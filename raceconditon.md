 
AUCTION SYSTEM
Race Condition Handling
A Complete Technical Reference
For Real-Time Concurrent Bidding at Scale

Designed for 200+ Concurrent Bidders
WebSockets  ·  Redis  ·  Message Queues  ·  Optimistic Locking  ·  Distributed Systems

Table of Contents



01
Introduction — The Problem of Concurrent Bidding

 
1.1  What Is a Race Condition?
A race condition occurs when two or more operations attempt to read and then write a shared resource at the same time, and the final outcome depends on the precise timing of their execution. In a standard single-user application this is never a concern because operations happen sequentially. In a real-time auction system serving 200 concurrent users, however, multiple bid submissions can arrive within microseconds of each other — and without careful design, they can corrupt the auction state.
 
✗
The Core Problem
Two bidders both read current_bid = $500. Both decide $550 is a valid new bid. Both submit $550 simultaneously. Without race-condition handling, both writes succeed — two people become the 'highest bidder' at the same price, or the lower-timestamped one silently overwrites a later valid bid.

 
1.2  Why Auctions Are Especially Vulnerable
Most web applications deal with user-specific data (your profile, your cart). Race conditions there are rare because users seldom edit the same record. Auctions are different: every bid targets the same shared row — the auction record — and 200 users may fire bids within the same 100-millisecond window during a heated closing phase.
The properties that make this uniquely hard are:
Read-modify-write pattern: every bid requires reading the current high bid, comparing, then writing if valid.
High contention: all bids go to one record per auction, not distributed across many rows.
Strict ordering requirement: the system must determine a definitive winner, no ties allowed.
Real-time feedback: rejected or accepted bids must be communicated to all clients within milliseconds.
Financial consequences: errors mean either a wrong winner or a revenue loss — both are unacceptable.
 
1.3  Scope of This Document
This document covers every layer of a production-grade auction system built to handle 200+ concurrent bidders without race conditions. It includes the networking layer (WebSockets), the serialization layer (Redis queues), the application logic (bid processor), the database layer (optimistic locking), and the broadcast layer (real-time updates). Code examples are provided in Node.js, SQL (PostgreSQL), and Redis commands throughout.
 
What This Document Covers
What It Does Not Cover
WebSocket connection management
UI/frontend bidding interfaces
Redis queue and atomic operations
Payment processing after auction close
Optimistic and pessimistic locking
User authentication systems
Bid validation logic
Auction item catalogue management
Broadcast architecture (pub/sub)
Analytics and reporting pipelines
Idempotency and duplicate protection
Mobile push notifications
Auction close race conditions
Multi-currency handling


02
System Architecture — The Complete Picture

 
2.1  The Five-Layer Architecture
A race-condition-safe auction system is built in five distinct layers, each with a single responsibility. Understanding how they connect is the key to understanding why the system works correctly under load.
 
  LAYER 5 — CLIENTS (200 browsers / mobile apps)
    │  WebSocket connections — each client has a persistent, bidirectional socket
    │
  LAYER 4 — GATEWAY (WebSocket Servers, load balanced)
    │  Authenticate JWT, rate-limit per user, deserialize bid payload
    │  Push bid event onto Redis Queue
    │
  LAYER 3 — QUEUE (Redis / BullMQ — FIFO per auction)
    │  Serializes all concurrent bids into an ordered sequence
    │  One consumer worker processes bids one at a time
    │
  LAYER 2 — BID PROCESSOR (Node.js worker)
    │  Acquires distributed lock  →  validates  →  writes atomically
    │  Optimistic lock on DB row prevents stale writes
    │
  LAYER 1 — DATABASE (PostgreSQL)
       Authoritative record of all bids and auction state
       Append-only bid_history table for full audit log

 
2.2  Data Flow for a Single Bid
When a user clicks 'Place Bid', the following sequence occurs. Each step is numbered and explained in detail in subsequent sections.
 
Client sends JSON payload over WebSocket: { auctionId, amount, userId, idempotencyKey }
Gateway server validates JWT, rate-limits (max 3 bids/second/user), and checks payload schema.
Valid bid is pushed onto Redis queue: LPUSH auction:{id}:bids {serialized payload}
Consumer worker picks up bid with BRPOP (blocking right-pop), processes one at a time.
Worker acquires a Redis distributed lock: SET lock:auction:{id} worker-uuid NX PX 5000
Worker reads current auction state from DB: current_bid, current_version, ends_at.
Validation: amount > current_bid AND NOW() < ends_at AND idempotency key not seen.
Atomic DB write: UPDATE auctions SET current_bid=$1, version=version+1 WHERE id=$2 AND version=$3
If version check fails (stale), retry the full cycle up to 3 times, then reject.
On success: release lock, publish new state to Redis Pub/Sub channel, persist to bid_history.
All gateway servers subscribed to the channel receive the update and push it to all connected clients.
 
