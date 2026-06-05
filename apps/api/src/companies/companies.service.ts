import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { S3Service } from '../s3/s3.service';
import { NotificationService } from '../notifications/notification.service';
import { CompanyType, CompanyStatus, DocumentType, CompanyDoc, S3Document } from '../firebase/firestore-types';

@Injectable()
export class CompaniesService {
  constructor(
    private firebaseService: FirebaseService,
    private s3: S3Service,
    private notifications: NotificationService,
  ) {}

  private get db() {
    return this.firebaseService.db;
  }

  private get auth() {
    return this.firebaseService.auth;
  }

  async create(
    data: {
      name: string;
      type: CompanyType;
      gstNumber?: string;
      panNumber?: string;
      address?: string;
      city?: string;
      state?: string;
      pincode?: string;
    },
    userId?: string,
  ) {
    const companyId = this.db.collection('companies').doc().id;
    const companyData: CompanyDoc = {
      id: companyId,
      name: data.name,
      type: data.type,
      status: CompanyStatus.PENDING,
      gstNumber: data.gstNumber || null,
      panNumber: data.panNumber || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      pincode: data.pincode || null,
      rating: 0,
      ratingCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      isLocked: false,
    };

    await this.db.collection('companies').doc(companyId).set(companyData);

    if (userId) {
      await this.db.collection('users').doc(userId).update({
        companyId,
        updatedAt: new Date(),
      });
      
      // Update custom claims in Firebase Auth for user
      const userSnap = await this.db.collection('users').doc(userId).get();
      if (userSnap.exists) {
        const user = userSnap.data() as any;
        await this.auth.setCustomUserClaims(userId, {
          role: user.role,
          companyId,
        });
      }
    }

    return companyData;
  }

  async findAll(type?: CompanyType, status?: CompanyStatus) {
    let query: any = this.db.collection('companies');
    if (type) query = query.where('type', '==', type);
    if (status) query = query.where('status', '==', status);

    const snapshot = await query.get();
    const companies: any[] = [];

    for (const doc of snapshot.docs) {
      const company = doc.data() as CompanyDoc;
      
      // Resolve users for this company
      const usersSnap = await this.db.collection('users').where('companyId', '==', company.id).get();
      const users: any[] = [];
      usersSnap.forEach((uDoc: any) => {
        const u = uDoc.data();
        users.push({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          phone: u.phone,
        });
      });

      // Resolve KYC Documents
      const kycSnap = await this.db.collection('companies').doc(company.id).collection('kycDocuments').get();
      const kycDocuments: any[] = [];
      kycSnap.forEach((kDoc: any) => kycDocuments.push(kDoc.data()));

      const docsWithUrls = await Promise.all(
        kycDocuments.map(async (kDoc) => ({
          ...kDoc,
          uploadedAt: kDoc.uploadedAt?.toDate ? kDoc.uploadedAt.toDate() : kDoc.uploadedAt,
          signedUrl: await this.s3
            .getSignedUrl(kDoc.s3Key, kDoc.s3Bucket)
            .catch(() => null),
        }))
      );

      companies.push({
        ...company,
        createdAt: (company.createdAt as any)?.toDate ? (company.createdAt as any).toDate() : company.createdAt,
        updatedAt: (company.updatedAt as any)?.toDate ? (company.updatedAt as any).toDate() : company.updatedAt,
        users,
        kycDocuments: docsWithUrls,
      });
    }

    return companies;
  }

