import { Injectable, NotFoundException } from '@nestjs/common';
import { S3Service } from '../s3/s3.service';
import { NotificationService } from '../notifications/notification.service';
import { DocumentsService } from '../documents/documents.service';
import { FirebaseService } from '../firebase/firebase.service';
import * as admin from 'firebase-admin';
import { PickupStatus, DocumentType, S3Document } from '../firebase/firestore-types';
import archiver from 'archiver';
import { PassThrough } from 'stream';

const convertDate = (field: any): Date | null => {
  if (!field) return null;
  return typeof field.toDate === 'function' ? field.toDate() : new Date(field);
};

@Injectable()
export class PickupsService {
  constructor(
    private firebaseService: FirebaseService,
    private s3: S3Service,
    private notifications: NotificationService,
    private documents: DocumentsService,
  ) {}

  private get db(): admin.firestore.Firestore {
    return this.firebaseService.db;
  }

  // Find pickup by its ID inside collectionGroup
  async findPickupById(id: string) {
    const querySnap = await this.db
      .collectionGroup('pickup')
      .where('id', '==', id)
      .get();
    if (querySnap.empty) return null;
    return querySnap.docs[0];
  }

  async findByAuction(auctionId: string) {
    const pickupSnap = await this.db
      .collection('auctions')
      .doc(auctionId)
      .collection('pickup')
      .get();
    if (pickupSnap.empty) return null;

    const pickupDoc = pickupSnap.docs[0];
    const pickup = { id: pickupDoc.id, ...pickupDoc.data() } as any;

    const auctionSnap = await this.db.collection('auctions').doc(auctionId).get();
    let auction = null;
    if (auctionSnap.exists) {
      const aData = auctionSnap.data()!;
      let client = null;
      if (aData.clientId) {
        const clientSnap = await this.db.collection('companies').doc(aData.clientId).get();
        if (clientSnap.exists) {
          client = { id: clientSnap.id, ...clientSnap.data() };
        }
      }
      let winner = null;
      if (aData.winnerId) {
        const winnerSnap = await this.db.collection('companies').doc(aData.winnerId).get();
        if (winnerSnap.exists) {
          winner = { id: winnerSnap.id, ...winnerSnap.data() };
        }
      }
      auction = {
        id: auctionSnap.id,
        ...aData,
        client,
        winner,
        auctionDocs: aData.auctionDocs || [],
      };
    }

    pickup.auction = auction;

    // Resolve payment
    const paymentSnap = await this.db.collection('auctions').doc(auctionId).collection('payment').get();
    pickup.payment = paymentSnap.empty ? null : { id: paymentSnap.docs[0].id, ...paymentSnap.docs[0].data() };

    const docs = await Promise.all(
      (pickup.pickupDocs ?? []).map(async (doc: any) => ({
        ...doc,
        signedUrl: await this.s3.getSignedUrl(doc.s3Key, doc.s3Bucket),
      })),
    );

    const auctionDocs = await Promise.all(
      (pickup.auction?.auctionDocs ?? []).map(async (doc: any) => ({
        ...doc,
        signedUrl: await this.s3
          .getSignedUrl(doc.s3Key, doc.s3Bucket)
          .catch(() => null),
      })),
    );

    // Merge Invoice into auctionDocs for frontend visibility
    const mergedAuctionDocs = [
      ...auctionDocs,
      ...docs.filter((d) => d.type === DocumentType.INVOICE),
    ];

    return {
      ...pickup,
      pickupDocs: docs,
      auctionDocs: mergedAuctionDocs,
      createdAt: convertDate(pickup.createdAt),
      updatedAt: convertDate(pickup.updatedAt),
      scheduledDate: convertDate(pickup.scheduledDate),
      gatePassIssuedAt: convertDate(pickup.gatePassIssuedAt),
      vendorPreferredDate: convertDate(pickup.vendorPreferredDate),
      clientVerifiedAt: convertDate(pickup.clientVerifiedAt),
    };
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
    const pickupDoc = await this.findPickupById(id);
    if (!pickupDoc) throw new NotFoundException('Pickup not found');

    const updateData = {
      gatePassNumber: data.gatePassNumber,
      vehicleNumber: data.vehicleNumber || null,
      driverName: data.driverName || null,
      pickupNotes: data.pickupNotes || null,
      gatePassIssuedAt: new Date(),
      status: PickupStatus.GATE_PASS_ISSUED,
      updatedAt: new Date(),
      ...(data.scheduledDate && {
        scheduledDate: new Date(data.scheduledDate),
      }),
    };

    await pickupDoc.ref.update(updateData);

    const auctionId = pickupDoc.ref.parent.parent!.id;
    const auctionSnap = await this.db.collection('auctions').doc(auctionId).get();
    const auctionData = auctionSnap.data()!;

    // Fetch winner users
    let vendorUser = null;
    if (auctionData.winnerId) {
      const usersSnap = await this.db.collection('users')
        .where('companyId', '==', auctionData.winnerId)
        .limit(1)
        .get();
      if (!usersSnap.empty) {
        vendorUser = { id: usersSnap.docs[0].id };
      }
    }

    if (vendorUser?.id) {
      await this.notifications
        .createInAppNotification({
          userId: vendorUser.id,
          type: 'gate_pass_issued',
          title: 'Gate Pass Issued',
          message: `Gate pass has been issued for "${auctionData.title}". You can proceed with logistics/pickup.`,
          link: `/vendor/pickups`,
        })
        .catch(() => {});
    }

    return { id, ...pickupDoc.data(), ...updateData };
  }