2.3  Component Summary Table
 
Component
Technology
Role
Why Needed
WebSocket Server
ws / Socket.io + Node.js
Persistent client connections
Enables real-time push to all clients
Redis Queue
Redis LPUSH/BRPOP
Bid serialization
Prevents simultaneous processing
BullMQ
Node.js library over Redis
Worker and retry logic
Handles failures, retries, dead-letter
Distributed Lock
Redis SET NX PX
Per-auction mutex
Guards across multiple servers
PostgreSQL
Relational DB
Authoritative state
ACID guarantees on writes
Optimistic Lock
version column + WHERE
Stale write prevention
Catches any races that slip through
Redis Pub/Sub
PUBLISH / SUBSCRIBE
Broadcast to gateways
Fan-out to all connected clients
Idempotency Store
Redis SET with TTL
Duplicate detection
Safe retries without double-bids


03
Layer 4 — WebSocket Gateway

 
3.1  Why WebSockets, Not HTTP Polling
Traditional HTTP is request-response: the client asks, the server answers. For an auction, this means the client must repeatedly poll ("did anything change?") — adding latency, wasting bandwidth, and delaying bid notifications. WebSockets establish a persistent, full-duplex TCP connection, enabling the server to push updates instantly when a new bid is placed.
 
HTTP Polling (bad for auctions)
WebSocket (correct approach)
Client polls every 1–2 seconds
Server pushes instantly on state change
~500ms average notification delay
<10ms notification delay
200 clients = 200 req/sec to handle
200 clients = 200 persistent connections
High unnecessary DB reads
Reads only on actual events
Can miss updates between polls
Zero missed updates (connection-persistent)

 
3.2  Connection Management
Each incoming WebSocket connection is registered in a server-local map keyed by user ID. When the same user opens a second tab, both connections are stored. When a broadcast needs to reach all clients, the server iterates all connections.
 
// server/websocket/connectionManager.js
const connections = new Map();  // userId -> Set<WebSocket>
 
function register(userId, ws) {
  if (!connections.has(userId)) connections.set(userId, new Set());
  connections.get(userId).add(ws);
  ws.on('close', () => {
    connections.get(userId)?.delete(ws);
    if (connections.get(userId)?.size === 0) connections.delete(userId);
  });
}
 
function broadcast(auctionId, payload) {
  const message = JSON.stringify(payload);
  for (const [, sockets] of connections) {
    for (const ws of sockets) {
      if (ws.readyState === ws.OPEN) ws.send(message);
    }
  }
}
 
3.3  Rate Limiting Per User
Without rate limiting, a malicious or buggy client could flood the queue with thousands of bids per second, degrading the system for all other users. A token-bucket limiter per user is applied at the gateway before any bid reaches the queue.
 
// server/websocket/rateLimiter.js
const redis = require('./redisClient');
 
async function checkRateLimit(userId) {
  const key = `rl:${userId}`;
  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, 1); // 1-second window
  if (current > 3) {                              // max 3 bids/second/user
    throw new Error('RATE_LIMIT_EXCEEDED');
  }
}
 
ℹ
Rate Limit Design
3 bids per second per user is generous for human bidders (clicking faster than that is physically difficult) but protects against bots. For VIP or automated bidding APIs, this limit can be tuned per user tier.

 
3.4  JWT Authentication on the WebSocket Handshake
Authentication happens once — at connection time during the HTTP upgrade handshake. The client sends its JWT as a query parameter or in the Sec-WebSocket-Protocol header. If verification fails, the connection is rejected with 401 before the socket is established. All subsequent messages on that socket are trusted as belonging to the authenticated user.
 
// server/websocket/index.js
const wss = new WebSocketServer({ server });
 
wss.on('connection', async (ws, req) => {
  try {
    const token = new URL(req.url, 'http://x').searchParams.get('token');
    const { userId } = jwt.verify(token, process.env.JWT_SECRET);
    register(userId, ws);
 
    ws.on('message', async (raw) => {
      const bid = JSON.parse(raw);
      await checkRateLimit(userId);
      await enqueueBid({ ...bid, userId });
    });
  } catch (err) {
    ws.close(4001, 'Unauthorized');
  }
});

