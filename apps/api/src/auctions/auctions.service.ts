import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { NotificationService } from '../notifications/notification.service';
import { DocumentsService } from '../documents/documents.service';
import { RedisService } from '../redis/redis.service';
import { AuctionStatus, BidPhase, DocumentType, Prisma } from '@prisma/client';

@Injectable()
export class AuctionsService {
  constructor(
    private prisma: PrismaService,
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

    // 1. Idempotency Check
    if (idempotencyKey) {
      const isNew = await this.redis.checkAndSetIdempotency(idempotencyKey, 1000 * 60 * 60); // 1 hour
      if (!isNew) {
        // Return current highest state instead of error to handle retries gracefully
        const auction = await this.findOne(auctionId);
        const leaderboard = await this.getLeaderboard(auctionId);
        return { bid: auction.bids[0], auction, leaderboard };
      }
    }

    // 2. Distributed Lock with Retry
    const lockKey = `lock:auction:${auctionId}`;
    const lockValue = `${vendorId}:${Date.now()}`;
    let locked = false;
    for (let i = 0; i < 10; i++) {
      locked = await this.redis.acquireLock(lockKey, lockValue, 5000);
      if (locked) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    if (!locked) {
      throw new BadRequestException('Bidding contention high, please try again.');
    }

    try {
      // 3. Database Transaction (Optimistic + Double-Check)
      return await this.prisma.$transaction(async (tx) => {
        const auction = await tx.auction.findUnique({
          where: { id: auctionId },
          include: {
            bids: {
              where: { phase: BidPhase.OPEN },
              orderBy: { amount: 'desc' },
              take: 1,
            },
          },
        });

        if (!auction) throw new NotFoundException('Auction not found');

        // Validation
        if (auction.status !== AuctionStatus.OPEN_PHASE) {
          throw new BadRequestException('Auction is not in open phase');
        }

        const now = new Date();
        if (auction.openPhaseStart && now < auction.openPhaseStart) {
          throw new BadRequestException('Auction has not started yet');
        }
        if (auction.openPhaseEnd && now > auction.openPhaseEnd) {
          throw new BadRequestException('Auction has already ended');
        }

        const vendorUser = await tx.user.findUnique({
          where: { id: vendorId },
          include: { company: true },
        });
        if (vendorUser?.company?.isLocked) {
          throw new BadRequestException('Your account is locked');
        }

        if (!vendorUser?.companyId) {
          throw new BadRequestException('Vendor company not found');
        }

        // 3b. Shortlist Check
        const isShortlisted = await tx.bid.findFirst({
          where: {
            auctionId,
            phase: BidPhase.SEALED,
            isShortlisted: true,
            vendor: {
              companyId: vendorUser.companyId
            }
          },
        });

        if (!isShortlisted) {
          throw new BadRequestException('Your company is not shortlisted for the live auction');
        }

        const highestBid = auction.bids[0]?.amount || auction.basePrice;
        const minRequired = highestBid + auction.tickSize;

        if (amount < minRequired) {
          throw new BadRequestException(`Minimum bid is ₹${minRequired}`);
        }

        // Create Bid
        const bid = await tx.bid.create({
          data: {
            auctionId,
            vendorId,
            amount,
            phase: BidPhase.OPEN,
          },
          include: { vendor: { select: { id: true, name: true } } },
        });

        // 4. Update Auction (Optimistic Lock)
        let updatedAuction = await tx.auction.update({
          where: {
            id: auctionId,
            version: auction.version,
          },
          data: {
            version: { increment: 1 },
          },
        });

        // 5. Timer Extension (Anti-sniping)
        const endTime = updatedAuction.openPhaseEnd!;
        const msToEnd = endTime.getTime() - now.getTime();
        const extMinutes = updatedAuction.extensionMinutes ?? 3;
        
        if (extMinutes > 0 && msToEnd > 0 && msToEnd < extMinutes * 60 * 1000 && updatedAuction.extensionCount < updatedAuction.maxTicks) {
          const newEnd = new Date(endTime.getTime() + extMinutes * 60 * 1000);
          updatedAuction = await tx.auction.update({
            where: { id: auctionId, version: updatedAuction.version },
            data: {
              openPhaseEnd: newEnd,
              extensionCount: { increment: 1 },
              version: { increment: 1 },
            },
          });
        }

        // 6. Update Leaderboard in Redis (Async-ish)
        await this.redis.updateLeaderboard(auctionId, vendorId, amount);

        const leaderboard = await this.getLeaderboard(auctionId);

        return { bid, auction: updatedAuction, leaderboard };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new BadRequestException('Concurrent update detected, please retry.');
      }
      throw e;
    } finally {
      await this.redis.releaseLock(lockKey, lockValue);
    }
  }

  async getLeaderboard(auctionId: string) {
    const raw = await this.redis.getLeaderboard(auctionId);
    // raw is [id1, score1, id2, score2, ...]
    const result = [];
    for (let i = 0; i < raw.length; i += 2) {
      const vendorId = raw[i];
      const amount = parseFloat(raw[i + 1]);
      
      // We could fetch vendor names from DB here or just return IDs
      // For efficiency, let's just return IDs and amounts
      result.push({ vendorId, amount, rank: (i / 2) + 1 });
    }

    if (result.length === 0) {
      // Fallback to DB if Redis is empty
      const bids = await this.prisma.bid.findMany({
        where: { auctionId, phase: BidPhase.OPEN },
        orderBy: { amount: 'desc' },
        include: { vendor: { select: { id: true, name: true } } },
      });
      const seen = new Set<string>();
      return bids.filter((b) => {
        if (seen.has(b.vendorId)) return false;
        seen.add(b.vendorId);
        return true;
      }).map((b, idx) => ({ vendorId: b.vendorId, amount: b.amount, rank: idx + 1, vendor: b.vendor }));
    }

    return result;
  }

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
    if (clientUser) {
      if (clientUser.email) {
        const configureUrl = `${process.env.WEB_URL || 'http://localhost:3000'}/client/listings/${updated.requirementId || id}/configure-live`;
        await this.notifications.notifyClientLiveAuctionApproval(
          clientUser.email,
          clientUser.name,
          updated.title,
          configureUrl
        ).catch(console.error);
      }
      await this.notifications.createInAppNotification({
        userId: clientUser.id,
        type: 'live_auction_approval',
        title: 'Review Live Auction Parameters',
        message: `Admin has scheduled the live parameters for "${updated.title}". Please review and approve.`,
        link: `/client/listings/${updated.requirementId || id}/configure-live`,
      }).catch(() => {});
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
      await this.notifications.createInAppNotification({
        userId: bid.vendorId,
        type: 'live_auction_approved',
        title: "You're Shortlisted for Live Auction!",
        message: `The live auction for "${auction.title}" has been approved. Place your bids now!`,
        link: `/vendor/marketplace/${auction.requirementId || auction.id}`,
      }).catch(() => {});
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

    const bid = await this.prisma.bid.create({
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

    // Notify client and admins in-app
    await this.notifications.notifyAdmins({
      type: 'sealed_bid_submitted',
      title: 'Sealed Bid Submitted',
      message: `Vendor "${vendorUser?.company?.name || vendorUser?.name || 'A vendor'}" submitted a sealed bid of ₹${amount.toLocaleString('en-IN')} for "${auction.title}".`,
      link: `/admin/listings/${auction.requirementId || auctionId}`,
    }).catch(() => {});

    const clientUsers = await this.prisma.user.findMany({
      where: { companyId: auction.clientId },
    });
    await Promise.all(
      clientUsers.map((clientUser) =>
        this.notifications.createInAppNotification({
          userId: clientUser.id,
          type: 'sealed_bid_submitted',
          title: 'Sealed Bid Submitted',
          message: `Vendor "${vendorUser?.company?.name || vendorUser?.name || 'A vendor'}" submitted a sealed bid of ₹${amount.toLocaleString('en-IN')} for "${auction.title}".`,
          link: `/client/listings/${auction.requirementId || auctionId}`,
        }).catch(() => {}),
      ),
    );

    return bid;
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

    // In-app notification for the winner
    await this.notifications.createInAppNotification({
      userId: vendorUserId,
      type: 'auction_won',
      title: 'You Won the Auction!',
      message: `Congratulations! You won the auction for "${auction.title}" with a bid of ₹${winningBid?.amount || 0}.`,
      link: '/vendor/final-quote',
    }).catch(() => {});

    // In-app notifications for client users
    const clientUsers = await this.prisma.user.findMany({
      where: { companyId: auction.clientId },
    });
    await Promise.all(
      clientUsers.map((clientUser) =>
        this.notifications.createInAppNotification({
          userId: clientUser.id,
          type: 'auction_winner_selected',
          title: 'Auction Winner Selected',
          message: `You selected "${winningBid?.vendor?.name || 'a vendor'}" as the winner for "${auction.title}".`,
          link: `/client/purchase-order`,
        }).catch(() => {}),
      ),
    );

    // In-app notifications for other participants
    const otherBids = await this.prisma.bid.findMany({
      where: { auctionId: id, vendorId: { not: vendorUserId } },
      select: { vendorId: true },
      distinct: ['vendorId'],
    });
    await Promise.all(
      otherBids.map((ob) =>
        this.notifications.createInAppNotification({
          userId: ob.vendorId,
          type: 'auction_lost',
          title: 'Auction Concluded',
          message: `The auction for "${auction.title}" has concluded. Thank you for participating.`,
        }).catch(() => {}),
      ),
    );

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
    const doc = await this.prisma.auctionDocument.create({
      data: {
        type: type as DocumentType,
        s3Key: key,
        s3Bucket: bucket,
        fileName: file.originalname,
        mimeType: file.mimetype,
        auctionId,
      },
    });

    // In-app notifications
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: { winner: true },
    });
    if (auction) {
      await this.notifications.notifyAdmins({
        type: 'final_quote_uploaded',
        title: 'Final Quote Uploaded',
        message: `Vendor "${auction.winner?.name || 'Winner'}" uploaded the final quote for "${auction.title}".`,
        link: `/admin/auctions`,
      }).catch(() => {});

      const clientUsers = await this.prisma.user.findMany({
        where: { companyId: auction.clientId },
      });
      await Promise.all(
        clientUsers.map((clientUser) =>
          this.notifications.createInAppNotification({
            userId: clientUser.id,
            type: 'final_quote_uploaded',
            title: 'Final Quote Uploaded',
            message: `Vendor "${auction.winner?.name || 'Winner'}" uploaded the final quote for "${auction.title}". Please review.`,
            link: `/client/purchase-order`,
          }).catch(() => {}),
        ),
      );
    }

    return doc;
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

    // Notify vendor user
    if (winningBid?.vendorId) {
      await this.notifications.createInAppNotification({
        userId: winningBid.vendorId,
        type: 'final_quote_approved',
        title: 'Final Quote Approved',
        message: `Your final quote for "${auction.title}" has been approved. Please submit payment.`,
        link: '/vendor/payments',
      }).catch(() => {});
    }

    // Upsert payment record — safe to call multiple times
    const payment = await this.prisma.payment.upsert({
      where: { auctionId },
      create: { auctionId, clientAmount, commissionAmount, totalAmount },
      update: { clientAmount, commissionAmount, totalAmount },
    });

    return { auction: { ...auction, quoteApproved: true }, payment };
  }

  async rejectQuote(auctionId: string, remarks: string) {
    const auction = await this.prisma.auction.update({
      where: { id: auctionId },
      data: { quoteApproved: false, quoteRemarks: remarks },
      include: { bids: { orderBy: { amount: 'desc' }, take: 1 } },
    });

    const winningBid = auction.bids[0];
    if (winningBid?.vendorId) {
      await this.notifications.createInAppNotification({
        userId: winningBid.vendorId,
        type: 'final_quote_rejected',
        title: 'Final Quote Rejected',
        message: `Your final quote for "${auction.title}" has been rejected. Remarks: ${remarks}`,
        link: '/vendor/final-quote',
      }).catch(() => {});
    }

    return auction;
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

  async disqualifyWinner(
    auctionId: string,
    disqualifiedVendorUserId: string,
    reason: string,
    fineAmount: number,
  ) {
    // 1. Load the auction with all bids ordered by highest amount
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        client: true,
        bids: {
          orderBy: { amount: 'desc' },
          include: { vendor: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!auction) throw new NotFoundException('Auction not found');

    // 2. Get the disqualified vendor's user and company info
    const disqualifiedUser = await this.prisma.user.findUnique({
      where: { id: disqualifiedVendorUserId },
      select: { id: true, name: true, email: true, companyId: true },
    });
    if (!disqualifiedUser) throw new NotFoundException('Disqualified vendor not found');

    // 3. Find the next highest unique bidder (excluding the disqualified one)
    const seenVendors = new Set<string>();
    let nextWinnerBid: typeof auction.bids[0] | null = null;
    for (const bid of auction.bids) {
      if (bid.vendorId === disqualifiedVendorUserId) continue;
      if (!seenVendors.has(bid.vendorId)) {
        seenVendors.add(bid.vendorId);
        if (!nextWinnerBid) nextWinnerBid = bid;
      }
    }

    if (!nextWinnerBid) {
      throw new BadRequestException('No other eligible bidder found to elevate as winner.');
    }

    // 4. Remove current winner & reset auction status back to allow re-selection
    await this.prisma.auction.update({
      where: { id: auctionId },
      data: { winnerId: null, status: AuctionStatus.PENDING_SELECTION },
    });

    // 5. Send disqualification email to the rejected vendor
    if (disqualifiedUser.email) {
      await this.notifications.notifyVendorDisqualified(
        disqualifiedUser.email,
        disqualifiedUser.name,
        auction.title,
        reason,
        fineAmount,
      ).catch(() => {});
    }

    // 6. In-app notification to the disqualified vendor
    await this.notifications.createInAppNotification({
      userId: disqualifiedUser.id,
      type: 'auction_disqualified',
      title: 'You Have Been Disqualified',
      message: `Your auction win for "${auction.title}" has been revoked by the admin. Reason: ${reason}${fineAmount > 0 ? `. A fine of ₹${fineAmount.toLocaleString('en-IN')} has been levied.` : ''}`,
      link: '/vendor/auctions',
    }).catch(() => {});

    // 7. Now select the next winner using the existing logic
    return this.selectWinner(auctionId, nextWinnerBid.vendorId);
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