  async uploadGatePassDoc(id: string, file: Express.Multer.File) {
    const pickupDoc = await this.findPickupById(id);
    if (!pickupDoc) throw new NotFoundException('Pickup not found');

    const auctionId = pickupDoc.ref.parent.parent!.id;
    const auctionSnap = await this.db.collection('auctions').doc(auctionId).get();
    const auctionData = auctionSnap.data()!;

    // Fetch winner and client company details
    let winnerCompany = null;
    if (auctionData.winnerId) {
      const winnerSnap = await this.db.collection('companies').doc(auctionData.winnerId).get();
      if (winnerSnap.exists) winnerCompany = winnerSnap.data();
    }

    let clientCompany = null;
    if (auctionData.clientId) {
      const clientSnap = await this.db.collection('companies').doc(auctionData.clientId).get();
      if (clientSnap.exists) clientCompany = clientSnap.data();
    }

    const { key, bucket } = await this.s3.upload(
      file,
      `pickups/${id}/gate-pass`,
    );

    const updateData = {
      gatePassDocS3Key: key,
      gatePassDocBucket: bucket,
      gatePassDocFileName: file.originalname,
      updatedAt: new Date(),
    };

    await pickupDoc.ref.update(updateData);

    const pickup = { ...pickupDoc.data(), ...updateData } as any;

    // Email vendor that gate pass is ready
    let vendorUser = null;
    if (auctionData.winnerId) {
      const usersSnap = await this.db.collection('users')
        .where('companyId', '==', auctionData.winnerId)
        .limit(1)
        .get();
      if (!usersSnap.empty) {
        vendorUser = { id: usersSnap.docs[0].id, ...usersSnap.docs[0].data() };
      }
    }

    if (vendorUser?.email) {
      await this.notifications
        .notifyVendorGatePassUploaded(
          vendorUser.email,
          vendorUser.name || winnerCompany!.name,
          auctionData.title,
          clientCompany!.name,
          pickup.gatePassNumber ?? 'N/A',
        )
        .catch(() => {});
    }

    if (vendorUser?.id) {
      await this.notifications
        .createInAppNotification({
          userId: vendorUser.id,
          type: 'gate_pass_uploaded',
          title: 'Gate Pass Document Uploaded',
          message: `Gate pass document has been uploaded for "${auctionData.title}". Logistics can now proceed.`,
          link: `/vendor/pickups`,
        })
        .catch(() => {});
    }

    return { success: true };
  }