04
Layer 3 — The Redis Bid Queue

 
4.1  Why a Queue Is the Right Primitive
The fundamental insight behind safe concurrent auction systems is: you cannot prevent multiple bids from arriving simultaneously, but you can ensure they are processed one at a time. A queue is the tool for this. All bids — regardless of when they arrived — get appended to a list. A single worker reads from the tail of that list, blocking until a new item appears.
 
  Bidder A ────┐
  Bidder B ────┤  LPUSH  ──►  [bid_E | bid_D | bid_C | bid_B | bid_A]  ──►  BRPOP  ──►  Worker
  Bidder C ────┤                     Redis List (FIFO queue)                            (one at a time)
  Bidder D ────┤
  Bidder E ────┘
 
  All 200 bidders push concurrently.  Worker pops and processes sequentially.
  Queue depth absorbs the burst — no bid is lost, no two are processed simultaneously.

 
4.2  BullMQ: Production-Grade Queues on Redis
While raw Redis LPUSH/BRPOP works, BullMQ adds critical production features: automatic retries with exponential backoff, dead-letter queues for failed jobs, job deduplication by idempotency key, job event hooks for monitoring, and graceful shutdown handling. It is the recommended library for Node.js auction systems.
 
// server/queue/bidQueue.js
const { Queue, Worker } = require('bullmq');
const redis = { host: 'localhost', port: 6379 };
 
// Producer — called from WebSocket gateway
const bidQueue = new Queue('bids', { connection: redis });
 
async function enqueueBid(bid) {
  await bidQueue.add('place-bid', bid, {
    jobId: bid.idempotencyKey,   // deduplication: same key = ignored
    attempts: 3,                 // retry up to 3 times on transient failures
    backoff: { type: 'exponential', delay: 200 },
    removeOnComplete: 1000,      // keep last 1000 completed jobs for debugging
    removeOnFail: 500,
  });
}
 
4.3  The Consumer Worker
One worker per auction processes bids from the queue. The worker is deliberately single-concurrency (concurrency: 1) — this is the core serialization guarantee. Even if you spin up 10 worker processes, each auction's queue has exactly one active processor at a time.
 
// server/queue/bidWorker.js
const worker = new Worker('bids', processBid, {
  connection: redis,
  concurrency: 1,   // CRITICAL: process one bid at a time
});
 
worker.on('failed', (job, err) => {
  console.error(`Bid job ${job.id} failed: ${err.message}`);
  notifyUser(job.data.userId, { error: err.message });
});
 
worker.on('completed', (job) => {
  // Success notification already sent inside processBid
});
 
ℹ
Multiple Auction Rooms
In a real platform with many simultaneous auctions, each auction gets its own named queue: bids:auction-{id}. This allows true parallelism — auction A's queue processes independently of auction B's queue — while still serializing within each auction.

 
4.4  Queue Monitoring and Health
A healthy bid queue should have near-zero depth during normal operation — bids are enqueued and consumed faster than they arrive. Monitoring queue depth gives early warning of consumer slowdowns. If depth consistently exceeds 50, it signals the consumer is too slow and may need tuning or the worker needs to be scaled (more per-auction queues with dedicated consumers).
 
Metric
Healthy Range
Action if Exceeded
Queue depth (waiting jobs)
0–10
Investigate consumer slowdown or DB bottleneck
Job processing time
<100ms
Profile DB query, check lock contention
Failed job rate
<0.1%
Check DB connectivity, review validation logic
Job retry rate
<1%
Investigate optimistic lock conflicts
Dead-letter queue size
0
Manual review — bids that failed all retries


05
Layer 2 — The Bid Processor

 
5.1  The Distributed Lock
Even with a single-concurrency queue worker, in a multi-server deployment multiple worker processes could theoretically pick up bids from different queue instances pointing at the same auction. The distributed lock is a second line of defence: before processing any bid, the worker must acquire a Redis lock scoped to the auction ID. Only one holder of this lock can proceed at a time, across all servers.
 
// server/processor/distributedLock.js
const lockTTL = 5000; // 5 seconds — auto-expires if worker crashes
 
async function acquireLock(auctionId, workerId) {
  const key = `lock:auction:${auctionId}`;
  // NX = set only if Not eXists; PX = TTL in milliseconds
  const result = await redis.set(key, workerId, 'NX', 'PX', lockTTL);
  return result === 'OK'; // true = acquired, false = already locked
}
 
async function releaseLock(auctionId, workerId) {
  // Lua script: only delete if WE are the holder (atomic check+delete)
  const script = `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
      return redis.call('DEL', KEYS[1])
    else return 0 end`;
  await redis.eval(script, 1, `lock:auction:${auctionId}`, workerId);
}
 
⚠
Why Lua for Lock Release?
The check-then-delete operation must be atomic. If we used two separate commands (GET then DEL), another process could acquire the lock between our GET and our DEL, and we would accidentally delete their lock. The Lua script runs atomically in Redis — it cannot be interrupted.

 
5.2  Full Bid Processing Logic
The processBid function is the heart of the system. It orchestrates the lock, validation, database write, and broadcast in a single transactional unit.
 
