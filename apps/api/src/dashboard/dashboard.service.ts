import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import * as admin from 'firebase-admin';
import {
  AuctionStatus,
  CompanyStatus,
  CompanyType,
  PaymentStatus,
  PickupStatus,
} from '../firebase/firestore-types';

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
export class DashboardService {
  constructor(private firebaseService: FirebaseService) {}

  private get db(): admin.firestore.Firestore {
    return this.firebaseService.db;
  }

  async getAdminStats() {
    const [
      totalClientsSnap,
      totalVendorsSnap,
      pendingApprovalsSnap,
      activeAuctionsSnap,
      pendingPaymentsSnap,
      completedDealsSnap,
    ] = await Promise.all([
      this.db
        .collection('companies')
        .where('type', '==', CompanyType.CLIENT)
        .where('status', '==', CompanyStatus.APPROVED)
        .count()
        .get(),
      this.db
        .collection('companies')
        .where('type', '==', CompanyType.VENDOR)
        .where('status', '==', CompanyStatus.APPROVED)
        .count()
        .get(),
      this.db
        .collection('companies')
        .where('status', '==', CompanyStatus.PENDING)
        .count()
        .get(),
      this.db
        .collection('auctions')
        .where('status', '==', AuctionStatus.OPEN_PHASE)
        .count()
        .get(),
      this.db
        .collectionGroup('payment')
        .where('status', '==', PaymentStatus.SUBMITTED)
        .count()
        .get(),
      this.db
        .collection('auctions')
        .where('status', '==', AuctionStatus.COMPLETED)
        .count()
        .get(),
    ]);

    const totalClients = totalClientsSnap.data().count;
    const totalVendors = totalVendorsSnap.data().count;
    const pendingApprovals = pendingApprovalsSnap.data().count;
    const activeAuctions = activeAuctionsSnap.data().count;
    const pendingPayments = pendingPaymentsSnap.data().count;
    const completedDeals = completedDealsSnap.data().count;

    // Fetch confirmed payments to sum the commissionAmount
    const confirmedPaymentsSnap = await this.db
      .collectionGroup('payment')
      .where('status', '==', PaymentStatus.CONFIRMED)
      .get();

    let totalRevenue = 0;
    confirmedPaymentsSnap.forEach((doc: any) => {
      const data = doc.data();
      totalRevenue += data.commissionAmount || 0;
    });

    return {
      totalClients,
      totalVendors,
      pendingApprovals,
      activeAuctions,
      totalRevenue,
      pendingPayments,
      completedDeals,
    };
  }

  async getClientStats(clientId: string) {
    const [myAuctionsSnap, activeAuctionsSnap, completedAuctionsSnap] =
      await Promise.all([
        this.db
          .collection('auctions')
          .where('clientId', '==', clientId)
          .count()
          .get(),
        this.db
          .collection('auctions')
          .where('clientId', '==', clientId)
          .where('status', 'in', [
            AuctionStatus.OPEN_PHASE,
            AuctionStatus.SEALED_PHASE,
          ])
          .count()
          .get(),
        this.db
          .collection('auctions')
          .where('clientId', '==', clientId)
          .where('status', '==', AuctionStatus.COMPLETED)
          .count()
          .get(),
      ]);

    const myAuctions = myAuctionsSnap.data().count;
    const activeAuctions = activeAuctionsSnap.data().count;
    const completedAuctions = completedAuctionsSnap.data().count;

    const recentAuctionsSnap = await this.db
      .collection('auctions')
      .where('clientId', '==', clientId)
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();

    const recentAuctions = [];
    for (const doc of recentAuctionsSnap.docs) {
      const data = doc.data();
      let winner = null;
      if (data.winnerId) {
        const winnerSnap = await this.db
          .collection('companies')
          .doc(data.winnerId)
          .get();
        if (winnerSnap.exists) {
          winner = { id: winnerSnap.id, ...winnerSnap.data() };
        }
      }
      recentAuctions.push({
        id: doc.id,
        ...data,
        createdAt: convertDate(data.createdAt),
        updatedAt: convertDate(data.updatedAt),
        sealedPhaseStart: convertDate(data.sealedPhaseStart),
        sealedPhaseEnd: convertDate(data.sealedPhaseEnd),
        openPhaseStart: convertDate(data.openPhaseStart),
        openPhaseEnd: convertDate(data.openPhaseEnd),
        winner,
      });
    }

    return { myAuctions, activeAuctions, completedAuctions, recentAuctions };
  }

