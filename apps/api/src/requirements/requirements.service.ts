import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { S3Service } from '../s3/s3.service';
import { NotificationService } from '../notifications/notification.service';
import { RequirementStatus, AuctionStatus } from '../firebase/firestore-types';
import * as admin from 'firebase-admin';

@Injectable()
export class RequirementsService {
  constructor(
    private firebaseService: FirebaseService,
    private s3: S3Service,
    private notifications: NotificationService,
  ) {}

  // Helper to map and convert Firestore Timestamps to JS Dates
  private mapDates(data: any): any {
    if (!data) return data;
    const mapped = { ...data };
    const dateFields = [
      'createdAt',
      'updatedAt',
      'adminApprovedAt',
      'sealedPhaseStart',
      'sealedPhaseEnd',
      'sealedBidDeadline',
      'sealedBidEventCreatedAt',
      'scheduledAt',
      'respondedAt',
      'completedAt',
      'uploadedAt',
      'capturedAt',
      'openPhaseStart',
      'openPhaseEnd',
    ];
    for (const field of dateFields) {
      if (mapped[field]) {
        mapped[field] = mapped[field].toDate ? mapped[field].toDate() : new Date(mapped[field]);
      }
    }
    return mapped;
  }

  // Helper to map Audit Invitations subcollection
  private mapAuditInvitation(data: any, id: string): any {
    if (!data) return null;
    const inv = { id, ...data };
    inv.createdAt = inv.createdAt?.toDate ? inv.createdAt.toDate() : (inv.createdAt ? new Date(inv.createdAt) : null);
    inv.updatedAt = inv.updatedAt?.toDate ? inv.updatedAt.toDate() : (inv.updatedAt ? new Date(inv.updatedAt) : null);
    inv.respondedAt = inv.respondedAt?.toDate ? inv.respondedAt.toDate() : (inv.respondedAt ? new Date(inv.respondedAt) : null);
    inv.scheduledAt = inv.scheduledAt?.toDate ? inv.scheduledAt.toDate() : (inv.scheduledAt ? new Date(inv.scheduledAt) : null);

    if (inv.report) {
      inv.report.createdAt = inv.report.createdAt?.toDate ? inv.report.createdAt.toDate() : (inv.report.createdAt ? new Date(inv.report.createdAt) : null);
      inv.report.updatedAt = inv.report.updatedAt?.toDate ? inv.report.updatedAt.toDate() : (inv.report.updatedAt ? new Date(inv.report.updatedAt) : null);
      inv.report.completedAt = inv.report.completedAt?.toDate ? inv.report.completedAt.toDate() : (inv.report.completedAt ? new Date(inv.report.completedAt) : null);
      if (Array.isArray(inv.report.photos)) {
        inv.report.photos = inv.report.photos.map((p: any) => ({
          ...p,
          uploadedAt: p.uploadedAt?.toDate ? p.uploadedAt.toDate() : (p.uploadedAt ? new Date(p.uploadedAt) : null),
          capturedAt: p.capturedAt?.toDate ? p.capturedAt.toDate() : (p.capturedAt ? new Date(p.capturedAt) : null),
        }));
      }
    }
    return inv;
  }