// server/processor/processBid.js
async function processBid(job) {
  const { auctionId, userId, amount, idempotencyKey } = job.data;
  const workerId = `worker-${process.pid}-${Date.now()}`;
  let lockAcquired = false;
 
  try {
    // 1. Check idempotency — reject duplicate bids
    const seen = await redis.set(
      `idem:${idempotencyKey}`, '1', 'NX', 'PX', 86400000 // 24h TTL
    );
    if (!seen) throw new Error('DUPLICATE_BID');
 
    // 2. Acquire distributed lock (retry up to 10x with 50ms backoff)
    for (let i = 0; i < 10; i++) {
      lockAcquired = await acquireLock(auctionId, workerId);
      if (lockAcquired) break;
      await sleep(50);
    }
    if (!lockAcquired) throw new Error('LOCK_TIMEOUT');
 
    // 3. Read current auction state
    const auction = await db.query(
      'SELECT current_bid, version, ends_at FROM auctions WHERE id = $1',
      [auctionId]
    );
 
    // 4. Validate bid
    if (Date.now() > auction.ends_at) throw new Error('AUCTION_ENDED');
    if (amount <= auction.current_bid) throw new Error('BID_TOO_LOW');
    if (amount < auction.current_bid + auction.min_increment)
      throw new Error('BELOW_MIN_INCREMENT');
 
    // 5. Atomic write with optimistic lock (version check)
    const result = await db.query(`
      UPDATE auctions
      SET current_bid = $1, current_bidder = $2, version = version + 1,
          updated_at = NOW()
      WHERE id = $3 AND version = $4
      RETURNING id, current_bid, version`,
      [amount, userId, auctionId, auction.version]
    );
 
    // 6. Handle version conflict
    if (result.rowCount === 0) throw new Error('VERSION_CONFLICT');
 
    // 7. Record in bid history (append-only audit log)
    await db.query(
      'INSERT INTO bid_history (auction_id, user_id, amount, created_at) VALUES ($1,$2,$3,NOW())',
      [auctionId, userId, amount]
    );
 
    // 8. Broadcast success to all connected clients
    await redis.publish(`auction:${auctionId}`, JSON.stringify({
      type: 'BID_ACCEPTED',
      auctionId,
      newHighBid: amount,
      bidderId: userId,
      version: result.rows[0].version
    }));
 
    notifyUser(userId, { type: 'YOUR_BID_ACCEPTED', amount });
 
  } catch (err) {
    handleBidError(userId, err);
    if (err.message === 'VERSION_CONFLICT') throw err; // trigger BullMQ retry
  } finally {
    if (lockAcquired) await releaseLock(auctionId, workerId);
  }
}
 
5.3  Error Handling Matrix
Every possible failure mode in bid processing has a defined response. The table below maps each error to its cause, the action taken, and what the user sees.
 
Error Code
Cause
System Action
User Notification
DUPLICATE_BID
Same idempotency key seen before
Silently drop
No message (intentional — safe retry)
RATE_LIMIT_EXCEEDED
User bidding >3/sec
Reject at gateway
"Slow down — too many bids"
LOCK_TIMEOUT
Lock held >500ms by another worker
Fail job → BullMQ retry
Retry transparent to user
AUCTION_ENDED
Bid arrived after ends_at
Reject immediately
"Auction has closed"
BID_TOO_LOW
Amount ≤ current high bid
Reject immediately
"Your bid was too low" + current price
BELOW_MIN_INCREMENT
Below minimum raise amount
Reject immediately
"Minimum increment is $X"
VERSION_CONFLICT
Stale read — another bid committed first
Throw → BullMQ retries job
Retry transparent; fails gracefully after 3x
DB_ERROR
PostgreSQL connection failure
Fail job → retry
"System error, please try again"


06
Layer 1 — The Database (Optimistic Locking)

 
6.1  The Auctions Table Schema
The schema is designed with race conditions in mind. The version column is the optimistic lock key. The bid_count is maintained for analytics. Constraints are enforced at the DB level as a final safety net.
 
