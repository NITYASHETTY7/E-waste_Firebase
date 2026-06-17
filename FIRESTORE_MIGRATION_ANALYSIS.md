# Firestore to DynamoDB Migration Analysis Report

## Executive Summary

This report documents all Firestore/Firebase database usage across the ECOLOOP-FIREBASE codebase for migration planning to DynamoDB.

---

## 1. Files Importing firebase-admin

### Core Service Files:
| File Path | Import Pattern |
|-----------|----------------|
| `apps/api/src/firebase/firebase.service.ts` | `import * as admin from 'firebase-admin'` |
| `apps/api/src/users/users.service.ts` | Uses `firebaseService.db` |
| `apps/api/src/companies/companies.service.ts` | `import * as admin from 'firebase-admin'` |
| `apps/api/src/auctions/auctions.service.ts` | `import * as admin from 'firebase-admin'` |
| `apps/api/src/requirements/requirements.service.ts` | `import * as admin from 'firebase-admin'` |
| `apps/api/src/user-products/user-products.service.ts` | `import * as admin from 'firebase-admin'` |
| `apps/api/src/pickups/pickups.service.ts` | `import * as admin from 'firebase-admin'` |
| `apps/api/src/payments/payments.service.ts` | `import * as admin from 'firebase-admin'` |
| `apps/api/src/dashboard/dashboard.service.ts` | `import * as admin from 'firebase-admin'` |
| `apps/api/src/audits/audits.service.ts` | `import * as admin from 'firebase-admin'` |
| `apps/api/src/auth/auth.service.ts` | `import * as admin from 'firebase-admin'` |
| `apps/api/src/auth/otp.service.ts` | `import * as admin from 'firebase-admin'` |
| `apps/api/src/auth/jwt-auth.guard.ts` | Uses `firebaseService.db` |
| `apps/api/src/notifications/notification.service.ts` | `import * as admin from 'firebase-admin'` |
| `apps/api/src/ratings/ratings.service.ts` | Uses `firebaseService.db` |

### Script Files:
| File Path | Import Pattern |
|-----------|----------------|
| `apps/api/scripts/migrate-to-firebase.ts` | `import * as admin from 'firebase-admin'` |
| `apps/api/scripts/create-existing-users.js` | `const admin = require('firebase-admin')` |
| `apps/api/scripts/create-admin.js` | `const admin = require('firebase-admin')` |
| `apps/api/scripts/init-firestore.js` | `const admin = require('firebase-admin')` |

### Test Files:
| File Path | Import Pattern |
|-----------|----------------|
| `apps/api/test-db-payments.js` | `const admin = require('firebase-admin')` |

---

## 2. Collection Names Used

### Root Collections:
| Collection Name | Description | Primary Service |
|-----------------|-------------|-----------------|
| `users` | User profiles (Auth UID as doc ID) | UsersService, AuthService |
| `companies` | Company profiles | CompaniesService |
| `requirements` | Auction requirements/listings | RequirementsService, AuditsService |
| `auctions` | Auction data | AuctionsService |
| `userProducts` | User product listings | UserProductsService |
| `ratings` | Company ratings | RatingsService |

### Subcollections (under parent documents):

#### Under `companies/{companyId}`:
| Subcollection | Description | Service |
|---------------|-------------|---------|
| `kycDocuments` | KYC document metadata | CompaniesService |
| `payment` | Company payment records | PaymentsService |

#### Under `users/{userId}`:
| Subcollection | Description | Service |
|---------------|-------------|---------|
| `notifications` | In-app notifications | NotificationService |

#### Under `requirements/{requirementId}`:
| Subcollection | Description | Service |
|---------------|-------------|---------|
| `auditInvitations` | Vendor audit invitations | AuditsService |
| `vendorAuditDocs` | Vendor audit documents | RequirementsService |