  async saveVendorLogistics(
    auctionId: string,
    data: {
      vehicleNumber?: string;
      driverName?: string;
      preferredDate?: string;
    },
  ) {
    const pickupSnap = await this.db
      .collection('auctions')
      .doc(auctionId)
      .collection('pickup')
      .get();
    if (pickupSnap.empty) return null;

    const pickupDoc = pickupSnap.docs[0];

    const updateData = {
      vendorVehicleNumber: data.vehicleNumber || null,
      vendorDriverName: data.driverName || null,
      updatedAt: new Date(),
      ...(data.preferredDate && {
        vendorPreferredDate: new Date(data.preferredDate),
      }),
    };

    await pickupDoc.ref.update(updateData);

    const auctionSnap = await this.db.collection('auctions').doc(auctionId).get();
    const auctionData = auctionSnap.data()!;

    // Fetch client company and users
    let clientUser = null;
    if (auctionData.clientId) {
      const usersSnap = await this.db.collection('users')
        .where('companyId', '==', auctionData.clientId)
        .limit(1)
        .get();
      if (!usersSnap.empty) {
        clientUser = { id: usersSnap.docs[0].id };
      }
    }

    let winnerCompany = null;
    if (auctionData.winnerId) {
      const winnerSnap = await this.db.collection('companies').doc(auctionData.winnerId).get();
      if (winnerSnap.exists) winnerCompany = winnerSnap.data();
    }

    if (clientUser?.id) {
      await this.notifications
        .createInAppNotification({
          userId: clientUser.id,
          type: 'logistics_updated',
          title: 'Pickup Logistics Updated',
          message: `Vendor "${winnerCompany?.name || 'Winner'}" has updated pickup logistics/driver details for "${auctionData.title}".`,
          link: `/client/handover`,
        })
        .catch(() => {});
    }

    await this.notifications
      .notifyAdmins({
        type: 'logistics_updated',
        title: 'Pickup Logistics Updated',
        message: `Vendor "${winnerCompany?.name || 'Winner'}" updated vehicle & driver details for "${auctionData.title}".`,
        link: `/admin/pickups`,
      })
      .catch(() => {});

    return { id: pickupDoc.id, ...pickupDoc.data(), ...updateData };
  }

  async vendorAcknowledge(id: string) {
    const pickupDoc = await this.findPickupById(id);
    if (!pickupDoc) throw new NotFoundException('Pickup not found');

    const updateData = {
      vendorAcknowledgedAt: new Date(),
      status: PickupStatus.VENDOR_ACKNOWLEDGED,
      updatedAt: new Date(),
    };

    await pickupDoc.ref.update(updateData);

    const auctionId = pickupDoc.ref.parent.parent!.id;
    const auctionSnap = await this.db.collection('auctions').doc(auctionId).get();
    const auctionData = auctionSnap.data()!;

    let clientUser = null;
    if (auctionData.clientId) {
      const usersSnap = await this.db.collection('users')
        .where('companyId', '==', auctionData.clientId)
        .limit(1)
        .get();
      if (!usersSnap.empty) {
        clientUser = { id: usersSnap.docs[0].id };
      }
    }

    let winnerCompany = null;
    if (auctionData.winnerId) {
      const winnerSnap = await this.db.collection('companies').doc(auctionData.winnerId).get();
      if (winnerSnap.exists) winnerCompany = winnerSnap.data();
    }

    if (clientUser?.id) {
      await this.notifications
        .createInAppNotification({
          userId: clientUser.id,
          type: 'pickup_acknowledged',
          title: 'Pickup Acknowledged by Vendor',
          message: `Vendor "${winnerCompany?.name || 'Winner'}" has acknowledged the scheduled pickup for "${auctionData.title}".`,
          link: `/client/handover`,
        })
        .catch(() => {});
    }

    await this.notifications
      .notifyAdmins({
        type: 'pickup_acknowledged',
        title: 'Pickup Acknowledged by Vendor',
        message: `Vendor "${winnerCompany?.name || 'Winner'}" acknowledged scheduled pickup details for "${auctionData.title}".`,
        link: `/admin/pickups`,
      })
      .catch(() => {});

    return { id: pickupDoc.id, ...pickupDoc.data(), ...updateData };
  }

