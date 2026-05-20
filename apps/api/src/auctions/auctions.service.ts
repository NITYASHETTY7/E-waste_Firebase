import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { NotificationService } from '../notifications/notification.service';
import { DocumentsService } from '../documents/documents.service';
import { AuctionStatus, BidPhase, DocumentType } from '@prisma/client';

@Injectable()
export class AuctionsService {
  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
    private notifications: NotificationService,
    private documents: DocumentsService,
  ) {}

  async findAllBids(auctionId?: string) {
    return this.prisma.bid.findMany({
      where: auctionId ? { auctionId } : {},
      include: { vendor: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: {
    title: string;
    category: string;
    description?: string;
    basePrice: number;
    targetPrice?: number;
    tickSize?: number;
    maxTicks?: number;
    extensionMinutes?: number;
    clientId: string;
    requirementId?: string;
  }) {
    return this.prisma.auction.create({ data });
  }

  async findAll(status?: AuctionStatus, clientId?: string) {
    return this.prisma.auction.findMany({
      where: {
        ...(status && { status }),
        ...(clientId && { clientId }),
      },
      include: {
        client: true,
        winner: true,
        bids: { orderBy: { amount: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
      include: {
        client: true,
        winner: true,
        bids: {
          orderBy: { amount: 'desc' },
          include: { vendor: { select: { id: true, name: true } } },
        },
        auctionDocs: true,
        pickup: true,
      },
    });
    if (!auction) throw new NotFoundException('Auction not found');
    return auction;
  }

  async schedule(
    id: string,
    data: {
      sealedPhaseStart: string;
      sealedPhaseEnd: string;
      openPhaseStart: string;
      openPhaseEnd: string;
      tickSize?: number;
      maxTicks?: number;
      extensionMinutes?: number;
    },
  ) {
    const existing = await this.prisma.auction.findUnique({ where: { id }, select: { status: true } });
    if (!existing) throw new NotFoundException('Auction not found');

    // Preserve current status if already in an active phase; only set UPCOMING for DRAFT
    const nextStatus = existing.status === AuctionStatus.DRAFT
      ? AuctionStatus.UPCOMING
      : existing.status;

    const updated = await this.prisma.auction.update({
      where: { id },
      data: {
        sealedPhaseStart: new Date(data.sealedPhaseStart),
        sealedPhaseEnd: new Date(data.sealedPhaseEnd),
        openPhaseStart: new Date(data.openPhaseStart),
        openPhaseEnd: new Date(data.openPhaseEnd),
        ...(data.tickSize && { tickSize: data.tickSize }),
        ...(data.maxTicks && { maxTicks: data.maxTicks }),
        ...(data.extensionMinutes && { extensionMinutes: data.extensionMinutes }),
        status: nextStatus,
      },
      include: { client: { include: { users: true } } },
    });

    const clientUser = updated.client?.users?.[0];
    if (clientUser?.email) {
      const configureUrl = `${process.env.WEB_URL || 'http://localhost:3000'}/client/listings/${updated.requirementId || id}/configure-live`;
      await this.notifications.notifyClientLiveAuctionApproval(
        clientUser.email,
        clientUser.name,
        updated.title,
        configureUrl
      ).catch(console.error);
    }

    return updated;
  }

  async approveLiveAuction(id: string) {
    const auction = await this.prisma.auction.update({
      where: { id },
      data: { status: AuctionStatus.OPEN_PHASE }, // Optionally set state to OPEN_PHASE or just UPCOMING.
      include: {
        client: true,
        bids: { include: { vendor: { select: { id: true, name: true, email: true } } } },
      },
    });

    if (!auction) throw new NotFoundException('Auction not found');

    const approvedBids = auction.bids.filter(b => b.phase === BidPhase.SEALED && b.clientStatus === 'approved');

    for (const bid of approvedBids) {
      if (bid.vendor?.email) {
        await this.notifications.notifyLiveAuctionApproved(
          bid.vendor.email,
          bid.vendor.name,
          auction.title,
          `${process.env.WEB_URL || 'http://localhost:3000'}/vendor/marketplace/${auction.requirementId || auction.id}`
        ).catch(console.error);
      }
    }

    return { success: true, message: 'Live auction approved and vendors notified' };
  }

  async submitSealedBid(
    auctionId: string,
    vendorId: string,
    amount: number,
    file?: Express.Multer.File,
    remarks?: string,
  ) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
    });
    if (!auction) throw new NotFoundException('Auction not found');

    const vendorUser = await this.prisma.user.findUnique({
      where: { id: vendorId },
      include: { company: true },
    });

    if (vendorUser?.company?.isLocked) {
      throw new BadRequestException('Your account is locked. Please contact admin.');
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

    return this.prisma.bid.create({
      data: {
        auctionId,
        vendorId,
        amount,
        phase: BidPhase.SEALED,
        remarks,
        priceSheetS3Key,
        priceSheetS3Bucket,
        priceSheetFileName,
      },
    });
  }

  async selectWinner(id: string, vendorUserId: string) {
    // vendorId from bids is a User ID; winnerId on Auction is a Company ID
    const vendorUser = await this.prisma.user.findUnique({
      where: { id: vendorUserId },
      select: { companyId: true, name: true, email: true },
    });
    const winnerCompanyId = vendorUser?.companyId ?? null;

    const auction = await this.prisma.auction.update({
      where: { id },
      data: {
        ...(winnerCompanyId ? { winnerId: winnerCompanyId } : {}),
        status: AuctionStatus.COMPLETED,
      },
      include: {
        client: true,
        requirement: true,
        bids: {
          where: { vendorId: vendorUserId },
          orderBy: { amount: 'desc' },
          take: 1,
          include: {
            vendor: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    const winningBid = auction.bids[0];
    const vendorAddress = 'Address on file';

    try {
      const workOrderS3Key = await this.documents.generateWorkOrderPdf(
        auction.id,
        auction.client.name,
        winningBid?.vendor?.name || 'Vendor',
        vendorAddress,
        auction.title,
        auction.requirement?.totalWeight || 0,
        winningBid?.amount || 0,
      );

      await this.prisma.auctionDocument.create({
        data: {
          auctionId: auction.id,
          type: DocumentType.WORK_ORDER,
          s3Key: workOrderS3Key,
          s3Bucket: process.env.AWS_S3_BUCKET_NAME || 'ecoloop-docs',
          fileName: `WO-${auction.id.substring(0, 8).toUpperCase()}.pdf`,
          mimeType: 'application/pdf',
        },
      });
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
          auction.client.name,
          auction.id,
        )
        .catch(() => {});
    }

    return auction;
  }

  async generatePostAuctionDocs(id: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
      include: {
        client: true,
        winner: true,
        requirement: true,
        bids: { orderBy: { amount: 'desc' }, take: 1 },
        auctionDocs: true,
      },
    });
    if (!auction) throw new NotFoundException('Auction not found');

    const winningAmount = auction.bids[0]?.amount ?? auction.basePrice;
    const commissionAmount = Math.round(winningAmount * 0.05);
    const totalWeight = auction.requirement?.totalWeight ?? 0;
    const vendorName = auction.winner?.name ?? 'Vendor';
    const clientName = auction.client.name;
    const poNumber = `PO-${new Date().getFullYear()}-${id.substring(0, 8).toUpperCase()}`;
    const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const bucket = process.env.AWS_S3_BUCKET_NAME ?? 'ecoloop-docs';

    const results: { type: string; s3Key: string; fileName: string }[] = [];

    // Generate Purchase Order PDF
    try {
      const poKey = await this.documents.generatePoPdf({
        auctionId: id, poNumber,
        clientName, clientAddress: auction.client.address ?? '',
        clientGst: auction.client.gstNumber ?? '',
        vendorName, vendorAddress: auction.winner?.address ?? '',
        vendorGst: auction.winner?.gstNumber ?? '',
        auctionTitle: auction.title,
        category: auction.category,
        totalWeight, winningAmount, commissionAmount,
        date,
      });
      await this.prisma.auctionDocument.create({
        data: {
          auctionId: id, type: DocumentType.PURCHASE_ORDER,
          s3Key: poKey, s3Bucket: bucket,
          fileName: `${poNumber}.pdf`, mimeType: 'application/pdf',
        },
      });
      results.push({ type: 'PURCHASE_ORDER', s3Key: poKey, fileName: `${poNumber}.pdf` });
    } catch (e) { console.error('PO generation failed', e); }

    // Generate Agreement PDF
    try {
      const agrKey = await this.documents.generateAgreementPdf({
        auctionId: id,
        clientName, vendorName,
        auctionTitle: auction.title,
        totalWeight, winningAmount, date,
      });
      await this.prisma.auctionDocument.create({
        data: {
          auctionId: id, type: DocumentType.AGREEMENT,
          s3Key: agrKey, s3Bucket: bucket,
          fileName: `AGR-${poNumber}.pdf`, mimeType: 'application/pdf',
        },
      });
      results.push({ type: 'AGREEMENT', s3Key: agrKey, fileName: `AGR-${poNumber}.pdf` });
    } catch (e) { console.error('Agreement generation failed', e); }

    // Ensure Work Order exists — generate if missing
    const hasWO = auction.auctionDocs.some(d => d.type === DocumentType.WORK_ORDER);
    if (!hasWO) {
      try {
        const woKey = await this.documents.generateWorkOrderPdf(
          id, clientName, vendorName, auction.winner?.address ?? '',
          auction.title, totalWeight, winningAmount,
        );
        await this.prisma.auctionDocument.create({
          data: {
            auctionId: id, type: DocumentType.WORK_ORDER,
            s3Key: woKey, s3Bucket: bucket,
            fileName: `WO-${id.substring(0, 8).toUpperCase()}.pdf`, mimeType: 'application/pdf',
          },
        });
        results.push({ type: 'WORK_ORDER', s3Key: woKey, fileName: `WO-${id.substring(0, 8).toUpperCase()}.pdf` });
      } catch (e) { console.error('WO generation failed', e); }
    }

    // Upsert payment record
    await this.prisma.payment.upsert({
      where: { auctionId: id },
      create: { auctionId: id, clientAmount: winningAmount, commissionAmount, totalAmount: winningAmount + commissionAmount },
      update: {},
    });

    // Upsert pickup record
    await this.prisma.pickup.upsert({
      where: { auctionId: id },
      create: { auctionId: id },
      update: {},
    });

    return { success: true, documents: results, poNumber };
  }

  async getAuctionWithPostDocs(id: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
      include: {
        client: true,
        winner: true,
        requirement: true,
        auctionDocs: true,
        bids: { orderBy: { amount: 'desc' }, take: 1 },
        pickup: { include: { pickupDocs: true, payment: true } },
        payment: true,
        ratings: true,
      },
    });
    if (!auction) throw new NotFoundException('Auction not found');
    return auction;
  }

  async uploadFinalQuote(
    auctionId: string,
    file: Express.Multer.File,
    type: 'FINAL_QUOTE' | 'LETTERHEAD_QUOTATION',
  ) {
    const { key, bucket } = await this.s3.upload(
      file,
      `final-quotes/${auctionId}`,
    );
    return this.prisma.auctionDocument.create({
      data: {
        type: type as DocumentType,
        s3Key: key,
        s3Bucket: bucket,
        fileName: file.originalname,
        mimeType: file.mimetype,
        auctionId,
      },
    });
  }

  async approveQuote(auctionId: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: { bids: { orderBy: { amount: 'desc' }, take: 1 } },
    });
    if (!auction) throw new NotFoundException('Auction not found');

    // Calculate commission (5%) and client amount
    const winningBid = auction.bids[0];
    const totalAmount = winningBid?.amount || auction.basePrice;
    const commissionAmount = Math.round(totalAmount * 0.05);
    const clientAmount = totalAmount - commissionAmount;

    // Update auction
    await this.prisma.auction.update({
      where: { id: auctionId },
      data: { quoteApproved: true },
    });

    // Upsert payment record — safe to call multiple times
    const payment = await this.prisma.payment.upsert({
      where: { auctionId },
      create: { auctionId, clientAmount, commissionAmount, totalAmount },
      update: { clientAmount, commissionAmount, totalAmount },
    });

    return { auction: { ...auction, quoteApproved: true }, payment };
  }

  async rejectQuote(auctionId: string, remarks: string) {
    return this.prisma.auction.update({
      where: { id: auctionId },
      data: { quoteApproved: false, quoteRemarks: remarks },
    });
  }

  async shareSealedBids(auctionId: string, bidIds: string[]) {
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new NotFoundException('Auction not found');

    // Reset all bids to false
    await this.prisma.bid.updateMany({
      where: { auctionId },
      data: { isShortlisted: false },
    });

    // Set selected bids to true
    if (bidIds.length > 0) {
      await this.prisma.bid.updateMany({
        where: { id: { in: bidIds } },
        data: { isShortlisted: true },
      });
    }

    return { success: true, message: 'Bids shared with client' };
  }

  async updateStatus(id: string, status: AuctionStatus) {
    return this.prisma.auction.update({ where: { id }, data: { status } });
  }

  async transitionPhases(): Promise<{ endedAuctionIds: string[] }> {
    const now = new Date();

    await this.prisma.auction.updateMany({
      where: { status: AuctionStatus.UPCOMING, sealedPhaseStart: { lte: now } },
      data: { status: AuctionStatus.SEALED_PHASE },
    });

    await this.prisma.auction.updateMany({
      where: {
        status: AuctionStatus.SEALED_PHASE,
        openPhaseStart: { lte: now },
        liveApprovalStatus: 'approved',
      },
      data: { status: AuctionStatus.OPEN_PHASE },
    });

    // Capture which live auctions are expiring before updating them
    const endingAuctions = await this.prisma.auction.findMany({
      where: { status: AuctionStatus.OPEN_PHASE, openPhaseEnd: { lte: now } },
      select: { id: true },
    });

    if (endingAuctions.length > 0) {
      await this.prisma.auction.updateMany({
        where: { id: { in: endingAuctions.map(a => a.id) } },
        data: { status: AuctionStatus.PENDING_SELECTION },
      });
    }

    return { endedAuctionIds: endingAuctions.map(a => a.id) };
  }

  async extendTimer(id: string) {
    const auction = await this.prisma.auction.findUnique({ where: { id } });
    if (!auction || !auction.openPhaseEnd)
      throw new NotFoundException('Auction not found');
    if (auction.extensionCount >= auction.maxTicks) return auction;

    const newEnd = new Date(
      auction.openPhaseEnd.getTime() + auction.extensionMinutes * 60 * 1000,
    );
    return this.prisma.auction.update({
      where: { id },
      data: { openPhaseEnd: newEnd, extensionCount: { increment: 1 } },
    });
  }
}
