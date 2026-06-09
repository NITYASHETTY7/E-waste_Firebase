import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { S3Service } from '../s3/s3.service';
import { NotificationService } from '../notifications/notification.service';
import { AuditStatus } from '../firebase/firestore-types';
import * as admin from 'firebase-admin';

const convertDate = (field: any): Date | null => {
  if (!field) return null;
  return typeof field.toDate === 'function' ? field.toDate() : new Date(field);
};

async function populateInvitation(invDoc: any, firebaseService: FirebaseService) {
  const data = invDoc.data();
  const invitationId = invDoc.id;
  
  // Get parent requirement
  const reqId = data.requirementId || invDoc.ref.parent.parent?.id;
  let requirement: any = null;
  let client: any = null;
  if (reqId) {
    const reqSnap = await firebaseService.db.collection('requirements').doc(reqId).get();
    if (reqSnap.exists) {
      requirement = { id: reqSnap.id, ...reqSnap.data() };
      if (requirement.createdAt) requirement.createdAt = convertDate(requirement.createdAt);
      if (requirement.updatedAt) requirement.updatedAt = convertDate(requirement.updatedAt);
      if (requirement.adminApprovedAt) requirement.adminApprovedAt = convertDate(requirement.adminApprovedAt);
      if (requirement.sealedPhaseStart) requirement.sealedPhaseStart = convertDate(requirement.sealedPhaseStart);
      if (requirement.sealedPhaseEnd) requirement.sealedPhaseEnd = convertDate(requirement.sealedPhaseEnd);
      if (requirement.sealedBidDeadline) requirement.sealedBidDeadline = convertDate(requirement.sealedBidDeadline);
      if (requirement.sealedBidEventCreatedAt) requirement.sealedBidEventCreatedAt = convertDate(requirement.sealedBidEventCreatedAt);
      
      const clientId = requirement.clientId;
      if (clientId) {
        const clientSnap = await firebaseService.db.collection('companies').doc(clientId).get();
        if (clientSnap.exists) {
          client = { id: clientSnap.id, ...clientSnap.data() };
        }
      }
      requirement.client = client;
    }
  }

  // Get vendor
  let vendor: any = null;
  if (data.vendorId) {
    const vendorSnap = await firebaseService.db.collection('companies').doc(data.vendorId).get();
    if (vendorSnap.exists) {
      const vendorData = vendorSnap.data();
      const usersSnap = await firebaseService.db.collection('users').where('companyId', '==', vendorSnap.id).limit(1).get();
      const users = usersSnap.docs.map((u: any) => ({ id: u.id, ...u.data() }));
      vendor = { id: vendorSnap.id, ...vendorData, users };
    }
  }

  const report = data.report ? {
    ...data.report,
    createdAt: convertDate(data.report.createdAt),
    updatedAt: convertDate(data.report.updatedAt),
    completedAt: convertDate(data.report.completedAt),
    photos: (data.report.photos || []).map((p: any) => ({
      ...p,
      uploadedAt: convertDate(p.uploadedAt),
      capturedAt: convertDate(p.capturedAt),
    })),
  } : null;

  return {
    id: invitationId,
    ...data,
    createdAt: convertDate(data.createdAt),
    updatedAt: convertDate(data.updatedAt),
    scheduledAt: convertDate(data.scheduledAt),
    respondedAt: convertDate(data.respondedAt),
    requirement,
    vendor,
    report,
  };
}

@Injectable()
export class AuditsService {
  constructor(
    private firebaseService: FirebaseService,
    private s3: S3Service,
    private notifications: NotificationService,
  ) {}

