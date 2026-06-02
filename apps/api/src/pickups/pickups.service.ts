import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { NotificationService } from '../notifications/notification.service';
import { DocumentsService } from '../documents/documents.service';
import { PickupStatus, DocumentType } from '@prisma/client';
import archiver from 'archiver';
import { PassThrough } from 'stream';

@Injectable()
export class PickupsService {
  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
    private notifications: NotificationService,
    private documents: DocumentsService,
  ) {}

  async findByAuction(auctionId: string) {
    const pickup = await this.prisma.pickup.findUnique({
      where: { auctionId },
      include: {
        auction: { include: { client: true, winner: true, auctionDocs: true } },
        pickupDocs: true,
        payment: true,
      },
    });
    if (!pickup) return null;
    const docs = await Promise.all(
      pickup.pickupDocs.map(async (doc) => ({
        ...doc,
        signedUrl: await this.s3.getSignedUrl(doc.s3Key, doc.s3Bucket),
      })),
    );
    const auctionDocs = await Promise.all(
      (pickup.auction?.auctionDocs ?? []).map(async (doc) => ({
        ...doc,
        signedUrl: await this.s3.getSignedUrl(doc.s3Key, doc.s3Bucket).catch(() => null),
      })),
    );
    return { ...pickup, pickupDocs: docs, auctionDocs };
  }

  async issueGatePass(
    id: string,
    data: {
      gatePassNumber: string;
      vehicleNumber?: string;
      driverName?: string;
      scheduledDate?: string;
      pickupNotes?: string;
    },
  ) {
    const pickup = await this.prisma.pickup.update({
      where: { id },
      data: {
        gatePassNumber: data.gatePassNumber,
        vehicleNumber: data.vehicleNumber,
        driverName: data.driverName,
        pickupNotes: data.pickupNotes,
        gatePassIssuedAt: new Date(),
        status: PickupStatus.GATE_PASS_ISSUED,
        ...(data.scheduledDate && { scheduledDate: new Date(data.scheduledDate) }),
      },
      include: {
        auction: {
          include: {
            winner: { include: { users: { take: 1 } } },
          },
        },
      },
    });

    const vendorUser = pickup.auction.winner?.users?.[0];
    if (vendorUser?.id) {
      await this.notifications.createInAppNotification({
        userId: vendorUser.id,
        type: 'gate_pass_issued',
        title: 'Gate Pass Issued',
        message: `Gate pass has been issued for "${pickup.auction.title}". You can proceed with logistics/pickup.`,
        link: `/vendor/pickups`,
      }).catch(() => {});
    }

    return pickup;
  }

  async uploadGatePassDoc(id: string, file: Express.Multer.File) {
    const pickup = await this.prisma.pickup.findUnique({
      where: { id },
      include: {
        auction: {
          include: {
            winner: { include: { users: { take: 1 } } },
            client: true,
          },
        },
      },
    });
    if (!pickup) throw new NotFoundException('Pickup not found');

    const { key, bucket } = await this.s3.upload(file, `pickups/${id}/gate-pass`);

    await this.prisma.pickup.update({
      where: { id },
      data: {
        gatePassDocS3Key: key,
        gatePassDocBucket: bucket,
        gatePassDocFileName: file.originalname,
      },
    });

    // Email vendor that gate pass is ready
    const vendorUser = pickup.auction.winner?.users?.[0];
    if (vendorUser?.email) {
      await this.notifications.notifyVendorGatePassUploaded(
        vendorUser.email,
        vendorUser.name || pickup.auction.winner!.name,
        pickup.auction.title,
        pickup.auction.client.name,
        pickup.gatePassNumber ?? 'N/A',
      ).catch(() => {});
    }

    if (vendorUser?.id) {
      await this.notifications.createInAppNotification({
        userId: vendorUser.id,
        type: 'gate_pass_uploaded',
        title: 'Gate Pass Document Uploaded',
        message: `Gate pass document has been uploaded for "${pickup.auction.title}". Logistics can now proceed.`,
        link: `/vendor/pickups`,
      }).catch(() => {});
    }

    return { success: true };
  }

  async saveVendorLogistics(
    auctionId: string,
    data: { vehicleNumber?: string; driverName?: string; preferredDate?: string },
  ) {
    const pickup = await this.prisma.pickup.findUnique({ where: { auctionId } });
    if (!pickup) return null;
    const updatedPickup = await this.prisma.pickup.update({
      where: { auctionId },
      data: {
        vendorVehicleNumber: data.vehicleNumber,
        vendorDriverName: data.driverName,
        ...(data.preferredDate && { vendorPreferredDate: new Date(data.preferredDate) }),
      },
      include: {
        auction: {
          include: {
            client: { include: { users: { take: 1 } } },
            winner: true,
          },
        },
      },
    });

    const clientUser = updatedPickup.auction.client?.users?.[0];
    if (clientUser?.id) {
      await this.notifications.createInAppNotification({
        userId: clientUser.id,
        type: 'logistics_updated',
        title: 'Pickup Logistics Updated',
        message: `Vendor "${updatedPickup.auction.winner?.name || 'Winner'}" has updated pickup logistics/driver details for "${updatedPickup.auction.title}".`,
        link: `/client/handover`,
      }).catch(() => {});
    }

    await this.notifications.notifyAdmins({
      type: 'logistics_updated',
      title: 'Pickup Logistics Updated',
      message: `Vendor "${updatedPickup.auction.winner?.name || 'Winner'}" updated vehicle & driver details for "${updatedPickup.auction.title}".`,
      link: `/admin/pickups`,
    }).catch(() => {});

    return updatedPickup;
  }

  async vendorAcknowledge(id: string) {
    const pickup = await this.prisma.pickup.update({
      where: { id },
      data: {
        vendorAcknowledgedAt: new Date(),
        status: PickupStatus.VENDOR_ACKNOWLEDGED,
      },
      include: {
        auction: {
          include: {
            client: { include: { users: { take: 1 } } },
            winner: true,
          },
        },
      },
    });

    const clientUser = pickup.auction.client?.users?.[0];
    if (clientUser?.id) {
      await this.notifications.createInAppNotification({
        userId: clientUser.id,
        type: 'pickup_acknowledged',
        title: 'Pickup Acknowledged by Vendor',
        message: `Vendor "${pickup.auction.winner?.name || 'Winner'}" has acknowledged the scheduled pickup for "${pickup.auction.title}".`,
        link: `/client/handover`,
      }).catch(() => {});
    }

    await this.notifications.notifyAdmins({
      type: 'pickup_acknowledged',
      title: 'Pickup Acknowledged by Vendor',
      message: `Vendor "${pickup.auction.winner?.name || 'Winner'}" acknowledged scheduled pickup details for "${pickup.auction.title}".`,
      link: `/admin/pickups`,
    }).catch(() => {});

    return pickup;
  }

  async uploadHandoverDoc(id: string, file: Express.Multer.File, type: DocumentType) {
    return this.uploadDocument(id, file, type);
  }

  async reconcile(
    id: string,
    data: { finalWeight: number; reconciliationNotes?: string; finalAmount: number },
  ) {
    const pickup = await this.prisma.pickup.update({
      where: { id },
      data: {
        finalWeight: data.finalWeight,
        reconciliationNotes: data.reconciliationNotes,
        finalAmount: data.finalAmount,
        status: PickupStatus.RECONCILIATION_DONE,
      },
      include: {
        auction: {
          include: {
            client: { include: { users: { take: 1 } } },
            winner: { include: { users: { take: 1 } } },
          },
        },
      },
    });

    const clientUser = pickup.auction.client?.users?.[0];
    const vendorUser = pickup.auction.winner?.users?.[0];

    if (clientUser?.id) {
      await this.notifications.createInAppNotification({
        userId: clientUser.id,
        type: 'weight_reconciled',
        title: 'Weight Reconciled',
        message: `Weight for "${pickup.auction.title}" has been reconciled. Final weight: ${data.finalWeight} kg, Final amount: ₹${data.finalAmount}.`,
        link: `/client/handover`,
      }).catch(() => {});
    }

    if (vendorUser?.id) {
      await this.notifications.createInAppNotification({
        userId: vendorUser.id,
        type: 'weight_reconciled',
        title: 'Weight Reconciled',
        message: `Weight for "${pickup.auction.title}" has been reconciled. Final weight: ${data.finalWeight} kg, Final amount: ₹${data.finalAmount}.`,
        link: `/vendor/pickups`,
      }).catch(() => {});
    }

    return pickup;
  }

  async generateInvoice(id: string) {
    const pickup = await this.prisma.pickup.findUnique({
      where: { id },
      include: {
        auction: {
          include: {
            client: true,
            winner: true,
            requirement: true,
          },
        },
        payment: true,
      },
    });
    if (!pickup) throw new NotFoundException('Pickup not found');

    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
    const finalAmount = pickup.finalAmount ?? pickup.payment?.clientAmount ?? 0;
    const commissionAmount = pickup.payment?.commissionAmount ?? Math.round(finalAmount * 0.05);

    const s3Key = await this.documents.generateInvoicePdf({
      pickupId: pickup.id,
      invoiceNumber,
      auctionId: pickup.auctionId,
      clientName: pickup.auction.client.name,
      vendorName: pickup.auction.winner?.name ?? 'Vendor',
      auctionTitle: pickup.auction.title,
      finalWeight: pickup.finalWeight ?? pickup.auction.requirement?.totalWeight ?? 0,
      finalAmount,
      commissionAmount,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    });

    const bucket = process.env.AWS_S3_BUCKET_NAME ?? 'ecoloop-docs';
    await this.prisma.pickupDocument.create({
      data: {
        type: DocumentType.INVOICE,
        s3Key,
        s3Bucket: bucket,
        fileName: `${invoiceNumber}.pdf`,
        mimeType: 'application/pdf',
        pickupId: id,
      },
    });

    return this.prisma.pickup.update({
      where: { id },
      data: {
        invoiceNumber,
        invoiceGeneratedAt: new Date(),
        invoiceS3Key: s3Key,
        status: PickupStatus.INVOICE_GENERATED,
      },
    });
  }

  async releasePayment(id: string) {
    return this.prisma.pickup.update({
      where: { id },
      data: { status: PickupStatus.COMPLETED },
    });
  }

  async create(auctionId: string, paymentId?: string) {
    return this.prisma.pickup.upsert({
      where: { auctionId },
      create: { auctionId, paymentId },
      update: { ...(paymentId && { paymentId }) },
    });
  }

  async findAll(status?: PickupStatus) {
    const pickups = await this.prisma.pickup.findMany({
      where: status ? { status } : {},
      include: {
        auction: { include: { client: true, winner: true, auctionDocs: true } },
        pickupDocs: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      pickups.map(async (pickup) => {
        const docs = await Promise.all(
          pickup.pickupDocs.map(async (doc) => ({
            ...doc,
            signedUrl: await this.s3.getSignedUrl(doc.s3Key, doc.s3Bucket),
          })),
        );
        const auctionDocs = await Promise.all(
          (pickup.auction?.auctionDocs ?? []).map(async (doc) => ({
            ...doc,
            signedUrl: await this.s3.getSignedUrl(doc.s3Key, doc.s3Bucket).catch(() => null),
          })),
        );
        return { ...pickup, pickupDocs: docs, auctionDocs };
      }),
    );
  }

  async findOne(id: string) {
    const pickup = await this.prisma.pickup.findUnique({
      where: { id },
      include: {
        auction: { include: { client: true, winner: true, auctionDocs: true } },
        pickupDocs: true,
        payment: true,
      },
    });
    if (!pickup) throw new NotFoundException('Pickup not found');

    const docs = await Promise.all(
      pickup.pickupDocs.map(async (doc) => ({
        ...doc,
        signedUrl: await this.s3.getSignedUrl(doc.s3Key, doc.s3Bucket),
      })),
    );

    const auctionDocs = await Promise.all(
      (pickup.auction?.auctionDocs ?? []).map(async (doc) => ({
        ...doc,
        signedUrl: await this.s3.getSignedUrl(doc.s3Key, doc.s3Bucket).catch(() => null),
      })),
    );

    return { ...pickup, pickupDocs: docs, auctionDocs };
  }

  async schedule(id: string, scheduledDate: string) {
    return this.prisma.pickup.update({
      where: { id },
      data: {
        scheduledDate: new Date(scheduledDate),
        status: PickupStatus.SCHEDULED,
      },
    });
  }

  async uploadDocument(
    id: string,
    file: Express.Multer.File,
    type: DocumentType,
  ) {
    const pickup = await this.prisma.pickup.findUnique({
      where: { id },
      include: {
        auction: {
          include: {
            client: { include: { users: { take: 1 } } },
            winner: true,
          },
        },
      },
    });
    if (!pickup) throw new NotFoundException('Pickup not found');

    const { key, bucket } = await this.s3.upload(file, `pickups/${id}`);
    const doc = await this.prisma.pickupDocument.create({
      data: {
        type,
        s3Key: key,
        s3Bucket: bucket,
        fileName: file.originalname,
        mimeType: file.mimetype,
        pickupId: id,
      },
    });

    const allDocs = await this.prisma.pickupDocument.findMany({
      where: { pickupId: id },
    });
    const hasRecycling = allDocs.some(
      (d) => d.type === DocumentType.RECYCLING_CERTIFICATE,
    );
    const hasDisposal = allDocs.some(
      (d) => d.type === DocumentType.DISPOSAL_CERTIFICATE,
    );
    if (hasRecycling && hasDisposal) {
      await this.prisma.pickup.update({
        where: { id },
        data: { status: PickupStatus.DOCUMENTS_UPLOADED },
      });
    }

    const isCompliance = type === DocumentType.RECYCLING_CERTIFICATE || type === DocumentType.DISPOSAL_CERTIFICATE;
    if (isCompliance) {
      const clientUser = pickup.auction?.client?.users?.[0];
      if (clientUser?.id) {
        await this.notifications.createInAppNotification({
          userId: clientUser.id,
          type: 'compliance_uploaded',
          title: 'Compliance Document Uploaded',
          message: `Vendor "${pickup.auction?.winner?.name || 'Winner'}" uploaded a compliance certificate (${type.replace('_', ' ')}) for "${pickup.auction?.title}".`,
          link: `/client/handover`,
        }).catch(() => {});
      }

      await this.notifications.notifyAdmins({
        type: 'compliance_uploaded',
        title: 'Compliance Document Uploaded',
        message: `Vendor "${pickup.auction?.winner?.name || 'Winner'}" uploaded ${type.replace('_', ' ')} for "${pickup.auction?.title}".`,
        link: `/admin/pickups`,
      }).catch(() => {});
    }

    return doc;
  }

  async downloadAllDocumentsZip(id: string): Promise<PassThrough> {
    const pickup = await this.prisma.pickup.findUnique({
      where: { id },
      include: { pickupDocs: true },
    });
    
    if (!pickup || pickup.pickupDocs.length === 0) {
      throw new NotFoundException('No documents found for this pickup');
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    const passThrough = new PassThrough();
    
    archive.pipe(passThrough);

    for (const doc of pickup.pickupDocs) {
      try {
        const fileStream = await this.s3.getFileStream(doc.s3Key, doc.s3Bucket);
        archive.append(fileStream, { name: doc.fileName || `${doc.type}.pdf` });
      } catch (err) {
        console.error(`Failed to fetch file stream for doc ${doc.id}`, err);
      }
    }

    await archive.finalize();
    return passThrough;
  }

  async clientVerifyCompliance(id: string) {
    return this.prisma.pickup.update({
      where: { id },
      data: { clientVerifiedAt: new Date() },
    });
  }

  async verifyCompliance(id: string) {
    const pickup = await this.prisma.pickup.update({
      where: { id },
      data: { status: PickupStatus.COMPLETED },
      include: {
        auction: {
          include: {
            client: { include: { users: { take: 1 } } },
            winner: { include: { users: { take: 1 } } },
          }
        }
      }
    });

    const clientUser = pickup.auction?.client?.users?.[0];
    const vendorUser = pickup.auction?.winner?.users?.[0];

    if (clientUser?.email) {
      await this.notifications.notifyComplianceVerified(
        clientUser.email,
        clientUser.name || pickup.auction.client.name,
        pickup.auction.title
      ).catch(() => {});
    }

    if (clientUser?.id) {
      await this.notifications.createInAppNotification({
        userId: clientUser.id,
        type: 'compliance_verified',
        title: 'Compliance Documents Verified',
        message: `Compliance documents for "${pickup.auction.title}" have been verified. The transaction is now complete.`,
        link: `/client/handover`,
      }).catch(() => {});
    }

    if (vendorUser?.id) {
      await this.notifications.createInAppNotification({
        userId: vendorUser.id,
        type: 'compliance_verified',
        title: 'Compliance Documents Verified',
        message: `Compliance documents for "${pickup.auction.title}" have been verified by the client. The transaction is now complete.`,
        link: `/vendor/pickups`,
      }).catch(() => {});
    }

    return pickup;
  }

  async completePickup(id: string, adminNotes?: string) {
    return this.prisma.pickup.update({
      where: { id },
      data: { status: PickupStatus.COMPLETED, adminNotes },
    });
  }
}