  async uploadHandoverDoc(
    id: string,
    file: Express.Multer.File,
    type: DocumentType,
  ) {
    return this.uploadDocument(id, file, type);
  }

  async reconcile(
    id: string,
    data: {
      finalWeight: number;
      reconciliationNotes?: string;
      finalAmount: number;
    },
  ) {
    const pickupDoc = await this.findPickupById(id);
    if (!pickupDoc) throw new NotFoundException('Pickup not found');

    const updateData = {
      finalWeight: data.finalWeight,
      reconciliationNotes: data.reconciliationNotes || null,
      finalAmount: data.finalAmount,
      status: PickupStatus.RECONCILIATION_DONE,
      updatedAt: new Date(),
    };

    await pickupDoc.ref.update(updateData);

    const auctionId = pickupDoc.ref.parent.parent!.id;
    const auctionSnap = await this.db.collection('auctions').doc(auctionId).get();
    const auctionData = auctionSnap.data()!;

    let clientUser = null;
    if (auctionData.clientId) {
      const usersSnap = await this.db.collection('users')
        .where('companyId', '==', auctionData.clientId)
        .limit(1)
        .get();
      if (!usersSnap.empty) {
        clientUser = { id: usersSnap.docs[0].id };
      }
    }

    let vendorUser = null;
    if (auctionData.winnerId) {
      const usersSnap = await this.db.collection('users')
        .where('companyId', '==', auctionData.winnerId)
        .limit(1)
        .get();
      if (!usersSnap.empty) {
        vendorUser = { id: usersSnap.docs[0].id };
      }
    }

    if (clientUser?.id) {
      await this.notifications
        .createInAppNotification({
          userId: clientUser.id,
          type: 'weight_reconciled',
          title: 'Weight Reconciled',
          message: `Weight for "${auctionData.title}" has been reconciled. Final weight: ${data.finalWeight} kg, Final amount: ₹${data.finalAmount}.`,
          link: `/client/handover`,
        })
        .catch(() => {});
    }

    if (vendorUser?.id) {
      await this.notifications
        .createInAppNotification({
          userId: vendorUser.id,
          type: 'weight_reconciled',
          title: 'Weight Reconciled',
          message: `Weight for "${auctionData.title}" has been reconciled. Final weight: ${data.finalWeight} kg, Final amount: ₹${data.finalAmount}.`,
          link: `/vendor/pickups`,
        })
        .catch(() => {});
    }

    return { id: pickupDoc.id, ...pickupDoc.data(), ...updateData };
  }

