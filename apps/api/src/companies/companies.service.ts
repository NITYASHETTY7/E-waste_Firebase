import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { CompanyStatus, CompanyType, DocumentType } from '@prisma/client';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
    private notifications: NotificationService,
  ) {}

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
    const company = await this.prisma.company.create({ data });

    if (userId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { companyId: company.id },
      });
    }

    return company;
  }

  async findAll(type?: CompanyType, status?: CompanyStatus) {
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;

    const companies = await this.prisma.company.findMany({
      where,
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phone: true,
          },
        },
        kycDocuments: true,
      },
    });

    return Promise.all(
      companies.map(async (company) => {
        const docs = await Promise.all(
          company.kycDocuments.map(async (doc) => ({
            ...doc,
            signedUrl: await this.s3
              .getSignedUrl(doc.s3Key, doc.s3Bucket)
              .catch(() => null),
          })),
        );
        return { ...company, kycDocuments: docs };
      }),
    );
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            phone: true,
          },
        },
        kycDocuments: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');

    let kycDocuments = company.kycDocuments;

    // If no DB records exist, fall back to listing S3 directly under kyc/{companyId}/
    if (kycDocuments.length === 0) {
      try {
        const s3Files = await this.s3.listObjects(`kyc/${id}/`);
        if (s3Files.length > 0) {
          // Sync found files back into the DB so they persist for next time
          const created = await Promise.all(
            s3Files.map((file) => {
              const fileName = file.key.split('/').pop() || file.key;
              const type = this.inferDocType(fileName);
              return this.prisma.kycDocument.upsert({
                where: { s3Key: file.key },
                update: {},
                create: {
                  type: type as DocumentType,
                  s3Key: file.key,
                  s3Bucket: this.s3.getPrivateBucket(),
                  fileName,
                  mimeType: this.inferMimeType(fileName),
                  companyId: id,
                },
              });
            }),
          );
          kycDocuments = created;
        }
      } catch {
        // S3 listing failed — leave docs empty
      }
    }

    const docs = await Promise.all(
      kycDocuments.map(async (doc) => ({
        ...doc,
        signedUrl: await this.s3
          .getSignedUrl(doc.s3Key, doc.s3Bucket)
          .catch(() => null),
      })),
    );

    return { ...company, kycDocuments: docs };
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
    return this.prisma.company.update({ where: { id }, data: { status } });
  }

  async update(id: string, data: any) {
    // Strip relations and read-only fields that Prisma rejects
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
    return this.prisma.company.update({ where: { id }, data: safeData });
  }

  async uploadKycDocument(
    companyId: string,
    file: Express.Multer.File,
    type: DocumentType,
  ) {
    const { key, bucket } = await this.s3.upload(file, `kyc/${companyId}`);
    return this.prisma.kycDocument.create({
      data: {
        type,
        s3Key: key,
        s3Bucket: bucket,
        fileName: file.originalname,
        mimeType: file.mimetype,
        companyId,
      },
    });
  }

  async getSignedUrl(s3Key: string, s3Bucket?: string) {
    const url = await this.s3.getSignedUrl(s3Key, s3Bucket);
    return { url };
  }

  async updateRating(vendorId: string, newRating: number) {
    const company = await this.prisma.company.findUnique({
      where: { id: vendorId },
    });
    if (!company) throw new NotFoundException('Vendor not found');

    const totalRatings = company.ratingCount + 1;
    const avgRating =
      ((company.rating || 0) * company.ratingCount + newRating) / totalRatings;

    return this.prisma.company.update({
      where: { id: vendorId },
      data: { rating: avgRating, ratingCount: totalRatings },
    });
  }

  // --- Admin Approval / Hold / Reject ---

  async approveCompany(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { users: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    await this.prisma.company.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    const primaryUser = company.users[0];
    if (primaryUser) {
      await this.prisma.user.update({
        where: { id: primaryUser.id },
        data: { isActive: true },
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
          message: `Your company ${company.name} has been approved. Welcome to Ecoloop!`,
          link: '/vendor/dashboard',
        })
        .catch(() => {});
    }

    return this.prisma.company.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  async holdCompany(id: string, reason?: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { users: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    await this.prisma.company.update({
      where: { id },
      data: { status: 'BLOCKED' },
    });

    const primaryUser = company.users[0];
    if (primaryUser) {
      await this.prisma.user.update({
        where: { id: primaryUser.id },
        data: { isActive: false },
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

    return this.prisma.company.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  async rejectCompany(id: string, reason?: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { users: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    await this.prisma.company.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    const primaryUser = company.users[0];
    if (primaryUser) {
      await this.prisma.user.update({
        where: { id: primaryUser.id },
        data: { isActive: false },
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

    return this.prisma.company.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  // --- Admin Risk Control ---

  async lockCompany(id: string, reason: string) {
    const company = await this.prisma.company.update({
      where: { id },
      data: { isLocked: true, lockReason: reason },
      include: { users: true },
    });

    await this.notifications
      .notifyCompanyUsers(id, {
        type: 'company_locked',
        title: 'Company Account Locked',
        message: `Your company account has been locked by an administrator. Reason: ${reason}`,
      })
      .catch(() => {});

    const primaryUser = company.users[0];
    if (primaryUser?.email) {
      await this.notifications
        .sendEmail({
          to: primaryUser.email,
          subject: `[WeConnect] Urgent: Your account has been locked`,
          body: `
          <h2>Account Locked</h2>
          <p>Hello ${primaryUser.name || company.name},</p>
          <p>Your company account on WeConnect has been locked by an administrator.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>You will not be able to place bids or participate in auctions until this issue is resolved. Please contact support immediately.</p>
        `,
        })
        .catch(() => {});
    }

    return company;
  }

  async unlockCompany(id: string) {
    const company = await this.prisma.company.update({
      where: { id },
      data: { isLocked: false, lockReason: null },
      include: { users: true },
    });

    await this.notifications
      .notifyCompanyUsers(id, {
        type: 'company_unlocked',
        title: 'Company Account Unlocked',
        message:
          'Your company account has been unlocked. Full platform services restored.',
        link: '/vendor/dashboard',
      })
      .catch(() => {});

    const primaryUser = company.users[0];
    if (primaryUser?.email) {
      await this.notifications
        .sendEmail({
          to: primaryUser.email,
          subject: `[WeConnect] Your account has been unlocked`,
          body: `
          <h2>Account Unlocked</h2>
          <p>Hello ${primaryUser.name || company.name},</p>
          <p>Your company account has been unlocked. You may now resume full platform activity.</p>
        `,
        })
        .catch(() => {});
    }

    return company;
  }

  async applyPenalty(id: string, amount: number, reason: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Company not found');

    const currentPenalty = company.penaltyAmount || 0;

    const updated = await this.prisma.company.update({
      where: { id },
      data: { penaltyAmount: currentPenalty + amount },
      include: { users: true },
    });

    await this.notifications
      .notifyCompanyUsers(id, {
        type: 'penalty_applied',
        title: 'Penalty Notice',
        message: `A penalty of ₹${amount.toLocaleString('en-IN')} has been applied to your company account. Reason: ${reason}`,
      })
      .catch(() => {});

    const primaryUser = updated.users[0];
    if (primaryUser?.email) {
      await this.notifications
        .sendEmail({
          to: primaryUser.email,
          subject: `[WeConnect] Penalty Applied to Account`,
          body: `
          <h2>Penalty Notice</h2>
          <p>Hello ${primaryUser.name || company.name},</p>
          <p>A financial penalty has been applied to your account.</p>
          <p><strong>Amount:</strong> ₹${amount.toLocaleString('en-IN')}</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>Please clear this penalty immediately to avoid suspension of services.</p>
        `,
        })
        .catch(() => {});
    }

    return updated;
  }
}