#### Under `auctions/{auctionId}`:
| Subcollection | Description | Service |
|---------------|-------------|---------|
| `bids` | Auction bids | AuctionsService |
| `pickup` | Pickup records | PickupsService, AuctionsService |
| `payment` | Payment records | PaymentsService, AuctionsService |

#### Under `userProducts/{productId}`:
| Subcollection | Description | Service |
|---------------|-------------|---------|
| `quotes` | Vendor quotes | UserProductsService |
| `pickups` | Pickup records | UserProductsService |

---

## 3. Firestore Query Types Used

### Document Operations:
| Operation | Usage Count | Files |
|-----------|-------------|-------|
| `.doc().get()` | ~200+ | All services |
| `.doc().set()` | ~50+ | All services |
| `.doc().update()` | ~100+ | All services |
| `.doc().delete()` | ~10 | UsersService, etc. |
| `.doc().id` | ~30 | All services (for ID generation) |

### Collection Operations:
| Operation | Usage Count | Files |
|-----------|-------------|-------|
| `.collection().get()` | ~100+ | All services |
| `.collection().add()` | Rare | - |

### Query Filters:
| Operation | Usage Pattern | Files |
|-----------|-------------|-------|
| `.where('field', '==', value)` | Equality filters | All services |
| `.where('field', 'in', array)` | Array containment (with chunking) | DashboardService, AuctionsService |
| `admin.firestore.FieldPath.documentId(), 'in', chunk` | Document ID batch fetch | DashboardService, RequirementsService |
| `.orderBy('field', 'desc')` | Sorting (descending) | AuctionsService, DashboardService |
| `.orderBy('field', 'asc')` | Sorting (ascending) | Rare |
| `.limit(n)` | Limit results | All services |

### Collection Group Queries:
| Collection Group | Usage | Files |
|------------------|-------|-------|
| `collectionGroup('bids')` | Fetch all bids across auctions | AuctionsService, DashboardService |
| `collectionGroup('pickup')` | Fetch all pickups | DashboardService, PickupsService, AuctionScheduler |
| `collectionGroup('payment')` | Fetch all payments | DashboardService, Test files |
| `collectionGroup('vendorAuditDocs')` | Fetch all vendor audit docs | RequirementsService |
| `collectionGroup('auditInvitations')` | Fetch all audit invitations | AuditsService |

### Transactions:
| Pattern | Usage | Files |
|---------|-------|-------|
| `db.runTransaction(async (transaction) => { ... })` | Bid placement with concurrency control | AuctionsService (placeLiveBid) |

### Batch Operations:
| Pattern | Usage | Files |
|---------|-------|-------|
| `db.batch()` | Multiple updates atomically | AuctionsService, UserProductsService, RequirementsService |
| `batch.update(ref, data)` | Batch updates | AuctionsService (transitionPhases, shareSealedBids) |
| `batch.set(ref, data)` | Batch sets | UserProductsService |

### Timestamps:
| Pattern | Usage | Files |
|---------|-------|-------|
| `admin.firestore.Timestamp.now()` | Current timestamp | All services |
| `admin.firestore.Timestamp.fromDate(date)` | Convert Date to Timestamp | AuctionsService |
| `admin.firestore.FieldValue.serverTimestamp()` | Server-side timestamp | Scripts |
| `admin.firestore.FieldValue.increment(1)` | Atomic increment | OTPService |

---

## 4. Subcollections Detail

### Complete Subcollection Hierarchy:

```
companies/{companyId}
├── kycDocuments/{docId}          - KYC document metadata
└── payment/{paymentId}           - Payment records

users/{userId}
└── notifications/{notifId}       - In-app notifications

requirements/{requirementId}
├── auditInvitations/{inviteId}   - Vendor audit invitations
└── vendorAuditDocs/{docId}       - Vendor audit documents

auctions/{auctionId}
├── bids/{bidId}                  - Auction bids
├── pickup/{pickupId}             - Pickup records
└── payment/{paymentId}           - Payment records

userProducts/{productId}
├── quotes/{quoteId}              - Vendor quotes
└── pickups/{pickupId}            - Pickup records
```