  async inviteVendors(requirementId: string, vendorIds: string[]) {
    const reqSnap = await this.firebaseService.db.collection('requirements').doc(requirementId).get();
    const requirement = reqSnap.exists ? reqSnap.data() : null;

    const invitations = await Promise.all(
      vendorIds.map(async (vendorId) => {
        const invRef = this.firebaseService.db
          .collection('requirements')
          .doc(requirementId)
          .collection('auditInvitations')
          .doc(vendorId);

        const invSnap = await invRef.get();
        if (invSnap.exists) {
          await invRef.update({
            status: AuditStatus.INVITED,
            updatedAt: new Date(),
          });
        } else {
          await invRef.set({
            id: vendorId,
            requirementId,
            vendorId,
            status: AuditStatus.INVITED,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        const finalSnap = await invRef.get();
        return { id: finalSnap.id, ...finalSnap.data() };
      }),
    );

    // Send email notifications and in-app notifications to all invited vendors
    const vendors = await Promise.all(
      vendorIds.map(async (vendorId) => {
        const compSnap = await this.firebaseService.db.collection('companies').doc(vendorId).get();
        if (!compSnap.exists) return null;
        const usersSnap = await this.firebaseService.db.collection('users').where('companyId', '==', vendorId).limit(1).get();
        const users = usersSnap.docs.map((u: any) => ({ id: u.id, ...u.data() }));
        return { id: compSnap.id, ...compSnap.data(), users };
      })
    );

    const validVendors = vendors.filter(Boolean) as any[];

    for (const vendor of validVendors) {
      const user = vendor.users[0];
      if (user?.email) {
        await this.notifications
          .notifyAuditInvitation(
            user.email,
            user.name || vendor.name,
            requirement?.title || 'E-Waste Requirement',
          )
          .catch(() => {});
      }
      await this.notifications
        .notifyCompanyUsers(vendor.id, {
          type: 'audit_invitation',
          title: 'New Site Audit Invitation',
          message: `You have been invited to perform a site audit for "${requirement?.title || 'E-Waste Requirement'}".`,
          link: '/vendor/audits',
        })
        .catch(() => {});
    }

    return invitations;
  }

  async findAllInvitations(vendorId?: string, requirementId?: string) {
    let snap: admin.firestore.QuerySnapshot;

    if (requirementId) {
      const collRef = this.firebaseService.db
        .collection('requirements')
        .doc(requirementId)
        .collection('auditInvitations');
      let query: admin.firestore.Query = collRef;
      if (vendorId) {
        query = query.where('vendorId', '==', vendorId);
      }
      snap = await query.get();
    } else {
      let query: admin.firestore.Query = this.firebaseService.db.collectionGroup('auditInvitations');
      if (vendorId) {
        query = query.where('vendorId', '==', vendorId);
      }
      snap = await query.get();
    }

    const invitations = await Promise.all(
      snap.docs.map((doc: any) => populateInvitation(doc, this.firebaseService))
    );

    invitations.sort((a: any, b: any) => {
      const aTime = a.createdAt ? a.createdAt.getTime() : 0;
      const bTime = b.createdAt ? b.createdAt.getTime() : 0;
      return bTime - aTime;
    });

    return invitations;
  }

  async findOneInvitation(id: string) {
    const snap = await this.firebaseService.db
      .collectionGroup('auditInvitations')
      .where('id', '==', id)
      .limit(1)
      .get();

    if (snap.empty) {
      throw new NotFoundException('Audit invitation not found');
    }

    return populateInvitation(snap.docs[0], this.firebaseService);
  }

  async acceptAudit(id: string) {
    const snap = await this.firebaseService.db
      .collectionGroup('auditInvitations')
      .where('id', '==', id)
      .limit(1)
      .get();

    if (snap.empty) {
      throw new NotFoundException('Audit invitation not found');
    }

    const docRef = snap.docs[0].ref;
    await docRef.update({
      status: AuditStatus.ACCEPTED,
      updatedAt: new Date(),
    });

    const inv = await populateInvitation(await docRef.get(), this.firebaseService);

    const vendorUser = inv.vendor?.users?.[0];
    if (vendorUser?.email && inv.spocName && inv.siteAddress) {
      await this.notifications
        .notifyAuditSpocDetails(
          vendorUser.email,
          vendorUser.name || inv.vendor.name,
          inv.requirement?.client?.name || '',
          inv.spocName,
          inv.spocPhone || '',
          inv.siteAddress,
        )
        .catch(() => {});
    }

    // In-app notifications
    await this.notifications
      .notifyAdmins({
        type: 'audit_accepted',
        title: 'Audit Invitation Accepted',
        message: `Vendor "${inv.vendor?.name || 'Vendor'}" accepted the audit invitation for "${inv.requirement?.title}".`,
        link: '/admin/audits',
      })
      .catch(() => {});

    if (inv.requirement?.client?.id) {
      const clientUsersSnap = await this.firebaseService.db
        .collection('users')
        .where('companyId', '==', inv.requirement.client.id)
        .get();

      await Promise.all(
        clientUsersSnap.docs.map((doc: any) =>
          this.notifications
            .createInAppNotification({
              userId: doc.id,
              type: 'audit_accepted',
              title: 'Audit Invitation Accepted',
              message: `Vendor "${inv.vendor?.name || 'Vendor'}" accepted the audit invitation for "${inv.requirement?.title}".`,
              link: `/client/listings/${inv.requirementId}`,
            })
            .catch(() => {}),
        ),
      );
    }

    return inv;
  }

  async respondToInvitation(id: string, status: 'ACCEPTED' | 'REJECTED') {
    const snap = await this.firebaseService.db
      .collectionGroup('auditInvitations')
      .where('id', '==', id)
      .limit(1)
      .get();

    if (snap.empty) {
      throw new NotFoundException('Audit invitation not found');
    }

    const docRef = snap.docs[0].ref;
    await docRef.update({
      status: status as AuditStatus,
      updatedAt: new Date(),
      respondedAt: new Date(),
    });

    const inv = await populateInvitation(await docRef.get(), this.firebaseService);

    if (status === 'REJECTED') {
      // In-app notifications
      await this.notifications
        .notifyAdmins({
          type: 'audit_rejected',
          title: 'Audit Invitation Declined',
          message: `Vendor "${inv.vendor?.name || 'Vendor'}" declined the audit invitation for "${inv.requirement?.title}".`,
          link: '/admin/audits',
        })
        .catch(() => {});

      if (inv.requirement?.client?.id) {
        const clientUsersSnap = await this.firebaseService.db
          .collection('users')
          .where('companyId', '==', inv.requirement.client.id)
          .get();

        await Promise.all(
          clientUsersSnap.docs.map((doc: any) =>
            this.notifications
              .createInAppNotification({
                userId: doc.id,
                type: 'audit_rejected',
                title: 'Audit Invitation Declined',
                message: `Vendor "${inv.vendor?.name || 'Vendor'}" declined the audit invitation for "${inv.requirement?.title}".`,
                link: `/client/listings/${inv.requirementId}`,
              })
              .catch(() => {}),
          ),
        );
      }
    }

    return inv;
  }

  async shareSpoc(
    id: string,
    data: {
      siteAddress: string;
      spocName: string;
      spocPhone: string;
      scheduledAt: string;
    },
  ) {
    const snap = await this.firebaseService.db
      .collectionGroup('auditInvitations')
      .where('id', '==', id)
      .limit(1)
      .get();

    if (snap.empty) {
      throw new NotFoundException('Audit invitation not found');
    }

    const docRef = snap.docs[0].ref;
    await docRef.update({
      siteAddress: data.siteAddress,
      spocName: data.spocName,
      spocPhone: data.spocPhone,
      scheduledAt: new Date(data.scheduledAt),
      status: AuditStatus.SCHEDULED,
      updatedAt: new Date(),
    });

    const inv = await populateInvitation(await docRef.get(), this.firebaseService);

    // In-app notification to all vendor users
    await this.notifications
      .notifyCompanyUsers(inv.vendorId, {
        type: 'audit_scheduled',
        title: 'Site Audit Scheduled',
        message: `The site audit for "${inv.requirement?.title}" has been scheduled. SPOC details are now available.`,
        link: '/vendor/audits',
      })
      .catch(() => {});

    return inv;
  }

  async submitReport(
    invitationId: string,
    data: {
      productMatch: boolean;
      remarks?: string;
      vendorUserId: string;
      photos?: Express.Multer.File[];
      latitude?: number;
      longitude?: number;
      capturedAt?: Date;
    },
  ) {
    const snap = await this.firebaseService.db
      .collectionGroup('auditInvitations')
      .where('id', '==', invitationId)
      .limit(1)
      .get();

    if (snap.empty) {
      throw new NotFoundException('Audit invitation not found');
    }

    const docRef = snap.docs[0].ref;
    const currentData = snap.docs[0].data();
    const currentReport = currentData.report || {};

    const photoDocs: any[] = currentReport.photos || [];

    if (data.photos && data.photos.length > 0) {
      await Promise.all(
        data.photos.map((photo) =>
          this.s3
            .upload(photo, `audits/${invitationId}`, false)
            .then(({ key, bucket }) => {
              photoDocs.push({
                id: this.firebaseService.db.collection('requirements').doc().id,
                s3Key: key,
                s3Bucket: bucket,
                fileName: photo.originalname,
                mimeType: photo.mimetype,
                latitude: data.latitude || null,
                longitude: data.longitude || null,
                capturedAt: data.capturedAt || null,
                uploadedAt: new Date(),
              });
            }),
        ),
      );
    }

    const report = {
      id: currentReport.id || this.firebaseService.db.collection('requirements').doc().id,
      productMatch: data.productMatch,
      remarks: data.remarks || null,
      completedAt: new Date(),
      vendorUserId: data.vendorUserId,
      createdAt: currentReport.createdAt || new Date(),
      updatedAt: new Date(),
      photos: photoDocs,
    };

    await docRef.update({
      status: AuditStatus.COMPLETED,
      report,
      updatedAt: new Date(),
    });

    const invitation = await populateInvitation(await docRef.get(), this.firebaseService);

    if (invitation) {
      await this.notifications
        .notifyAdmins({
          type: 'audit_report_submitted',
          title: 'Audit Report Submitted',
          message: `Vendor "${invitation.vendor?.name || 'Vendor'}" has submitted the site audit report for "${invitation.requirement?.title}".`,
          link: `/admin/listings/${invitation.requirementId}/audit-docs`,
        })
        .catch(() => {});

      if (invitation.requirement?.clientId) {
        const clientUsersSnap = await this.firebaseService.db
          .collection('users')
          .where('companyId', '==', invitation.requirement.clientId)
          .get();

        await Promise.all(
          clientUsersSnap.docs.map((doc: any) =>
            this.notifications
              .createInAppNotification({
                userId: doc.id,
                type: 'audit_report_submitted',
                title: 'Audit Report Submitted',
                message: `Vendor "${invitation.vendor?.name || 'Vendor'}" has submitted the site audit report for "${invitation.requirement?.title}".`,
                link: `/client/listings/${invitation.requirementId}`,
              })
              .catch(() => {}),
          ),
        );
      }
    }

    return report;
  }
}
