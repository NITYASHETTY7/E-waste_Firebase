# EcoLoop (We Connect) — Comprehensive Master Architecture & Business Plan

**Version:** 2.0 (Elaborated for All Stakeholders)  
**Prepared:** April 2026  
**Tech Stack Decision:** Next.js (Frontend) + Node.js/NestJS (API) + PostgreSQL RDS + S3  
**Target Audience:** Developers, Product Managers, Compliance Officers, Sales/Marketing Teams, and Business Stakeholders.

---

## 📖 Executive Summary
*(For Business Stakeholders, Investors & Sales)*

**EcoLoop (also acting as "We Connect")** is a highly transparent, B2B & B2C E-Waste Aggregator and Auction Platform. The problem with current e-waste disposal is a lack of transparency, low price realization for sellers, and immense compliance risks. 

Our solution provides a digital marketplace where Corporate Clients can upload their e-waste scrap, and verified Vendor Recyclers can compete in a highly secure, real-time bidding environment to purchase it. This platform not only ensures the seller gets the maximum value (5-20% higher revenue) but also guarantees that strictly audited, legal compliance documents (E-Waste Certificates, Data Destruction Certs) are automatically generated and tracked.

---

## Table of Contents

1. [Understanding the Users (Personas)](#1-understanding-the-users-personas)
2. [System Overview & Workflows](#2-system-overview--workflows)
3. [Tech Stack & Tooling Explained](#3-tech-stack--tooling-explained)
4. [Monorepo Structure (Developer Guide)](#4-monorepo-structure-developer-guide)
5. [Infrastructure & Cloud Design](#5-infrastructure--cloud-design)
6. [Database Schema (Data Architecture)](#6-database-schema-data-architecture)
7. [S3 Bucket Structure (Compliance & Storage)](#7-s3-bucket-structure-compliance--storage)
8. [API Layer Design](#8-api-layer-design)
9. [Authentication & Security Access](#9-authentication--security-access)
10. [The Core: Auction & Bidding Engine](#10-the-core-auction--bidding-engine)
11. [Document & Compliance Management](#11-document--compliance-management)
12. [Background Jobs (Automation)](#12-background-jobs-automation)
13. [Real-time Events (Live Bidding Tech)](#13-real-time-events-live-bidding-tech)
14. [Notification & Communication Channels](#14-notification--communication-channels)
15. [Caching Strategy (Performance Optimization)](#15-caching-strategy-performance-optimization)
16. [Third-party Integrations Map](#16-third-party-integrations-map)
17. [Overall Security Architecture](#17-overall-security-architecture)
18. [Local Development Setup](#18-local-development-setup)
19. [Environment Configuration](#19-environment-configuration)
20. [Future Scope (AI & Mobile Apps)](#20-future-scope-ai--mobile-apps)
21. [Visual Data Flow Diagrams](#21-visual-data-flow-diagrams)

---

## 1. Understanding the Users (Personas)
*(For Product Managers & UI/UX Designers)*

To build a system everyone loves, we must understand who is using it. EcoLoop is divided into four main roles, each getting their own specialized "Dashboard" view:

1. **The Admin (We Connect Operations):** 
   - **Goal:** Monitor everything, ensure users are who they say they are, and resolve disputes.
   - **What they see:** A "God-view" dashboard showing total revenue, active/completed auctions, vendor registrations pending approval, and compliance tracking.
   
2. **The Client (Corporates, IT Firms, Manufacturers):**
   - **Goal:** Dispose of their e-waste legally, easily, and for the highest possible profit.
   - **What they see:** A dashboard to "Create an Auction Lot", upload scrap photos, monitor bids safely, select a winner, and download their legal recycling certificates.
   
3. **The Vendor (Authorized CPCB Recyclers & Buyers):**
   - **Goal:** Find continuous, reliable streams of scrap e-waste to process and profit from.
   - **What they see:** A marketplace dashboard to find available scrap, place blind "Sealed Bids", join the high-adrenaline "Live Auction", pay EMD (Earnest Money Deposits), and upload compliance proofs.
   
4. **The Individual User (B2C / Citizens):**
   - **Goal:** Dispose of an old fridge or laptop cleanly.
   - **What they see:** A simple 3-step form to request a pickup, get a base quote, and track the truck.

---

## 2. System Overview & Workflows
*(For the General Team)*

The software works in a smooth **6-Step Pipeline**:
1. **Onboarding:** Clients and Vendors sign up. Vendors MUST upload legal licenses (GST, PAN, Pollution Control Board Auth). The Admin approves them.
2. **Lot Creation:** A Client takes pictures of 500 laptops, fills out the details, sets a base minimum price, and launches a "Lot".
3. **Sealed Bid Phase:** Vendors see the Lot. They submit a single, hidden "Blind Bid" to secure a spot. No vendor knows what the others bid.
4. **Open Auction Phase (The Exciting Part):** The auction goes "Live". A 3-minute timer starts. The highest sealed bid becomes the starting price. Vendors rapidly outbid each other in real-time. If a bid happens in the last 3 minutes, the timer extends by 3 minutes (up to 24 times) to prevent last-second sniping.
5. **Winner Selection:** The timer runs out. The Client chooses the winner (usually the highest bidder). 
6. **Post-Auction Compliance:** The Vendor sends a truck. A "Pickup Challan" is uploaded. The final weight is matched. The Vendor processes the waste and uploads a final "E-Waste Recycling Certificate", keeping everyone legally safe.

---

## 3. Tech Stack & Tooling Explained
*(For Developers, Architects & CTOs)*

We chose technologies that balance blazing-fast performance with deep security.

### Frontend (What the user sees & clicks)
- **Next.js (App Router):** The overarching framework. We use it because it makes web pages load instantly using Server-Side Rendering (SSR), which is excellent for marketing SEO and user experience.
- **Tailwind CSS & shadcn/ui:** For designing beautiful, clean, corporate UI features quickly without writing thousands of lines of custom CSS styles.
- **Socket.io Client:** The magical cord that connects the user's browser to the server for the Live Auction module, ensuring that when someone bids, everyone else sees it instantly without refreshing the page.

### Backend (The brain & rules engine)
- **Node.js & NestJS:** Node.js is the runtime, and NestJS is a heavily structured framework ensuring our code stays clean and scalable as the team grows.
- **Prisma (ORM):** Translates our TypeScript code into safe Database queries. It acts as a safety blanket preventing developers from breaking the database.

### Infrastructure (Where the app lives)
- **PostgreSQL:** Our secure, main relational database. It stores users, bids, and financial records perfectly safely.
- **Redis:** Our ultra-fast, temporary memory bank. Used to store exactly how many seconds are left on a live auction timer so the database doesn't crash from thousands of rapid checks.
- **Amazon S3:** The "Digital Vault" where we store deeply sensitive files (PAN cards, legal certificates).

---

## 4. Monorepo Structure (Developer Guide)
*(For Developers)*

We use a Monorepo strategy (all code in one giant folder, split into "apps").

```text
ecoloop-app/
├── apps/
│   ├── web/                          ← The Frontend
│   │   ├── app/
│   │   │   ├── (auth)/               ← Login & Onboarding flows
│   │   │   ├── (admin)/              ← Admin Dashboard
│   │   │   ├── (client)/             ← Corporate Flow (Post Scrap, Track)
│   │   │   ├── (vendor)/             ← Recycler Flow (Bid, EMD, Win)
│   │   │   └── page.tsx              ← The Public Homepage (Marketing)
│   │   └── components/
│   │       ├── ui/                   ← Buttons, Cards, Inputs
│   │       └── auction/              ← Live Bidding UI, Timers, Tickers
│   │
│   └── api/                          ← The Backend API (NestJS)
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/             ← Registration & Security
│       │   │   ├── kyc/              ← GST, PAN, License validation
│       │   │   ├── auctions/         ← Lot Creation, Master logic
│       │   │   ├── bids/             ← Bid Engine, Sealed vs Open Logic
│       │   │   ├── documents/        ← Certificate generation logic
│       │   │   └── reports/          ← EPR Tracking, Analytics exports
│       │   └── database/prisma/      ← The Database Schema
│
└── package.json                      ← Shared dependencies
```

---

## 5. Infrastructure & Cloud Design
*(For DevOps Ops & Business Scalability)*

How we prevent the site from going offline when 1,000 vendors are bidding on 50 auctions simultaneously.

1. **The Web Traffic:** Users hit our `Vercel` hosted website edge-nodes. It loads in milliseconds globally.
2. **The API Servers:** Data requests go to scalable `AWS ECS / Fargate` or `Render` nodes. If traffic spikes during a massive corporate auction, the cloud spins up extra servers automatically to handle the sheer number of bids.
3. **The Database Protection:** We utilize a PostgreSQL instance with automated daily backups up to 35 days, meaning no business or bidding data is ever permanently lost.
4. **WebSocket Segregation:** Live sockets pass through `Redis Pub/Sub` ensuring that even if user A is connected to Server 1, and user B is connected to Server 2, they see the same bids instantly.

---

## 6. Database Schema (Data Architecture)
*(Detailed for Engineers)*

A highly relational structure focusing on the interconnected nature of Auctions, Vendors, and Documents.

```prisma
// Using Prisma ORM

// ALL ROLES
enum UserRole {
  ADMIN
  CLIENT
  VENDOR
  USER
}

// THE LIFE OF AN AUCTION
enum AuctionStatus {
  DRAFT
  PENDING_APPROVAL
  UPCOMING          // Scheduled, waiting to begin
  SEALED_PHASE      // Accepting hidden blind bids
  OPEN_PHASE        // Active Live Bidding
  PENDING_SELECTION // Auction over, waiting for Client to click 'Accept'
  COMPLETED         // Winner selected, moving strictly to Compliance Phase
  CANCELLED
}

// COMPLIANCE DOCUMENTS MATTRIX
enum DocumentType {
  GST_CERTIFICATE
  PAN_CARD
  PCB_AUTHORIZATION
  EPR_AUTHORIZATION
  WORK_ORDER
  INVOICE
  PICKUP_CHALLAN
  RECYCLING_CERTIFICATE
  DATA_DESTRUCTION_CERT
}

// 1. COMPANY (The central entity)
model Company {
  id                  String         @id @default(cuid())
  companyName         String
  gstNumber           String?
  panNumber           String?
  
  isVendor            Boolean        @default(false)
  isClient            Boolean        @default(false)
  status              String         @default("PENDING") // PENDING, APPROVED, BLOCKED
  
  users               User[]
  documents           Document[]
  auctionsAsClient    Auction[]      @relation("ClientAuctions")
  wonAuctions         Auction[]      @relation("VendorAuctions")
}

// 2. AUCTION (The product)
model Auction {
  id              String           @id @default(cuid())
  title           String
  category        String           // e.g., IT_TELECOM, BATTERIES
  totalWeight     Float            // in Kg/Tons
  location        String
  
  status          AuctionStatus    @default(DRAFT)
  
  basePrice       Float?           // Minimum acceptable starting price
  emdAmount       Float?           // Money required to participate
  tickSize        Float?           // How much a bid must beat the last bid by
  
  sealedPhaseEnd  DateTime?        
  openPhaseStart  DateTime?
  openPhaseEnd    DateTime?        // Extends dynamically
  extensionCount  Int              @default(0) // Max 24 per rules
  
  clientId        String
  client          Company          @relation("ClientAuctions", fields: [clientId], references: [id])
  
  winnerId        String?
  winner          Company?         @relation("VendorAuctions", fields: [winnerId], references: [id])
  
  bids            Bid[]
}

// 3. BID (The action)
model Bid {
  id              String      @id @default(cuid())
  auctionId       String
  amount          Float
  
  isSealed        Boolean     @default(true) // Sealed or Live
  timestamp       DateTime    @default(now())
  
  vendorUserId    String
  vendorUser      User        @relation(fields: [vendorUserId], references: [id])
}
```

---

## 7. S3 Bucket Structure (Compliance & Storage)
*(For Legal & Security Teams)*

Because we handle sensitive Corporate documents and ID proofs, we use segregated storage.

- **`ecoloop-public-assets`:** Logos, platform UI images, marketing content. (Fast, Public).
- **`ecoloop-auction-images`:** Photos of the scrap piles. (Semi-public, viewable by registered vendors).
- **`ecoloop-kyc-secure`:** Contains GST, PAN, PCB Licenses. **STRICTLY PRIVATE**. The internet cannot see this. When an Admin clicks "View Document", the server creates a temporary `Presigned-URL` that vanishes after 10 minutes.
- **`ecoloop-compliance-docs`:** Contains the final Certificates of Destruction and Work Orders post-sale.

---

## 8. API Layer Design
*(For Backend Developers)*

The API acts as the bridge. Here's a brief snapshot of the core channels.

| Endpoint Route | Method | Purpose & Explanation |
|---|---|---|
| `/api/auth/login` | POST | Exchanging credentials for a secure JWT (Access token) |
| `/api/kyc/upload` | POST | Generates the S3 upload URL so heavy files don't crash our servers. |
| `/api/admin/companies/:id/approve` | PUT | Admin verifies a Vendor's licenses and activates them. |
| `/api/auctions` | POST | A Client posts a brand new heap of E-Waste. |
| `/api/bids/sealed` | POST | Vendor places a hidden bid. API validates they paid EMD. |
| `wss://api.ecoloop.com/auction` | WSS | The blazing fast Live Auction socket for constant updating bid streams. |

---

## 9. Authentication & Security Access
*(For System Admins & InfoSec)*

- **JWT Tokens:** We use JSON Web Tokens. When a user logs in, they receive a cryptographic token. Every time they try to fetch data, the server reads the token to confirm they are who they claim.
- **Data Fencing:** 
  - A Client can NEVER view another Client's Dashboard or Auctions. 
  - A Vendor can NEVER see the specific name or exact details of who another Vendor is during a live auction (to prevent cartel formation or price fixing). They only see "Bidder #3".
- **Role-Based Access Control (RBAC):** Backend endpoints have `@Roles(UserRole.ADMIN)` decorators. If a Vendor tries to execute an Admin command (like approving themselves), the system forcefully kicks the request out.

---

## 10. The Core: Auction & Bidding Engine
*(For Everyone - The heart of EcoLoop)*

The business revolves around generating the highest value through psychological competition based on strict architectural limits.

1. **The Earnest Money Deposit (EMD):** To prevent fake accounts from spam-bidding huge numbers, Vendors must pay an EMD to even *join* the Sealed Phase.
2. **The Transition (Sealed to Open):** When Open Phase begins, the engine scans all Sealed Bids. The absolute highest valid Sealed bid becomes the starting line for the Live Auction. All lower sealed bidders start at a disadvantage.
3. **The Tick Logic:** If the highest bid is ₹1,00,000 and the Tick Size is ₹5,000. Vendors physically cannot submit a live bid less than ₹1,05,000. 
4. **The 3-Minute Sniping Rule:** Just like real-life auctions ("Going once, going twice!"), if a vendor places a bid when there are only 45 seconds left on the clock, the system instantly bumps the timer back up by 3 minutes. This allows other vendors to react and pushes the price higher. It is capped at 24 extensions so it ends eventually.


Imagine the current highest bid is ₹10,000. Vendor A and Vendor B both click "Bid ₹11,000" at the   
  exact same millisecond.
   1. Server Thread A reads the DB: Highest bid is ₹10,000.
   2. Server Thread B reads the DB: Highest bid is ₹10,000.
   3. Both threads validate that ₹11,000 is a valid next bid.
   4. Both threads write ₹11,000 to the database.
  Result: The database now has two identical winning bids, the timer might be extended twice
  erroneously, and the state is corrupted.

  To prevent this, we implemented a "Belt and Suspenders" 4-Layer Defense architecture. Here is       
  exactly how it works:

  Layer 1: The Bouncer (Redis Distributed Lock / Mutex)
  This is our first line of defense. We used Redis to create a "Mutex" (Mutual Exclusion) lock.       
   * Think of the lock like a single microphone in a room. You can only speak (process a bid) if you  
     are holding the microphone.
   * When a bid comes in, the code calls redis.acquireLock('lock:auction:123').
   * If Vendor A and Vendor B bid at the exact same time, Redis (which is strictly single-threaded)   
     guarantees that only one of them gets the lock.
   * Vendor A gets the lock and proceeds into the database transaction.
   * Vendor B gets a "locked" response. Instead of failing immediately, our code forces Vendor B to   
     wait 50 milliseconds and try again (a "retry loop").
   * By the time Vendor B gets the lock, Vendor A is finished, and Vendor B will read the new highest 
     bid (₹11,000), realize their ₹11,000 bid is now invalid, and gracefully reject it.

  Layer 2: The Vault Guard (Optimistic Database Locking)
  What if the Redis server crashes for a split second, or two servers somehow slip past the lock? We  
  need the Database itself to reject concurrent writes.
   * We added a version integer column to the Auction table in the Prisma schema.
   * When Vendor A starts their transaction, they read the auction and note: "Version is 5".
   * When Vendor A finishes, they tell the database: “Update this auction, add my bid, and increment  
     the version to 6—BUT ONLY IF the version is still exactly 5.”
   * If Vendor B somehow bypassed Redis and tried to save their bid at the same time, they would also 
     tell the DB: "Update this auction, BUT ONLY IF the version is still 5."
   * Because Vendor A already changed the version to 6, the database strictly rejects Vendor B's      
     update, throwing a PrismaClientKnownRequestError. We catch this and tell Vendor B to retry.      

  Layer 3: The Double-Charge Protector (Idempotency)
  Sometimes, race conditions aren't caused by two different people, but by one person whose internet  
  connection lagged, causing their phone to send the exact same "Bid ₹11,000" request three times in a
  row.
   * Every time the frontend sends a bid, it generates a unique ID (idempotencyKey).
   * Before doing anything, our server checks Redis: "Have I processed this exact ID in the last      
     hour?"
   * If yes, it completely skips the database logic and just returns the current auction state. This  
     prevents accidental double-bidding from network glitches.

  Layer 4: Atomic Timer Extensions
  The final race condition risk occurs at the end of the auction. If two valid bids come in during the
  last 30 seconds (staggered just enough to bypass the locks), they could both trigger a 3-minute     
  extension, resulting in a 6-minute extension.
   * Because all our logic (checking the bid, writing the bid, and calculating the time remaining)    
     happens inside the locked database transaction, the timer calculation is frozen in time.
   * We calculate the exact milliseconds remaining, add exactly 3 minutes, and increment the
     extensionCount by 1, all atomically tied to the version update.

  Summary of the Flow:
   1. Vendor clicks Bid.
   2. Idempotency Check: Is this a duplicate network request? (If yes, ignore).
   3. Redis Lock: Grab the microphone for this specific auction. (Others wait in line).
   4. Transaction Start: Read the absolute latest state from the database.
   5. Validate: Check shortlist status, time remaining, and if the bid amount is high enough.
   6. Optimistic Write: Save the bid and extend the timer, checking the version column to guarantee no
      one else wrote to the DB while we were validating.
   7. Redis Unlock: Drop the microphone so the next person in line can bid.
---

## 11. Document & Compliance Management
*(For Operations, Legal & Logistics)*

EcoLoop is fundamentally a **Compliance Trust Platform**. The tech manages liabilities for Corporates.

- **Post-Auction Step 1:** Once a winner triggers, the API automatically generates a **Work Order PDF** tying the Client and Vendor into a digital agreement.
- **Post-Auction Step 2:** When the truck arrives at the Corporate office, the Vendor uploads a **Pickup Challan** via mobile browser. 
- **Post-Auction Step 3:** Once processed at the recycling factory, the Vendor is locked out of further platform actions until they upload the **E-Waste Recycling Certificate** to the Client, formally closing the EPR (Extended Producer Responsibility) logging loop.

---

## 12. Background Jobs (Automation)
*(Why AI/Automation handles the dirty work)*

Humans shouldn't press buttons to open and close auctions. We use **BullMQ & Redis** to schedule microscopic perfect triggers.

- **`auction-transitioner`:** Job placed on the calendar to fire precisely at (e.g. 10:00:00 AM). It flips the auction from `SEALED` to `OPEN` and broadcasts an initialization packet to all connected WebSockets.
- **`auction-closer`:** Closes the bidding completely and calculates the absolute winner.
- **`certificate-generator`:** A background thread running a "headless browser" (Puppeteer) that injects database variables into a clean HTML template to generate gorgeous PDF Work Orders autonomously.

---

## 13. Real-time Events (Live Bidding Tech)
*(For tech enthusiasts)*

Traditional HTTP requires you to "refresh" the page to fetch new info. That's too slow for active auctions.
We use **WebSockets (WSS)**. 

When Vendor A clicks "BID ₹50,000":
1. Their browser sends a sub-millisecond signal to our API.
2. The API verifies the amount and role logic instantly.
3. The API uses Redis Pub/Sub to yell: `"NEW_BID_ACCEPTED!"`
4. Vendor B and Vendor C's screens simultaneously update with the new price and the new bouncing countdown timer without them touching a thing.

---

## 14. Notification & Communication Channels
*(For Marketing & Client Retention)*

Communication ensures the system flows without Admin phone calls.

- **WhatsApp API / Twilio:** The ultimate weapon in India. Vendors receive auto-alerts: *"Auction for 500 Lenovo Thinkpads starts in 10 mins. Click here to join Live Room: [LINK]"*.
- **Email (SendGrid/Resend):** Used strictly for formal business. E.g., *"Your KYC has been approved"*, *"Attached is your Certificate of Demagnetization"*.
- **In-App Notifs:** The classic red dot bell icon in the dashboard for less urgent tracking ("Your truck is out for delivery").

---

## 15. Caching Strategy (Performance Optimization)
*(For System Admins worried about cost)*

Because hundreds of people might stare at an active auction simultaneously:
- We don't query the PostgreSQL database every second. 
- We load the current "Highest Bid" into **Redis (RAM Memory)**. 
- All incoming bids are evaluated against the lightning-fast RAM memory.
- Every 10 seconds, the RAM seamlessly syncs backwards to the permanent Database so nothing is lost, saving massive compute costs on AWS RDS.

---

## 16. Third-party Integrations Map

EcoLoop connects to giants to do the heavy lifting:

| Tool | What It Does For Us |
|---|---|
| **AWS S3** | Fort Knox for Document Storage |
| **AWS CloudFront** | CDN ensuring the UI loads beautifully worldwide |
| **Twilio OR WATI** | WhatsApp Business API for instant vendor pings |
| **Stripe / Razorpay**| Indian/Global payment gateways for handling the EMD deposits safely in escrow |
| **Puppeteer** | Magic tool to convert raw HTML into downloadable PDF legal certificates |

---

## 17. Overall Security Architecture
*(Keeping the lawyers happy)*

- **Blind Vendor Identities:** Vendor A never knows Vendor B's name during an auction. They see "Bidder_X". This kills cartel price manipulation dead.
- **Audit Logging:** Every single action (Approve user, place bid, download cert) drops an uneditable log in the Database. If an Admin goes rogue and downloads a PAN card improperly, the system knows.
- **SSL Encryption:** Industry standard HTTPS to ensure traffic sniffing is impossible.

---

## 18. Local Development Setup
*(For New Developers Onboarding from Day 1)*

If a new dev joins the team tomorrow, here’s how they run the giant system on their laptop:

```bash
# 1. Grab the code
git clone https://github.com/eco-org/ecoloop.git
cd ecoloop && npm ci

# 2. Start the magic background servers (Postgres + Redis)
docker-compose up -d

# 3. Create mock database tables
cd apps/api && npx prisma migrate dev

# 4. Turn on the Matrix
npm run dev
```

---

## 19. Environment Configuration
*(For DevOps - Environmental Variables)*

Separation of constants between Dev and Production via `.env` files ensures keys don't leak.

```env
# SHARED / FRONTEND
NEXT_PUBLIC_BASE_URL=https://ecoloop.app
NEXT_PUBLIC_ENVIRONMENT=production

# BACKEND SECRETS (Never commit to GitHub)
DATABASE_URL=postgresql://user:hunter2@aws-rds...
REDIS_URL=redis://elasticache...
JWT_SECRET=this_needs_to_be_a_64_character_random_string
RAZORPAY_API_KEY=rzp_live_abc123
AWS_S3_KYC_BUCKET=ecoloop-kyc-production
```

---

## 20. Future Scope (AI & Mobile Apps)
*(For Visionary Product Strategy)*

Once the V1 Master Architecture is stable, EcoLoop will scale into Phase 2:
- **AI Price Suggestion Engine:** Using historical bid data, when a Client uploads 5 Tons of Copper Wire, an algorithm suggests: *"Historically, this is worth ₹450/Kg right now. Set base price to ₹400/Kg."*
- **Logistics Tech Integration:** Direct API link to Delhivery/BlueDart to automatically dispatch a truck the second an auction concludes.
- **Vendor Mobile App (React Native):** A dedicated App-Store app purely for Vendors so they can receive WhatsApp-style push notifications and bid instantly from their mobile phones while on the move.

---

## 21. Visual Data Flow Diagrams
*(For the Wall Chart)*

### The Client (Seller) Journey
`Sign up` ➔ `Upload Corporate Docs` ➔ `Admin Approval` ➔ `Create Scrap Lot Details` ➔ `Set Auction Settings (Base, EMD, Rules)` ➔ `Watch Sealed Bids come in privately` ➔ `Watch Open Auction Price Skyrocket` ➔ `Click Accept Winner` ➔ `Receive Certificates`

### The Vendor (Buyer) Journey
`Sign up` ➔ `Upload Intense CPCB Licenses` ➔ `Admin Scrub/Approval` ➔ `Browse Marketplace` ➔ `Pay EMD for Lot #402` ➔ `Place 1 Blind Bid` ➔ `Wait for Timer...` ➔ `Join Live War Room` ➔ `Win the Bid` ➔ `Receive Work Order` ➔ `Dispatch Truck` ➔ `Upload Processing Certificate`

---

*This document serves as the true north for all EcoLoop developmental, architectural, and business alignment.*