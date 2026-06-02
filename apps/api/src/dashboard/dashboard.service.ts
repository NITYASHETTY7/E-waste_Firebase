import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AuctionStatus,
  CompanyStatus,
  PaymentStatus,
  PickupStatus,
} from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getAdminStats() {
    const [
      totalClients,
      totalVendors,
      pendingApprovals,
      activeAuctions,
      totalRevenue,
      pendingPayments,
      completedDeals,
    ] = await Promise.all([
      this.prisma.company.count({
        where: { type: 'CLIENT', status: CompanyStatus.APPROVED },
      }),
      this.prisma.company.count({
        where: { type: 'VENDOR', status: CompanyStatus.APPROVED },
      }),
      this.prisma.company.count({ where: { status: CompanyStatus.PENDING } }),
      this.prisma.auction.count({
        where: { status: AuctionStatus.OPEN_PHASE },
      }),
      this.prisma.payment.aggregate({
        _sum: { commissionAmount: true },
        where: { status: PaymentStatus.CONFIRMED },
      }),
      this.prisma.payment.count({ where: { status: PaymentStatus.SUBMITTED } }),
      this.prisma.auction.count({ where: { status: AuctionStatus.COMPLETED } }),
    ]);

    return {
      totalClients,
      totalVendors,
      pendingApprovals,
      activeAuctions,
      totalRevenue: totalRevenue._sum.commissionAmount || 0,
      pendingPayments,
      completedDeals,
    };
  }

  async getClientStats(clientId: string) {
    const [myAuctions, activeAuctions, completedAuctions] = await Promise.all([
      this.prisma.auction.count({ where: { clientId } }),
      this.prisma.auction.count({
        where: {
          clientId,
          status: {
            in: [AuctionStatus.OPEN_PHASE, AuctionStatus.SEALED_PHASE],
          },
        },
      }),
      this.prisma.auction.count({
        where: { clientId, status: AuctionStatus.COMPLETED },
      }),
    ]);

    const recentAuctions = await this.prisma.auction.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { winner: true },
    });

    return { myAuctions, activeAuctions, completedAuctions, recentAuctions };
  }

  async getVendorStats(vendorId: string) {
    const [wonAuctions, activeBids, pendingPickups] = await Promise.all([
      this.prisma.auction.count({ where: { winnerId: vendorId } }),
      this.prisma.bid.count({
        where: {
          vendor: { companyId: vendorId },
          auction: { status: AuctionStatus.OPEN_PHASE },
        },
      }),
      this.prisma.pickup.count({
        where: {
          auction: { winnerId: vendorId },
          status: {
            in: [PickupStatus.SCHEDULED, PickupStatus.DOCUMENTS_UPLOADED],
          },
        },
      }),
    ]);

    const recentWins = await this.prisma.auction.findMany({
      where: { winnerId: vendorId, status: AuctionStatus.COMPLETED },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: { client: true },
    });

    return { wonAuctions, activeBids, pendingPickups, recentWins };
  }

  async getAdminRevenueAnalytics() {
    const payments = await this.prisma.payment.findMany({
      where: { status: PaymentStatus.CONFIRMED },
      select: { createdAt: true, totalAmount: true, commissionAmount: true },
    });

    const totalRevenue = payments.reduce((s, p) => s + p.totalAmount, 0);
    const totalCommission = payments.reduce(
      (s, p) => s + p.commissionAmount,
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

    payments.forEach((p) => {
      const month = months[p.createdAt.getMonth()];
      monthlyMap[month] += p.commissionAmount;
    });

    const monthlyRevenue = Object.entries(monthlyMap).map(
      ([month, amount]) => ({ month, amount }),
    );

    const [completedDeals, activeVendors] = await Promise.all([
      this.prisma.auction.count({ where: { status: AuctionStatus.COMPLETED } }),
      this.prisma.company.count({
        where: { type: 'VENDOR', status: CompanyStatus.APPROVED },
      }),
    ]);

    // Top vendors
    const vendorStats = await this.prisma.auction.groupBy({
      by: ['winnerId'],
      where: { status: AuctionStatus.COMPLETED, winnerId: { not: null } },
      _count: { _all: true },
    });

    const topVendors = [];
    for (const v of vendorStats.slice(0, 5)) {
      if (!v.winnerId) continue;
      const company = await this.prisma.company.findUnique({
        where: { id: v.winnerId },
      });
      if (company) {
        topVendors.push({
          name: company.name,
          deals: v._count._all,
          revenue: 0,
        }); // Simplification for now
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
    const payments = await this.prisma.payment.findMany({
      where: {
        auction: { winnerId: companyId },
        status: PaymentStatus.CONFIRMED,
      },
      select: { createdAt: true, totalAmount: true },
    });

    const totalEarnings = payments.reduce((s, p) => s + p.totalAmount, 0);

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

    payments.forEach((p) => {
      const month = months[p.createdAt.getMonth()];
      monthlyMap[month] += p.totalAmount;
    });

    const monthlyEarnings = Object.entries(monthlyMap).map(
      ([month, amount]) => ({ month, amount }),
    );

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { rating: true },
    });

    const completedPickups = await this.prisma.pickup.count({
      where: {
        auction: { winnerId: companyId },
        status: PickupStatus.COMPLETED,
      },
    });

    return {
      totalEarnings,
      completedPickups,
      averageRating: company?.rating || 0,
      monthlyEarnings,
    };
  }
}