  async getVendorStats(vendorId: string) {
    const wonAuctionsSnap = await this.db
      .collection('auctions')
      .where('winnerId', '==', vendorId)
      .count()
      .get();

    const wonAuctions = wonAuctionsSnap.data().count;

    const bidsSnap = await this.db
      .collectionGroup('bids')
      .where('vendorId', '==', vendorId)
      .get();

    const auctionIds = Array.from(
      new Set(bidsSnap.docs.map((doc: any) => doc.ref.parent.parent!.id)),
    );

    let activeBids = 0;
    if (auctionIds.length > 0) {
      const chunks = chunkArray(auctionIds, 30);
      for (const chunk of chunks) {
        const auctionsSnap = await this.db
          .collection('auctions')
          .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
          .where('status', '==', AuctionStatus.OPEN_PHASE)
          .get();
        activeBids += auctionsSnap.size;
      }
    }

    const pickupsSnap = await this.db
      .collectionGroup('pickup')
      .where('status', 'in', [
        PickupStatus.SCHEDULED,
        PickupStatus.DOCUMENTS_UPLOADED,
      ])
      .get();

    let pendingPickups = 0;
    for (const doc of pickupsSnap.docs) {
      const auctionId = doc.ref.parent.parent!.id;
      const auctionSnap = await this.db
        .collection('auctions')
        .doc(auctionId)
        .get();
      if (auctionSnap.exists && auctionSnap.data()?.winnerId === vendorId) {
        pendingPickups++;
      }
    }

    const recentWinsSnap = await this.db
      .collection('auctions')
      .where('winnerId', '==', vendorId)
      .where('status', '==', AuctionStatus.COMPLETED)
      .orderBy('updatedAt', 'desc')
      .limit(5)
      .get();

    const recentWins = [];
    for (const doc of recentWinsSnap.docs) {
      const data = doc.data();
      let client = null;
      if (data.clientId) {
        const clientSnap = await this.db
          .collection('companies')
          .doc(data.clientId)
          .get();
        if (clientSnap.exists) {
          client = { id: clientSnap.id, ...clientSnap.data() };
        }
      }
      recentWins.push({
        id: doc.id,
        ...data,
        createdAt: convertDate(data.createdAt),
        updatedAt: convertDate(data.updatedAt),
        sealedPhaseStart: convertDate(data.sealedPhaseStart),
        sealedPhaseEnd: convertDate(data.sealedPhaseEnd),
        openPhaseStart: convertDate(data.openPhaseStart),
        openPhaseEnd: convertDate(data.openPhaseEnd),
        client,
      });
    }

    return { wonAuctions, activeBids, pendingPickups, recentWins };
  }