  async generateInvoice(id: string) {
    const pickupDoc = await this.findPickupById(id);
    if (!pickupDoc) throw new NotFoundException('Pickup not found');

    const pickup = pickupDoc.data() as any;
    const auctionId = pickupDoc.ref.parent.parent!.id;
    const auctionSnap = await this.db.collection('auctions').doc(auctionId).get();
    if (!auctionSnap.exists) throw new NotFoundException('Auction not found');
    const auctionData = auctionSnap.data()!;

    // Resolve client, winner, requirement details
    let clientName = 'Client';
    if (auctionData.clientId) {
      const clientSnap = await this.db.collection('companies').doc(auctionData.clientId).get();
      if (clientSnap.exists) clientName = clientSnap.data()?.name || clientName;
    }

    let vendorName = 'Vendor';
    if (auctionData.winnerId) {
      const vendorSnap = await this.db.collection('companies').doc(auctionData.winnerId).get();
      if (vendorSnap.exists) vendorName = vendorSnap.data()?.name || vendorName;
    }

    let reqWeight = 0;
    if (auctionData.requirementId) {
      const reqSnap = await this.db.collection('requirements').doc(auctionData.requirementId).get();
      if (reqSnap.exists) reqWeight = reqSnap.data()?.totalWeight || 0;
    }

    // Resolve payment
    const paymentSnap = await this.db.collection('auctions').doc(auctionId).collection('payment').get();
    const payment = paymentSnap.empty ? null : (paymentSnap.docs[0].data() as any);

    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
    const finalAmount = pickup.finalAmount ?? payment?.clientAmount ?? 0;
    const commissionAmount =
      payment?.commissionAmount ?? Math.round(finalAmount * 0.05);

    const s3Key = await this.documents.generateInvoicePdf({
      pickupId: id,
      invoiceNumber,
      auctionId,
      clientName,
      vendorName,
      auctionTitle: auctionData.title,
      finalWeight: pickup.finalWeight ?? reqWeight,
      finalAmount,
      commissionAmount,
      date: new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    });

    const bucket = this.s3.getPrivateBucket();
    const newDoc: S3Document = {
      id: this.db.collection('auctions').doc().id,
      type: DocumentType.INVOICE,
      s3Key,
      s3Bucket: bucket,
      fileName: `${invoiceNumber}.pdf`,
      mimeType: 'application/pdf',
      uploadedAt: new Date(),
    };

    await pickupDoc.ref.update({
      invoiceNumber,
      invoiceGeneratedAt: new Date(),
      invoiceS3Key: s3Key,
      status: PickupStatus.INVOICE_GENERATED,
      pickupDocs: admin.firestore.FieldValue.arrayUnion(newDoc),
      updatedAt: new Date(),
    });

    return { id, ...pickup, invoiceNumber, invoiceGeneratedAt: new Date(), invoiceS3Key: s3Key, status: PickupStatus.INVOICE_GENERATED };
  }

  async releasePayment(id: string) {
    const pickupDoc = await this.findPickupById(id);
    if (!pickupDoc) throw new NotFoundException('Pickup not found');
    await pickupDoc.ref.update({
      status: PickupStatus.COMPLETED,
      updatedAt: new Date(),
    });
    return { success: true };
  }

  async create(auctionId: string, paymentId?: string) {
    const paymentCol = this.db.collection('auctions').doc(auctionId).collection('pickup');
    const snap = await paymentCol.get();

    const pickupData = {
      auctionId,
      paymentId: paymentId || null,
      status: PickupStatus.PENDING,
      updatedAt: new Date(),
    };

    if (snap.empty) {
      const newRef = paymentCol.doc();
      const newPickup = {
        id: newRef.id,
        ...pickupData,
        pickupDocs: [],
        createdAt: new Date(),
      };
      await newRef.set(newPickup);
      return newPickup;
    } else {
      const existingDoc = snap.docs[0];
      await existingDoc.ref.update({
        ...(paymentId && { paymentId }),
        updatedAt: new Date(),
      });
      return { id: existingDoc.id, ...existingDoc.data(), ...(paymentId && { paymentId }) };
    }
  }