---

## 5. Transactions and Batch Operations

### Transaction Usage:

#### File: `apps/api/src/auctions/auctions.service.ts` (Lines 113-220)
**Purpose:** Place live bid with optimistic locking
**Operations within transaction:**
- `transaction.get(auctionRef)` - Read auction
- `transaction.get(vendorUserRef)` - Read vendor user
- `transaction.get(companyRef)` - Read company
- `transaction.get(sealedBidsQuery)` - Query sealed bids
- `transaction.get(bidsQueryRef)` - Query open bids
- `transaction.set(newBidRef, bidData)` - Create new bid

### Batch Usage:

#### File: `apps/api/src/auctions/auctions.service.ts`
- **Line 1500:** `const batch = db.batch()` - Share sealed bids
- **Line 1532:** `const batch1 = db.batch()` - Transition upcoming → sealed
- **Line 1547:** `const batch2 = db.batch()` - Transition sealed → open
- **Line 1563:** `const batch3 = db.batch()` - Transition open → pending

#### File: `apps/api/src/user-products/user-products.service.ts`
- **Line 449:** `const batch = this.db.batch()` - Accept quote (updates quote + creates pickup)

#### File: `apps/api/src/requirements/requirements.service.ts`
- **Line 1166:** `const batch = this.firebaseService.db.batch()` - Cancel requirement

---

## 6. Real-time Listeners (onSnapshot)

**No onSnapshot listeners found in the API codebase.**

The backend API uses request-response patterns only. Real-time updates are handled via:
- WebSocket gateway (`auction.gateway.ts`) for live bidding
- Redis for distributed locking

---

## 7. Data Types and Interfaces

### Main Document Interfaces (from `firestore-types.ts`):

| Interface | Collection | Key Fields |
|-----------|------------|------------|
| `UserDoc` | users | id, email, name, role, companyId, isActive |
| `CompanyDoc` | companies | id, name, type, status, isLocked |
| `RequirementDoc` | requirements | id, clientId, status, category, title |
| `AuctionDoc` | auctions | id, clientId, winnerId, status, basePrice |
| `BidDoc` | auctions/{id}/bids | id, amount, phase, vendorId, isShortlisted |
| `PickupDoc` | auctions/{id}/pickup | id, status, scheduledDate, finalWeight |
| `PaymentDoc` | auctions/{id}/payment | id, status, clientAmount, commissionAmount |
| `UserProductDoc` | userProducts | id, userId, name, weightKg, status |
| `UserProductQuoteDoc` | userProducts/{id}/quotes | id, vendorCompanyId, offeredPrice |
| `UserProductPickupDoc` | userProducts/{id}/pickups | id, vendorCompanyId, status |
| `AuditInvitationDoc` | requirements/{id}/auditInvitations | id, vendorId, status, token |
| `VendorAuditDocDoc` | requirements/{id}/vendorAuditDocs | id, vendorUserId, status |
| `RatingDoc` | ratings | id, auctionId, fromCompanyId, toCompanyId, score |
| `InAppNotificationDoc` | users/{id}/notifications | id, type, title, message, read |
| `S3Document` | Embedded | id, type, s3Key, s3Bucket, fileName |

