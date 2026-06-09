import { Injectable, NotFoundException } from '@nestjs/common';
import { S3Service } from '../s3/s3.service';
import { NotificationService } from '../notifications/notification.service';
import { FirebaseService } from '../firebase/firebase.service';
import * as admin from 'firebase-admin';
import { PaymentStatus, DocumentType } from '../firebase/firestore-types';

const convertDate = (field: any): Date | null => {
  if (!field) return null;
  return typeof field.toDate === 'function' ? field.toDate() : new Date(field);
};

@Injectable()
export class PaymentsService {
  constructor(
    private firebaseService: FirebaseService,
    private s3: S3Service,
    private notifications: NotificationService,
  ) {}

  private get db(): admin.firestore.Firestore {
    return this.firebaseService.db;
  }

  // Find payment by its ID inside collectionGroup
  async findPaymentById(id: string) {
    const querySnap = await this.db
      .collectionGroup('payment')
      .where('id', '==', id)
      .get();
    if (querySnap.empty) return null;
    return querySnap.docs[0];
  }

  // Create payment record after deal is closed (winner selected)
  async createForAuction(auctionId: string, clientAmount: number) {
    const commission = parseFloat((clientAmount * 0.05).toFixed(2));
    const paymentCol = this.db
      .collection('auctions')
      .doc(auctionId)
      .collection('payment');
    const snap = await paymentCol.get();

    const paymentData = {
      clientAmount,
      commissionAmount: commission,
      totalAmount: clientAmount + commission,
      status: PaymentStatus.PENDING,
      updatedAt: new Date(),
    };

    if (snap.empty) {
      const newPaymentRef = paymentCol.doc();
      const newPayment = {
        id: newPaymentRef.id,
        ...paymentData,
        createdAt: new Date(),
      };
      await newPaymentRef.set(newPayment);
      return newPayment;
    } else {
      const existingDoc = snap.docs[0];
      await existingDoc.ref.update(paymentData);
      return { id: existingDoc.id, ...existingDoc.data(), ...paymentData };
    }
  }

  async findByAuction(auctionId: string) {
    const snap = await this.db
      .collection('auctions')
      .doc(auctionId)
      .collection('payment')
      .get();
    if (snap.empty) return null;
    const data = snap.docs[0].data();
    return {
      id: snap.docs[0].id,
      ...data,
      createdAt: convertDate(data.createdAt),
      updatedAt: convertDate(data.updatedAt),
    };
  }

  async uploadProofByAuction(
    auctionId: string,
    file: Express.Multer.File,
    utrNumber?: string,
  ) {
    const payment = await this.findByAuction(auctionId);
    if (!payment)
      throw new NotFoundException('Payment not found for this auction');
    return this.uploadProof(payment.id, file, utrNumber);
  }

  async verifyPaymentByAuction(auctionId: string, adminNotes?: string) {
    const payment = await this.findByAuction(auctionId);
    if (!payment)
      throw new NotFoundException('Payment not found for this auction');
    return this.verifyPayment(payment.id, adminNotes);
  }