  async getAdminRevenueAnalytics() {
    const paymentsSnap = await this.db
      .collectionGroup('payment')
      .where('status', '==', PaymentStatus.CONFIRMED)
      .get();

    const payments = paymentsSnap.docs.map((doc: any) => {
      const d = doc.data();
      return {
        createdAt: convertDate(d.createdAt) || new Date(),
        totalAmount: d.totalAmount || 0,
        commissionAmount: d.commissionAmount || 0,
      };
    });

    const totalRevenue = payments.reduce((s: number, p: any) => s + p.totalAmount, 0);
    const totalCommission = payments.reduce(
      (s: number, p: any) => s + p.commissionAmount,
      0,
    );

    // Monthly aggregation
    const monthlyMap: Record<string, number> = {};
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    months.forEach((m) => (monthlyMap[m] = 0));

    payments.forEach((p: any) => {
      const month = months[p.createdAt.getMonth()];
      monthlyMap[month] += p.commissionAmount;
    });

    const monthlyRevenue = Object.entries(monthlyMap).map(
      ([month, amount]) => ({ month, amount }),
    );

    const [completedDealsSnap, activeVendorsSnap] = await Promise.all([
      this.db
        .collection('auctions')
        .where('status', '==', AuctionStatus.COMPLETED)
        .count()
        .get(),
      this.db
        .collection('companies')
        .where('type', '==', CompanyType.VENDOR)
        .where('status', '==', CompanyStatus.APPROVED)
        .count()
        .get(),
    ]);

    const completedDeals = completedDealsSnap.data().count;
    const activeVendors = activeVendorsSnap.data().count;

    // Top vendors
    const completedAuctionsSnap = await this.db
      .collection('auctions')
      .where('status', '==', AuctionStatus.COMPLETED)
      .get();

    const vendorDealsMap: Record<string, number> = {};
    completedAuctionsSnap.forEach((doc: any) => {
      const winnerId = doc.data().winnerId;
      if (winnerId) {
        vendorDealsMap[winnerId] = (vendorDealsMap[winnerId] || 0) + 1;
      }
    });

    const vendorStats = Object.entries(vendorDealsMap)
      .map(([winnerId, count]) => ({ winnerId, count }))
      .sort((a, b) => b.count - a.count);

    const topVendors = [];
    for (const v of vendorStats.slice(0, 5)) {
      if (!v.winnerId) continue;
      const companySnap = await this.db
        .collection('companies')
        .doc(v.winnerId)
        .get();
      if (companySnap.exists) {
        topVendors.push({
          name: companySnap.data()?.name || 'Unknown',
          deals: v.count,
          revenue: 0, // Simplification for now
        });
      }
    }

    return {
      monthlyRevenue,
      totalRevenue,
      totalCommission,
      completedDeals,
      activeVendors,
      topVendors,
    };
  }

  async getVendorAnalytics(companyId: string) {
    const paymentsSnap = await this.db
      .collectionGroup('payment')
      .where('status', '==', PaymentStatus.CONFIRMED)
      .get();

    const payments = [];
    for (const doc of paymentsSnap.docs) {
      const d = doc.data();
      const auctionId = doc.ref.parent.parent!.id;
      const auctionSnap = await this.db
        .collection('auctions')
        .doc(auctionId)
        .get();
      if (auctionSnap.exists && auctionSnap.data()?.winnerId === companyId) {
        payments.push({
          createdAt: convertDate(d.createdAt) || new Date(),
          totalAmount: d.totalAmount || 0,
        });
      }
    }

    const totalEarnings = payments.reduce((s: number, p: any) => s + p.totalAmount, 0);

    const monthlyMap: Record<string, number> = {};
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    months.forEach((m) => (monthlyMap[m] = 0));

    payments.forEach((p: any) => {
      const month = months[p.createdAt.getMonth()];
      monthlyMap[month] += p.totalAmount;
    });

    const monthlyEarnings = Object.entries(monthlyMap).map(
      ([month, amount]) => ({ month, amount }),
    );

    const companySnap = await this.db
      .collection('companies')
      .doc(companyId)
      .get();
    const company = companySnap.exists ? companySnap.data() : null;

    // completedPickups from subcollections of pickup
    const pickupsSnap = await this.db
      .collectionGroup('pickup')
      .where('status', '==', PickupStatus.COMPLETED)
      .get();

    let completedPickups = 0;
    for (const doc of pickupsSnap.docs) {
      const auctionId = doc.ref.parent.parent!.id;
      const auctionSnap = await this.db
        .collection('auctions')
        .doc(auctionId)
        .get();
      if (auctionSnap.exists && auctionSnap.data()?.winnerId === companyId) {
        completedPickups++;
      }
    }

    return {
      totalEarnings,
      completedPickups,
      averageRating: company?.rating || 0,
      monthlyEarnings,
    };
  }
}