  // Helper to fetch multiple users in chunks
  private async fetchUsersByIds(ids: string[]): Promise<any[]> {
    if (!ids || ids.length === 0) return [];
    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) {
      chunks.push(ids.slice(i, i + 10));
    }
    const users: any[] = [];
    for (const chunk of chunks) {
      const snap = await this.firebaseService.db.collection('users')
        .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
        .get();
      snap.docs.forEach(doc => {
        users.push({ id: doc.id, ...doc.data() });
      });
    }
    return users;
  }

  // Helper to create In-App notifications in Firestore
  private async createInAppNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    link?: string | null,
  ): Promise<void> {
    try {
      const notifRef = this.firebaseService.db
        .collection('users')
        .doc(userId)
        .collection('notifications')
        .doc();
      await notifRef.set({
        id: notifRef.id,
        type,
        title,
        message,
        link: link || null,
        read: false,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error(`Failed to create in-app notification for user ${userId}:`, error);
    }
  }

  // CREATE REQUIREMENT
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

    const reqId = this.firebaseService.db.collection('requirements').doc().id;
    const now = new Date();

    const requirementDoc = {
      id: reqId,
      title: data.title,
      description: data.description || null,
      clientId: data.clientId,
      status: RequirementStatus.UPLOADED,
      rawS3Key: rawS3Key || null,
      processedS3Key: null,
      targetPrice: null,
      category: data.category || null,
      totalWeight: data.totalWeight ? Number(data.totalWeight) : null,
      invitedVendorIds: data.invitedVendorIds ?? [],
      acceptedVendorIds: [],
      declinedVendorIds: [],
      auditApprovedVendorIds: [],
      sealedPhaseStart: data.sealedPhaseStart ? new Date(data.sealedPhaseStart) : null,
      sealedPhaseEnd: data.sealedPhaseEnd ? new Date(data.sealedPhaseEnd) : null,
      clientDocuments: clientDocuments, // Firestore accepts arrays natively
      createdAt: now,
      updatedAt: now,
    };

    await this.firebaseService.db.collection('requirements').doc(reqId).set(requirementDoc);

    // Retrieve client company details to mirror Prisma's `include: { client: true }`
    let client: any = null;
    const clientSnap = await this.firebaseService.db.collection('companies').doc(data.clientId).get();
    if (clientSnap.exists) {
      client = { id: clientSnap.id, ...clientSnap.data() };
    }

    return this.mapDates({
      ...requirementDoc,
      client: client ? this.mapDates(client) : null,
    });
  }

  // FIND ALL REQUIREMENTS
  async findAll(clientId?: string) {
    let query: admin.firestore.Query = this.firebaseService.db.collection('requirements');
    if (clientId) {
      query = query.where('clientId', '==', clientId);
    }
    const snapshot = await query.get();
    const requirements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort in memory by createdAt descending to avoid composite indexes requirement
    requirements.sort((a: any, b: any) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return dateB.getTime() - dateA.getTime();
    });

    const enriched = await Promise.all(requirements.map(async (req: any) => {
      let client: any = null;
      if (req.clientId) {
        const clientSnap = await this.firebaseService.db.collection('companies').doc(req.clientId).get();
        if (clientSnap.exists) {
          client = { id: clientSnap.id, ...clientSnap.data() };
          const userSnap = await this.firebaseService.db.collection('users')
            .where('companyId', '==', req.clientId)
            .limit(1)
            .get();
          const users = userSnap.docs.map(doc => ({ id: doc.id }));
          client.users = users;
        }
      }

      // Fetch audit invitations subcollection
      const auditSnap = await this.firebaseService.db.collection('requirements')
        .doc(req.id)
        .collection('auditInvitations')
        .get();
      const auditInvitations = auditSnap.docs.map(doc => this.mapAuditInvitation(doc.data(), doc.id));

      // Fetch auction
      const auctionSnap = await this.firebaseService.db.collection('auctions')
        .where('requirementId', '==', req.id)
        .limit(1)
        .get();
      const auction = auctionSnap.empty ? null : { id: auctionSnap.docs[0].id, ...auctionSnap.docs[0].data() };

      return this.mapDates({
        ...req,
        client: client ? this.mapDates(client) : null,
        auditInvitations,
        auction: auction ? this.mapDates(auction) : null,
      });
    }));

    return enriched;
  }

  // FIND ONE REQUIREMENT
  async findOne(id: string) {
    const reqRef = this.firebaseService.db.collection('requirements').doc(id);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) throw new NotFoundException('Requirement not found');
    const req = { id: reqSnap.id, ...reqSnap.data() } as any;

    let client: any = null;
    if (req.clientId) {
      const clientSnap = await this.firebaseService.db.collection('companies').doc(req.clientId).get();
      if (clientSnap.exists) {
        client = { id: clientSnap.id, ...clientSnap.data() };
      }
    }

    // Fetch audit invitations subcollection and include vendor company details
    const auditSnap = await reqRef.collection('auditInvitations').get();
    const auditInvitations = await Promise.all(
      auditSnap.docs.map(async (doc) => {
        const invData = doc.data();
        let vendor: any = null;
        if (invData.vendorId) {
          const vendorSnap = await this.firebaseService.db.collection('companies').doc(invData.vendorId).get();
          if (vendorSnap.exists) {
            vendor = { id: vendorSnap.id, ...vendorSnap.data() };
          } else {
            const userSnap = await this.firebaseService.db.collection('users').doc(invData.vendorId).get();
            if (userSnap.exists) {
              vendor = { id: userSnap.id, ...userSnap.data() };
            }
          }
        }
        const mappedInvite = this.mapAuditInvitation(invData, doc.id);
        if (mappedInvite) {
          mappedInvite.vendor = vendor ? this.mapDates(vendor) : null;
        }
        return mappedInvite;
      }),
    );

    // Fetch auction
    const auctionSnap = await this.firebaseService.db.collection('auctions')
      .where('requirementId', '==', id)
      .limit(1)
      .get();
    const auction = auctionSnap.empty ? null : { id: auctionSnap.docs[0].id, ...auctionSnap.docs[0].data() };

    // Parse clientDocuments
    let rawDocs: any[] = [];
    if (req.clientDocuments) {
      if (typeof req.clientDocuments === 'string') {
        try {
          rawDocs = JSON.parse(req.clientDocuments);
        } catch {
          rawDocs = [];
        }
      } else if (Array.isArray(req.clientDocuments)) {
        rawDocs = req.clientDocuments;
      }
    }

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

    return this.mapDates({
      ...req,
      client: client ? this.mapDates(client) : null,
      auditInvitations: auditInvitations.filter(Boolean),
      auction: auction ? this.mapDates(auction) : null,
      clientDocumentsWithUrls,
    });
  }

  // UPLOAD PROCESSED SHEET
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

    const updateData: any = {
      processedS3Key: key,
      status: RequirementStatus.CLIENT_REVIEW,
      updatedAt: new Date(),
    };
    if (vendorIds && vendorIds.length > 0) {
      updateData.invitedVendorIds = vendorIds;
    }

    await this.firebaseService.db.collection('requirements').doc(id).update(updateData);

    // Notify client that the processed sheet is ready for review
    const clientUserSnap = await this.firebaseService.db.collection('users')
      .where('companyId', '==', req.clientId)
      .limit(1)
      .get();

    if (!clientUserSnap.empty) {
      const clientUser = { id: clientUserSnap.docs[0].id, ...clientUserSnap.docs[0].data() } as any;
      await this.notifications.notifyClientSheetReady(
        clientUser.email,
        clientUser.name,
        req.title,
        req.id,
      );
      await this.createInAppNotification(
        clientUser.id,
        'processed_sheet_ready',
        'Processed Sheet Ready',
        `Your processed sheet for "${req.title}" has been uploaded and is ready for your review.`,
        `/client/listings/${req.id}`,
      );
    }

    return this.findOne(id);
  }

  // CLIENT APPROVE PROCESSED LIST
  async clientApprove(
    id: string,
    data: { targetPrice: number; totalWeight?: number; category?: string },
  ) {
    const req = await this.findOne(id);
    const { targetPrice, totalWeight, category } = data;

    const updateData: any = {
      targetPrice: Number(targetPrice),
      status: RequirementStatus.FINALIZED,
      updatedAt: new Date(),
    };
    if (totalWeight !== undefined) updateData.totalWeight = Number(totalWeight);
    if (category !== undefined) updateData.category = category;

    await this.firebaseService.db.collection('requirements').doc(id).update(updateData);

    // Create the auction linked to this requirement
    const now = new Date();
    const sealedStart = req.sealedPhaseStart ?? now;
    const sealedEnd = req.sealedPhaseEnd ?? new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const auctionStatus = sealedStart <= now ? AuctionStatus.SEALED_PHASE : AuctionStatus.UPCOMING;

    let auction = req.auction;
    if (!auction) {
      const auctionId = this.firebaseService.db.collection('auctions').doc().id;
      const newAuction = {
        id: auctionId,
        title: req.title,
        category: req.category ?? 'General',
        description: req.description || null,
        basePrice: Number(targetPrice),
        targetPrice: Number(targetPrice),
        clientId: req.clientId,
        requirementId: req.id,
        status: auctionStatus,
        sealedPhaseStart: sealedStart,
        sealedPhaseEnd: sealedEnd,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        auctionDocs: [],
      };
      await this.firebaseService.db.collection('auctions').doc(auctionId).set(newAuction);
      auction = newAuction;
    }

    // Send sealed-bid invitation emails + in-app notifications
    if (req.invitedVendorIds && req.invitedVendorIds.length > 0) {
      const vendors = await this.fetchUsersByIds(req.invitedVendorIds);

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
          await this.createInAppNotification(
            v.id,
            'sealed_bid_invitation',
            'New Sealed Bid Invitation',
            `You have been invited to participate in a sealed bid auction: "${req.title}". Deadline: ${sealedEndStr}.`,
            `${webUrl}/vendor/invitations/${req.id}`,
          );
        }),
      );
    }

    const updatedRequirement = await this.findOne(id);
    return { requirement: updatedRequirement, auction: this.mapDates(auction) };
  }

  // ADMIN APPROVE
  async adminApprove(id: string, adminUserId?: string) {
    const req = await this.findOne(id);

    const updateData: any = {
      status: RequirementStatus.FINALIZED,
      adminApprovedAt: new Date(),
      adminApprovedById: adminUserId || null,
      updatedAt: new Date(),
    };

    await this.firebaseService.db.collection('requirements').doc(id).update(updateData);

    const now = new Date();
    const sealedStart = req.sealedPhaseStart ?? now;
    const sealedEnd = req.sealedPhaseEnd ?? new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const auctionStatus = sealedStart <= now ? AuctionStatus.SEALED_PHASE : AuctionStatus.UPCOMING;

    let auction = req.auction;
    if (!auction) {
      const auctionId = this.firebaseService.db.collection('auctions').doc().id;
      const newAuction = {
        id: auctionId,
        title: req.title,
        category: req.category ?? 'General',
        description: req.description || null,
        basePrice: req.targetPrice ?? 0,
        targetPrice: req.targetPrice || null,
        clientId: req.clientId,
        requirementId: req.id,
        status: auctionStatus,
        sealedPhaseStart: sealedStart,
        sealedPhaseEnd: sealedEnd,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        auctionDocs: [],
      };
      await this.firebaseService.db.collection('auctions').doc(auctionId).set(newAuction);
      auction = newAuction;
    } else {
      await this.firebaseService.db.collection('auctions').doc(auction.id).update({
        status: auctionStatus,
        sealedPhaseStart: sealedStart,
        sealedPhaseEnd: sealedEnd,
        updatedAt: new Date(),
      });
      auction.status = auctionStatus;
      auction.sealedPhaseStart = sealedStart;
      auction.sealedPhaseEnd = sealedEnd;
    }

    // Send invitations
    if (req.invitedVendorIds && req.invitedVendorIds.length > 0) {
      const vendors = await this.fetchUsersByIds(req.invitedVendorIds);

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
          await this.createInAppNotification(
            v.id,
            'sealed_bid_invitation',
            'New Sealed Bid Invitation',
            `You have been invited to participate in a sealed bid auction: "${req.title}". Deadline: ${sealedEndStr}.`,
            `${webUrl}/vendor/invitations/${req.id}`,
          );
        }),
      );
    }

    const updatedRequirement = await this.findOne(id);
    return { requirement: updatedRequirement, auction: this.mapDates(auction) };
  }

  // REJECT REQUIREMENT
  async reject(id: string, reason?: string) {
    await this.firebaseService.db.collection('requirements').doc(id).update({
      status: RequirementStatus.REJECTED,
      updatedAt: new Date(),
    });
    return this.findOne(id);
  }

  // VENDOR RESPOND
  async vendorRespond(
    requirementId: string,
    vendorUserId: string,
    action: 'accept' | 'decline',
  ) {
    const reqRef = this.firebaseService.db.collection('requirements').doc(requirementId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) throw new NotFoundException('Requirement not found');
    const req = reqSnap.data() as any;

    let acceptedVendorIds = Array.isArray(req.acceptedVendorIds) ? req.acceptedVendorIds : [];
    let declinedVendorIds = Array.isArray(req.declinedVendorIds) ? req.declinedVendorIds : [];

    if (action === 'accept') {
      if (!acceptedVendorIds.includes(vendorUserId)) {
        acceptedVendorIds.push(vendorUserId);
      }
      declinedVendorIds = declinedVendorIds.filter((id: string) => id !== vendorUserId);
    } else {
      if (!declinedVendorIds.includes(vendorUserId)) {
        declinedVendorIds.push(vendorUserId);
      }
      acceptedVendorIds = acceptedVendorIds.filter((id: string) => id !== vendorUserId);
    }

    await reqRef.update({
      acceptedVendorIds,
      declinedVendorIds,
      updatedAt: new Date(),
    });

    // In-app notifications
    const vendorSnap = await this.firebaseService.db.collection('users').doc(vendorUserId).get();
    const vendorName = vendorSnap.exists ? (vendorSnap.data()?.name || 'A vendor') : 'A vendor';

    await this.notifications
      .notifyAdmins({
        type: 'vendor_invitation_response',
        title: 'Vendor Invitation Response',
        message: `${vendorName} has ${action}ed the invitation for "${req.title}".`,
        link: `/admin/listings/${req.id}`,
      })
      .catch(() => {});

    const clientUsersSnap = await this.firebaseService.db.collection('users')
      .where('companyId', '==', req.clientId)
      .get();

    await Promise.all(
      clientUsersSnap.docs.map(clientDoc =>
        this.createInAppNotification(
          clientDoc.id,
          'vendor_invitation_response',
          'Vendor Invitation Response',
          `${vendorName} has ${action}ed the invitation for "${req.title}".`,
          `/client/listings/${req.id}`,
        ),
      ),
    );

    return this.findOne(requirementId);
  }

  // UPLOAD AUDIT DOCS
  async uploadAuditDocs(
    requirementId: string,
    vendorUserId: string,
    files: {
      auditReport?: Express.Multer.File;
      filledExcel?: Express.Multer.File;
      images?: Express.Multer.File[];
    },
  ) {
    const reqRef = this.firebaseService.db.collection('requirements').doc(requirementId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) throw new NotFoundException('Requirement not found');
    const req = reqSnap.data() as any;

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

    const docRef = reqRef.collection('vendorAuditDocs').doc(vendorUserId);
    const docSnap = await docRef.get();

    const updateData: any = {
      id: vendorUserId,
      requirementId,
      vendorUserId,
      status: 'pending',
      updatedAt: new Date(),
    };

    if (auditReportS3Key) {
      updateData.auditReportS3Key = auditReportS3Key;
      updateData.auditReportFileName = auditReportFileName;
    }
    if (excelS3Key) {
      updateData.excelS3Key = excelS3Key;
      updateData.excelFileName = excelFileName;
    }
    if (imageS3Keys.length > 0) {
      updateData.imageS3Keys = imageS3Keys;
      updateData.imageFileNames = imageFileNames;
    }

    if (!docSnap.exists) {
      updateData.createdAt = new Date();
      // Ensure defaults for non-provided fields
      if (!updateData.auditReportS3Key) {
        updateData.auditReportS3Key = null;
        updateData.auditReportFileName = null;
      }
      if (!updateData.excelS3Key) {
        updateData.excelS3Key = null;
        updateData.excelFileName = null;
      }
      if (!updateData.imageS3Keys) {
        updateData.imageS3Keys = [];
        updateData.imageFileNames = [];
      }
      await docRef.set(updateData);
    } else {
      await docRef.update(updateData);
    }

    // Fetch vendor info
    const vendorSnap = await this.firebaseService.db.collection('users').doc(vendorUserId).get();
    const vendorName = vendorSnap.exists ? (vendorSnap.data()?.name || 'A vendor') : 'A vendor';

    await this.notifications
      .notifyAdmins({
        type: 'audit_docs_submitted',
        title: 'Audit Documents Submitted',
        message: `${vendorName} has submitted audit documents for "${req.title}".`,
        link: `/admin/listings/${req.id}/audit-docs`,
      })
      .catch(() => {});

    const clientUsersSnap = await this.firebaseService.db.collection('users')
      .where('companyId', '==', req.clientId)
      .get();

    await Promise.all(
      clientUsersSnap.docs.map(clientDoc =>
        this.createInAppNotification(
          clientDoc.id,
          'audit_docs_submitted',
          'Audit Documents Submitted',
          `${vendorName} has submitted audit documents for "${req.title}".`,
          `/client/listings/${req.id}`,
        ),
      ),
    );

    await this.createInAppNotification(
      vendorUserId,
      'audit_docs_submitted',
      'Audit Documents Submitted',
      `Your audit documents for "${req.title}" have been successfully submitted and are awaiting review.`,
      `/vendor/marketplace/${req.id}`,
    );

    const finalDocSnap = await docRef.get();
    return { id: finalDocSnap.id, ...finalDocSnap.data() };
  }

  // GET AUDIT DOCS FOR A REQUIREMENT
  async getAuditDocs(requirementId: string) {
    const snap = await this.firebaseService.db.collection('requirements')
      .doc(requirementId)
      .collection('vendorAuditDocs')
      .get();

    const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return Promise.all(
      docs.map(async (doc: any) => {
        let vendor: any = null;
        if (doc.vendorUserId) {
          const vendorSnap = await this.firebaseService.db.collection('users').doc(doc.vendorUserId).get();
          if (vendorSnap.exists) {
            const vData = vendorSnap.data();
            vendor = { id: vendorSnap.id, name: vData?.name, email: vData?.email };
          }
        }

        return {
          ...this.mapDates(doc),
          vendor,
          auditReportUrl: doc.auditReportS3Key
            ? await this.s3.getSignedUrl(doc.auditReportS3Key).catch(() => null)
            : null,
          excelUrl: doc.excelS3Key
            ? await this.s3.getSignedUrl(doc.excelS3Key).catch(() => null)
            : null,
          imageUrls: await Promise.all(
            (doc.imageS3Keys || []).map((k: string) => this.s3.getSignedUrl(k).catch(() => null)),
          ),
        };
      }),
    );
  }

  // GET ALL AUDIT DOCS
  async getAllAuditDocs() {
    const snap = await this.firebaseService.db.collectionGroup('vendorAuditDocs').get();

    const docs = await Promise.all(snap.docs.map(async (doc) => {
      const docData = doc.data() as any;
      const requirementId = doc.ref.parent.parent?.id;

      let vendor: any = null;
      if (docData.vendorUserId) {
        const vendorSnap = await this.firebaseService.db.collection('users').doc(docData.vendorUserId).get();
        if (vendorSnap.exists) {
          const vData = vendorSnap.data();
          vendor = { id: vendorSnap.id, name: vData?.name, email: vData?.email };
        }
      }

      let requirement: any = null;
      if (requirementId) {
        const reqSnap = await this.firebaseService.db.collection('requirements').doc(requirementId).get();
        if (reqSnap.exists) {
          const rData = reqSnap.data();
          requirement = { id: reqSnap.id, title: rData?.title, category: rData?.category };
        }
      }

      return {
        ...this.mapDates(docData),
        id: doc.id,
        vendor,
        requirement,
      };
    }));

    // Sort descending by createdAt
    docs.sort((a: any, b: any) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    return docs;
  }

  // REVIEW AUDIT DOC
  async reviewAuditDoc(
    requirementId: string,
    docId: string,
    action: 'approve' | 'reject',
    remarks?: string,
  ) {
    const docRef = this.firebaseService.db.collection('requirements')
      .doc(requirementId)
      .collection('vendorAuditDocs')
      .doc(docId);

    const docSnap = await docRef.get();
    if (!docSnap.exists) throw new NotFoundException('Audit doc not found');
    const doc = docSnap.data() as any;

    await docRef.update({
      status: action === 'approve' ? 'approved' : 'rejected',
      adminRemarks: remarks || null,
      updatedAt: new Date(),
    });

    // Update auditApprovedVendorIds on requirement
    if (action === 'approve') {
      const reqRef = this.firebaseService.db.collection('requirements').doc(requirementId);
      const reqSnap = await reqRef.get();
      if (reqSnap.exists) {
        const req = reqSnap.data() as any;
        const auditApprovedVendorIds = Array.isArray(req.auditApprovedVendorIds) ? req.auditApprovedVendorIds : [];
        if (!auditApprovedVendorIds.includes(doc.vendorUserId)) {
          auditApprovedVendorIds.push(doc.vendorUserId);
          await reqRef.update({
            auditApprovedVendorIds,
            updatedAt: new Date(),
          });
        }
      }

      await this.createInAppNotification(
        doc.vendorUserId,
        'audit_approved',
        'Audit Documents Approved',
        `Your audit documents for the listing have been approved. Wait for the sealed bid event.`,
      );
    } else {
      await this.createInAppNotification(
        doc.vendorUserId,
        'audit_rejected',
        'Audit Documents Rejected',
        `Your audit documents were rejected. ${remarks ? 'Reason: ' + remarks : 'Please resubmit.'}`,
      );
    }

    const vendorSnap = await this.firebaseService.db.collection('users').doc(doc.vendorUserId).get();
    const vendorData = vendorSnap.exists ? vendorSnap.data() : null;

    return {
      id: docId,
      ...doc,
      status: action === 'approve' ? 'approved' : 'rejected',
      adminRemarks: remarks || null,
      updatedAt: new Date(),
      vendor: vendorData ? { id: vendorSnap.id, name: vendorData.name, email: vendorData.email } : null,
    };
  }

  // CREATE SEALED BID EVENT
  async createSealedBidEvent(
    requirementId: string,
    sealedBidDeadline: string,
    sealedBidStart?: string,
  ) {
    const reqRef = this.firebaseService.db.collection('requirements').doc(requirementId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) throw new NotFoundException('Requirement not found');
    const req = reqSnap.data() as any;

    const deadline = new Date(sealedBidDeadline);
    const start = sealedBidStart ? new Date(sealedBidStart) : new Date();

    await reqRef.update({
      sealedBidEventCreatedAt: new Date(),
      sealedBidDeadline: deadline,
      sealedPhaseStart: start,
      updatedAt: new Date(),
    });

    // Transition auction to SEALED_PHASE
    const auctionQuery = await this.firebaseService.db.collection('auctions')
      .where('requirementId', '==', requirementId)
      .limit(1)
      .get();

    if (!auctionQuery.empty) {
      await this.firebaseService.db.collection('auctions').doc(auctionQuery.docs[0].id).update({
        status: AuctionStatus.SEALED_PHASE,
        updatedAt: new Date(),
      });
    }

    // Notify approved vendors
    const approvedVendorIds = Array.isArray(req.auditApprovedVendorIds) ? req.auditApprovedVendorIds : [];
    let notifiedCount = 0;

    if (approvedVendorIds.length > 0) {
      const approvedVendors = await this.fetchUsersByIds(approvedVendorIds);
      notifiedCount = approvedVendors.length;

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
          await this.createInAppNotification(
            v.id,
            'sealed_bid_event',
            'Submit Your Sealed Bid',
            `Sealed bid event created for "${req.title}". Deadline: ${deadlineStr}`,
            `/vendor/sealed-bid/${requirementId}`,
          );
        }),
      );
    }

    const updatedRequirement = await this.findOne(requirementId);
    return { requirement: updatedRequirement, notifiedCount };
  }

  // SUBMIT SEALED BID PRICE
  async submitSealedBid(
    requirementId: string,
    vendorUserId: string,
    amount: number,
    remarks?: string,
  ) {
    const reqRef = this.firebaseService.db.collection('requirements').doc(requirementId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) throw new NotFoundException('Requirement not found');
    const req = reqSnap.data() as any;

    const auctionQuery = await this.firebaseService.db.collection('auctions')
      .where('requirementId', '==', requirementId)
      .limit(1)
      .get();
    if (auctionQuery.empty) throw new NotFoundException('Auction not created yet');
    const auctionId = auctionQuery.docs[0].id;

    const auditApprovedVendorIds = Array.isArray(req.auditApprovedVendorIds) ? req.auditApprovedVendorIds : [];
    if (!auditApprovedVendorIds.includes(vendorUserId)) {
      throw new NotFoundException('Your audit must be approved before submitting a bid');
    }

    const bidsRef = this.firebaseService.db.collection('auctions').doc(auctionId).collection('bids');
    const existingQuery = await bidsRef
      .where('vendorId', '==', vendorUserId)
      .where('phase', '==', 'SEALED')
      .limit(1)
      .get();

    let bid: any;
    if (!existingQuery.empty) {
      const existingBidDoc = existingQuery.docs[0];
      await existingBidDoc.ref.update({
        amount,
        remarks: remarks || null,
        updatedAt: new Date(),
      });
      bid = { id: existingBidDoc.id, ...existingBidDoc.data(), amount, remarks };
    } else {
      const bidId = bidsRef.doc().id;
      const newBid = {
        id: bidId,
        auctionId,
        vendorId: vendorUserId,
        phase: 'SEALED',
        amount,
        remarks: remarks || null,
        createdAt: new Date(),
        isShortlisted: false,
        clientStatus: 'PENDING',
      };
      await bidsRef.doc(bidId).set(newBid);
      bid = newBid;
    }

    return this.mapDates(bid);
  }

  // VIEW SEALED BIDS
  async getSealedBids(requirementId: string) {
    const reqRef = this.firebaseService.db.collection('requirements').doc(requirementId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) return [];

    const auctionQuery = await this.firebaseService.db.collection('auctions')
      .where('requirementId', '==', requirementId)
      .limit(1)
      .get();
    if (auctionQuery.empty) return [];
    const auctionId = auctionQuery.docs[0].id;

    const bidsSnap = await this.firebaseService.db.collection('auctions')
      .doc(auctionId)
      .collection('bids')
      .where('phase', '==', 'SEALED')
      .get();

    const bids = bidsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort descending by amount
    bids.sort((a: any, b: any) => b.amount - a.amount);

    return Promise.all(
      bids.map(async (bid: any) => {
        let vendor: any = null;
        if (bid.vendorId) {
          const vendorSnap = await this.firebaseService.db.collection('users').doc(bid.vendorId).get();
          if (vendorSnap.exists) {
            const vData = vendorSnap.data();
            vendor = { id: vendorSnap.id, name: vData?.name, email: vData?.email };
          }
        }

        const auditDocSnap = await this.firebaseService.db.collection('requirements')
          .doc(requirementId)
          .collection('vendorAuditDocs')
          .doc(bid.vendorId)
          .get();

        const auditDoc = auditDocSnap.exists ? { id: auditDocSnap.id, ...auditDocSnap.data() } : null;

        return {
          ...this.mapDates(bid),
          vendor,
          auditDoc: auditDoc ? this.mapDates(auditDoc) : null,
        };
      }),
    );
  }

  // SHARE SHORTLISTED BIDS WITH CLIENT
  async shareShortlistedBidsWithClient(
    requirementId: string,
    bidIds: string[],
  ) {
    const req = await this.findOne(requirementId);

    const auctionQuery = await this.firebaseService.db.collection('auctions')
      .where('requirementId', '==', requirementId)
      .limit(1)
      .get();
    if (auctionQuery.empty) throw new NotFoundException('Auction not found');
    const auctionId = auctionQuery.docs[0].id;

    const bidsRef = this.firebaseService.db.collection('auctions').doc(auctionId).collection('bids');
    const bidsSnap = await bidsRef.where('phase', '==', 'SEALED').get();

    const batch = this.firebaseService.db.batch();
    for (const doc of bidsSnap.docs) {
      const isShortlisted = bidIds.includes(doc.id);
      batch.update(doc.ref, { isShortlisted, updatedAt: new Date() });
    }
    await batch.commit();

    // Notify client users
    const clientUserSnap = await this.firebaseService.db.collection('users')
      .where('companyId', '==', req.clientId)
      .limit(1)
      .get();

    if (!clientUserSnap.empty) {
      const clientUser = { id: clientUserSnap.docs[0].id, ...clientUserSnap.docs[0].data() } as any;
      const webUrl = process.env.WEB_URL || 'http://localhost:3000';
      const link = `/client/sealed-bids`;

      await this.createInAppNotification(
        clientUser.id,
        'sealed_bids_shared',
        'Shortlisted Bids Ready for Review',
        `Admin has shortlisted sealed bids for "${req.title}". Review them now.`,
        link,
      );

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
      const uniqueVendorIds = new Set<string>();
      bidsSnap.docs.forEach(doc => {
        if (bidIds.includes(doc.id)) {
          const vId = doc.data()?.vendorId;
          if (vId) uniqueVendorIds.add(vId);
        }
      });

      await Promise.all(
        Array.from(uniqueVendorIds).map(vId =>
          this.createInAppNotification(
            vId,
            'bid_shortlisted',
            'You are Shortlisted!',
            `Your sealed bid for "${req.title}" has been shortlisted and shared with the client for review.`,
            `/vendor/marketplace/${req.id}`,
          ).catch(() => {}),
        ),
      );
    }

    return { success: true, shortlistedCount: bidIds.length };
  }

  // NOTIFY CLIENT FOR LIVE APPROVAL
  async notifyClientForLiveApproval(requirementId: string) {
    const req = await this.findOne(requirementId);

    const auctionQuery = await this.firebaseService.db.collection('auctions')
      .where('requirementId', '==', requirementId)
      .limit(1)
      .get();
    if (auctionQuery.empty) throw new NotFoundException('Auction not found');
    const auctionDoc = auctionQuery.docs[0];

    const clientUserSnap = await this.firebaseService.db.collection('users')
      .where('companyId', '==', req.clientId)
      .limit(1)
      .get();
    if (clientUserSnap.empty) throw new NotFoundException('Client user not found');
    const clientUser = { id: clientUserSnap.docs[0].id, ...clientUserSnap.docs[0].data() } as any;

    const webUrl = process.env.WEB_URL || 'http://localhost:3000';
    const configureUrl = `${webUrl}/client/listings/${requirementId}/configure-live`;

    await this.notifications.notifyClientLiveAuctionApproval(
      clientUser.email,
      clientUser.name,
      req.title,
      configureUrl,
    );

    await this.createInAppNotification(
      clientUser.id,
      'live_auction_approval',
      'Action Required: Approve Live Auction',
      `Admin has set live auction parameters for "${req.title}". Review and approve to start bidding.`,
      `/client/listings/${requirementId}/configure-live`,
    );

    await auctionDoc.ref.update({
      liveApprovalStatus: 'notified',
      updatedAt: new Date(),
    });

    return { success: true };
  }

  // CLIENT REQUEST PARAM CHANGES
  async clientRequestParamChanges(requirementId: string, message?: string) {
    const req = await this.findOne(requirementId);

    const auctionQuery = await this.firebaseService.db.collection('auctions')
      .where('requirementId', '==', requirementId)
      .limit(1)
      .get();
    if (auctionQuery.empty) throw new NotFoundException('Auction not found');
    const auctionDoc = auctionQuery.docs[0];

    const clientUserSnap = await this.firebaseService.db.collection('users')
      .where('companyId', '==', req.clientId)
      .limit(1)
      .get();
    const clientUser = clientUserSnap.empty ? null : clientUserSnap.docs[0].data() as any;

    const adminSnap = await this.firebaseService.db.collection('users')
      .where('role', '==', 'ADMIN')
      .where('isActive', '==', true)
      .get();
    const admins = adminSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const note = message ? `: "${message}"` : '';
    for (const admin of admins) {
      await this.notifications
        .sendEmail({
          to: admin.email,
          subject: `Client requests param changes — ${req.title}`,
          body: `<p>${clientUser?.name || 'Client'} has requested changes to the governance parameters for "${req.title}"${note}.</p><p>Please review and update the parameters in the admin dashboard.</p>`,
        })
        .catch(() => {});
      await this.createInAppNotification(
        admin.id,
        'param_change_request',
        `Change Request: ${req.title}`,
        `Client requested changes to auction governance params${note}.`,
        `/admin/auctions`,
      );
    }

    await auctionDoc.ref.update({
      liveApprovalStatus: 'change_requested',
      updatedAt: new Date(),
    });

    return { success: true };
  }

  // CLIENT APPROVE LIVE
  async clientApproveLive(
    requirementId: string,
    body: {
      basePrice?: number;
      targetPrice?: number;
      startDate?: string;
      endDate?: string;
    } = {},
  ) {
    const req = await this.findOne(requirementId);

    const auctionQuery = await this.firebaseService.db.collection('auctions')
      .where('requirementId', '==', requirementId)
      .limit(1)
      .get();
    if (auctionQuery.empty) throw new NotFoundException('Auction not found');
    const auctionDoc = auctionQuery.docs[0];
    const auctionData = auctionDoc.data() as any;

    const now = new Date();
    const openPhaseStart = body.startDate ? new Date(body.startDate) : (auctionData.openPhaseStart?.toDate ? auctionData.openPhaseStart.toDate() : (auctionData.openPhaseStart ? new Date(auctionData.openPhaseStart) : null));
    const shouldGoLiveNow = openPhaseStart && openPhaseStart <= now;

    const auctionUpdateData: any = {
      liveApprovalStatus: 'approved',
      status: shouldGoLiveNow ? AuctionStatus.OPEN_PHASE : AuctionStatus.UPCOMING,
      updatedAt: new Date(),
    };
    if (body.basePrice !== undefined) auctionUpdateData.basePrice = Number(body.basePrice);
    if (body.targetPrice !== undefined) auctionUpdateData.targetPrice = Number(body.targetPrice);
    if (body.startDate) auctionUpdateData.openPhaseStart = new Date(body.startDate);
    if (body.endDate) auctionUpdateData.openPhaseEnd = new Date(body.endDate);

    await auctionDoc.ref.update(auctionUpdateData);

    // Notify approved vendors
    const approvedVendorIds = Array.isArray(req.auditApprovedVendorIds) ? req.auditApprovedVendorIds : [];
    let notifiedCount = 0;

    if (approvedVendorIds.length > 0) {
      const approvedVendors = await this.fetchUsersByIds(approvedVendorIds);
      notifiedCount = approvedVendors.length;

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
          await this.createInAppNotification(
            v.id,
            'live_auction_approved',
            "You're Approved for Live Auction!",
            `The live open auction for "${req.title}" is now active.${timingNote} Join the bidding now.`,
            `/vendor/live-auction`,
          );
        }),
      );
    }

    return { success: true, notifiedCount };
  }

  // GET INVITATION DETAILS
  async getInvitationDetails(requirementId: string, vendorUserId: string) {
    if (!vendorUserId) throw new NotFoundException('Vendor user not identified');

    const req = await this.findOne(requirementId);

    let processedSheetUrl: string | null = null;
    if (req.processedS3Key) {
      processedSheetUrl = await this.s3.getSignedUrl(req.processedS3Key);
    }

    const auditDocSnap = await this.firebaseService.db.collection('requirements')
      .doc(requirementId)
      .collection('vendorAuditDocs')
      .doc(vendorUserId)
      .get();
    const auditDoc = auditDocSnap.exists ? auditDocSnap.data() as any : null;

    let existingBid: any = null;
    if (req.auction) {
      const bidsSnap = await this.firebaseService.db.collection('auctions')
        .doc(req.auction.id)
        .collection('bids')
        .where('vendorId', '==', vendorUserId)
        .where('phase', '==', 'SEALED')
        .limit(1)
        .get();
      existingBid = bidsSnap.empty ? null : bidsSnap.docs[0].data();
    }

    const invitedVendorIds = Array.isArray(req.invitedVendorIds) ? req.invitedVendorIds : [];
    const acceptedVendorIds = Array.isArray(req.acceptedVendorIds) ? req.acceptedVendorIds : [];
    const declinedVendorIds = Array.isArray(req.declinedVendorIds) ? req.declinedVendorIds : [];
    const auditApprovedVendorIds = Array.isArray(req.auditApprovedVendorIds) ? req.auditApprovedVendorIds : [];

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
      isInvited: invitedVendorIds.includes(vendorUserId),
      hasAccepted: acceptedVendorIds.includes(vendorUserId),
      hasDeclined: declinedVendorIds.includes(vendorUserId),
      auditApproved: auditApprovedVendorIds.includes(vendorUserId),
      auditDoc: auditDoc
        ? { status: auditDoc.status, adminRemarks: auditDoc.adminRemarks }
        : null,
      hasSealedBid: !!existingBid,
      sealedBidAmount: existingBid?.amount ?? null,
      auctionId: req.auction?.id ?? null,
      auctionStatus: req.auction?.status ?? null,
      auctionLiveApprovalStatus: req.auction?.liveApprovalStatus ?? 'pending',
    };
  }

  // GET SIGNED URL
  async getSignedUrl(id: string, field: 'raw' | 'processed') {
    const reqRef = this.firebaseService.db.collection('requirements').doc(id);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) throw new NotFoundException('Requirement not found');
    const req = reqSnap.data() as any;

    const key = field === 'raw' ? req.rawS3Key : req.processedS3Key;
    if (!key) throw new NotFoundException('File not found');
    return { url: await this.s3.getSignedUrl(key) };
  }
}