  async findAll(status?: PaymentStatus) {
    let query: any = this.db.collectionGroup('payment');
    if (status) {
      query = query.where('status', '==', status);
    }
    const snap = await query.get();

    const payments = [];
    for (const doc of snap.docs) {
      const paymentData = doc.data();
      const auctionId = doc.ref.parent.parent!.id;
      const auctionSnap = await this.db
        .collection('auctions')
        .doc(auctionId)
        .get();

      let auction = null;
      if (auctionSnap.exists) {
        const aData = auctionSnap.data()!;

        // Fetch client & winner companies
        let client = null;
        if (aData.clientId) {
          const clientSnap = await this.db
            .collection('companies')
            .doc(aData.clientId)
            .get();
          if (clientSnap.exists) {
            client = { id: clientSnap.id, name: clientSnap.data()?.name };
          }
        }

        let winner = null;
        if (aData.winnerId) {
          const winnerSnap = await this.db
            .collection('companies')
            .doc(aData.winnerId)
            .get();
          if (winnerSnap.exists) {
            winner = { id: winnerSnap.id, name: winnerSnap.data()?.name };
          }
        }

        auction = {
          id: auctionSnap.id,
          ...aData,
          client,
          winner,
        };
      }

      payments.push({
        id: doc.id,
        ...paymentData,
        createdAt: convertDate(paymentData.createdAt),
        updatedAt: convertDate(paymentData.updatedAt),
        auction,
      });
    }

    return payments.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  // Vendor uploads payment proof (screenshot / UTR)
  async uploadProof(id: string, file: Express.Multer.File, utrNumber?: string) {
    const paymentDoc = await this.findPaymentById(id);
    if (!paymentDoc) throw new NotFoundException('Payment not found');

    const payment = paymentDoc.data();
    const auctionId = paymentDoc.ref.parent.parent!.id;
    const auctionSnap = await this.db
      .collection('auctions')
      .doc(auctionId)
      .get();
    if (!auctionSnap.exists) throw new NotFoundException('Auction not found');
    const auctionData = auctionSnap.data()!;

    // Retrieve winner company
    let winnerCompany = null;
    if (auctionData.winnerId) {
      const winnerSnap = await this.db
        .collection('companies')
        .doc(auctionData.winnerId)
        .get();
      if (winnerSnap.exists) {
        winnerCompany = winnerSnap.data();
      }
    }

    const { key } = await this.s3.upload(file, `payments/${auctionId}`);

    const updateData = {
      proofS3Key: key,
      paymentProofUrl: key, // Added for new schema field
      utrNumber: utrNumber || null,
      status: PaymentStatus.SUBMITTED,
      updatedAt: new Date(),
    };

    await paymentDoc.ref.update(updateData);

    // Notify admins in-app
    await this.notifications
      .notifyAdmins({
        type: 'payment_proof_uploaded',
        title: 'Payment Proof Uploaded',
        message: `Vendor "${winnerCompany?.name || 'Winner'}" uploaded payment proof for "${auctionData.title}".`,
        link: '/admin/payments',
      })
      .catch(() => {});

    return { id, ...payment, ...updateData };
  }

  // Admin verifies payment → notify vendor and client
  async verifyPayment(id: string, adminNotes?: string) {
    const paymentDoc = await this.findPaymentById(id);
    if (!paymentDoc) throw new NotFoundException('Payment not found');

    const payment = paymentDoc.data();
    const auctionId = paymentDoc.ref.parent.parent!.id;
    const auctionSnap = await this.db
      .collection('auctions')
      .doc(auctionId)
      .get();
    if (!auctionSnap.exists) throw new NotFoundException('Auction not found');
    const auctionData = auctionSnap.data()!;

    await paymentDoc.ref.update({
      status: PaymentStatus.CONFIRMED,
      adminNotes: adminNotes || null,
      updatedAt: new Date(),
    });

    // Fetch winner and client users to notify
    let vendorUser = null;
    if (auctionData.winnerId) {
      const usersSnap = await this.db
        .collection('users')
        .where('companyId', '==', auctionData.winnerId)
        .limit(1)
        .get();
      if (!usersSnap.empty) {
        vendorUser = { id: usersSnap.docs[0].id, ...usersSnap.docs[0].data() };
      }
    }

    let clientUser = null;
    if (auctionData.clientId) {
      const usersSnap = await this.db
        .collection('users')
        .where('companyId', '==', auctionData.clientId)
        .limit(1)
        .get();
      if (!usersSnap.empty) {
        clientUser = { id: usersSnap.docs[0].id, ...usersSnap.docs[0].data() };
      }
    }

    // Retrieve company details for display name fallback
    let winnerCompany = null;
    if (auctionData.winnerId) {
      const winnerSnap = await this.db
        .collection('companies')
        .doc(auctionData.winnerId)
        .get();
      if (winnerSnap.exists) {
        winnerCompany = winnerSnap.data();
      }
    }

    let clientCompany = null;
    if (auctionData.clientId) {
      const clientSnap = await this.db
        .collection('companies')
        .doc(auctionData.clientId)
        .get();
      if (clientSnap.exists) {
        clientCompany = clientSnap.data();
      }
    }

    try {
      if (vendorUser?.email) {
        await this.notifications.notifyPaymentVerified(
          vendorUser.email,
          vendorUser.name || winnerCompany!.name,
          auctionData.title,
          'VENDOR',
        );
        // Also trigger compliance pending email as requested originally
        await this.notifications.notifyCompliancePending(
          vendorUser.email,
          vendorUser.name || winnerCompany!.name,
          auctionData.title,
        );
      }
      if (clientUser?.email) {
        await this.notifications.notifyPaymentVerified(
          clientUser.email,
          clientUser.name || clientCompany!.name,
          auctionData.title,
          'CLIENT',
        );
        // Ask client to upload gate pass now that payment is processing
        await this.notifications.notifyClientUploadGatePass(
          clientUser.email,
          clientUser.name || clientCompany!.name,
          auctionData.title,
          winnerCompany?.name ?? 'the vendor',
        );
      }
    } catch (e) {
      // Non-critical — don't fail payment confirmation if email fails
    }

    // In-app notifications
    if (vendorUser?.id) {
      await this.notifications
        .createInAppNotification({
          userId: vendorUser.id,
          type: 'payment_verified',
          title: 'Payment Confirmed & Verified',
          message: `Your payment for "${auctionData.title}" has been verified. Please upload required compliance certificates.`,
          link: '/vendor/pickups',
        })
        .catch(() => {});
    }

    if (clientUser?.id) {
      await this.notifications
        .createInAppNotification({
          userId: clientUser.id,
          type: 'payment_verified',
          title: 'Vendor Payment Verified',
          message: `Vendor payment for "${auctionData.title}" has been verified. Please upload the Gate Pass now.`,
          link: '/client/handover',
        })
        .catch(() => {});
    }

    return {
      id,
      ...payment,
      status: PaymentStatus.CONFIRMED,
      adminNotes: adminNotes || null,
    };
  }
}
