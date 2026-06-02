import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { NotificationService } from '../notifications/notification.service';
import { RequirementStatus, AuctionStatus, Prisma } from '@prisma/client';

@Injectable()
export class RequirementsService {
  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
    private notifications: NotificationService,
  ) {}

  async create(data: {
    title: string;
    description?: string;
    clientId: string;
    category?: string;
    totalWeight?: number;
    location?: string;
    invitedVendorIds?: string[];
    sealedPhaseStart?: string;
    sealedPhaseEnd?: string;
    file?: Express.Multer.File;
    documentFiles?: Express.Multer.File[];
    documentTypes?: string[];
  }) {
    if (!data.clientId) {
      throw new BadRequestException(
        'Your account is not linked to a company. Please complete onboarding or contact support.',
      );
    }

    let rawS3Key: string | undefined;
    if (data.file) {
      const { key } = await this.s3.upload(
        data.file,
        `requirements/${data.clientId}`,
      );
      rawS3Key = key;
    }

    const clientDocuments: { name: string; s3Key: string; type: string }[] = [];
    if (data.documentFiles?.length) {
      for (let i = 0; i < data.documentFiles.length; i++) {
        const docFile = data.documentFiles[i];
        const { key } = await this.s3.upload(
          docFile,
          `requirements/${data.clientId}/documents`,
        );
        clientDocuments.push({
          name: docFile.originalname,
          s3Key: key,
          type: data.documentTypes?.[i] ?? 'document',
        });
      }
    }

    return this.prisma.requirement.create({
      data: {
        title: data.title,
        description: data.description,
        clientId: data.clientId,
        rawS3Key,
        category: data.category,
        totalWeight: data.totalWeight ? Number(data.totalWeight) : undefined,
        invitedVendorIds: data.invitedVendorIds ?? [],
        sealedPhaseStart: data.sealedPhaseStart
          ? new Date(data.sealedPhaseStart)
          : undefined,
        sealedPhaseEnd: data.sealedPhaseEnd
          ? new Date(data.sealedPhaseEnd)
          : undefined,
        clientDocuments: clientDocuments.length ? clientDocuments : [],
      },
      include: { client: true },
    });
  }

  async findAll(clientId?: string) {
    return this.prisma.requirement.findMany({
      where: clientId ? { clientId } : {},
      include: {
        client: { include: { users: { select: { id: true }, take: 1 } } },
        auditInvitations: true,
        auction: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const req = await this.prisma.requirement.findUnique({
      where: { id },
      include: {
        client: true,
        auditInvitations: { include: { vendor: true, report: true } },
        auction: true,
      },
    });
    if (!req) throw new NotFoundException('Requirement not found');

    const rawDocs = Array.isArray(req.clientDocuments)
      ? (req.clientDocuments as any[])
      : [];
    const clientDocumentsWithUrls = await Promise.all(
      rawDocs.map(
        async (doc: { name: string; s3Key: string; type: string }) => ({
          name: doc.name,
          type: doc.type,
          url: doc.s3Key
            ? await this.s3.getSignedUrl(doc.s3Key).catch(() => '')
            : '',
        }),
      ),
    );

    return { ...req, clientDocumentsWithUrls };
  }

  // Admin uploads the cleaned / processed sheet
  async uploadProcessedSheet(
    id: string,
    file: Express.Multer.File,
    vendorIds?: string[],
  ) {
    const req = await this.findOne(id);
    const { key } = await this.s3.upload(
      file,
      `requirements/${req.clientId}/processed`,
    );
    const updateData: Prisma.RequirementUpdateInput = {
      processedS3Key: key,
      status: RequirementStatus.CLIENT_REVIEW,
    };
    if (vendorIds && vendorIds.length > 0) {
      updateData.invitedVendorIds = vendorIds;
    }
    const updated = await this.prisma.requirement.update({
      where: { id },
      data: updateData,
    });

    // Notify client that the processed sheet is ready for review
    const clientUser = await this.prisma.user.findFirst({
      where: { companyId: req.clientId },
      select: { id: true, email: true, name: true },
    });
    if (clientUser) {
      await this.notifications.notifyClientSheetReady(
        clientUser.email,
        clientUser.name,
        req.title,
        req.id,
      );
      await this.notifications
        .createInAppNotification({
          userId: clientUser.id,
          type: 'processed_sheet_ready',
          title: 'Processed Sheet Ready',
          message: `Your processed sheet for "${req.title}" has been uploaded and is ready for your review.`,
          link: `/client/listings/${req.id}`,
        })
        .catch(() => {});
    }

    return updated;
  }

  // Client approves the processed list — creates auction and sends vendor invitations
  async clientApprove(
    id: string,
    data: { targetPrice: number; totalWeight?: number; category?: string },
  ) {
    const req = await this.findOne(id);
    const { targetPrice, totalWeight, category } = data;

    const updated = await this.prisma.requirement.update({
      where: { id },
      data: {
        targetPrice: Number(targetPrice),
        ...(totalWeight !== undefined && { totalWeight: Number(totalWeight) }),
        ...(category !== undefined && { category }),
        status: RequirementStatus.FINALIZED,
      },
    });

    // Create the auction linked to this requirement
    const now = new Date();
    const sealedStart = req.sealedPhaseStart ?? now;
    const sealedEnd =
      req.sealedPhaseEnd ?? new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const auctionStatus =
      sealedStart <= now ? AuctionStatus.SEALED_PHASE : AuctionStatus.UPCOMING;

    let auction = req.auction;
    if (!auction) {
      auction = await this.prisma.auction.create({
        data: {
          title: req.title,
          category: req.category ?? 'General',
          description: req.description,
          basePrice: Number(targetPrice),
          targetPrice: Number(targetPrice),
          clientId: req.clientId,
          requirementId: req.id,
          status: auctionStatus,
          sealedPhaseStart: sealedStart,
          sealedPhaseEnd: sealedEnd,
        },
      });
    }

    // Send sealed-bid invitation emails + in-app notifications to admin-selected vendors
    if (req.invitedVendorIds.length > 0) {
      const vendors = await this.prisma.user.findMany({
        where: { id: { in: req.invitedVendorIds } },
        select: { id: true, name: true, email: true },
      });

      const sealedEndStr = sealedEnd.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const webUrl = process.env.WEB_URL || 'http://localhost:3000';

      await Promise.all(
        vendors.map(async (v) => {
          // Email invite (silently skipped in dev if SES not configured)
          await this.notifications.notifySealedBidInvitation(
            v.email,
            v.name,
            req.title,
            req.id,
            sealedEndStr,
          );
          // In-app notification so vendor sees it even without email
          await this.prisma.inAppNotification.create({
            data: {
              userId: v.id,
              type: 'sealed_bid_invitation',
              title: 'New Sealed Bid Invitation',
              message: `You have been invited to participate in a sealed bid auction: "${req.title}". Deadline: ${sealedEndStr}.`,
              link: `${webUrl}/vendor/invitations/${req.id}`,
            },
          });
        }),
      );
    }

    return { requirement: updated, auction };
  }

  /**
   * Admin approves the requirement.
   * - Marks requirement as FINALIZED
   * - Creates an Auction (UPCOMING / SEALED_PHASE) linked to it
   * - Sends sealed-bid invitation emails to every vendor the client selected
   */
  async adminApprove(id: string, adminUserId?: string) {
    const req = await this.findOne(id);

    // Mark approved
    const updated = await this.prisma.requirement.update({
      where: { id },
      data: {
        status: RequirementStatus.FINALIZED,
        adminApprovedAt: new Date(),
        adminApprovedById: adminUserId,
      },
    });

    // Create or update the auction linked to this requirement
    const now = new Date();
    const sealedStart = req.sealedPhaseStart ?? now;
    const sealedEnd =
      req.sealedPhaseEnd ?? new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const auctionStatus =
      sealedStart <= now ? AuctionStatus.SEALED_PHASE : AuctionStatus.UPCOMING;

    let auction = req.auction;
    if (!auction) {
      auction = await this.prisma.auction.create({
        data: {
          title: req.title,
          category: req.category ?? 'General',
          description: req.description,
          basePrice: req.targetPrice ?? 0,
          targetPrice: req.targetPrice,
          clientId: req.clientId,
          requirementId: req.id,
          status: auctionStatus,
          sealedPhaseStart: sealedStart,
          sealedPhaseEnd: sealedEnd,
        },
      });
    } else {
      await this.prisma.auction.update({
        where: { id: auction.id },
        data: {
          status: auctionStatus,
          sealedPhaseStart: sealedStart,
          sealedPhaseEnd: sealedEnd,
        },
      });
    }

    // Send invitation emails + in-app notifications to every selected vendor (User IDs)
    if (req.invitedVendorIds.length > 0) {
      const vendors = await this.prisma.user.findMany({
        where: { id: { in: req.invitedVendorIds } },
        select: { id: true, name: true, email: true },
      });

      const sealedEndStr = sealedEnd.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const webUrl = process.env.WEB_URL || 'http://localhost:3000';

      await Promise.all(
        vendors.map(async (v) => {
          await this.notifications.notifySealedBidInvitation(
            v.email,
            v.name,
            req.title,
            req.id,
            sealedEndStr,
          );
          await this.prisma.inAppNotification.create({
            data: {
              userId: v.id,
              type: 'sealed_bid_invitation',
              title: 'New Sealed Bid Invitation',
              message: `You have been invited to participate in a sealed bid auction: "${req.title}". Deadline: ${sealedEndStr}.`,
              link: `${webUrl}/vendor/invitations/${req.id}`,
            },
          });
        }),
      );
    }

    return { requirement: updated, auction };
  }

  async reject(id: string, reason?: string) {
    return this.prisma.requirement.update({
      where: { id },
      data: { status: RequirementStatus.REJECTED },
    });
  }

  async vendorRespond(
    requirementId: string,
    vendorUserId: string,
    action: 'accept' | 'decline',
  ) {
    const req = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
    });
    if (!req) throw new NotFoundException('Requirement not found');

    let updatedReq;
    if (action === 'accept') {
      updatedReq = await this.prisma.requirement.update({
        where: { id: requirementId },
        data: {
          acceptedVendorIds: { push: vendorUserId },
          declinedVendorIds: req.declinedVendorIds.filter(
            (id) => id !== vendorUserId,
          ),
        },
      });
    } else {
      updatedReq = await this.prisma.requirement.update({
        where: { id: requirementId },
        data: {
          declinedVendorIds: { push: vendorUserId },
          acceptedVendorIds: req.acceptedVendorIds.filter(
            (id) => id !== vendorUserId,
          ),
        },
      });
    }

    // In-app notifications
    const vendor = await this.prisma.user.findUnique({
      where: { id: vendorUserId },
      select: { name: true },
    });
    const vendorName = vendor?.name || 'A vendor';

    await this.notifications
      .notifyAdmins({
        type: 'vendor_invitation_response',
        title: 'Vendor Invitation Response',
        message: `${vendorName} has ${action}ed the invitation for "${req.title}".`,
        link: `/admin/listings/${req.id}`,
      })
      .catch(() => {});

    const clientUsers = await this.prisma.user.findMany({
      where: { companyId: req.clientId },
    });
    await Promise.all(
      clientUsers.map((clientUser) =>
        this.notifications
          .createInAppNotification({
            userId: clientUser.id,
            type: 'vendor_invitation_response',
            title: 'Vendor Invitation Response',
            message: `${vendorName} has ${action}ed the invitation for "${req.title}".`,
            link: `/client/listings/${req.id}`,
          })
          .catch(() => {}),
      ),
    );

    return updatedReq;
  }

  // ─── STEP 2: Vendor uploads audit documents ───────────────────────────────

  async uploadAuditDocs(
    requirementId: string,
    vendorUserId: string,
    files: {
      auditReport?: Express.Multer.File;
      filledExcel?: Express.Multer.File;
      images?: Express.Multer.File[];
    },
  ) {
    const req = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
    });
    if (!req) throw new NotFoundException('Requirement not found');

    const folder = `requirements/${requirementId}/audit-docs/${vendorUserId}`;
    let auditReportS3Key: string | undefined;
    let auditReportFileName: string | undefined;
    let excelS3Key: string | undefined;
    let excelFileName: string | undefined;
    const imageS3Keys: string[] = [];
    const imageFileNames: string[] = [];

    if (files.auditReport) {
      const { key } = await this.s3.upload(files.auditReport, folder);
      auditReportS3Key = key;
      auditReportFileName = files.auditReport.originalname;
    }
    if (files.filledExcel) {
      const { key } = await this.s3.upload(files.filledExcel, folder);
      excelS3Key = key;
      excelFileName = files.filledExcel.originalname;
    }
    if (files.images?.length) {
      for (const img of files.images) {
        const { key } = await this.s3.upload(img, `${folder}/images`);
        imageS3Keys.push(key);
        imageFileNames.push(img.originalname);
      }
    }

    const doc = await this.prisma.vendorAuditDoc.upsert({
      where: { requirementId_vendorUserId: { requirementId, vendorUserId } },
      create: {
        requirementId,
        vendorUserId,
        auditReportS3Key,
        auditReportFileName,
        excelS3Key,
        excelFileName,
        imageS3Keys,
        imageFileNames,
      },
      update: {
        auditReportS3Key,
        auditReportFileName,
        excelS3Key,
        excelFileName,
        imageS3Keys,
        imageFileNames,
        status: 'pending',
      },
    });

    // In-app notifications
    const vendor = await this.prisma.user.findUnique({
      where: { id: vendorUserId },
      select: { name: true },
    });
    const vendorName = vendor?.name || 'A vendor';

    await this.notifications
      .notifyAdmins({
        type: 'audit_docs_submitted',
        title: 'Audit Documents Submitted',
        message: `${vendorName} has submitted audit documents for "${req.title}".`,
        link: `/admin/listings/${req.id}/audit-docs`,
      })
      .catch(() => {});

    const clientUsers = await this.prisma.user.findMany({
      where: { companyId: req.clientId },
    });
    await Promise.all(
      clientUsers.map((clientUser) =>
        this.notifications
          .createInAppNotification({
            userId: clientUser.id,
            type: 'audit_docs_submitted',
            title: 'Audit Documents Submitted',
            message: `${vendorName} has submitted audit documents for "${req.title}".`,
            link: `/client/listings/${req.id}`,
          })
          .catch(() => {}),
      ),
    );

    await this.notifications
      .createInAppNotification({
        userId: vendorUserId,
        type: 'audit_docs_submitted',
        title: 'Audit Documents Submitted',
        message: `Your audit documents for "${req.title}" have been successfully submitted and are awaiting review.`,
        link: `/vendor/marketplace/${req.id}`,
      })
      .catch(() => {});

    return doc;
  }

  async getAuditDocs(requirementId: string) {
    const docs = await this.prisma.vendorAuditDoc.findMany({
      where: { requirementId },
      include: { vendor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        auditReportUrl: doc.auditReportS3Key
          ? await this.s3.getSignedUrl(doc.auditReportS3Key)
          : null,
        excelUrl: doc.excelS3Key
          ? await this.s3.getSignedUrl(doc.excelS3Key)
          : null,
        imageUrls: await Promise.all(
          doc.imageS3Keys.map((k) => this.s3.getSignedUrl(k)),
        ),
      })),
    );
  }

  async getAllAuditDocs() {
    const docs = await this.prisma.vendorAuditDoc.findMany({
      include: {
        vendor: { select: { id: true, name: true, email: true } },
        requirement: { select: { id: true, title: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return docs;
  }

  // ─── STEP 3: Admin reviews audit docs ─────────────────────────────────────

  async reviewAuditDoc(
    requirementId: string,
    docId: string,
    action: 'approve' | 'reject',
    remarks?: string,
  ) {
    const doc = await this.prisma.vendorAuditDoc.findUnique({
      where: { id: docId },
    });
    if (!doc || doc.requirementId !== requirementId)
      throw new NotFoundException('Audit doc not found');

    const updated = await this.prisma.vendorAuditDoc.update({
      where: { id: docId },
      data: {
        status: action === 'approve' ? 'approved' : 'rejected',
        adminRemarks: remarks,
      },
      include: { vendor: { select: { id: true, name: true, email: true } } },
    });

    // Update auditApprovedVendorIds on requirement
    if (action === 'approve') {
      const req = await this.prisma.requirement.findUnique({
        where: { id: requirementId },
      });
      if (req && !req.auditApprovedVendorIds.includes(doc.vendorUserId)) {
        await this.prisma.requirement.update({
          where: { id: requirementId },
          data: { auditApprovedVendorIds: { push: doc.vendorUserId } },
        });
      }
      // In-app notification to vendor
      await this.prisma.inAppNotification.create({
        data: {
          userId: doc.vendorUserId,
          type: 'audit_approved',
          title: 'Audit Documents Approved',
          message: `Your audit documents for the listing have been approved. Wait for the sealed bid event.`,
        },
      });
    } else {
      // Notify vendor of rejection
      await this.prisma.inAppNotification.create({
        data: {
          userId: doc.vendorUserId,
          type: 'audit_rejected',
          title: 'Audit Documents Rejected',
          message: `Your audit documents were rejected. ${remarks ? 'Reason: ' + remarks : 'Please resubmit.'}`,
        },
      });
    }

    return updated;
  }

  // ─── STEP 4: Admin creates sealed bid event ────────────────────────────────

  async createSealedBidEvent(
    requirementId: string,
    sealedBidDeadline: string,
    sealedBidStart?: string,
  ) {
    const req = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
      include: { auction: true },
    });
    if (!req) throw new NotFoundException('Requirement not found');

    const deadline = new Date(sealedBidDeadline);
    const start = sealedBidStart ? new Date(sealedBidStart) : new Date();
    const updated = await this.prisma.requirement.update({
      where: { id: requirementId },
      data: {
        sealedBidEventCreatedAt: new Date(),
        sealedBidDeadline: deadline,
        sealedPhaseStart: start,
      },
    });

    // Transition auction to SEALED_PHASE so admin sees Sealed Bids + Set Params buttons
    if (req.auction) {
      await this.prisma.auction.update({
        where: { id: req.auction.id },
        data: { status: AuctionStatus.SEALED_PHASE },
      });
    }

    // Notify all audit-approved vendors via email + in-app
    const approvedVendors = await this.prisma.user.findMany({
      where: { id: { in: req.auditApprovedVendorIds } },
      select: { id: true, name: true, email: true },
    });

    const deadlineStr = deadline.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const webUrl = process.env.WEB_URL || 'http://localhost:3000';

    await Promise.all(
      approvedVendors.map(async (v) => {
        await this.notifications.sendEmail({
          to: v.email,
          subject: `[WeConnect] Sealed Bid Invitation — ${req.title}`,
          body: `
          <h2>Sealed Bid Event Created</h2>
          <p>Hello ${v.name},</p>
          <p>Your audit for <strong>${req.title}</strong> has been approved. You are now invited to submit your sealed bid.</p>
          <p><strong>Deadline:</strong> ${deadlineStr}</p>
          <p><a href="${webUrl}/vendor/sealed-bid/${requirementId}">Submit Sealed Bid →</a></p>
          <br/><p>— WeConnect Platform</p>
        `,
        });
        await this.prisma.inAppNotification.create({
          data: {
            userId: v.id,
            type: 'sealed_bid_event',
            title: 'Submit Your Sealed Bid',
            message: `Sealed bid event created for "${req.title}". Deadline: ${deadlineStr}`,
            link: `/vendor/sealed-bid/${requirementId}`,
          },
        });
      }),
    );

    return { requirement: updated, notifiedCount: approvedVendors.length };
  }

  // ─── STEP 5: Vendor submits sealed bid price ───────────────────────────────

  async submitSealedBid(
    requirementId: string,
    vendorUserId: string,
    amount: number,
    remarks?: string,
  ) {
    const req = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
      include: { auction: true },
    });
    if (!req) throw new NotFoundException('Requirement not found');
    if (!req.auction) throw new NotFoundException('Auction not created yet');
    if (!req.auditApprovedVendorIds.includes(vendorUserId)) {
      throw new NotFoundException(
        'Your audit must be approved before submitting a bid',
      );
    }

    const existing = await this.prisma.bid.findFirst({
      where: {
        auctionId: req.auction.id,
        vendorId: vendorUserId,
        phase: 'SEALED',
      },
    });

    const bid = existing
      ? await this.prisma.bid.update({
          where: { id: existing.id },
          data: { amount, remarks },
        })
      : await this.prisma.bid.create({
          data: {
            auctionId: req.auction.id,
            vendorId: vendorUserId,
            phase: 'SEALED',
            amount,
            remarks,
          },
        });

    return bid;
  }

  // ─── STEP 6: Admin/client views sealed bids ───────────────────────────────

  async getSealedBids(requirementId: string) {
    const req = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
      include: { auction: true },
    });
    if (!req?.auction) return [];

    const bids = await this.prisma.bid.findMany({
      where: { auctionId: req.auction.id, phase: 'SEALED' },
      include: { vendor: { select: { id: true, name: true, email: true } } },
      orderBy: { amount: 'desc' },
    });

    // Enrich with audit doc info
    const auditDocs = await this.prisma.vendorAuditDoc.findMany({
      where: {
        requirementId,
        vendorUserId: { in: bids.map((b) => b.vendorId) },
      },
    });
    const docMap = Object.fromEntries(
      auditDocs.map((d) => [d.vendorUserId, d]),
    );

    return bids.map((bid) => ({
      ...bid,
      auditDoc: docMap[bid.vendorId] || null,
    }));
  }

  // ─── STEP 6b: Admin shortlists bids and shares with client ──────────────

  async shareShortlistedBidsWithClient(
    requirementId: string,
    bidIds: string[],
  ) {
    const req = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
      include: {
        auction: true,
        client: {
          include: {
            users: { select: { id: true, name: true, email: true }, take: 1 },
          },
        },
      },
    });
    if (!req?.auction) throw new NotFoundException('Auction not found');

    // Mark selected bids as shortlisted, clear others
    await this.prisma.bid.updateMany({
      where: { auctionId: req.auction.id, phase: 'SEALED' },
      data: { isShortlisted: false },
    });
    if (bidIds.length > 0) {
      await this.prisma.bid.updateMany({
        where: { id: { in: bidIds }, auctionId: req.auction.id },
        data: { isShortlisted: true },
      });
    }

    // Notify client via in-app + email
    const clientUser = req.client?.users?.[0];
    if (clientUser) {
      const webUrl = process.env.WEB_URL || 'http://localhost:3000';
      const link = `/client/sealed-bids`;

      await this.prisma.inAppNotification.create({
        data: {
          userId: clientUser.id,
          type: 'sealed_bids_shared',
          title: 'Shortlisted Bids Ready for Review',
          message: `Admin has shortlisted sealed bids for "${req.title}". Review them now.`,
          link,
        },
      });

      await this.notifications.sendEmail({
        to: clientUser.email,
        subject: `[WeConnect] Sealed Bids Ready for Review — ${req.title}`,
        body: `
          <h2>Shortlisted Sealed Bids</h2>
          <p>Hello ${clientUser.name},</p>
          <p>The admin team has reviewed all sealed bids for <strong>${req.title}</strong> and shortlisted the top vendors for your review.</p>
          <p><a href="${webUrl}${link}">View Shortlisted Bids →</a></p>
          <br/><p>— WeConnect Platform</p>
        `,
      });
    }

    // Notify shortlisted vendors
    if (bidIds.length > 0) {
      const shortlistedBids = await this.prisma.bid.findMany({
        where: { id: { in: bidIds } },
        select: { vendorId: true },
      });
      const uniqueVendorIds = [
        ...new Set(shortlistedBids.map((b) => b.vendorId)),
      ];

      await Promise.all(
        uniqueVendorIds.map((vId) =>
          this.notifications
            .createInAppNotification({
              userId: vId,
              type: 'bid_shortlisted',
              title: 'You are Shortlisted!',
              message: `Your sealed bid for "${req.title}" has been shortlisted and shared with the client for review.`,
              link: `/vendor/marketplace/${req.id}`,
            })
            .catch(() => {}),
        ),
      );
    }

    return { success: true, shortlistedCount: bidIds.length };
  }

  // ─── Notify client to approve live params ────────────────────────────────

  async notifyClientForLiveApproval(requirementId: string) {
    const req = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
      include: {
        auction: true,
        client: {
          include: {
            users: { select: { id: true, name: true, email: true }, take: 1 },
          },
        },
      },
    });
    if (!req?.auction) throw new NotFoundException('Auction not found');

    const clientUser = req.client?.users?.[0];
    if (!clientUser) throw new NotFoundException('Client user not found');

    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const configureUrl = `${webUrl}/client/listings/${requirementId}/configure-live`;

    await this.notifications.notifyClientLiveAuctionApproval(
      clientUser.email,
      clientUser.name,
      req.title,
      configureUrl,
    );

    await this.prisma.inAppNotification.create({
      data: {
        userId: clientUser.id,
        type: 'live_auction_approval',
        title: 'Action Required: Approve Live Auction',
        message: `Admin has set live auction parameters for "${req.title}". Review and approve to start bidding.`,
        link: `/client/listings/${requirementId}/configure-live`,
      },
    });

    await this.prisma.auction.update({
      where: { id: req.auction.id },
      data: { liveApprovalStatus: 'notified' },
    });

    return { success: true };
  }

  // ─── Client requests governance param changes ────────────────────────────

  async clientRequestParamChanges(requirementId: string, message?: string) {
    const req = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
      include: {
        auction: true,
        client: {
          include: {
            users: { select: { id: true, name: true, email: true }, take: 1 },
          },
        },
      },
    });
    if (!req?.auction) throw new NotFoundException('Auction not found');

    const clientUser = req.client?.users?.[0];
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true, name: true, email: true },
    });

    const note = message ? `: "${message}"` : '';
    for (const admin of admins) {
      await this.notifications
        .sendEmail({
          to: admin.email,
          subject: `Client requests param changes — ${req.title}`,
          body: `<p>${clientUser?.name || 'Client'} has requested changes to the governance parameters for "${req.title}"${note}.</p><p>Please review and update the parameters in the admin dashboard.</p>`,
        })
        .catch(() => {});
      await this.prisma.inAppNotification.create({
        data: {
          userId: admin.id,
          type: 'param_change_request',
          title: `Change Request: ${req.title}`,
          message: `Client requested changes to auction governance params${note}.`,
          link: `/admin/auctions`,
        },
      });
    }

    await this.prisma.auction.update({
      where: { id: req.auction.id },
      data: { liveApprovalStatus: 'change_requested' },
    });

    return { success: true };
  }

  // ─── Client approves live auction ─────────────────────────────────────────

  async clientApproveLive(
    requirementId: string,
    body: {
      basePrice?: number;
      targetPrice?: number;
      startDate?: string;
      endDate?: string;
    } = {},
  ) {
    const req = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
      include: {
        auction: {
          include: {
            bids: { where: { phase: 'SEALED', isShortlisted: true } },
          },
        },
      },
    });
    if (!req?.auction) throw new NotFoundException('Auction not found');

    const now = new Date();
    const openPhaseStart = body.startDate
      ? new Date(body.startDate)
      : req.auction.openPhaseStart;
    const shouldGoLiveNow = openPhaseStart && openPhaseStart <= now;

    const auctionUpdateData: any = {
      liveApprovalStatus: 'approved',
      status: shouldGoLiveNow
        ? AuctionStatus.OPEN_PHASE
        : AuctionStatus.UPCOMING,
    };
    if (body.basePrice !== undefined)
      auctionUpdateData.basePrice = Number(body.basePrice);
    if (body.targetPrice !== undefined)
      auctionUpdateData.targetPrice = Number(body.targetPrice);
    if (body.startDate)
      auctionUpdateData.openPhaseStart = new Date(body.startDate);
    if (body.endDate) auctionUpdateData.openPhaseEnd = new Date(body.endDate);

    await this.prisma.auction.update({
      where: { id: req.auction.id },
      data: auctionUpdateData,
    });

    // Notify all shortlisted (audit-approved) vendors about live auction approval
    const approvedVendors = await this.prisma.user.findMany({
      where: { id: { in: req.auditApprovedVendorIds } },
      select: { id: true, name: true, email: true },
    });

    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const auctionUrl = `${webUrl}/vendor/marketplace/${requirementId}`;

    const openStart = auctionUpdateData.openPhaseStart
      ? new Date(auctionUpdateData.openPhaseStart).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      : null;
    const openEnd = auctionUpdateData.openPhaseEnd
      ? new Date(auctionUpdateData.openPhaseEnd).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      : null;

    await Promise.all(
      approvedVendors.map(async (v) => {
        await this.notifications.notifyLiveAuctionApproved(
          v.email,
          v.name,
          req.title,
          auctionUrl,
          openStart,
          openEnd,
        );
        const timingNote = openStart
          ? ` Open bidding starts: ${openStart}${openEnd ? ` and closes: ${openEnd}` : ''}.`
          : '';
        await this.prisma.inAppNotification.create({
          data: {
            userId: v.id,
            type: 'live_auction_approved',
            title: "You're Approved for Live Auction!",
            message: `The live open auction for "${req.title}" is now active.${timingNote} Join the bidding now.`,
            link: `/vendor/live-auction`,
          },
        });
      }),
    );

    return { success: true, notifiedCount: approvedVendors.length };
  }

  async getInvitationDetails(requirementId: string, vendorUserId: string) {
    if (!vendorUserId)
      throw new NotFoundException('Vendor user not identified');

    const req = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
      include: { client: true, auction: true },
    });
    if (!req) throw new NotFoundException('Requirement not found');

    let processedSheetUrl: string | null = null;
    if (req.processedS3Key) {
      processedSheetUrl = await this.s3.getSignedUrl(req.processedS3Key);
    }

    const auditDoc = await this.prisma.vendorAuditDoc.findUnique({
      where: { requirementId_vendorUserId: { requirementId, vendorUserId } },
    });

    const existingBid = req.auction
      ? await this.prisma.bid.findFirst({
          where: {
            auctionId: req.auction.id,
            vendorId: vendorUserId,
            phase: 'SEALED',
          },
        })
      : null;

    return {
      id: req.id,
      title: req.title,
      description: req.description,
      category: req.category,
      totalWeight: req.totalWeight,
      sealedPhaseStart: req.sealedPhaseStart,
      sealedPhaseEnd: req.sealedPhaseEnd,
      sealedBidDeadline: req.sealedBidDeadline,
      sealedBidEventCreatedAt: req.sealedBidEventCreatedAt,
      openPhaseStart: req.auction?.openPhaseStart ?? null,
      openPhaseEnd: req.auction?.openPhaseEnd ?? null,
      clientName: req.client?.name,
      processedSheetUrl,
      isInvited: req.invitedVendorIds.includes(vendorUserId),
      hasAccepted: req.acceptedVendorIds.includes(vendorUserId),
      hasDeclined: req.declinedVendorIds.includes(vendorUserId),
      auditApproved: req.auditApprovedVendorIds.includes(vendorUserId),
      auditDoc: auditDoc
        ? { status: auditDoc.status, adminRemarks: auditDoc.adminRemarks }
        : null,
      hasSealedBid: !!existingBid,
      sealedBidAmount: existingBid?.amount ?? null,
      auctionId: req.auction?.id,
      auctionStatus: req.auction?.status ?? null,
      auctionLiveApprovalStatus: req.auction?.liveApprovalStatus ?? 'pending',
    };
  }

  async getSignedUrl(id: string, field: 'raw' | 'processed') {
    const req = await this.prisma.requirement.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Requirement not found');
    const key = field === 'raw' ? req.rawS3Key : req.processedS3Key;
    if (!key) throw new NotFoundException('File not found');
    return { url: await this.s3.getSignedUrl(key) };
  }
}
