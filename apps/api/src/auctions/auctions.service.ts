import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { DocumentsService } from '../documents/documents.service';
import { FirebaseService } from '../firebase/firebase.service';
import {
    AuctionDoc,
    AuctionStatus,
    BidPhase,
    DocumentType,
    PaymentDoc,
    PaymentStatus,
    PickupDoc,
    PickupStatus,
    S3Document,
    UserDoc,
} from '../firebase/firestore-types';
import { NotificationService } from '../notifications/notification.service';
import { RedisService } from '../redis/redis.service';
import { S3Service } from '../s3/s3.service';
import { GenerateDocsDto } from './auctions.dto';

const convertDate = (field: any): Date | null => {
  if (!field) return null;
  return typeof field.toDate === 'function' ? field.toDate() : new Date(field);
};

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

@Injectable()
export class AuctionsService {
  constructor(
    private firebaseService: FirebaseService,
    private s3: S3Service,
    private notifications: NotificationService,
    private documents: DocumentsService,
    private redis: RedisService,
  ) {}

  async placeLiveBid(data: {
    auctionId: string;
    vendorId: string;
    amount: number;
    idempotencyKey?: string;
  }) {
    const { auctionId, vendorId, amount, idempotencyKey } = data;
    const db = this.firebaseService.db;

    // 1. Idempotency Check
    if (idempotencyKey) {
      const isNew = await this.redis.checkAndSetIdempotency(
        idempotencyKey,
        1000 * 60 * 60,
      ); // 1 hour
      if (!isNew) {
        // Return current highest state instead of error to handle retries gracefully
        const auction = await this.findOne(auctionId);
        const leaderboard = await this.getLeaderboard(auctionId);
        return { bid: auction.bids[0], auction, leaderboard };
      }
    }

    // Pre-check helper to avoid lock contention for duplicate or lower bids
    const checkPriceAlreadyBid = async () => {
      const bidsSnap = await db.collection('auctions').doc(auctionId).collection('bids')
        .orderBy('amount', 'desc')
        .get();
      
      const highestBidDoc = bidsSnap.docs.find((d: any) => d.data().phase === BidPhase.OPEN);
      const highestBid = highestBidDoc ? highestBidDoc.data() : null;
      if (highestBid && amount <= highestBid.amount) {
        throw new BadRequestException(
          'The price is already bid. Try the next highest bid.',
        );
      }
    };

    await checkPriceAlreadyBid();

    // 2. Distributed Lock with Retry
    const lockKey = `lock:auction:${auctionId}`;
    const lockValue = `${vendorId}:${Date.now()}`;
    let locked = false;
    const maxRetries = 100;
    for (let i = 0; i < maxRetries; i++) {
      if (i > 0) {
        await checkPriceAlreadyBid();
      }
      locked = await this.redis.acquireLock(lockKey, lockValue, 5000);
      if (locked) break;
      const delay = 10 + Math.floor(Math.random() * 20); // 10-30ms jitter
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (!locked) {
      throw new BadRequestException(
        'Bidding contention high, please try again.',
      );
    }

    try {
      // 3. Database Transaction (Optimistic + Double-Check)
      return await db.runTransaction(async (transaction: any) => {
        const auctionRef = db.collection('auctions').doc(auctionId);
        const auctionDoc = await transaction.get(auctionRef);
        if (!auctionDoc.exists) throw new NotFoundException('Auction not found');
        const auctionData = auctionDoc.data() as AuctionDoc;

        // Validation
        if (auctionData.status !== AuctionStatus.OPEN_PHASE) {
          throw new BadRequestException('Auction is not in open phase');
        }

        const now = new Date();
        const openPhaseStart = convertDate(auctionData.openPhaseStart);
        const openPhaseEnd = convertDate(auctionData.openPhaseEnd);

        if (openPhaseStart && now < openPhaseStart) {
          throw new BadRequestException('Auction has not started yet');
        }
        if (openPhaseEnd && now > openPhaseEnd) {
          throw new BadRequestException('Auction has already ended');
        }

        const vendorUserRef = db.collection('users').doc(vendorId);
        const vendorUserDoc = await transaction.get(vendorUserRef);
        const vendorUserData = vendorUserDoc.exists ? (vendorUserDoc.data() as UserDoc) : null;

        let companyData: any = null;
        if (vendorUserData?.companyId) {
          const companyRef = db.collection('companies').doc(vendorUserData.companyId);
          const companyDoc = await transaction.get(companyRef);
          companyData = companyDoc.exists ? companyDoc.data() : null;
        }

        if (companyData?.isLocked) {
          throw new BadRequestException('Your account is locked');
        }

        if (!vendorUserData?.companyId) {
          throw new BadRequestException('Vendor company not found');
        }

        // 3b. Shortlist Check (check if any user of the vendor's company has a shortlisted sealed bid)
        const companyUsersSnap = await transaction.get(
          db.collection('users').where('companyId', '==', vendorUserData.companyId)
        );
        const companyUserIds = companyUsersSnap.docs.map((doc: any) => doc.id);

        const sealedBidsQuery = auctionRef.collection('bids')
          .where('phase', '==', BidPhase.SEALED)
          .where('isShortlisted', '==', true);
        const sealedBidsSnap = await transaction.get(sealedBidsQuery);
        const isShortlisted = sealedBidsSnap.docs.some((doc: any) => {
          const bidData = doc.data();
          return companyUserIds.includes(bidData.vendorId);
        });

        if (!isShortlisted) {
          throw new BadRequestException(
            'Your company is not shortlisted for the live auction',
          );
        }

        // Fetch highest bid in OPEN phase inside transaction
        const bidsQueryRef = auctionRef.collection('bids')
          .orderBy('amount', 'desc');
        const bidsQuerySnap = await transaction.get(bidsQueryRef);
        const highestBidDoc = bidsQuerySnap.docs.find((d: any) => d.data().phase === BidPhase.OPEN);
        const highestBidData = highestBidDoc ? highestBidDoc.data() : null;
        const highestBidAmount = highestBidData ? highestBidData.amount : null;

        const baseHighest = highestBidAmount || auctionData.basePrice;
        const minRequired = baseHighest + auctionData.tickSize;

        if (highestBidAmount !== null && amount <= highestBidAmount) {
          throw new BadRequestException(
            'The price is already bid. Try the next highest bid.',
          );
        }

        if (amount < minRequired) {
          throw new BadRequestException(`Minimum bid is ₹${minRequired}`);
        }

        // Create Bid
        const newBidRef = auctionRef.collection('bids').doc();
        const bidData = {
          id: newBidRef.id,
          auctionId,
          vendorId,
          amount: Number(amount),
          phase: BidPhase.OPEN,
          createdAt: admin.firestore.Timestamp.now(),
          isShortlisted: false,
          clientStatus: 'pending',
        };
        transaction.set(newBidRef, bidData);

        // 4. Update Auction (Optimistic Lock)
        const newVersion = (auctionData.version || 0) + 1;
        const updateData: any = {
          version: newVersion,
          updatedAt: admin.firestore.Timestamp.now(),
        };

        // 5. Timer Extension (Anti-sniping)
        let finalEndTime = openPhaseEnd;
        let extensionCount = auctionData.extensionCount || 0;
        const extMinutes = auctionData.extensionMinutes ?? 3;

        if (openPhaseEnd) {
          const msToEnd = openPhaseEnd.getTime() - now.getTime();
          if (
            extMinutes > 0 &&
            msToEnd > 0 &&
            msToEnd < extMinutes * 60 * 1000 &&
            extensionCount < (auctionData.maxTicks || 0)
          ) {
            finalEndTime = new Date(openPhaseEnd.getTime() + extMinutes * 60 * 1000);
            extensionCount += 1;
            updateData.openPhaseEnd = admin.firestore.Timestamp.fromDate(finalEndTime);
            updateData.extensionCount = extensionCount;
          }
        }

        transaction.update(auctionRef, updateData);

        // 6. Update Leaderboard in Redis (Async-ish)
        await this.redis.updateLeaderboard(auctionId, vendorId, amount);

        const leaderboard = await this.getLeaderboard(auctionId);

        const returnedBid = {
          ...bidData,
          createdAt: bidData.createdAt.toDate(),
          vendor: {
            id: vendorUserData.id,
            name: vendorUserData.name,
          },
        };

        const updatedAuction = {
          ...auctionData,
          ...updateData,
          openPhaseEnd: finalEndTime,
          sealedPhaseStart: convertDate(auctionData.sealedPhaseStart),
          sealedPhaseEnd: convertDate(auctionData.sealedPhaseEnd),
          openPhaseStart: convertDate(auctionData.openPhaseStart),
          createdAt: convertDate(auctionData.createdAt),
          updatedAt: new Date(),
        };

        return { bid: returnedBid, auction: updatedAuction, leaderboard };
      });
    } catch (e) {
      if (e.code === 'aborted') {
        throw new BadRequestException(
          'Concurrent update detected, please retry.',
        );
      }
      throw e;
    } finally {
      await this.redis.releaseLock(lockKey, lockValue);
    }
  }

  async getLeaderboard(auctionId: string) {
    const raw = await this.redis.getLeaderboard(auctionId);
    const result = [];
    for (let i = 0; i < raw.length; i += 2) {
      const vendorId = raw[i];
      const amount = parseFloat(raw[i + 1]);

      result.push({ vendorId, amount, rank: i / 2 + 1 });
    }

    if (result.length === 0) {
      const db = this.firebaseService.db;
      const bidsSnap = await db.collection('auctions').doc(auctionId).collection('bids')
        .orderBy('amount', 'desc')
        .get();

      const seen = new Set<string>();
      const uniqueBids: any[] = [];
      const openBids = bidsSnap.docs.filter((doc: any) => (doc.data() as any)?.phase === BidPhase.OPEN);
      const vendorIds = Array.from(new Set(openBids.map((doc: any) => (doc.data() as any)?.vendorId)));

      const vendorUsers = await Promise.all(
        vendorIds.map(async (vid) => {
          const uDoc = await db.collection('users').doc(vid).get();
          return uDoc.exists ? { id: vid, name: (uDoc.data() as any)?.name } : { id: vid, name: 'Unknown' };
        })
      );
      const vendorMap = new Map(vendorUsers.map((u: any) => [u.id, u]));

      for (const doc of openBids) {
        const b = doc.data();
        if (seen.has(b.vendorId)) continue;
        seen.add(b.vendorId);
        uniqueBids.push({
          vendorId: b.vendorId,
          amount: b.amount,
          vendor: vendorMap.get(b.vendorId),
        });
      }

      return uniqueBids.map((b: any, idx: any) => ({
        vendorId: b.vendorId,
        amount: b.amount,
        rank: idx + 1,
        vendor: b.vendor,
      }));
    }

    return result;
  }

  async findAllBids(auctionId?: string, vendorId?: string) {
    const db = this.firebaseService.db;
    let bidsSnap: admin.firestore.QuerySnapshot;
    
    if (auctionId) {
      let query: admin.firestore.Query = db.collection('auctions').doc(auctionId).collection('bids');
      if (vendorId) {
        query = query.where('vendorId', '==', vendorId);
      }
      bidsSnap = await query.limit(100).get();
    } else if (vendorId) {
      bidsSnap = await db.collectionGroup('bids')
        .where('vendorId', '==', vendorId)
        .limit(100)
        .get();
    } else {
      bidsSnap = await db.collectionGroup('bids').limit(100).get();
    }

    const bids = bidsSnap.docs.map((doc: any) => {
      const data = doc.data();
      const pathParts = doc.ref.path.split('/');
      const docAuctionId = pathParts[1] || auctionId;
      return {
        ...data,
        id: doc.id,
        auctionId: docAuctionId,
        createdAt: convertDate(data.createdAt),
      } as any;
    }).sort((a: any, b: any) => {
      const dateA = a.createdAt ? a.createdAt.getTime() : 0;
      const dateB = b.createdAt ? b.createdAt.getTime() : 0;
      return dateB - dateA;
    });

    const uniqueVendorIds = Array.from(new Set(bids.map((b: any) => b.vendorId))).filter(Boolean) as string[];
    const uniqueAuctionIds = Array.from(new Set(bids.map((b: any) => b.auctionId))).filter(Boolean) as string[];

    const vendorsMap = new Map<string, any>();
    if (uniqueVendorIds.length > 0) {
      const chunks = chunkArray(uniqueVendorIds, 10);
      await Promise.all(chunks.map(async (chunk: any) => {
        const snap = await db.collection('users').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
        snap.docs.forEach((doc: any) => {
          const u = doc.data();
          vendorsMap.set(doc.id, { id: doc.id, name: u.name, companyId: u.companyId });
        });
      }));
    }

    const auctionsMap = new Map<string, any>();
    if (uniqueAuctionIds.length > 0) {
      const chunks = chunkArray(uniqueAuctionIds, 10);
      await Promise.all(chunks.map(async (chunk: any) => {
        const snap = await db.collection('auctions').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
        snap.docs.forEach((doc: any) => {
          const a = doc.data();
          auctionsMap.set(doc.id, {
            id: doc.id,
            status: a.status,
            winnerId: a.winnerId,
            requirementId: a.requirementId,
          });
        });
      }));
    }

    return bids.map((b: any) => ({
      ...b,
      vendor: vendorsMap.get(b.vendorId) || null,
      auction: auctionsMap.get(b.auctionId) || null,
    }));
  }

  async create(data: {
    title: string;
    category: string;
    description?: string;
    basePrice: number;
    targetPrice?: number;
    tickSize?: number;
    maximumTickSize?: number;
    maxTicks?: number;
    extensionMinutes?: number;
    clientId: string;
    requirementId?: string;
  }) {
    const db = this.firebaseService.db;
    const auctionRef = db.collection('auctions').doc();
    const auctionDoc: AuctionDoc = {
      id: auctionRef.id,
      title: data.title,
      category: data.category,
      description: data.description || null,
      status: AuctionStatus.DRAFT,
      basePrice: Number(data.basePrice),
      targetPrice: data.targetPrice !== undefined ? Number(data.targetPrice) : null,
      tickSize: data.tickSize !== undefined ? Number(data.tickSize) : 50,
      maximumTickSize: data.maximumTickSize !== undefined ? Number(data.maximumTickSize) : null,
      maxTicks: data.maxTicks !== undefined ? Number(data.maxTicks) : 5,
      extensionMinutes: data.extensionMinutes !== undefined ? Number(data.extensionMinutes) : 3,
      extensionCount: 0,
      liveApprovalStatus: 'pending',
      liveApprovalRemarks: null,
      clientId: data.clientId,
      winnerId: null,
      requirementId: data.requirementId || null,
      quoteApproved: null,
      quoteRemarks: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      auctionDocs: [],
    };

    await auctionRef.set(auctionDoc);
    return auctionDoc;
  }

  async findAll(status?: AuctionStatus, clientId?: string, winnerId?: string) {
    const db = this.firebaseService.db;
    let query: admin.firestore.Query = db.collection('auctions');
    if (status) {
      query = query.where('status', '==', status);
    }
    if (clientId) {
      query = query.where('clientId', '==', clientId);
    }
    if (winnerId) {
      query = query.where('winnerId', '==', winnerId);
    }

    // Removed orderBy to avoid requiring new Firestore composite indexes for status+winnerId
    // Limit to prevent quota issues - use pagination for large datasets
    const snap = await query.limit(200).get();
    const auctions = snap.docs.map((doc: any) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: convertDate(data.createdAt),
        updatedAt: convertDate(data.updatedAt),
        sealedPhaseStart: convertDate(data.sealedPhaseStart),
        sealedPhaseEnd: convertDate(data.sealedPhaseEnd),
        openPhaseStart: convertDate(data.openPhaseStart),
        openPhaseEnd: convertDate(data.openPhaseEnd),
      };
    }).sort((a: any, b: any) => {
      const dateA = a.createdAt ? a.createdAt.getTime() : 0;
      const dateB = b.createdAt ? b.createdAt.getTime() : 0;
      return dateB - dateA;
    });