-- PostgreSQL schema
CREATE TABLE auctions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  starting_bid    NUMERIC(12,2) NOT NULL,
  current_bid     NUMERIC(12,2) NOT NULL,
  current_bidder  UUID REFERENCES users(id),
  min_increment   NUMERIC(12,2) NOT NULL DEFAULT 1.00,
  starts_at       TIMESTAMPTZ NOT NULL,
  ends_at         TIMESTAMPTZ NOT NULL,
  version         INTEGER NOT NULL DEFAULT 0,  -- optimistic lock key
  bid_count       INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('scheduled','open','closing','closed','cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
 
-- Append-only bid history (never update, only insert)
CREATE TABLE bid_history (
  id          BIGSERIAL PRIMARY KEY,
  auction_id  UUID NOT NULL REFERENCES auctions(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  amount      NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
 
-- Index for fast latest-bid queries
CREATE INDEX idx_bid_history_auction ON bid_history(auction_id, created_at DESC);
 
6.2  How Optimistic Locking Works
Optimistic locking does not use database-level row locks. Instead it uses a version number to detect if the row was modified between the time you read it and the time you write to it. If another transaction incremented the version in that window, your WHERE clause matches nothing and you know a conflict occurred.
 
  Time →
 
  Worker A reads:  version=5, current_bid=$500
  Worker B reads:  version=5, current_bid=$500    (same snapshot!)
 
  Worker A writes: UPDATE ... SET current_bid=$550, version=6 WHERE version=5
  ✓ Rows affected: 1   ← success, version is now 6
 
  Worker B writes: UPDATE ... SET current_bid=$550, version=6 WHERE version=5
  ✗ Rows affected: 0   ← CONFLICT — version is already 6, WHERE version=5 matches nothing
  Worker B throws VERSION_CONFLICT → BullMQ retries with a fresh read → re-validates

 
6.3  The Atomic Update Query in Detail
The single SQL statement that performs the bid update is carefully constructed to be a one-shot read-check-write. It does not require a transaction with a separate SELECT first because the check is embedded in the WHERE clause.
 
UPDATE auctions
SET
  current_bid    = $1,          -- the new bid amount
  current_bidder = $2,          -- the winning user ID
  version        = version + 1, -- increment: next writer must match this new version
  bid_count      = bid_count + 1,
  updated_at     = NOW()
WHERE
  id             = $3           -- target auction
  AND version    = $4           -- optimistic lock check
  AND current_bid < $1          -- double-check: still the highest bid
  AND ends_at    > NOW()        -- double-check: auction still open
RETURNING id, current_bid, version, ends_at;
 
-- If rowCount = 0: either version mismatch, bid too low, or auction closed.
-- The application layer distinguishes these by re-reading if needed.
 
✓
Defence in Depth
Notice the WHERE clause includes AND current_bid < $1 AND ends_at > NOW() even though these were checked in application code. This is intentional — DB constraints are the last line of defence. If a bug in application logic passes an invalid bid, the DB rejects it.

 
6.4  Optimistic vs Pessimistic Locking — When to Use Which
Both locking strategies can prevent race conditions. The choice depends on your expected contention level and latency requirements.
 
Optimistic Locking
Pessimistic Locking (SELECT FOR UPDATE)
No DB locks held during processing
Locks row for duration of transaction
Better throughput at low-to-medium contention
Better for very high contention (>50% conflict rate)
Failed bids require retry logic
Failed bids queue at the DB level automatically
Works well with external Redis queue
Works without a queue (DB is the serializer)
Recommended for ≤200 concurrent bidders
Consider if >500 concurrent bidders on one auction
version column + WHERE version=N pattern
BEGIN; SELECT ... FOR UPDATE; UPDATE; COMMIT;


07
Layer 4B — Broadcasting Updates to All Clients

 
7.1  The Pub/Sub Architecture
Once a bid is accepted and committed to the database, every connected client — across all WebSocket servers — must be notified immediately. Redis Pub/Sub provides a simple, fast message bus for this. Each WebSocket server subscribes to a channel per auction. When the bid processor publishes a new high bid, all servers receive it and push it to their connected clients.
 
  [Bid Processor]
       │
       │  PUBLISH auction:abc123  '{type:BID_ACCEPTED, amount:550, bidder:xyz}'
       ▼
  [Redis Pub/Sub]
       │
       ├──────────────────────┬──────────────────────┐
       ▼                      ▼                      ▼
  [WS Server 1]          [WS Server 2]          [WS Server 3]
  SUBSCRIBE auction:abc   SUBSCRIBE auction:abc   SUBSCRIBE auction:abc
       │                      │                      │
   push to 68 clients     push to 71 clients     push to 61 clients
                                                       = 200 clients notified

 
7.2  The Subscriber Setup on Each Gateway Server
 
// server/pubsub/subscriber.js
const subscriber = redis.duplicate(); // separate Redis connection for subscriptions
 
subscriber.on('message', (channel, message) => {
  const auctionId = channel.replace('auction:', '');
  const payload = JSON.parse(message);
  broadcast(auctionId, payload); // push to all local WebSocket clients
});
 
// Called when a client joins an auction room
function subscribeToAuction(auctionId) {
  subscriber.subscribe(`auction:${auctionId}`);
}
 
// Called when all clients leave an auction room
function unsubscribeFromAuction(auctionId) {
  subscriber.unsubscribe(`auction:${auctionId}`);
}
 
7.3  Message Types and Payloads
The broadcast channel carries several message types beyond just new bids. All messages are JSON with a type discriminator field.
 
Message Type
Trigger
Payload Fields
BID_ACCEPTED
New highest bid committed
auctionId, newHighBid, bidderId, version, timestamp
BID_REJECTED
Sent only to the bidder
auctionId, reason, currentHighBid
AUCTION_EXTENDED
Bid in final 30s extends closing time
auctionId, newEndsAt
AUCTION_CLOSING
60 seconds remaining
auctionId, endsAt, secondsLeft
AUCTION_CLOSED
ends_at reached with no extension
auctionId, winnerId, finalBid
PRICE_UPDATE
Any bid change (summary)
auctionId, price, bidCount, timeLeft


08
Idempotency — Safe Retries Without Double Bids

 
8.1  The Problem with Network Retries
WebSocket connections can drop. The client might reconnect and resend a bid that was already processed but whose acknowledgment was lost in transit. Without idempotency protection, the same bid amount would be processed twice — once legitimately and once as a duplicate — creating a second entry in bid_history and potentially overwriting a higher bid placed in between.
 
8.2  The Idempotency Key
Every bid payload includes a client-generated idempotency key — a UUID the client creates once per bid attempt. Even if the network drops and the client retransmits the same bid, the server recognizes the key as already processed and ignores the duplicate.
 
// CLIENT SIDE — generate key once, reuse on retries
function placeBid(auctionId, amount) {
  const idempotencyKey = crypto.randomUUID(); // generate once
  const payload = { auctionId, amount, idempotencyKey };
 
  const sendWithRetry = () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    } else {
      ws.addEventListener('open', () => ws.send(JSON.stringify(payload)), { once: true });
    }
  };
 
  sendWithRetry(); // initial send
  // On reconnect, sendWithRetry() is called again with SAME payload and key
  // Server will silently ignore the second attempt
}
 
8.3  Server-Side Idempotency Store
The server records every processed idempotency key in Redis with a 24-hour TTL. The SET NX (set if Not eXists) command atomically checks and records in a single operation — if the key is already stored, the bid is dropped immediately before any processing.
 
// SERVER SIDE — idempotency check in processBid
const idempKey = `idem:${idempotencyKey}`;
const isNew = await redis.set(idempKey, '1', 'NX', 'PX', 86400000);
 
// isNew === 'OK'   → first time we see this key → proceed
// isNew === null   → key exists → duplicate bid → silently drop
if (!isNew) {
  console.log(`Duplicate bid ignored: ${idempotencyKey}`);
  return; // exit without processing — no error to client
}
 
ℹ
Idempotency vs De-duplication
Idempotency means processing the same operation multiple times has the same effect as processing it once. De-duplication just means detecting duplicates. Here we need both: detect the duplicate AND not return an error to the client (so the client does not need special retry handling).


09
The Auction Close Race Condition

 
9.1  The Problem
The auction closing moment is the most race-condition-prone instant in the entire system. In the last few seconds, bid volume spikes dramatically as users rush to place last-minute bids. Meanwhile, a separate closing process is watching the clock and preparing to mark the auction as closed. Without careful handling, a bid and a close event can collide.
 
  T=0.000s  ends_at reached — closing job starts
  T=0.005s  Bidder A submits a bid (was initiated before ends_at)
  T=0.010s  Bid A enters queue
  T=0.020s  Closing job reads auction: status=open  ← about to close
  T=0.025s  Bid A processor reads auction: status=open, valid!
  T=0.030s  Bid A writes new high bid successfully
  T=0.035s  Closing job writes status=closed, winner=previous_bidder
 
  RESULT: Bid A won but the system recorded the previous bidder as winner!

 
9.2  Soft-Close / Anti-Sniping Extension
The cleanest solution to close-time races combines two techniques: a hard close at the DB level (status change is atomic and versioned), and an anti-sniping rule that extends the auction by 30 seconds whenever a bid arrives in the final 60 seconds. This is standard practice on Ebay, Sotheby's online, and most professional auction platforms.
 
// In processBid — after successful DB write
const secondsLeft = (auction.ends_at - Date.now()) / 1000;
if (secondsLeft < 60) {
  // Anti-snipe: extend auction by 30 seconds
  await db.query(
    `UPDATE auctions SET ends_at = ends_at + INTERVAL '30 seconds'
     WHERE id = $1 AND status = 'open'`,
    [auctionId]
  );
  await redis.publish(`auction:${auctionId}`, JSON.stringify({
    type: 'AUCTION_EXTENDED',
    auctionId,
    extraSeconds: 30
  }));
}
 
9.3  The Closing Job — Atomic Status Transition
The closing job runs on a scheduler (cron every second, or a Redis sorted set expiry trigger). It uses the same optimistic locking pattern to atomically transition the status only if the auction is still open — preventing double-closes and respecting any extensions.
 
// server/jobs/closeAuctions.js
async function closeExpiredAuctions() {
  // Find auctions past their end time that are still open
  const expired = await db.query(`
    SELECT id, current_bidder, current_bid, version
    FROM auctions
    WHERE ends_at <= NOW() AND status = 'open'
    FOR UPDATE SKIP LOCKED`  // skip any row locked by another process
  );
 
  for (const auction of expired.rows) {
    const result = await db.query(`
      UPDATE auctions
      SET status = 'closed', closed_at = NOW()
      WHERE id = $1 AND status = 'open' AND version = $2
      RETURNING id, current_bidder, current_bid`,
      [auction.id, auction.version]
    );
    if (result.rowCount > 0) {
      await redis.publish(`auction:${auction.id}`, JSON.stringify({
        type: 'AUCTION_CLOSED',
        auctionId: auction.id,
        winnerId: result.rows[0].current_bidder,
        finalBid: result.rows[0].current_bid,
      }));
    }
  }
}

10
Scaling to 200+ Concurrent Bidders

 
10.1  Load Calculation
Before designing for scale, quantify the actual load. 200 concurrent bidders does not mean 200 simultaneous bid submissions at all times — but during the final 60 seconds of a popular auction, that is exactly what happens.
 
Phase
Expected Bid Rate
Queue Depth
Normal bidding (early)
1–5 bids/second total
<5 jobs waiting
Active bidding (middle)
10–30 bids/second total
5–20 jobs waiting
Final minute (closing)
50–150 bids/second total
20–100 jobs waiting
Last 10 seconds (peak)
100–200 bids/second total
50–200 jobs waiting

 
10.2  Horizontal Scaling the WebSocket Gateway
WebSocket servers are stateless (per-connection state is in Redis, not server memory) and can be scaled horizontally behind a load balancer. The load balancer must use sticky sessions (IP hash or cookie) for the WebSocket upgrade handshake, but once connected, the Pub/Sub ensures each server can push to its own clients independently.
 
10.3  Redis as the Single Point of Truth for Live State
The database is the authoritative record but is too slow (typically 5–20ms per query) to serve every client update. Redis caches the current live state of each auction and is updated atomically alongside every DB write. Clients that need the current price poll Redis (sub-millisecond), not PostgreSQL.
 
// After every successful bid write, update Redis cache atomically
const pipeline = redis.pipeline();
pipeline.hset(`auction:${auctionId}:live`, {
  current_bid: amount,
  current_bidder: userId,
  bid_count: auction.bid_count + 1,
  version: auction.version + 1,
  updated_at: Date.now()
});
pipeline.expire(`auction:${auctionId}:live`, 86400); // 24h TTL
await pipeline.exec();
 
10.4  Benchmark Summary — Expected Latencies
 
Operation
Expected Latency (p99)
Notes
WebSocket message receipt
<5ms
Network + deserialization
Rate limit check (Redis)
<2ms
Single INCR command
Queue push (Redis LPUSH)
<3ms
Sub-millisecond + network
Lock acquisition (Redis SET NX)
<3ms
Retry adds 50ms per attempt
Bid validation (DB read)
5–15ms
Indexed single-row read
Atomic DB write (UPDATE)
8–25ms
Single statement, no transaction
Pub/Sub publish (Redis)
<2ms
Fire and forget
Client notification received
10–50ms total
Sum of all above steps


11
Testing for Race Conditions

 
11.1  The 200-Concurrent-Bidders Test
The only way to be confident race conditions are handled is to deliberately create them in a test environment. The test below fires 200 simultaneous bid requests at the same auction and verifies that exactly one wins.
 
// tests/race-condition.test.js
const WebSocket = require('ws');
 
test('200 simultaneous bids result in exactly one winner', async () => {
  const auctionId = await createTestAuction({ startBid: 100 });
  const results = [];
 
  // Fire 200 concurrent WebSocket bids
  await Promise.all(
    Array.from({ length: 200 }, async (_, i) => {
      const ws = new WebSocket(`ws://localhost:3000?token=${tokens[i]}`);
      await new Promise(r => ws.on('open', r));
      ws.send(JSON.stringify({
        auctionId,
        amount: 150,  // all bid the same amount
        idempotencyKey: crypto.randomUUID()
      }));
      ws.on('message', (msg) => {
        results.push(JSON.parse(msg));
        ws.close();
      });
    })
  );
 
  await sleep(2000); // allow all processing
 
  const accepted = results.filter(r => r.type === 'YOUR_BID_ACCEPTED');
  const rejected = results.filter(r => r.type === 'BID_REJECTED');
 
  expect(accepted.length).toBe(1);      // exactly one winner
  expect(rejected.length).toBe(199);    // all others cleanly rejected
  expect(await getAuctionVersion(auctionId)).toBe(1); // one write committed
}, 30000);
 
11.2  Test Scenarios Checklist
 
Scenario
What to Verify
Pass Condition
Priority
200 simultaneous equal bids
Exactly 1 accepted, 199 rejected
rowCount in DB = 1
Critical
Bid arrives 1ms after close
Bid rejected, auction stays closed
status unchanged
Critical
Duplicate idempotency key
Second bid silently ignored
bid_history rows = 1
High
Worker crash mid-processing
Job retried, no double-write
bid_count correct
High
Redis unavailable for 500ms
Graceful degradation, no data loss
All bids queued
High
Network drop during bid ACK
Client resends, duplicate ignored
Only one DB write
High
Bid exactly at min increment
Accepted
Success response
Medium
Bid 1 cent below min increment
Rejected with clear message
BELOW_MIN_INCREMENT
Medium
Anti-snipe: bid in final 30s
Auction extended 30 seconds
ends_at += 30s
Medium
User rate limit exceeded
4th bid in 1s rejected at gateway
RATE_LIMIT_EXCEEDED
Medium


12
Monitoring, Observability & Operations

 
12.1  Key Metrics to Watch
A race condition that slips through in production often shows up first in metrics before users report it. The following metrics should be dashboarded and alerted on.
 
Metric
Instrument From
Alert Threshold
What It Signals
bid_accepted_rate
processBid success count
Drop >50% in 60s
Queue or DB issue
version_conflict_rate
VERSION_CONFLICT errors / total
>5% over 60s
High contention or slow consumer
queue_depth
BullMQ waiting count
>200 jobs
Consumer too slow
lock_wait_time_ms
Lock retry count × 50ms
p99 >500ms
Lock held too long or deadlock
bid_e2e_latency_ms
WS receive → client notify
p99 >500ms
Overall system slowdown
ws_connections_active
connectionManager size
Alert on sharp drops
Mass disconnect event
failed_jobs_total
BullMQ failed queue size
>10 per minute
Persistent processing errors

 
12.2  Structured Logging
Every bid processing attempt should emit a structured log line with all fields needed to reconstruct the sequence of events for any auction. This is critical for post-incident investigation.
 
// Log every bid outcome — success or failure
logger.info({
  event: 'bid_processed',
  auctionId,
  userId,
  amount,
  outcome: 'ACCEPTED' | 'REJECTED' | 'CONFLICT' | 'DUPLICATE',
  version_before: auction.version,
  version_after: result?.version,
  lock_wait_ms,
  db_write_ms,
  total_ms: Date.now() - startTime,
  idempotencyKey,
  attempt: job.attemptsMade,
});

13
Summary — The Complete Race Condition Defence

 
13.1  Defence Layers Summary
A production auction system handling 200 concurrent bidders uses multiple overlapping defences. No single technique is sufficient; they work together as a layered system.
 
Layer
Technique
What Race Condition It Prevents
Gateway
Rate limiting (3 bids/sec/user)
Flood attacks overloading the queue
Gateway
JWT auth on connection handshake
Unauthenticated bids injecting bad data
Queue
Single-concurrency Redis worker
Two bids processing simultaneously
Queue
Idempotency key deduplication
Retransmitted bids counted twice
Processor
Distributed Redis lock
Two workers on different servers colliding
Database
Optimistic locking (version column)
Stale read committed after fresher write
Database
WHERE current_bid < $1 in UPDATE
Lower bid overwriting a higher one
Database
WHERE ends_at > NOW() in UPDATE
Bid accepted after auction closes
Closing job
FOR UPDATE SKIP LOCKED
Two closing jobs processing same auction
Closing job
Anti-snipe 30-second extension
Last-second bids arriving after close signal

 
13.2  Implementation Priority Order
If you are building this system incrementally, implement defences in this order — each one gives you the most safety for the least complexity at each stage.
 
Optimistic locking (version column + WHERE) — the most important single change. Prevents incorrect winners.
Redis queue with single-concurrency worker — eliminates simultaneous processing. Replaces naive direct DB writes.
Idempotency keys — protects against network retries creating duplicate bids.
Distributed lock — second line of defence for multi-server deployments.
Rate limiting — protects queue from flood and user experience from accidental double-clicks.
Anti-snipe extension — fair closing experience, eliminates last-millisecond sniping.
Structured logging and metrics — you cannot fix what you cannot see.
 
✓
The Golden Rule
The core principle of race-condition-safe auction systems: serialize writes to shared auction state. Every other technique in this document is a layer of defence around this principle. No two bids should ever be in the 'check-and-write' phase simultaneously for the same auction.

 
 
End of Document
Auction System — Race Condition Handling Reference