  async findOne(id: string) {
    const docSnap = await this.db.collection('companies').doc(id).get();
    if (!docSnap.exists) throw new NotFoundException('Company not found');

    const company = docSnap.data() as CompanyDoc;

    // Resolve users
    const usersSnap = await this.db.collection('users').where('companyId', '==', id).get();
    const users: any[] = [];
    usersSnap.forEach((uDoc: any) => {
      const u = uDoc.data();
      users.push({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        phone: u.phone,
      });
    });

    // Resolve KYC documents
    const kycSnap = await this.db.collection('companies').doc(id).collection('kycDocuments').get();
    let kycDocuments: any[] = [];
    kycSnap.forEach((kDoc: any) => kycDocuments.push(kDoc.data()));

    // Fallback: If no DB records exist, list from S3 directly
    if (kycDocuments.length === 0) {
      try {
        const s3Files = await this.s3.listObjects(`kyc/${id}/`);
        if (s3Files.length > 0) {
          const created = await Promise.all(
            s3Files.map(async (file) => {
              const fileName = file.key.split('/').pop() || file.key;
              const docType = this.inferDocType(fileName);
              const subDocId = this.db.collection('companies').doc(id).collection('kycDocuments').doc().id;
              
              const kycDocData: S3Document = {
                id: subDocId,
                type: docType as DocumentType,
                s3Key: file.key,
                s3Bucket: this.s3.getPrivateBucket(),
                fileName,
                mimeType: this.inferMimeType(fileName),
                uploadedAt: new Date(),
              };

              await this.db
                .collection('companies')
                .doc(id)
                .collection('kycDocuments')
                .doc(subDocId)
                .set(kycDocData);

              return kycDocData;
            })
          );
          kycDocuments = created;
        }
      } catch {
        // S3 listing failed — leave empty
      }
    }

    const docsWithUrls = await Promise.all(
      kycDocuments.map(async (kDoc) => ({
        ...kDoc,
        uploadedAt: kDoc.uploadedAt?.toDate ? kDoc.uploadedAt.toDate() : kDoc.uploadedAt,
        signedUrl: await this.s3
          .getSignedUrl(kDoc.s3Key, kDoc.s3Bucket)
          .catch(() => null),
      }))
    );

    return {
      ...company,
      createdAt: (company.createdAt as any)?.toDate ? (company.createdAt as any).toDate() : company.createdAt,
      updatedAt: (company.updatedAt as any)?.toDate ? (company.updatedAt as any).toDate() : company.updatedAt,
      users,
      kycDocuments: docsWithUrls,
    };
  }

