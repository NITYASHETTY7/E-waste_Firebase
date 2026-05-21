# Auction Race Condition Resolution

This document details the technical implementation and architecture used to solve race conditions in the EcoLoop Auction System. Our system is designed to handle high-concurrency bidding (200+ concurrent users) while maintaining absolute data integrity.

## 1. The Problem
In a real-time auction, multiple bids for the same item can arrive at the server within milliseconds. Without proper handling, several issues can occur:
- **Overwriting Bids:** Two users bid $100 and $105 simultaneously. The $100 bid might be processed last, overwriting the $105 bid.
- **Double Bidding:** The same bid is processed twice due to network retries.
- **Winner Collision:** Two users are told they are the "Highest Bidder" at the same price.
- **Sniping Races:** A bid arrives exactly as the auction closes, leading to inconsistent winner state.

## 2. The Multi-Layered Defense Architecture

We implemented a **Defense-in-Depth** strategy with five distinct layers of protection.

### Layer 1: Idempotency Protection (Redis)
Every bid request from the client includes a unique `idempotencyKey` (UUID).
- **Mechanism:** Before processing, the server checks if this key exists in Redis.
- **Benefit:** If a network glitch causes the client to retry a request, the server recognizes the duplicate and ignores it, preventing "double-bidding."

### Layer 2: Distributed Locking (Redis)
To ensure that only one bid is processed for a specific auction at any given microsecond, we use a distributed lock.
- **Mechanism:** Using Redis `SET NX PX`, we acquire a mutex lock on the `auctionId`.
- **Retry Logic:** If a lock cannot be acquired immediately (contention), the system retries up to 10 times with a 50ms backoff.
- **Benefit:** Serializes all incoming bids for a single auction across multiple API instances.

### Layer 3: Validation & Business Rules
Inside the protected critical section, we perform rigorous checks:
- **Status Check:** Is the auction actually in `OPEN_PHASE`?
- **Time Check:** Is the current time within the start and end boundaries?
- **Account Status:** Is the vendor's account locked or restricted?
- **Shortlist Check:** Did the vendor pass the sealed-bid phase and get shortlisted?
- **Tick Size Check:** Is the new bid at least `current_bid + tick_size`?

### Layer 4: Optimistic Locking (Database/Prisma)
As a final fail-safe at the database level, we use a `version` column in the `Auctions` table.
- **Mechanism:** Every `UPDATE` statement includes `WHERE version = current_version`.
- **Benefit:** Even if the distributed lock were to fail, the database update will fail if another process changed the record in the interim. The `version` is incremented with every successful bid.

### Layer 5: Anti-Sniping (Auto-Extension)
To prevent "last-second sniping" from creating race conditions at the closing moment:
- **Mechanism:** If a valid bid is placed within the last `X` minutes (default 3), the auction's `openPhaseEnd` is automatically extended by another `X` minutes.
- **Limit:** This can happen up to a `maxTicks` limit to ensure auctions don't last forever.

## 3. Technical Implementation Summary

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Idempotency Store** | Redis (`idempotency:*`) | Prevents duplicate processing of the same request. |
| **Distributed Lock** | Redis (`lock:auction:*`) | Mutex to serialize bidding across workers. |
| **Leaderboard** | Redis (`leaderboard:*`) | High-speed ZSET for real-time ranking. |
| **Transactional DB** | PostgreSQL + Prisma | Atomic updates with ACID guarantees. |
| **Optimistic Lock** | `version` column | Final integrity check for concurrent writes. |
| **Anti-Sniping** | Dynamic `openPhaseEnd` | Dynamic timer extension to reduce closing pressure. |

## 4. Verification

We have implemented a specialized test suite to verify this resolution:
- **File:** `apps/api/src/auctions/race-condition.spec.ts`
- **Scenario:** 20 concurrent requests are fired at the exact same millisecond for the same auction with the same amount.
- **Result:** The system successfully accepts exactly **one** bid and rejects the other **19** with a `400 BadRequestException` (Bidding contention), maintaining a consistent state in the database.

---
*Created on May 21, 2026*