  async findAll(status?: PickupStatus) {
    let query: any = this.db.collectionGroup('pickup');
    if (status) {
      query = query.where('status', '==', status);
    }
    const snap = await query.get();

    const pickups = [];
    for (const doc of snap.docs) {
      const pickupData = doc.data();
      const parentRef = doc.ref.parent.parent;
      if (!parentRef) continue;

      let auction = null;
      if (parentRef.path.startsWith('auctions/')) {
        const auctionId = parentRef.id;
        const auctionSnap = await this.db.collection('auctions').doc(auctionId).get();

        if (auctionSnap.exists) {
          const aData = auctionSnap.data()!;
          let client = null;
          if (aData.clientId) {
            const clientSnap = await this.db.collection('companies').doc(aData.clientId).get();
            if (clientSnap.exists) client = { id: clientSnap.id, name: clientSnap.data()?.name };
          }
          let winner = null;
          if (aData.winnerId) {
            const winnerSnap = await this.db.collection('companies').doc(aData.winnerId).get();
            if (winnerSnap.exists) winner = { id: winnerSnap.id, name: winnerSnap.data()?.name };
          }
          auction = { id: auctionSnap.id, ...aData, client, winner, auctionDocs: aData.auctionDocs || [] };
        }
      }

      pickups.push({
        id: doc.id,
        ...pickupData,
        createdAt: convertDate(pickupData.createdAt),
        updatedAt: convertDate(pickupData.updatedAt),
        auction,
      });
    }

    return Promise.all(
      pickups.map(async (pickup) => {
        const docs = await Promise.all(
          (pickup.pickupDocs ?? []).map(async (doc: any) => ({
            ...doc,
            signedUrl: await this.s3.getSignedUrl(doc.s3Key, doc.s3Bucket),
          })),
        );
        const auctionDocs = await Promise.all(
          (pickup.auction?.auctionDocs ?? []).map(async (doc: any) => ({
            ...doc,
            signedUrl: await this.s3.getSignedUrl(doc.s3Key, doc.s3Bucket).catch(() => null),
          })),
        );
        const mergedAuctionDocs = [
          ...auctionDocs,
          ...docs.filter((d) => d.type === DocumentType.INVOICE),
        ];
        return { ...pickup, pickupDocs: docs, auctionDocs: mergedAuctionDocs };
      }),
    ).then(res => res.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)));
  }

  async findOne(id: string) {
    const pickupDoc = await this.findPickupById(id);
    if (!pickupDoc) throw new NotFoundException('Pickup not found');

    const pickup = { id: pickupDoc.id, ...pickupDoc.data() } as any;
    const parentRef = pickupDoc.ref.parent.parent;
    
    let auction = null;
    if (parentRef && parentRef.path.startsWith('auctions/')) {
      const auctionId = parentRef.id;
      const auctionSnap = await this.db.collection('auctions').doc(auctionId).get();
      if (auctionSnap.exists) {
        const aData = auctionSnap.data()!;
        let client = null;
        if (aData.clientId) {
          const clientSnap = await this.db.collection('companies').doc(aData.clientId).get();
          if (clientSnap.exists) client = { id: clientSnap.id, ...clientSnap.data() };
        }
        let winner = null;
        if (aData.winnerId) {
          const winnerSnap = await this.db.collection('companies').doc(aData.winnerId).get();
          if (winnerSnap.exists) winner = { id: winnerSnap.id, ...winnerSnap.data() };
        }
        auction = { id: auctionSnap.id, ...aData, client, winner, auctionDocs: aData.auctionDocs || [] };
      }
    }

    pickup.auction = auction;

    // Resolve payment
    if (parentRef) {
      const paymentSnap = await parentRef.collection('payment').get();
      pickup.payment = paymentSnap.empty ? null : { id: paymentSnap.docs[0].id, ...paymentSnap.docs[0].data() };
    }

    const docs = await Promise.all(
      (pickup.pickupDocs ?? []).map(async (doc: any) => ({
        ...doc,
        signedUrl: await this.s3.getSignedUrl(doc.s3Key, doc.s3Bucket),
      })),
    );

    const auctionDocs = await Promise.all(
      (pickup.auction?.auctionDocs ?? []).map(async (doc: any) => ({
        ...doc,
        signedUrl: await this.s3.getSignedUrl(doc.s3Key, doc.s3Bucket).catch(() => null),
      })),
    );

    const mergedAuctionDocs = [
      ...auctionDocs,
      ...docs.filter((d) => d.type === DocumentType.INVOICE),
    ];

    return {
      ...pickup,
      pickupDocs: docs,
      auctionDocs: mergedAuctionDocs,
      createdAt: convertDate(pickup.createdAt),
      updatedAt: convertDate(pickup.updatedAt),
      scheduledDate: convertDate(pickup.scheduledDate),
      gatePassIssuedAt: convertDate(pickup.gatePassIssuedAt),
      vendorPreferredDate: convertDate(pickup.vendorPreferredDate),
      clientVerifiedAt: convertDate(pickup.clientVerifiedAt),
    };
  }

  async schedule(id: string, scheduledDate: string) {
    const pickupDoc = await this.findPickupById(id);
    if (!pickupDoc) throw new NotFoundException('Pickup not found');
    await pickupDoc.ref.update({
      scheduledDate: new Date(scheduledDate),
      status: PickupStatus.SCHEDULED,
      updatedAt: new Date(),
    });
    return { success: true };
  }

  async uploadDocument(
    id: string,
    file: Express.Multer.File,
    type: DocumentType,
  ) {
    const pickupDoc = await this.findPickupById(id);
    if (!pickupDoc) throw new NotFoundException('Pickup not found');

    const parentRef = pickupDoc.ref.parent.parent;
    let auctionData: any = null;
    if (parentRef && parentRef.path.startsWith('auctions/')) {
      const auctionSnap = await parentRef.get();
      auctionData = auctionSnap.exists ? auctionSnap.data() : null;
    }

    const { key, bucket } = await this.s3.upload(file, `pickups/${id}`);

    const newDoc: S3Document = {
      id: this.db.collection('auctions').doc().id,
      type,
      s3Key: key,
      s3Bucket: bucket,
      fileName: file.originalname,
      mimeType: file.mimetype,
      uploadedAt: new Date(),
    };

    await pickupDoc.ref.update({
      pickupDocs: admin.firestore.FieldValue.arrayUnion(newDoc),
      updatedAt: new Date(),
    });

    const updatedPickupSnap = await pickupDoc.ref.get();
    const updatedPickup = updatedPickupSnap.data() as any;
    const allDocs = updatedPickup.pickupDocs || [];

    const hasRecycling = allDocs.some((d: any) => d.type === DocumentType.RECYCLING_CERTIFICATE);
    const hasDisposal = allDocs.some((d: any) => d.type === DocumentType.DISPOSAL_CERTIFICATE);
    if (hasRecycling && hasDisposal) {
      await pickupDoc.ref.update({
        status: PickupStatus.DOCUMENTS_UPLOADED,
        updatedAt: new Date(),
      });
    }

    const isCompliance = type === DocumentType.RECYCLING_CERTIFICATE || type === DocumentType.DISPOSAL_CERTIFICATE;
    if (isCompliance && auctionData) {
      let clientUser = null;
      if (auctionData.clientId) {
        const usersSnap = await this.db.collection('users').where('companyId', '==', auctionData.clientId).limit(1).get();
        if (!usersSnap.empty) clientUser = { id: usersSnap.docs[0].id };
      }
      let winnerCompany = null;
      if (auctionData.winnerId) {
        const winnerSnap = await this.db.collection('companies').doc(auctionData.winnerId).get();
        if (winnerSnap.exists) winnerCompany = winnerSnap.data();
      }

      if (clientUser?.id) {
        await this.notifications.createInAppNotification({
          userId: clientUser.id,
          type: 'compliance_uploaded',
          title: 'Compliance Document Uploaded',
          message: `Vendor "${winnerCompany?.name || 'Winner'}" uploaded a compliance certificate (${type.replace('_', ' ')}) for "${auctionData.title}".`,
          link: `/client/handover`,
        }).catch(() => {});
      }
      await this.notifications.notifyAdmins({
        type: 'compliance_uploaded',
        title: 'Compliance Document Uploaded',
        message: `Vendor "${winnerCompany?.name || 'Winner'}" uploaded ${type.replace('_', ' ')} for "${auctionData.title}".`,
        link: `/admin/pickups`,
      }).catch(() => {});
    }

    return newDoc;
  }

  async downloadAllDocumentsZip(id: string): Promise<PassThrough> {
    const pickupDoc = await this.findPickupById(id);
    if (!pickupDoc) throw new NotFoundException('Pickup not found');
    const pickup = pickupDoc.data() as any;

    if (!pickup || !pickup.pickupDocs || pickup.pickupDocs.length === 0) {
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
    const pickupDoc = await this.findPickupById(id);
    if (!pickupDoc) throw new NotFoundException('Pickup not found');
    await pickupDoc.ref.update({
      clientVerifiedAt: new Date(),
      updatedAt: new Date(),
    });
    return { success: true };
  }

  async verifyCompliance(id: string) {
    const pickupDoc = await this.findPickupById(id);
    if (!pickupDoc) throw new NotFoundException('Pickup not found');

    const parentRef = pickupDoc.ref.parent.parent;
    let auctionData: any = null;
    if (parentRef && parentRef.path.startsWith('auctions/')) {
      const auctionSnap = await parentRef.get();
      auctionData = auctionSnap.exists ? { id: auctionSnap.id, ...auctionSnap.data() } : null;
    }

    await pickupDoc.ref.update({
      status: PickupStatus.COMPLETED,
      updatedAt: new Date(),
    });

    if (auctionData) {
      let clientUser = null;
      if (auctionData.clientId) {
        const usersSnap = await this.db.collection('users').where('companyId', '==', auctionData.clientId).limit(1).get();
        if (!usersSnap.empty) clientUser = { id: usersSnap.docs[0].id, ...usersSnap.docs[0].data() as any };
      }
      let vendorUser = null;
      if (auctionData.winnerId) {
        const usersSnap = await this.db.collection('users').where('companyId', '==', auctionData.winnerId).limit(1).get();
        if (!usersSnap.empty) vendorUser = { id: usersSnap.docs[0].id, ...usersSnap.docs[0].data() as any };
      }

      let winnerCompany = null;
      if (auctionData.winnerId) {
        const winnerSnap = await this.db.collection('companies').doc(auctionData.winnerId).get();
        if (winnerSnap.exists) winnerCompany = winnerSnap.data();
      }
      let clientCompany = null;
      if (auctionData.clientId) {
        const clientSnap = await this.db.collection('companies').doc(auctionData.clientId).get();
        if (clientSnap.exists) clientCompany = clientSnap.data();
      }

      if (clientUser?.email) {
        await this.notifications.notifyComplianceVerified(clientUser.email, clientUser.name || clientCompany!.name, auctionData.title).catch(() => {});
      }
      if (clientUser?.id) {
        await this.notifications.createInAppNotification({
          userId: clientUser.id,
          type: 'compliance_verified',
          title: 'Compliance Documents Verified',
          message: `Compliance documents for "${auctionData.title}" have been verified.`,
          link: `/client/handover`,
        }).catch(() => {});
      }
      if (vendorUser?.id) {
        await this.notifications.createInAppNotification({
          userId: vendorUser.id,
          type: 'compliance_verified',
          title: 'Compliance Documents Verified',
          message: `Compliance documents for "${auctionData.title}" have been verified by the client.`,
          link: `/vendor/pickups`,
        }).catch(() => {});
      }
    }

    return { id: pickupDoc.id, ...pickupDoc.data(), status: PickupStatus.COMPLETED };
  }

  async completePickup(id: string, adminNotes?: string) {
    const pickupDoc = await this.findPickupById(id);
    if (!pickupDoc) throw new NotFoundException('Pickup not found');
    await pickupDoc.ref.update({
      status: PickupStatus.COMPLETED,
      adminNotes: adminNotes || null,
      updatedAt: new Date(),
    });
    return { id: pickupDoc.id, ...pickupDoc.data(), status: PickupStatus.COMPLETED, adminNotes: adminNotes || null };
  }
}