  private inferDocType(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.includes('gst')) return 'GST_CERTIFICATE';
    if (lower.includes('pan')) return 'PAN_CARD';
    if (lower.includes('cheque') || lower.includes('bank'))
      return 'CANCELLED_CHEQUE';
    if (lower.includes('incorp') || lower.includes('cert'))
      return 'INCORPORATION_CERTIFICATE';
    if (lower.includes('address') || lower.includes('proof'))
      return 'ADDRESS_PROOF';
    return 'OTHER';
  }

  private inferMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'png') return 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    return 'application/octet-stream';
  }

  async updateStatus(id: string, status: CompanyStatus) {
    await this.db.collection('companies').doc(id).update({
      status,
      updatedAt: new Date(),
    });
    return { success: true };
  }

  async update(id: string, data: any) {
    const {
      id: _id,
      users: _users,
      kycDocuments: _kycDocuments,
      auctions: _auctions,
      wonAuctions: _wonAuctions,
      auditInvitations: _auditInvitations,
      requirements: _requirements,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...safeData
    } = data;

    await this.db.collection('companies').doc(id).update({
      ...safeData,
      updatedAt: new Date(),
    });

    return this.findOne(id);
  }

  async uploadKycDocument(
    companyId: string,
    file: Express.Multer.File,
    type: DocumentType,
  ) {
    const { key, bucket } = await this.s3.upload(file, `kyc/${companyId}`);
    const docId = this.db.collection('companies').doc(companyId).collection('kycDocuments').doc().id;
    
    const docData: S3Document = {
      id: docId,
      type,
      s3Key: key,
      s3Bucket: bucket,
      fileName: file.originalname,
      mimeType: file.mimetype,
      uploadedAt: new Date(),
    };

    await this.db
      .collection('companies')
      .doc(companyId)
      .collection('kycDocuments')
      .doc(docId)
      .set(docData);

    return docData;
  }

  async getSignedUrl(s3Key: string, s3Bucket?: string) {
    const url = await this.s3.getSignedUrl(s3Key, s3Bucket);
    return { url };
  }

  async updateRating(vendorId: string, newRating: number) {
    const companySnap = await this.db.collection('companies').doc(vendorId).get();
    if (!companySnap.exists) throw new NotFoundException('Vendor not found');

    const company = companySnap.data() as CompanyDoc;
    const totalRatings = company.ratingCount + 1;
    const avgRating =
      ((company.rating || 0) * company.ratingCount + newRating) / totalRatings;

    await this.db.collection('companies').doc(vendorId).update({
      rating: avgRating,
      ratingCount: totalRatings,
      updatedAt: new Date(),
    });

    return { success: true };
  }

  // --- Admin Approval / Hold / Reject ---

  async approveCompany(id: string) {
    const companySnap = await this.db.collection('companies').doc(id).get();
    if (!companySnap.exists) throw new NotFoundException('Company not found');

    await this.db.collection('companies').doc(id).update({
      status: CompanyStatus.APPROVED,
      updatedAt: new Date(),
    });

    // Find primary user linked to this company
    const usersSnap = await this.db.collection('users').where('companyId', '==', id).limit(1).get();
    if (!usersSnap.empty) {
      const primaryUser = usersSnap.docs[0].data();
      
      // Enable in Firebase Auth & set active in Firestore
      await this.auth.updateUser(primaryUser.id, { disabled: false });
      await this.db.collection('users').doc(primaryUser.id).update({
        isActive: true,
        updatedAt: new Date(),
      });

      await this.notifications
        .notifyAccountApproved(
          primaryUser.email,
          primaryUser.name,
          primaryUser.phone ?? undefined,
        )
        .catch(() => {});
      await this.notifications
        .createInAppNotification({
          userId: primaryUser.id,
          type: 'account_approved',
          title: 'Company Application Approved',
          message: `Your company has been approved. Welcome to Ecoloop!`,
          link: '/vendor/dashboard',
        })
        .catch(() => {});
    }

    return this.findOne(id);
  }

  async holdCompany(id: string, reason?: string) {
    const companySnap = await this.db.collection('companies').doc(id).get();
    if (!companySnap.exists) throw new NotFoundException('Company not found');

    await this.db.collection('companies').doc(id).update({
      status: CompanyStatus.BLOCKED,
      updatedAt: new Date(),
    });

    const usersSnap = await this.db.collection('users').where('companyId', '==', id).limit(1).get();
    if (!usersSnap.empty) {
      const primaryUser = usersSnap.docs[0].data();
      
      // Disable in Firebase Auth and deactivate in Firestore
      await this.auth.updateUser(primaryUser.id, { disabled: true });
      await this.db.collection('users').doc(primaryUser.id).update({
        isActive: false,
        updatedAt: new Date(),
      });

      await this.notifications
        .notifyAccountOnHold(
          primaryUser.email,
          primaryUser.name,
          primaryUser.phone ?? undefined,
          reason,
        )
        .catch(() => {});
      await this.notifications
        .createInAppNotification({
          userId: primaryUser.id,
          type: 'account_on_hold',
          title: 'Company Account On Hold',
          message: `Your company account has been placed on hold. ${reason ? `Reason: ${reason}` : ''}`,
        })
        .catch(() => {});
    }

    return this.findOne(id);
  }

  async rejectCompany(id: string, reason?: string) {
    const companySnap = await this.db.collection('companies').doc(id).get();
    if (!companySnap.exists) throw new NotFoundException('Company not found');

    await this.db.collection('companies').doc(id).update({
      status: CompanyStatus.REJECTED,
      updatedAt: new Date(),
    });

    const usersSnap = await this.db.collection('users').where('companyId', '==', id).limit(1).get();
    if (!usersSnap.empty) {
      const primaryUser = usersSnap.docs[0].data();
      
      await this.auth.updateUser(primaryUser.id, { disabled: true });
      await this.db.collection('users').doc(primaryUser.id).update({
        isActive: false,
        updatedAt: new Date(),
      });

      await this.notifications
        .notifyAccountRejected(
          primaryUser.email,
          primaryUser.name,
          primaryUser.phone ?? undefined,
          reason,
        )
        .catch(() => {});
      await this.notifications
        .createInAppNotification({
          userId: primaryUser.id,
          type: 'account_rejected',
          title: 'Company Application Update',
          message: `Your company application was not approved. ${reason ? `Reason: ${reason}` : ''}`,
        })
        .catch(() => {});
    }

    return this.findOne(id);
  }

  // --- Admin Risk Control ---

  async lockCompany(id: string, reason: string) {
    await this.db.collection('companies').doc(id).update({
      isLocked: true,
      lockReason: reason,
      updatedAt: new Date(),
    });

    await this.notifications
      .notifyCompanyUsers(id, {
        type: 'company_locked',
        title: 'Company Account Locked',
        message: `Your company account has been locked by an administrator. Reason: ${reason}`,
      })
      .catch(() => {});

    // Send email to primary user
    const usersSnap = await this.db.collection('users').where('companyId', '==', id).limit(1).get();
    if (!usersSnap.empty) {
      const primaryUser = usersSnap.docs[0].data();
      await this.notifications
        .sendEmail({
          to: primaryUser.email,
          subject: `[WeConnect] Urgent: Your account has been locked`,
          body: `
          <h2>Account Locked</h2>
          <p>Hello ${primaryUser.name},</p>
          <p>Your company account on WeConnect has been locked by an administrator.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>You will not be able to place bids or participate in auctions until this issue is resolved. Please contact support immediately.</p>
        `,
        })
        .catch(() => {});
    }

    return this.findOne(id);
  }

  async unlockCompany(id: string) {
    await this.db.collection('companies').doc(id).update({
      isLocked: false,
      lockReason: null,
      updatedAt: new Date(),
    });

    await this.notifications
      .notifyCompanyUsers(id, {
        type: 'company_unlocked',
        title: 'Company Account Unlocked',
        message: 'Your company account has been unlocked. Full platform services restored.',
        link: '/vendor/dashboard',
      })
      .catch(() => {});

    const usersSnap = await this.db.collection('users').where('companyId', '==', id).limit(1).get();
    if (!usersSnap.empty) {
      const primaryUser = usersSnap.docs[0].data();
      await this.notifications
        .sendEmail({
          to: primaryUser.email,
          subject: `[WeConnect] Your account has been unlocked`,
          body: `
          <h2>Account Unlocked</h2>
          <p>Hello ${primaryUser.name},</p>
          <p>Your company account has been unlocked. You may now resume full platform activity.</p>
        `,
        })
        .catch(() => {});
    }

    return this.findOne(id);
  }

  async applyPenalty(id: string, amount: number, reason: string) {
    const companySnap = await this.db.collection('companies').doc(id).get();
    if (!companySnap.exists) throw new NotFoundException('Company not found');

    const company = companySnap.data() as CompanyDoc;
    const currentPenalty = company.penaltyAmount || 0;

    await this.db.collection('companies').doc(id).update({
      penaltyAmount: currentPenalty + amount,
      updatedAt: new Date(),
    });

    await this.notifications
      .notifyCompanyUsers(id, {
        type: 'penalty_applied',
        title: 'Penalty Notice',
        message: `A penalty of ₹${amount.toLocaleString('en-IN')} has been applied to your company account. Reason: ${reason}`,
      })
      .catch(() => {});

    const usersSnap = await this.db.collection('users').where('companyId', '==', id).limit(1).get();
    if (!usersSnap.empty) {
      const primaryUser = usersSnap.docs[0].data();
      await this.notifications
        .sendEmail({
          to: primaryUser.email,
          subject: `[WeConnect] Penalty Applied to Account`,
          body: `
          <h2>Penalty Notice</h2>
          <p>Hello ${primaryUser.name},</p>
          <p>A financial penalty has been applied to your account.</p>
          <p><strong>Amount:</strong> ₹${amount.toLocaleString('en-IN')}</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>Please clear this penalty immediately to avoid suspension of services.</p>
        `,
        })
        .catch(() => {});
    }

    return this.findOne(id);
  }
}