    const clientIds = Array.from(new Set(auctions.map((a: any) => a.clientId).filter(Boolean)));
    const winnerIds = Array.from(new Set(auctions.map((a: any) => a.winnerId).filter(Boolean)));
    const companyIds = Array.from(new Set([...clientIds, ...winnerIds]));

    const companiesMap = new Map<string, any>();
    if (companyIds.length > 0) {
      const chunks = chunkArray(companyIds, 10);
      await Promise.all(chunks.map(async (chunk: any) => {
        const cSnap = await db.collection('companies').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
        cSnap.docs.forEach((doc: any) => {
          companiesMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
      }));
    }

    const resolvedAuctions = await Promise.all(auctions.map(async (a: any) => {
      const bidsSnap = await db.collection('auctions').doc(a.id).collection('bids')
        .orderBy('amount', 'desc')
        .limit(1)
        .get();
      
      const bids = bidsSnap.docs.map((doc: any) => {
        const b = doc.data();
        return {
          ...b,
          id: doc.id,
          createdAt: convertDate(b.createdAt),
        };
      });

      return {
        ...a,
        client: companiesMap.get(a.clientId) || null,
        winner: a.winnerId ? (companiesMap.get(a.winnerId) || null) : null,
        bids,
      };
    }));

    return resolvedAuctions;
  }

  async findOne(id: string) {
    const db = this.firebaseService.db;
    const auctionRef = db.collection('auctions').doc(id);
    const auctionDoc = await auctionRef.get();
    if (!auctionDoc.exists) throw new NotFoundException('Auction not found');
    
    const a = auctionDoc.data()!;
    const auction = {
      ...a,
      id,
      createdAt: convertDate(a.createdAt),
      updatedAt: convertDate(a.updatedAt),
      sealedPhaseStart: convertDate(a.sealedPhaseStart),
      sealedPhaseEnd: convertDate(a.sealedPhaseEnd),
      openPhaseStart: convertDate(a.openPhaseStart),
      openPhaseEnd: convertDate(a.openPhaseEnd),
    } as any;

    const companyIds = [auction.clientId, auction.winnerId].filter(Boolean) as string[];
    const companiesMap = new Map<string, any>();
    if (companyIds.length > 0) {
      const cSnap = await db.collection('companies').where(admin.firestore.FieldPath.documentId(), 'in', companyIds).get();
      cSnap.docs.forEach((doc: any) => {
        companiesMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
    }

    const bidsSnap = await auctionRef.collection('bids').orderBy('amount', 'desc').get();
    const bidsWithVendors = await Promise.all(bidsSnap.docs.map(async (doc: any) => {
      const b = doc.data() as any;
      const vendorId = b.vendorId;
      const vendorDoc = await db.collection('users').doc(vendorId).get();
      const vendor = vendorDoc.exists
        ? { id: vendorId, name: (vendorDoc.data() as any)?.name, email: (vendorDoc.data() as any)?.email }
        : { id: vendorId, name: 'Unknown' };

      return {
        ...b,
        id: doc.id,
        createdAt: convertDate(b.createdAt),
        vendor,
      } as any;
    }));

    const pickupSnap = await auctionRef.collection('pickup').limit(1).get();
    const pickup = pickupSnap.empty ? null : {
      id: pickupSnap.docs[0].id,
      ...pickupSnap.docs[0].data(),
      createdAt: convertDate(pickupSnap.docs[0].data().createdAt),
      updatedAt: convertDate(pickupSnap.docs[0].data().updatedAt),
      scheduledDate: convertDate(pickupSnap.docs[0].data().scheduledDate),
      gatePassIssuedAt: convertDate(pickupSnap.docs[0].data().gatePassIssuedAt),
      vendorAcknowledgedAt: convertDate(pickupSnap.docs[0].data().vendorAcknowledgedAt),
      invoiceGeneratedAt: convertDate(pickupSnap.docs[0].data().invoiceGeneratedAt),
      vendorPreferredDate: convertDate(pickupSnap.docs[0].data().vendorPreferredDate),
      clientVerifiedAt: convertDate(pickupSnap.docs[0].data().clientVerifiedAt),
    };

    return {
      ...auction,
      client: companiesMap.get(auction.clientId) || null,
      winner: auction.winnerId ? (companiesMap.get(auction.winnerId) || null) : null,
      bids: bidsWithVendors,
      pickup,
    };
  }

  async schedule(
    id: string,
    data: {
      sealedPhaseStart: string;
      sealedPhaseEnd: string;
      openPhaseStart: string;
      openPhaseEnd: string;
      tickSize?: number;
      maximumTickSize?: number;
      maxTicks?: number;
      extensionMinutes?: number;
    },
  ) {
    const db = this.firebaseService.db;
    const auctionRef = db.collection('auctions').doc(id);
    const auctionDoc = await auctionRef.get();
    if (!auctionDoc.exists) throw new NotFoundException('Auction not found');
    const existing = auctionDoc.data()!;

    const nextStatus =
      existing.status === AuctionStatus.DRAFT
        ? AuctionStatus.UPCOMING
        : existing.status;

    const updateData: any = {
      sealedPhaseStart: admin.firestore.Timestamp.fromDate(new Date(data.sealedPhaseStart)),
      sealedPhaseEnd: admin.firestore.Timestamp.fromDate(new Date(data.sealedPhaseEnd)),
      openPhaseStart: admin.firestore.Timestamp.fromDate(new Date(data.openPhaseStart)),
      openPhaseEnd: admin.firestore.Timestamp.fromDate(new Date(data.openPhaseEnd)),
      ...(data.tickSize && { tickSize: Number(data.tickSize) }),
      ...(data.maximumTickSize !== undefined && { maximumTickSize: data.maximumTickSize ? Number(data.maximumTickSize) : null }),
      ...(data.maxTicks && { maxTicks: Number(data.maxTicks) }),
      ...(data.extensionMinutes && {
        extensionMinutes: Number(data.extensionMinutes),
      }),
      status: nextStatus,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await auctionRef.update(updateData);

    const updatedDoc = await auctionRef.get();
    const updated = {
      ...updatedDoc.data(),
      id,
      createdAt: convertDate(updatedDoc.data()?.createdAt),
      updatedAt: convertDate(updatedDoc.data()?.updatedAt),
      sealedPhaseStart: convertDate(updatedDoc.data()?.sealedPhaseStart),
      sealedPhaseEnd: convertDate(updatedDoc.data()?.sealedPhaseEnd),
      openPhaseStart: convertDate(updatedDoc.data()?.openPhaseStart),
      openPhaseEnd: convertDate(updatedDoc.data()?.openPhaseEnd),
    } as any;

    const clientCompanyDoc = await db.collection('companies').doc(updated.clientId).get();
    const clientCompany = clientCompanyDoc.exists ? { id: clientCompanyDoc.id, ...clientCompanyDoc.data() } : null;

    let clientUsers: any[] = [];
    if (clientCompany) {
      const usersSnap = await db.collection('users').where('companyId', '==', clientCompany.id).get();
      clientUsers = usersSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    }

    const clientWithUsers = clientCompany ? { ...clientCompany, users: clientUsers } : null;
    updated.client = clientWithUsers;

    const clientUser = clientUsers[0];
    if (clientUser) {
      if (clientUser.email) {
        const configureUrl = `${process.env.WEB_URL || 'http://localhost:3000'}/client/listings/${updated.requirementId || id}/configure-live`;
        await this.notifications
          .notifyClientLiveAuctionApproval(
            clientUser.email,
            clientUser.name,
            updated.title,
            configureUrl,
          )
          .catch(console.error);
      }
      await this.notifications
        .createInAppNotification({
          userId: clientUser.id,
          type: 'live_auction_approval',
          title: 'Review Live Auction Parameters',
          message: `Admin has scheduled the live parameters for "${updated.title}". Please review and approve.`,
          link: `/client/listings/${updated.requirementId || id}/configure-live`,
        })
        .catch(() => {});
    }

    return updated;
  }

  async approveLiveAuction(id: string) {
    const db = this.firebaseService.db;
    const auctionRef = db.collection('auctions').doc(id);
    
    await auctionRef.update({
      status: AuctionStatus.OPEN_PHASE,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    const auctionDoc = await auctionRef.get();
    if (!auctionDoc.exists) throw new NotFoundException('Auction not found');
    const a = auctionDoc.data()!;

    const bidsSnap = await auctionRef.collection('bids').get();
    const bidsWithVendors = await Promise.all(bidsSnap.docs.map(async (doc: any) => {
      const b = doc.data() as any;
      const vendorUserDoc = await db.collection('users').doc(b.vendorId).get();
      const vendor = vendorUserDoc.exists ? { id: b.vendorId, name: (vendorUserDoc.data() as any)?.name, email: (vendorUserDoc.data() as any)?.email } : null;
      return {
        ...b,
        id: doc.id,
        vendor,
      } as any;
    }));

    const auction = {
      ...a,
      id,
      bids: bidsWithVendors,
    } as any;

    const approvedBids = bidsWithVendors.filter(
      (b: any) => b.phase === BidPhase.SEALED && b.clientStatus === 'approved',
    );

    for (const bid of approvedBids) {
      if (bid.vendor?.email) {
        await this.notifications
          .notifyLiveAuctionApproved(
            bid.vendor.email,
            bid.vendor.name,
            auction.title,
            `${process.env.WEB_URL || 'http://localhost:3000'}/vendor/marketplace/${auction.requirementId || auction.id}`,
          )
          .catch(console.error);
      }
      await this.notifications
        .createInAppNotification({
          userId: bid.vendorId,
          type: 'live_auction_approved',
          title: "You're Shortlisted for Live Auction!",
          message: `The live auction for "${auction.title}" has been approved. Place your bids now!`,
          link: `/vendor/marketplace/${auction.requirementId || auction.id}`,
        })
        .catch(() => {});
    }

    return {
      success: true,
      message: 'Live auction approved and vendors notified',
    };
  }

  async submitSealedBid(
    auctionId: string,
    vendorId: string,
    amount: number,
    file?: Express.Multer.File,
    remarks?: string,
  ) {
    const db = this.firebaseService.db;
    const auctionRef = db.collection('auctions').doc(auctionId);
    const auctionDoc = await auctionRef.get();
    if (!auctionDoc.exists) throw new NotFoundException('Auction not found');
    const auction = auctionDoc.data()!;

    const vendorUserDoc = await db.collection('users').doc(vendorId).get();
    const vendorUser = vendorUserDoc.exists ? vendorUserDoc.data()! : null;

    let companyData: any = null;
    if (vendorUser?.companyId) {
      const companyDoc = await db.collection('companies').doc(vendorUser.companyId).get();
      companyData = companyDoc.exists ? companyDoc.data() : null;
    }

    if (companyData?.isLocked) {
      throw new BadRequestException(
        'Your account is locked. Please contact admin.',
      );
    }
    if (auction.status !== AuctionStatus.SEALED_PHASE) {
      throw new BadRequestException('Sealed bidding is not currently open');
    }

    let priceSheetS3Key: string | undefined;
    let priceSheetS3Bucket: string | undefined;
    let priceSheetFileName: string | undefined;

    if (file) {
      const { key, bucket } = await this.s3.upload(
        file,
        `bids/${auctionId}/${vendorId}`,
      );
      priceSheetS3Key = key;
      priceSheetS3Bucket = bucket;
      priceSheetFileName = file.originalname;
    }

    const bidId = db.collection('auctions').doc(auctionId).collection('bids').doc().id;
    const bidData = {
      id: bidId,
      auctionId,
      vendorId,
      amount: Number(amount),
      phase: BidPhase.SEALED,
      remarks: remarks || null,
      priceSheetS3Key: priceSheetS3Key || null,
      priceSheetS3Bucket: priceSheetS3Bucket || null,
      priceSheetFileName: priceSheetFileName || null,
      isShortlisted: false,
      clientStatus: 'pending',
      createdAt: admin.firestore.Timestamp.now(),
    };

    await db.collection('auctions').doc(auctionId).collection('bids').doc(bidId).set(bidData);

    await this.notifications
      .notifyAdmins({
        type: 'sealed_bid_submitted',
        title: 'Sealed Bid Submitted',
        message: `Vendor "${companyData?.name || vendorUser?.name || 'A vendor'}" submitted a sealed bid of ₹${Number(amount).toLocaleString('en-IN')} for "${auction.title}".`,
        link: `/admin/listings/${auction.requirementId || auctionId}`,
      })
      .catch(() => {});

    const clientUsersSnap = await db.collection('users').where('companyId', '==', auction.clientId).get();
    const clientUsers = clientUsersSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    await Promise.all(
      clientUsers.map((clientUser: any) =>
        this.notifications
          .createInAppNotification({
            userId: clientUser.id,
            type: 'sealed_bid_submitted',
            title: 'Sealed Bid Submitted',
            message: `Vendor "${companyData?.name || vendorUser?.name || 'A vendor'}" submitted a sealed bid of ₹${Number(amount).toLocaleString('en-IN')} for "${auction.title}".`,
            link: `/client/listings/${auction.requirementId || auctionId}`,
          })
          .catch(() => {}),
      ),
    );

    await this.notifications
      .createInAppNotification({
        userId: vendorId,
        type: 'sealed_bid_submitted',
        title: 'Sealed Bid Submitted',
        message: `Your sealed bid of ₹${Number(amount).toLocaleString('en-IN')} for "${auction.title}" has been successfully submitted.`,
        link: `/vendor/marketplace/${auction.requirementId || auctionId}`,
      })
      .catch(() => {});

    return {
      ...bidData,
      createdAt: bidData.createdAt.toDate(),
    };
  }

  async selectWinner(id: string, vendorUserId: string) {
    const db = this.firebaseService.db;
    const auctionRef = db.collection('auctions').doc(id);

    const vendorUserDoc = await db.collection('users').doc(vendorUserId).get();
    const vendorUser = vendorUserDoc.exists ? vendorUserDoc.data() : null;
    const winnerCompanyId = vendorUser?.companyId ?? null;

    const updateData: any = {
      status: AuctionStatus.COMPLETED,
      updatedAt: admin.firestore.Timestamp.now(),
    };
    if (winnerCompanyId) {
      updateData.winnerId = winnerCompanyId;
    }

    await auctionRef.update(updateData);

    const auctionDoc = await auctionRef.get();
    const a = auctionDoc.data()!;
    const auction = {
      ...a,
      id,
      createdAt: convertDate(a.createdAt),
      updatedAt: convertDate(a.updatedAt),
      sealedPhaseStart: convertDate(a.sealedPhaseStart),
      sealedPhaseEnd: convertDate(a.sealedPhaseEnd),
      openPhaseStart: convertDate(a.openPhaseStart),
      openPhaseEnd: convertDate(a.openPhaseEnd),
    } as any;

    const clientCompanyDoc = await db.collection('companies').doc(auction.clientId).get();
    auction.client = clientCompanyDoc.exists ? { id: clientCompanyDoc.id, ...clientCompanyDoc.data() } : null;

    if (auction.requirementId) {
      const reqDoc = await db.collection('requirements').doc(auction.requirementId).get();
      auction.requirement = reqDoc.exists ? { id: reqDoc.id, ...reqDoc.data() } : null;
    } else {
      auction.requirement = null;
    }

    const bidsSnap = await auctionRef.collection('bids')
      .where('vendorId', '==', vendorUserId)
      .orderBy('amount', 'desc')
      .limit(1)
      .get();

    const winningBid = bidsSnap.empty ? null : {
      id: bidsSnap.docs[0].id,
      ...bidsSnap.docs[0].data(),
      vendor: {
        id: vendorUserId,
        name: vendorUser?.name || 'Vendor',
        email: vendorUser?.email || '',
      }
    } as any;

    auction.bids = winningBid ? [winningBid] : [];

    const vendorAddress = 'Address on file';

    try {
      const workOrderS3Key = await this.documents.generateWorkOrderPdf(
        auction.id,
        auction.client?.name || 'Client',
        winningBid?.vendor?.name || 'Vendor',
        vendorAddress,
        auction.title,
        auction.requirement?.totalWeight || 0,
        winningBid?.amount || 0,
      );

      const newDoc: S3Document = {
        id: db.collection('auctions').doc().id,
        type: DocumentType.WORK_ORDER,
        s3Key: workOrderS3Key,
        s3Bucket: process.env.AWS_S3_BUCKET_NAME || 'ecoloop-docs',
        fileName: `WO-${auction.id.substring(0, 8).toUpperCase()}.pdf`,
        mimeType: 'application/pdf',
        uploadedAt: new Date(),
      };

      await auctionRef.update({
        auctionDocs: admin.firestore.FieldValue.arrayUnion(newDoc),
        updatedAt: admin.firestore.Timestamp.now(),
      });
      auction.auctionDocs = [...(auction.auctionDocs || []), newDoc];
    } catch (e) {
      console.error('Failed to generate work order', e);
    }

    if (winningBid?.vendor?.email) {
      await this.notifications
        .notifyAuctionWinner(
          winningBid.vendor.email,
          winningBid.vendor.name,
          auction.title,
          winningBid.amount,
          auction.client?.name || 'Client',
          auction.id,
        )
        .catch(() => {});
    }

    await this.notifications
      .createInAppNotification({
        userId: vendorUserId,
        type: 'auction_won',
        title: 'You Won the Auction!',
        message: `Congratulations! You won the auction for "${auction.title}" with a bid of ₹${winningBid?.amount || 0}.`,
        link: '/vendor/final-quote',
      })
      .catch(() => {});

    const clientUsersSnap = await db.collection('users').where('companyId', '==', auction.clientId).get();
    const clientUsers = clientUsersSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    await Promise.all(
      clientUsers.map((clientUser: any) =>
        this.notifications
          .createInAppNotification({
            userId: clientUser.id,
            type: 'auction_winner_selected',
            title: 'Auction Winner Selected',
            message: `You selected "${winningBid?.vendor?.name || 'a vendor'}" as the winner for "${auction.title}".`,
            link: `/client/purchase-order`,
          })
          .catch(() => {}),
      ),
    );

    const otherBidsSnap = await auctionRef.collection('bids').get();
    const otherVendorIds = Array.from(new Set(
      otherBidsSnap.docs.map((doc: any) => doc.data().vendorId).filter((vid: any) => vid !== vendorUserId)
    ));

    await Promise.all(
      otherVendorIds.map((vid: any) =>
        this.notifications
          .createInAppNotification({
            userId: vid,
            type: 'auction_lost',
            title: 'Auction Concluded',
            message: `The auction for "${auction.title}" has concluded. Thank you for participating.`,
          })
          .catch(() => {}),
      ),
    );

    return auction;
  }

  async generatePostAuctionDocs(id: string, data?: GenerateDocsDto) {
    const db = this.firebaseService.db;
    const auctionRef = db.collection('auctions').doc(id);
    const auctionDoc = await auctionRef.get();
    if (!auctionDoc.exists) throw new NotFoundException('Auction not found');
    const a = auctionDoc.data()!;

    if (!a.winnerId) {
      throw new BadRequestException(
        'Winner must be selected and approved before generating documents.',
      );
    }

    // Save terms if provided
    if (data) {
      await auctionRef.update({
        poPaymentTerms: data.paymentTerms || null,
        poDeliveryTerms: data.deliveryTerms || null,
        poPenaltyClause: data.penaltyClause || null,
        poSpecialConditions: data.specialConditions || null,
      });
    }

    const auction = {
      ...a,
      id,
      createdAt: convertDate(a.createdAt),
      updatedAt: convertDate(a.updatedAt),
    } as any;

    const clientCompanyDoc = await db.collection('companies').doc(auction.clientId).get();
    auction.client = clientCompanyDoc.exists ? clientCompanyDoc.data() : null;

    const winnerCompanyDoc = await db.collection('companies').doc(auction.winnerId).get();
    auction.winner = winnerCompanyDoc.exists ? winnerCompanyDoc.data() : null;

    if (auction.requirementId) {
      const reqDoc = await db.collection('requirements').doc(auction.requirementId).get();
      auction.requirement = reqDoc.exists ? reqDoc.data() : null;
    } else {
      auction.requirement = null;
    }

    const bidsSnap = await auctionRef.collection('bids').orderBy('amount', 'desc').get();
    const bids = bidsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as any));
    auction.bids = bids;

    const winningBid =
      bids.find((b: any) => b.vendorId === auction.winnerId) ||
      bids[0];
    const winningAmount = winningBid?.amount ?? auction.basePrice;
    const commissionAmount = Math.round(winningAmount * 0.05);
    const totalWeight = auction.requirement?.totalWeight ?? 0;
    const vendorName = auction.winner?.name ?? 'Vendor';
    const clientName = auction.client?.name ?? 'Client';
    const poNumber = `PO-${new Date().getFullYear()}-${id.substring(0, 8).toUpperCase()}`;
    const date = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const bucket = this.s3.getPrivateBucket();

    const results: { type: string; s3Key: string; fileName: string }[] = [];
    
    // In Firestore version, we'll replace the docs in the array if they already exist
    let currentDocs = (auction.auctionDocs || []) as S3Document[];
    const typesToGenerate = [DocumentType.PURCHASE_ORDER, DocumentType.AGREEMENT, DocumentType.WORK_ORDER];
    
    // Filter out existing docs of these types if we are regenerating
    if (data) {
        currentDocs = currentDocs.filter(d => !typesToGenerate.includes(d.type));
    }

    const hasPO = currentDocs.some((d: any) => d.type === DocumentType.PURCHASE_ORDER);
    if (!hasPO) {
      try {
        const poKey = await this.documents.generatePoPdf({
          auctionId: id,
          poNumber,
          clientName,
          clientAddress: auction.client?.address ?? '',
          clientGst: auction.client?.gstNumber ?? '',
          vendorName,
          vendorAddress: auction.winner?.address ?? '',
          vendorGst: auction.winner?.gstNumber ?? '',
          auctionTitle: auction.title,
          category: auction.category,
          totalWeight,
          winningAmount,
          commissionAmount,
          date,
          paymentTerms: data?.paymentTerms || auction.poPaymentTerms,
          deliveryTerms: data?.deliveryTerms || auction.poDeliveryTerms,
          penaltyClause: data?.penaltyClause || auction.poPenaltyClause,
          specialConditions: data?.specialConditions || auction.poSpecialConditions,
        });

        const newDoc: S3Document = {
          id: db.collection('auctions').doc().id,
          type: DocumentType.PURCHASE_ORDER,
          s3Key: poKey,
          s3Bucket: bucket,
          fileName: `${poNumber}.pdf`,
          mimeType: 'application/pdf',
          uploadedAt: new Date(),
        };
        currentDocs.push(newDoc);
        results.push({
          type: 'PURCHASE_ORDER',
          s3Key: poKey,
          fileName: `${poNumber}.pdf`,
        });
      } catch (e) {
        console.error('PO generation failed', e);
        throw new BadRequestException(
          `Failed to generate Purchase Order: ${e.message}`,
        );
      }
    }

    const hasAgr = currentDocs.some((d: any) => d.type === DocumentType.AGREEMENT);
    if (!hasAgr) {
      try {
        const agrKey = await this.documents.generateAgreementPdf({
          auctionId: id,
          clientName,
          vendorName,
          auctionTitle: auction.title,
          totalWeight,
          winningAmount,
          date,
          paymentTerms: data?.paymentTerms || auction.poPaymentTerms,
          deliveryTerms: data?.deliveryTerms || auction.poDeliveryTerms,
          penaltyClause: data?.penaltyClause || auction.poPenaltyClause,
          specialConditions: data?.specialConditions || auction.poSpecialConditions,
        });

        const newDoc: S3Document = {
          id: db.collection('auctions').doc().id,
          type: DocumentType.AGREEMENT,
          s3Key: agrKey,
          s3Bucket: bucket,
          fileName: `AGR-${poNumber}.pdf`,
          mimeType: 'application/pdf',
          uploadedAt: new Date(),
        };
        currentDocs.push(newDoc);
        results.push({
          type: 'AGREEMENT',
          s3Key: agrKey,
          fileName: `AGR-${poNumber}.pdf`,
        });
      } catch (e) {
        console.error('Agreement generation failed', e);
        throw new BadRequestException(
          `Failed to generate Agreement: ${e.message}`,
        );
      }
    }

    const hasWO = currentDocs.some((d: any) => d.type === DocumentType.WORK_ORDER);
    if (!hasWO) {
      try {
        const woKey = await this.documents.generateWorkOrderPdf(
          id,
          clientName,
          vendorName,
          auction.winner?.address ?? '',
          auction.title,
          totalWeight,
          winningAmount,
          data || {
            paymentTerms: auction.poPaymentTerms,
            deliveryTerms: auction.poDeliveryTerms,
            penaltyClause: auction.poPenaltyClause,
            specialConditions: auction.poSpecialConditions,
          }
        );

        const newDoc: S3Document = {
          id: db.collection('auctions').doc().id,
          type: DocumentType.WORK_ORDER,
          s3Key: woKey,
          s3Bucket: bucket,
          fileName: `WO-${id.substring(0, 8).toUpperCase()}.pdf`,
          mimeType: 'application/pdf',
          uploadedAt: new Date(),
        };
        currentDocs.push(newDoc);
        results.push({
          type: 'WORK_ORDER',
          s3Key: woKey,
          fileName: `WO-${id.substring(0, 8).toUpperCase()}.pdf`,
        });
      } catch (e) {
        console.error('WO generation failed', e);
        throw new BadRequestException(
          `Failed to generate Work Order: ${e.message}`,
        );
      }
    }

    await auctionRef.update({
      auctionDocs: currentDocs,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    const paymentCol = auctionRef.collection('payment');
    const paymentSnap = await paymentCol.get();
    if (paymentSnap.empty) {
      const paymentId = paymentCol.doc().id;
      const paymentDoc: PaymentDoc = {
        id: paymentId,
        status: PaymentStatus.PENDING,
        clientAmount: winningAmount,
        commissionAmount,
        totalAmount: winningAmount + commissionAmount,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await paymentCol.doc(paymentId).set(paymentDoc);
    } else {
      const paymentId = paymentSnap.docs[0].id;
      await paymentCol.doc(paymentId).update({
        clientAmount: winningAmount,
        commissionAmount,
        totalAmount: winningAmount + commissionAmount,
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }

    const pickupCol = auctionRef.collection('pickup');
    const pickupSnap = await pickupCol.get();
    if (pickupSnap.empty) {
      const pickupId = pickupCol.doc().id;
      const pickupDoc: PickupDoc = {
        id: pickupId,
        status: PickupStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        pickupDocs: [],
      };
      await pickupCol.doc(pickupId).set(pickupDoc);
    }

    return { success: true, documents: results, poNumber };
  }

  async getAuctionWithPostDocs(id: string) {
    const db = this.firebaseService.db;
    const auctionRef = db.collection('auctions').doc(id);
    const auctionDoc = await auctionRef.get();
    if (!auctionDoc.exists) throw new NotFoundException('Auction not found');
    const a = auctionDoc.data()!;

    const auction = {
      ...a,
      id,
      createdAt: convertDate(a.createdAt),
      updatedAt: convertDate(a.updatedAt),
      sealedPhaseStart: convertDate(a.sealedPhaseStart),
      sealedPhaseEnd: convertDate(a.sealedPhaseEnd),
      openPhaseStart: convertDate(a.openPhaseStart),
      openPhaseEnd: convertDate(a.openPhaseEnd),
    } as any;

    const clientCompanyDoc = await db.collection('companies').doc(auction.clientId).get();
    auction.client = clientCompanyDoc.exists ? clientCompanyDoc.data() : null;

    if (auction.winnerId) {
      const winnerCompanyDoc = await db.collection('companies').doc(auction.winnerId).get();
      auction.winner = winnerCompanyDoc.exists ? winnerCompanyDoc.data() : null;
    } else {
      auction.winner = null;
    }

    if (auction.requirementId) {
      const reqDoc = await db.collection('requirements').doc(auction.requirementId).get();
      auction.requirement = reqDoc.exists ? reqDoc.data() : null;
    } else {
      auction.requirement = null;
    }

    const bidsSnap = await auctionRef.collection('bids').orderBy('amount', 'desc').limit(1).get();
    auction.bids = bidsSnap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: convertDate(doc.data().createdAt),
    }));

    const pickupCol = auctionRef.collection('pickup');
    const pickupSnap = await pickupCol.limit(1).get();
    if (!pickupSnap.empty) {
      const pData = pickupSnap.docs[0].data();
      const pickupDocId = pickupSnap.docs[0].id;

      const paymentCol = auctionRef.collection('payment');
      const paymentSnap = await paymentCol.limit(1).get();
      const paymentData = paymentSnap.empty ? null : {
        id: paymentSnap.docs[0].id,
        ...paymentSnap.docs[0].data(),
        createdAt: convertDate(paymentSnap.docs[0].data().createdAt),
        updatedAt: convertDate(paymentSnap.docs[0].data().updatedAt),
      };

      auction.pickup = {
        id: pickupDocId,
        ...pData,
        createdAt: convertDate(pData.createdAt),
        updatedAt: convertDate(pData.updatedAt),
        scheduledDate: convertDate(pData.scheduledDate),
        gatePassIssuedAt: convertDate(pData.gatePassIssuedAt),
        vendorAcknowledgedAt: convertDate(pData.vendorAcknowledgedAt),
        invoiceGeneratedAt: convertDate(pData.invoiceGeneratedAt),
        vendorPreferredDate: convertDate(pData.vendorPreferredDate),
        clientVerifiedAt: convertDate(pData.clientVerifiedAt),
        payment: paymentData,
      };
    } else {
      auction.pickup = null;
    }

    const paymentCol = auctionRef.collection('payment');
    const paymentSnap = await paymentCol.limit(1).get();
    auction.payment = paymentSnap.empty ? null : {
      id: paymentSnap.docs[0].id,
      ...paymentSnap.docs[0].data(),
      createdAt: convertDate(paymentSnap.docs[0].data().createdAt),
      updatedAt: convertDate(paymentSnap.docs[0].data().updatedAt),
    };

    const ratingsSnap = await db.collection('ratings').where('auctionId', '==', id).get();
    auction.ratings = ratingsSnap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: convertDate(doc.data().createdAt),
    }));

    return auction;
  }

  async uploadFinalQuote(
    auctionId: string,
    file: Express.Multer.File,
    type: 'FINAL_QUOTE' | 'LETTERHEAD_QUOTATION',
  ) {
    const db = this.firebaseService.db;
    const auctionRef = db.collection('auctions').doc(auctionId);
    
    const { key, bucket } = await this.s3.upload(
      file,
      `final-quotes/${auctionId}`,
    );

    const docId = db.collection('auctions').doc().id;
    const newDoc: S3Document = {
      id: docId,
      type: type as DocumentType,
      s3Key: key,
      s3Bucket: bucket,
      fileName: file.originalname,
      mimeType: file.mimetype,
      uploadedAt: new Date(),
    };

    await auctionRef.update({
      auctionDocs: admin.firestore.FieldValue.arrayUnion(newDoc),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    const auctionDoc = await auctionRef.get();
    if (auctionDoc.exists) {
      const auction = auctionDoc.data()!;
      let vendorName = 'Winner';
      if (auction.winnerId) {
        const winnerCompanyDoc = await db.collection('companies').doc(auction.winnerId).get();
        if (winnerCompanyDoc.exists) {
          vendorName = winnerCompanyDoc.data()!.name;
        }
      }

      await this.notifications
        .notifyAdmins({
          type: 'final_quote_uploaded',
          title: 'Final Quote Uploaded',
          message: `Vendor "${vendorName}" uploaded the final quote for "${auction.title}".`,
          link: `/admin/auctions`,
        })
        .catch(() => {});

      const clientUsersSnap = await db.collection('users').where('companyId', '==', auction.clientId).get();
      const clientUsers = clientUsersSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      await Promise.all(
        clientUsers.map((clientUser: any) =>
          this.notifications
            .createInAppNotification({
              userId: clientUser.id,
              type: 'final_quote_uploaded',
              title: 'Final Quote Uploaded',
              message: `Vendor "${vendorName}" uploaded the final quote for "${auction.title}". Please review.`,
              link: `/client/purchase-order`,
            })
            .catch(() => {}),
        ),
      );
    }

    return newDoc;
  }

  async approveQuote(auctionId: string) {
    const db = this.firebaseService.db;
    const auctionRef = db.collection('auctions').doc(auctionId);
    const auctionDoc = await auctionRef.get();
    if (!auctionDoc.exists) throw new NotFoundException('Auction not found');
    const auction = auctionDoc.data()!;

    const bidsSnap = await auctionRef.collection('bids').orderBy('amount', 'desc').limit(1).get();
    const winningBid = bidsSnap.empty ? null : bidsSnap.docs[0].data();

    const totalAmount = winningBid?.amount || auction.basePrice;
    const commissionAmount = Math.round(totalAmount * 0.05);
    const clientAmount = totalAmount - commissionAmount;

    await auctionRef.update({
      quoteApproved: true,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    if (winningBid?.vendorId) {
      await this.notifications
        .createInAppNotification({
          userId: winningBid.vendorId,
          type: 'final_quote_approved',
          title: 'Final Quote Approved',
          message: `Your final quote for "${auction.title}" has been approved. Please submit payment.`,
          link: '/vendor/payments',
        })
        .catch(() => {});
    }

    const paymentCol = auctionRef.collection('payment');
    const paymentSnap = await paymentCol.get();
    let payment: any = null;
    if (paymentSnap.empty) {
      const paymentId = paymentCol.doc().id;
      payment = {
        id: paymentId,
        status: PaymentStatus.PENDING,
        clientAmount,
        commissionAmount,
        totalAmount,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await paymentCol.doc(paymentId).set(payment);
    } else {
      const paymentId = paymentSnap.docs[0].id;
      payment = {
        id: paymentId,
        ...paymentSnap.docs[0].data(),
        clientAmount,
        commissionAmount,
        totalAmount,
        updatedAt: new Date(),
      };
      await paymentCol.doc(paymentId).update({
        clientAmount,
        commissionAmount,
        totalAmount,
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }

    return { auction: { ...auction, quoteApproved: true }, payment };
  }

  async rejectQuote(auctionId: string, remarks: string) {
    const db = this.firebaseService.db;
    const auctionRef = db.collection('auctions').doc(auctionId);
    
    await auctionRef.update({
      quoteApproved: false,
      quoteRemarks: remarks,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    const auctionDoc = await auctionRef.get();
    const auction = auctionDoc.data()!;

    const bidsSnap = await auctionRef.collection('bids').orderBy('amount', 'desc').limit(1).get();
    const winningBid = bidsSnap.empty ? null : bidsSnap.docs[0].data();

    if (winningBid?.vendorId) {
      await this.notifications
        .createInAppNotification({
          userId: winningBid.vendorId,
          type: 'final_quote_rejected',
          title: 'Final Quote Rejected',
          message: `Your final quote for "${auction.title}" has been rejected. Remarks: ${remarks}`,
          link: '/vendor/final-quote',
        })
        .catch(() => {});
    }

    return auction;
  }

  async shareSealedBids(auctionId: string, bidIds: string[]) {
    const db = this.firebaseService.db;
    const auctionRef = db.collection('auctions').doc(auctionId);
    const auctionDoc = await auctionRef.get();
    if (!auctionDoc.exists) throw new NotFoundException('Auction not found');

    const bidsCol = auctionRef.collection('bids');
    const bidsSnap = await bidsCol.get();

    const batch = db.batch();
    for (const doc of bidsSnap.docs) {
      const isShortlisted = bidIds.includes(doc.id);
      batch.update(doc.ref, {
        isShortlisted,
      });
    }
    await batch.commit();

    return { success: true, message: 'Bids shared with client' };
  }

  async updateStatus(id: string, status: AuctionStatus) {
    const db = this.firebaseService.db;
    const auctionRef = db.collection('auctions').doc(id);
    await auctionRef.update({
      status,
      updatedAt: admin.firestore.Timestamp.now(),
    });
    const updated = await auctionRef.get();
    return { id, ...updated.data() };
  }

  async transitionPhases(): Promise<{ endedAuctionIds: string[] }> {
    const db = this.firebaseService.db;
    const now = new Date();

    const upcomingSnap = await db.collection('auctions')
      .where('status', '==', AuctionStatus.UPCOMING)
      .get();
    
    const batch1 = db.batch();
    upcomingSnap.docs.forEach((doc: any) => {
      const data = doc.data();
      const sealedPhaseStart = convertDate(data.sealedPhaseStart);
      if (sealedPhaseStart && sealedPhaseStart <= now) {
        batch1.update(doc.ref, {
          status: AuctionStatus.SEALED_PHASE,
          updatedAt: admin.firestore.Timestamp.now(),
        });
      }
    });
    await batch1.commit();

    const sealedSnap = await db.collection('auctions')
      .where('status', '==', AuctionStatus.SEALED_PHASE)
      .where('liveApprovalStatus', '==', 'approved')
      .get();

    const batch2 = db.batch();
    sealedSnap.docs.forEach((doc: any) => {
      const data = doc.data();
      const openPhaseStart = convertDate(data.openPhaseStart);
      if (openPhaseStart && openPhaseStart <= now) {
        batch2.update(doc.ref, {
          status: AuctionStatus.OPEN_PHASE,
          updatedAt: admin.firestore.Timestamp.now(),
        });
      }
    });
    await batch2.commit();

    const endingSnap = await db.collection('auctions')
      .where('status', '==', AuctionStatus.OPEN_PHASE)
      .get();

    const endedAuctionIds: string[] = [];
    if (!endingSnap.empty) {
      const batch3 = db.batch();
      endingSnap.docs.forEach((doc: any) => {
        const data = doc.data();
        const openPhaseEnd = convertDate(data.openPhaseEnd);
        if (openPhaseEnd && openPhaseEnd <= now) {
          endedAuctionIds.push(doc.id);
          batch3.update(doc.ref, {
            status: AuctionStatus.PENDING_SELECTION,
            updatedAt: admin.firestore.Timestamp.now(),
          });
        }
      });
      await batch3.commit();
    }

    return { endedAuctionIds };
  }

  async disqualifyWinner(
    auctionId: string,
    disqualifiedVendorUserId: string,
    reason: string,
    fineAmount: number,
  ) {
    const db = this.firebaseService.db;
    const auctionRef = db.collection('auctions').doc(auctionId);
    
    const auctionDoc = await auctionRef.get();
    if (!auctionDoc.exists) throw new NotFoundException('Auction not found');
    const a = auctionDoc.data()!;

    const clientCompanyDoc = await db.collection('companies').doc(a.clientId).get();
    const client = clientCompanyDoc.exists ? clientCompanyDoc.data() : null;

    const bidsSnap = await auctionRef.collection('bids').orderBy('amount', 'desc').get();
    const bidsWithVendors = await Promise.all(bidsSnap.docs.map(async (doc: any) => {
      const b = doc.data();
      const vendorUserDoc = await db.collection('users').doc(b.vendorId).get();
      const vendor = vendorUserDoc.exists ? { id: b.vendorId, name: (vendorUserDoc.data() as any)?.name, email: (vendorUserDoc.data() as any)?.email } : null;
      return {
        ...b,
        id: doc.id,
        createdAt: convertDate(b.createdAt),
        vendor,
      };
    })) as any[];

    const auction: any = {
      ...a,
      id: auctionId,
      client,
      bids: bidsWithVendors,
    };

    const disqualifiedUserDoc = await db.collection('users').doc(disqualifiedVendorUserId).get();
    if (!disqualifiedUserDoc.exists)
      throw new NotFoundException('Disqualified vendor not found');
    const disqualifiedUser = disqualifiedUserDoc.data()!;

    const seenVendors = new Set<string>();
    let nextWinnerBid: any = null;
    for (const bid of bidsWithVendors) {
      if ((bid as any).vendorId === disqualifiedVendorUserId) continue;
      if (!seenVendors.has((bid as any).vendorId)) {
        seenVendors.add((bid as any).vendorId);
        if (!nextWinnerBid) nextWinnerBid = bid;
      }
    }

    if (!nextWinnerBid) {
      throw new BadRequestException(
        'No other eligible bidder found to elevate as winner.',
      );
    }

    await auctionRef.update({
      winnerId: null,
      status: AuctionStatus.PENDING_SELECTION,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    if (disqualifiedUser.email) {
      await this.notifications
        .notifyVendorDisqualified(
          disqualifiedUser.email,
          disqualifiedUser.name,
          auction.title,
          reason,
          fineAmount,
        )
        .catch(() => {});
    }

    await this.notifications
      .createInAppNotification({
        userId: disqualifiedVendorUserId,
        type: 'auction_disqualified',
        title: 'You Have Been Disqualified',
        message: `Your auction win for "${auction.title}" has been revoked by the admin. Reason: ${reason}${fineAmount > 0 ? `. A fine of ₹${fineAmount.toLocaleString('en-IN')} has been levied.` : ''}`,
        link: '/vendor/auctions',
      })
      .catch(() => {});

    return this.selectWinner(auctionId, nextWinnerBid.vendorId);
  }

  async extendTimer(id: string) {
    const db = this.firebaseService.db;
    const auctionRef = db.collection('auctions').doc(id);
    const auctionDoc = await auctionRef.get();
    if (!auctionDoc.exists || !auctionDoc.data()?.openPhaseEnd)
      throw new NotFoundException('Auction not found');
    
    const auction = auctionDoc.data()!;
    const openPhaseEnd = convertDate(auction.openPhaseEnd)!;
    const extensionCount = auction.extensionCount || 0;
    const maxTicks = auction.maxTicks || 0;
    const extensionMinutes = auction.extensionMinutes || 0;

    if (extensionCount >= maxTicks) {
      return {
        ...auction,
        id,
        openPhaseEnd,
      };
    }

    const newEnd = new Date(openPhaseEnd.getTime() + extensionMinutes * 60 * 1000);
    const updatedData = {
      openPhaseEnd: admin.firestore.Timestamp.fromDate(newEnd),
      extensionCount: extensionCount + 1,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await auctionRef.update(updatedData);

    return {
      ...auction,
      ...updatedData,
      id,
      openPhaseEnd: newEnd,
    };
  }
}
