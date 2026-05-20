import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { NotificationService } from '../notifications/notification.service';
import { AuditStatus } from '@prisma/client';

@Injectable()
export class AuditsService {
  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
    private notifications: NotificationService,
  ) {}

  async inviteVendors(requirementId: string, vendorIds: string[]) {
    const requirement = await this.prisma.requirement.findUnique({
      where: { id: requirementId },
    });

    const invitations = await Promise.all(
      vendorIds.map((vendorId) =>
        this.prisma.auditInvitation.upsert({
          where: { requirementId_vendorId: { requirementId, vendorId } },
          create: { requirementId, vendorId },
          update: { status: AuditStatus.INVITED },
        }),
      ),
    );

    // Send email notifications and in-app notifications to all invited vendors
    const vendors = await this.prisma.company.findMany({
      where: { id: { in: vendorIds } },
      include: { users: { select: { email: true, name: true }, take: 1 } },
    });

    for (const vendor of vendors) {
      const user = vendor.users[0];
      if (user?.email) {
        await this.notifications.notifyAuditInvitation(
          user.email,
          user.name || vendor.name,
          requirement?.title || 'E-Waste Requirement',
        ).catch(() => {});
      }
      await this.notifications.notifyCompanyUsers(vendor.id, {
        type: 'audit_invitation',
        title: 'New Site Audit Invitation',
        message: `You have been invited to perform a site audit for "${requirement?.title || 'E-Waste Requirement'}".`,
        link: '/vendor/audits',
      }).catch(() => {});
    }

    return invitations;
  }

  async findAllInvitations(vendorId?: string, requirementId?: string) {
    return this.prisma.auditInvitation.findMany({
      where: {
        ...(vendorId && { vendorId }),
        ...(requirementId && { requirementId }),
      },
      include: {
        requirement: { include: { client: true } },
        vendor: true,
        report: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneInvitation(id: string) {
    const inv = await this.prisma.auditInvitation.findUnique({
      where: { id },
      include: {
        requirement: { include: { client: true } },
        vendor: true,
        report: { include: { photos: true } },
      },
    });
    if (!inv) throw new NotFoundException('Audit invitation not found');
    return inv;
  }

  async acceptAudit(id: string) {
    const inv = await this.prisma.auditInvitation.update({
      where: { id },
      data: { status: AuditStatus.ACCEPTED },
      include: {
        vendor: { include: { users: { take: 1 } } },
        requirement: { include: { client: true } },
      },
    });

    const vendorUser = inv.vendor.users[0];
    if (vendorUser?.email && inv.spocName && inv.siteAddress) {
      await this.notifications.notifyAuditSpocDetails(
        vendorUser.email,
        vendorUser.name || inv.vendor.name,
        inv.requirement.client.name,
        inv.spocName,
        inv.spocPhone || '',
        inv.siteAddress,
      ).catch(() => {});
    }

    // In-app notifications
    await this.notifications.notifyAdmins({
      type: 'audit_accepted',
      title: 'Audit Invitation Accepted',
      message: `Vendor "${inv.vendor.name}" accepted the audit invitation for "${inv.requirement.title}".`,
      link: '/admin/audits',
    }).catch(() => {});

    const clientUsers = await this.prisma.user.findMany({
      where: { companyId: inv.requirement.client.id }
    });
    await Promise.all(
      clientUsers.map(clientUser =>
        this.notifications.createInAppNotification({
          userId: clientUser.id,
          type: 'audit_accepted',
          title: 'Audit Invitation Accepted',
          message: `Vendor "${inv.vendor.name}" accepted the audit invitation for "${inv.requirement.title}".`,
          link: `/client/listings/${inv.requirementId}`,
        }).catch(() => {})
      )
    );

    return inv;
  }

  async respondToInvitation(id: string, status: 'ACCEPTED' | 'REJECTED') {
    const inv = await this.prisma.auditInvitation.update({
      where: { id },
      data: { status: status as AuditStatus },
      include: {
        vendor: true,
        requirement: { include: { client: true } },
      },
    });

    if (status === 'REJECTED') {
      // In-app notifications
      await this.notifications.notifyAdmins({
        type: 'audit_rejected',
        title: 'Audit Invitation Declined',
        message: `Vendor "${inv.vendor.name}" declined the audit invitation for "${inv.requirement.title}".`,
        link: '/admin/audits',
      }).catch(() => {});

      const clientUsers = await this.prisma.user.findMany({
        where: { companyId: inv.requirement.client.id }
      });
      await Promise.all(
        clientUsers.map(clientUser =>
          this.notifications.createInAppNotification({
            userId: clientUser.id,
            type: 'audit_rejected',
            title: 'Audit Invitation Declined',
            message: `Vendor "${inv.vendor.name}" declined the audit invitation for "${inv.requirement.title}".`,
            link: `/client/listings/${inv.requirementId}`,
          }).catch(() => {})
        )
      );
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
    const inv = await this.prisma.auditInvitation.update({
      where: { id },
      data: {
        siteAddress: data.siteAddress,
        spocName: data.spocName,
        spocPhone: data.spocPhone,
        scheduledAt: new Date(data.scheduledAt),
        status: AuditStatus.SCHEDULED,
      },
      include: {
        requirement: true,
      }
    });

    // In-app notification to all vendor users
    await this.notifications.notifyCompanyUsers(inv.vendorId, {
      type: 'audit_scheduled',
      title: 'Site Audit Scheduled',
      message: `The site audit for "${inv.requirement.title}" has been scheduled. SPOC details are now available.`,
      link: '/vendor/audits',
    }).catch(() => {});

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
    const report = await this.prisma.auditReport.upsert({
      where: { invitationId },
      create: {
        invitationId,
        productMatch: data.productMatch,
        remarks: data.remarks,
        completedAt: new Date(),
        vendorUserId: data.vendorUserId,
      },
      update: {
        productMatch: data.productMatch,
        remarks: data.remarks,
        completedAt: new Date(),
      },
    });

    if (data.photos && data.photos.length > 0) {
      await Promise.all(
        data.photos.map((photo) =>
          this.s3
            .upload(photo, `audits/${invitationId}`, false)
            .then(({ key, bucket }) =>
              this.prisma.auditPhoto.create({
                data: {
                  s3Key: key,
                  s3Bucket: bucket,
                  fileName: photo.originalname,
                  mimeType: photo.mimetype,
                  latitude: data.latitude,
                  longitude: data.longitude,
                  capturedAt: data.capturedAt,
                  auditReportId: report.id,
                },
              }),
            ),
        ),
      );
    }

    await this.prisma.auditInvitation.update({
      where: { id: invitationId },
      data: { status: AuditStatus.COMPLETED },
    });

    // In-app notifications for report submission
    const invitation = await this.prisma.auditInvitation.findUnique({
      where: { id: invitationId },
      include: {
        vendor: true,
        requirement: true,
      }
    });

    if (invitation) {
      await this.notifications.notifyAdmins({
        type: 'audit_report_submitted',
        title: 'Audit Report Submitted',
        message: `Vendor "${invitation.vendor.name}" has submitted the site audit report for "${invitation.requirement.title}".`,
        link: `/admin/listings/${invitation.requirementId}/audit-docs`,
      }).catch(() => {});

      const clientUsers = await this.prisma.user.findMany({
        where: { companyId: invitation.requirement.clientId }
      });
      await Promise.all(
        clientUsers.map(clientUser =>
          this.notifications.createInAppNotification({
            userId: clientUser.id,
            type: 'audit_report_submitted',
            title: 'Audit Report Submitted',
            message: `Vendor "${invitation.vendor.name}" has submitted the site audit report for "${invitation.requirement.title}".`,
            link: `/client/listings/${invitation.requirementId}`,
          }).catch(() => {})
        )
      );
    }

    return report;
  }
}