### Enums:
- `UserRole`: ADMIN, CLIENT, VENDOR, USER
- `CompanyStatus`: PENDING, APPROVED, REJECTED, BLOCKED
- `CompanyType`: CLIENT, VENDOR
- `RequirementStatus`: UPLOADED, PROCESSING, CLIENT_REVIEW, FINALIZED, REJECTED
- `AuctionStatus`: DRAFT, UPCOMING, SEALED_PHASE, OPEN_PHASE, PENDING_SELECTION, COMPLETED, CANCELLED, CLIENT_REVIEW
- `BidPhase`: SEALED, OPEN
- `PaymentStatus`: PENDING, SUBMITTED, CONFIRMED, FAILED
- `PickupStatus`: PENDING, SCHEDULED, DOCUMENTS_UPLOADED, COMPLETED, GATE_PASS_ISSUED, VENDOR_ACKNOWLEDGED, IN_TRANSIT, RECONCILIATION_DONE, INVOICE_GENERATED
- `UserProductStatus`: PENDING_ADMIN_REVIEW, ADMIN_APPROVED, QUOTE_RECEIVED, QUOTE_ACCEPTED, PICKUP_REQUESTED, PICKUP_IN_PROGRESS, COMPLETED, REJECTED
- `DocumentType`: 40+ document types (GST_CERTIFICATE, PAN_CARD, etc.)

---

## 8. Complex Query Patterns

### Chunked ID Queries (Firestore 10-item limit workaround):
```typescript
// Pattern found in: DashboardService, AuctionsService, RequirementsService
const chunks = chunkArray(ids, 10);
await Promise.all(chunks.map(async (chunk) => {
  const snap = await db.collection('users')
    .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
    .get();
}));
```

### Collection Group Queries:
```typescript
// Pattern found in: DashboardService, PickupsService, RequirementsService
const snap = await db.collectionGroup('payment')
  .where('status', '==', PaymentStatus.SUBMITTED)
  .get();
```

### Multi-level Subcollection Access:
```typescript
// Pattern found in: CompaniesService, AuctionsService, UserProductsService
const subSnap = await db.collection('companies')
  .doc(companyId)
  .collection('kycDocuments')
  .get();
```

---

## 9. Migration Considerations

### For DynamoDB Migration:

1. **Single Table Design**: Consider combining all entities into a single DynamoDB table with partition keys like:
   - `USER#<id>` for users
   - `COMPANY#<id>` for companies
   - `AUCTION#<id>` for auctions
   - `AUCTION#<id>#BID#<bidId>` for bids (or GSI)

2. **Subcollections**: DynamoDB doesn't have native subcollections. Options:
   - Store as nested objects (for small collections)
   - Separate items with composite keys (for large collections)
   - Use GSIs to query by parent ID

3. **Collection Group Queries**: Replace with:
   - GSIs with entity type as SK prefix
   - Separate tables for high-volume entities

4. **Transactions**: DynamoDB supports transactions but with different syntax and limitations

5. **Timestamps**: Replace `admin.firestore.Timestamp` with ISO strings or Unix timestamps

6. **Document ID Generation**: Replace `db.collection().doc().id` with UUID generation

7. **In operator**: DynamoDB supports `IN` but with different syntax

8. **OrderBy/Limit**: Use GSIs with sort keys for DynamoDB queries

---

## 10. File-by-File Summary

### High-Impact Files (Require Significant Changes):
| File | Firestore Usage | Lines |
|------|-----------------|-------|
| `auctions.service.ts` | Transactions, batch ops, subcollections | ~1700 |
| `requirements.service.ts` | Complex queries, notifications | ~1400 |
| `companies.service.ts` | Subcollections, batch updates | ~550 |
| `user-products.service.ts` | Batch ops, subcollections | ~650 |
| `pickups.service.ts` | Collection groups, subcollections | ~900 |
| `payments.service.ts` | Collection groups, subcollections | ~450 |
| `dashboard.service.ts` | Collection groups, aggregations | ~500 |
| `audits.service.ts` | Collection groups, complex queries | ~480 |

### Medium-Impact Files:
| File | Firestore Usage |
|------|-----------------|
| `users.service.ts` | Basic CRUD |
| `auth.service.ts` | Basic CRUD |
| `ratings.service.ts` | Basic CRUD with joins |
| `notification.service.ts` | Subcollection writes |

### Low-Impact Files:
| File | Firestore Usage |
|------|-----------------|
| `otp.service.ts` | Single document updates |
| `jwt-auth.guard.ts` | Single document reads |

---

*Report generated on 2026-06-15*
