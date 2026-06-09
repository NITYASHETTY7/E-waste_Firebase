import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { S3Service } from '../s3/s3.service';
import { NotificationService } from '../notifications/notification.service';
import { FirebaseService } from '../firebase/firebase.service';
import * as admin from 'firebase-admin';
import { UserProductStatus } from '../firebase/firestore-types';

const convertDate = (field: any): Date | null => {
  if (!field) return null;
  return typeof field.toDate === 'function' ? field.toDate() : new Date(field);
};

@Injectable()
export class UserProductsService {
  constructor(
    private firebaseService: FirebaseService,
    private s3: S3Service,
    private notifications: NotificationService,
  ) {}

  private get db(): admin.firestore.Firestore {
    return this.firebaseService.db;
  }

  async create(
    userId: string,
    data: {
      name: string;
      weightKg: number;
      condition: string;
      askingPrice: number;
      description?: string;
    },
    photos: Express.Multer.File[],
    invoice?: Express.Multer.File,
  ) {
    const photoUploads = await Promise.all(
      photos.map((f) => this.s3.upload(f, 'user-products/photos', false)),
    );

    let invoiceKey: string | undefined;
    let invoiceBucket: string | undefined;
    let invoiceFileName: string | undefined;

    if (invoice) {
      const inv = await this.s3.upload(
        invoice,
        'user-products/invoices',
        false,
      );
      invoiceKey = inv.key;
      invoiceBucket = inv.bucket;
      invoiceFileName = invoice.originalname;
    }

    const prodDocRef = this.db.collection('userProducts').doc();

    const product = {
      id: prodDocRef.id,
      userId,
      name: data.name,
      weightKg: data.weightKg,
      condition: data.condition,
      askingPrice: data.askingPrice,
      description: data.description || null,
      status: UserProductStatus.PENDING_ADMIN_REVIEW,
      photoS3Keys: photoUploads.map((u) => u.key),
      photoS3Bucket: photoUploads[0]?.bucket || null,
      invoiceS3Key: invoiceKey || null,
      invoiceS3Bucket: invoiceBucket || null,
      invoiceFileName: invoiceFileName || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await prodDocRef.set(product);

    // Fetch user details for notification
    const userSnap = await this.db.collection('users').doc(userId).get();
    const userData = userSnap.exists ? userSnap.data() : null;

    // Notify admins in-app
    await this.notifications
      .notifyAdmins({
        type: 'new_product_listing',
        title: 'New Product Listing Pending Review',
        message: `A new product listing "${product.name}" has been created by "${userData?.name || 'User'}" and is pending review.`,
        link: `/admin/individual-products`,
      })
      .catch(() => {});

    return { ...product, user: userData ? { id: userId, name: userData.name, email: userData.email } : null };
  }

  async findMyProducts(userId: string) {
    const productsSnap = await this.db
      .collection('userProducts')
      .where('userId', '==', userId)
      .get();

    const products = [];
    for (const doc of productsSnap.docs) {
      const p = doc.data() as any;

      // Fetch quotes
      const quotesSnap = await doc.ref.collection('quotes').get();
      const quotes = [];
      for (const qDoc of quotesSnap.docs) {
        const qData = qDoc.data();
        let vendorCompany = null;
        if (qData.vendorCompanyId) {
          const compSnap = await this.db.collection('companies').doc(qData.vendorCompanyId).get();
          if (compSnap.exists) {
            vendorCompany = { id: compSnap.id, name: compSnap.data()?.name };
          }
        }
        quotes.push({
          id: qDoc.id,
          ...qData,
          createdAt: convertDate(qData.createdAt),
          updatedAt: convertDate(qData.updatedAt),
          vendorCompany,
        });
      }
      // Sort quotes by offeredPrice desc
      quotes.sort((a, b) => b.offeredPrice - a.offeredPrice);

      // Fetch pickups
      const pickupSnap = await doc.ref.collection('pickups').get();
      const pickup = pickupSnap.empty ? null : { id: pickupSnap.docs[0].id, ...pickupSnap.docs[0].data() };

      products.push({
        ...p,
        createdAt: convertDate(p.createdAt),
        updatedAt: convertDate(p.updatedAt),
        adminApprovedAt: convertDate(p.adminApprovedAt),
        quotes,
        pickup,
      });
    }

    products.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return Promise.all(
      products.map(async (p) => ({
        ...p,
        photoUrls: await Promise.all(
          p.photoS3Keys.map((key: string) =>
            this.s3.getSignedUrl(key, p.photoS3Bucket ?? undefined),
          ),
        ),
        invoiceUrl: p.invoiceS3Key
          ? await this.s3.getSignedUrl(
              p.invoiceS3Key,
              p.invoiceS3Bucket ?? undefined,
            )
          : null,
      })),
    );
  }

  async findAllForAdmin() {
    const productsSnap = await this.db.collection('userProducts').get();

    const products = [];
    for (const doc of productsSnap.docs) {
      const p = doc.data() as any;

      // Fetch user profile
      const userSnap = await this.db.collection('users').doc(p.userId).get();
      const user = userSnap.exists
        ? { id: userSnap.id, name: userSnap.data()?.name, email: userSnap.data()?.email, phone: userSnap.data()?.phone }
        : null;

      // Fetch quotes
      const quotesSnap = await doc.ref.collection('quotes').get();
      const quotes = [];
      for (const qDoc of quotesSnap.docs) {
        const qData = qDoc.data();
        let vendorCompany = null;
        if (qData.vendorCompanyId) {
          const compSnap = await this.db.collection('companies').doc(qData.vendorCompanyId).get();
          if (compSnap.exists) {
            vendorCompany = { id: compSnap.id, name: compSnap.data()?.name };
          }
        }
        quotes.push({
          id: qDoc.id,
          ...qData,
          createdAt: convertDate(qData.createdAt),
          updatedAt: convertDate(qData.updatedAt),
          vendorCompany,
        });
      }

      // Fetch pickups
      const pickupSnap = await doc.ref.collection('pickups').get();
      const pickup = pickupSnap.empty ? null : { id: pickupSnap.docs[0].id, ...pickupSnap.docs[0].data() };

      products.push({
        ...p,
        createdAt: convertDate(p.createdAt),
        updatedAt: convertDate(p.updatedAt),
        adminApprovedAt: convertDate(p.adminApprovedAt),
        user,
        quotes,
        pickup,
      });
    }

    products.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return Promise.all(
      products.map(async (p) => ({
        ...p,
        photoUrls: await Promise.all(
          p.photoS3Keys.map((key: string) =>
            this.s3.getSignedUrl(key, p.photoS3Bucket ?? undefined),
          ),
        ),
        invoiceUrl: p.invoiceS3Key
          ? await this.s3.getSignedUrl(
              p.invoiceS3Key,
              p.invoiceS3Bucket ?? undefined,
            )
          : null,
      })),
    );
  }

  async findApprovedForVendors(vendorCompanyId: string) {
    const productsSnap = await this.db
      .collection('userProducts')
      .where('status', 'in', [
        UserProductStatus.ADMIN_APPROVED,
        UserProductStatus.QUOTE_RECEIVED,
      ])
      .get();

    const products = [];
    for (const doc of productsSnap.docs) {
      const p = doc.data() as any;

      // Fetch user profile
      const userSnap = await this.db.collection('users').doc(p.userId).get();
      const user = userSnap.exists ? { id: userSnap.id, name: userSnap.data()?.name } : null;

      // Fetch this vendor's quotes specifically
      const quotesSnap = await doc.ref
        .collection('quotes')
        .where('vendorCompanyId', '==', vendorCompanyId)
        .get();

      const quotes = quotesSnap.docs.map((qDoc: any) => {
        const qData = qDoc.data();
        return {
          id: qDoc.id,
          offeredPrice: qData.offeredPrice,
          status: qData.status,
        };
      });

      products.push({
        ...p,
        createdAt: convertDate(p.createdAt),
        updatedAt: convertDate(p.updatedAt),
        adminApprovedAt: convertDate(p.adminApprovedAt),
        user,
        quotes,
      });
    }

    // Sort by adminApprovedAt descending
    products.sort((a, b) => {
      const da = a.adminApprovedAt ? a.adminApprovedAt.getTime() : 0;
      const db = b.adminApprovedAt ? b.adminApprovedAt.getTime() : 0;
      return db - da;
    });

    return Promise.all(
      products.map(async (p) => ({
        ...p,
        photoUrls: await Promise.all(
          p.photoS3Keys.map((key: string) =>
            this.s3.getSignedUrl(key, p.photoS3Bucket ?? undefined),
          ),
        ),
        alreadyQuoted: p.quotes.length > 0,
        myQuote: p.quotes[0] ?? null,
      })),
    );
  }

  async adminReview(
    productId: string,
    action: 'approve' | 'reject',
    remarks?: string,
  ) {
    const productRef = this.db.collection('userProducts').doc(productId);
    const productSnap = await productRef.get();
    if (!productSnap.exists) throw new NotFoundException('Product not found');
    const product = productSnap.data()!;

    // Fetch owner user details
    const userSnap = await this.db.collection('users').doc(product.userId).get();
    if (!userSnap.exists) throw new NotFoundException('User profile not found');
    const user = userSnap.data()!;

    const status =
      action === 'approve'
        ? UserProductStatus.ADMIN_APPROVED
        : UserProductStatus.REJECTED;

    const updateData = {
      status,
      adminApprovedAt: action === 'approve' ? new Date() : null,
      adminRemarks: remarks || null,
      updatedAt: new Date(),
    };

    await productRef.update(updateData);

    if (action === 'approve') {
      this.notifications
        .sendEmail({
          to: user.email,
          subject: 'Your product listing has been approved',
          body: `Hi ${user.name},\n\nYour product "${product.name}" has been approved and is now visible to vendors for quoting.\n\nWeConnect Team`,
        })
        .catch(() => {});
    } else {
      this.notifications
        .sendEmail({
          to: user.email,
          subject: 'Update on your product listing',
          body: `Hi ${user.name},\n\nYour product "${product.name}" was not approved.\nReason: ${remarks ?? 'Not specified'}\n\nWeConnect Team`,
        })
        .catch(() => {});
    }

    // In-app notification to the owner user
    await this.notifications
      .createInAppNotification({
        userId: product.userId,
        type: action === 'approve' ? 'product_approved' : 'product_rejected',
        title:
          action === 'approve'
            ? 'Product Listing Approved'
            : 'Product Listing Rejected',
        message:
          action === 'approve'
            ? `Your product listing "${product.name}" has been approved and is now open for bidding/quotes.`
            : `Your product listing "${product.name}" was not approved. Remarks: ${remarks || 'None'}`,
        link: `/client/listings`,
      })
      .catch(() => {});

    return { id: productId, ...product, ...updateData };
  }

  async submitQuote(
    productId: string,
    vendorCompanyId: string,
    offeredPrice: number,
    remarks?: string,
  ) {
    const productRef = this.db.collection('userProducts').doc(productId);
    const productSnap = await productRef.get();
    if (!productSnap.exists) throw new NotFoundException('Product not found');
    const product = productSnap.data()!;

    if (
      product.status !== UserProductStatus.ADMIN_APPROVED &&
      product.status !== UserProductStatus.QUOTE_RECEIVED
    ) {
      throw new BadRequestException('Product is not open for quoting');
    }

    // Check if vendor already quoted using subcollection check
    const existingSnap = await productRef
      .collection('quotes')
      .where('vendorCompanyId', '==', vendorCompanyId)
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      throw new BadRequestException(
        'You have already submitted a quote for this product',
      );
    }

    const quoteRef = productRef.collection('quotes').doc();
    const quote = {
      id: quoteRef.id,
      productId,
      vendorCompanyId,
      offeredPrice,
      remarks: remarks || null,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await quoteRef.set(quote);

    await productRef.update({
      status: UserProductStatus.QUOTE_RECEIVED,
      updatedAt: new Date(),
    });

    // Fetch vendor company name
    const compSnap = await this.db.collection('companies').doc(vendorCompanyId).get();
    const compName = compSnap.exists ? compSnap.data()?.name || 'Vendor' : 'Vendor';

    // Notify product owner in-app
    await this.notifications
      .createInAppNotification({
        userId: product.userId,
        type: 'quote_received',
        title: 'New Quote Received',
        message: `You have received a new quote of ₹${offeredPrice.toLocaleString('en-IN')} from "${compName}" for your product "${product.name}".`,
        link: `/client/listings`,
      })
      .catch(() => {});

    return { ...quote, vendorCompany: { name: compName } };
  }

  async acceptQuote(productId: string, quoteId: string, userId: string) {
    const productRef = this.db.collection('userProducts').doc(productId);
    const productSnap = await productRef.get();
    if (!productSnap.exists) throw new NotFoundException('Product not found');
    const product = productSnap.data()!;

    if (product.userId !== userId)
      throw new ForbiddenException('Not your product');

    // Fetch all quotes
    const quotesSnap = await productRef.collection('quotes').get();
    const quotes = quotesSnap.docs.map((d: any) => d.data());

    const quote = quotes.find((q: any) => q.id === quoteId);
    if (!quote) throw new NotFoundException('Quote not found');

    const batch = this.db.batch();

    // 1. Update accepted quote
    const acceptedRef = productRef.collection('quotes').doc(quoteId);
    batch.update(acceptedRef, { status: 'accepted', updatedAt: new Date() });

    // 2. Reject other quotes
    quotesSnap.docs.forEach((qDoc: any) => {
      if (qDoc.id !== quoteId) {
        batch.update(qDoc.ref, { status: 'rejected', updatedAt: new Date() });
      }
    });

    // 3. Update product
    batch.update(productRef, {
      status: UserProductStatus.PICKUP_REQUESTED,
      acceptedQuoteId: quoteId,
      updatedAt: new Date(),
    });

    // 4. Create pickup document in pickups subcollection
    const pickupRef = productRef.collection('pickups').doc();
    const pickupDoc = {
      id: pickupRef.id,
      productId,
      vendorCompanyId: quote.vendorCompanyId,
      status: 'requested',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    batch.set(pickupRef, pickupDoc);

    await batch.commit();

    // Fetch user details
    const userSnap = await this.db.collection('users').doc(userId).get();
    const user = userSnap.data()!;

    // Email vendor with user contact details
    const vendorUsersSnap = await this.db
      .collection('users')
      .where('companyId', '==', quote.vendorCompanyId)
      .get();

    for (const vuDoc of vendorUsersSnap.docs) {
      const vu = vuDoc.data();
      this.notifications
        .notifyVendorPickupRequested(
          vu.email,
          vu.name,
          product.name,
          quote.offeredPrice,
          user.name,
          user.email,
          user.phone ?? null,
        )
        .catch(() => {});
    }

    // Notify vendor company users in-app
    await this.notifications
      .notifyCompanyUsers(quote.vendorCompanyId, {
        type: 'quote_accepted',
        title: 'Quote Accepted & Pickup Requested',
        message: `Your quote of ₹${quote.offeredPrice.toLocaleString('en-IN')} for "${product.name}" has been accepted. Pickup is requested.`,
        link: `/vendor/individual-products`,
      })
      .catch(() => {});

    return { success: true };
  }

  async getPickupStatus(productId: string, userId: string) {
    const productSnap = await this.db.collection('userProducts').doc(productId).get();
    if (!productSnap.exists) throw new NotFoundException('Product not found');
    const product = productSnap.data()!;
    if (product.userId !== userId)
      throw new ForbiddenException('Not your product');

    const pickupsSnap = await this.db
      .collection('userProducts')
      .doc(productId)
      .collection('pickups')
      .get();
    if (pickupsSnap.empty) return null;

    const pickup = pickupsSnap.docs[0].data();

    // Fetch vendorCompany details
    let vendorCompany = null;
    if (pickup.vendorCompanyId) {
      const compSnap = await this.db.collection('companies').doc(pickup.vendorCompanyId).get();
      if (compSnap.exists) {
        vendorCompany = { id: compSnap.id, name: compSnap.data()?.name };
      }
    }

    return { id: pickupsSnap.docs[0].id, ...pickup, vendorCompany };
  }

  async updatePickupStatus(
    productId: string,
    status: string,
    scheduledDate?: Date,
  ) {
    const productRef = this.db.collection('userProducts').doc(productId);
    const productSnap = await productRef.get();
    if (!productSnap.exists) throw new NotFoundException('Product not found');
    const product = productSnap.data()!;

    const pickupsSnap = await productRef.collection('pickups').get();
    if (pickupsSnap.empty) throw new NotFoundException('Pickup not found');
    const pickupDoc = pickupsSnap.docs[0];

    const updateData = {
      status,
      updatedAt: new Date(),
      ...(scheduledDate && { scheduledDate: new Date(scheduledDate) }),
    };

    await pickupDoc.ref.update(updateData);

    const statusMap: Record<string, UserProductStatus> = {
      scheduled: UserProductStatus.PICKUP_IN_PROGRESS,
      in_transit: UserProductStatus.PICKUP_IN_PROGRESS,
      completed: UserProductStatus.COMPLETED,
    };

    if (statusMap[status]) {
      await productRef.update({
        status: statusMap[status],
        updatedAt: new Date(),
      });
    }

    let message = '';
    if (status === 'scheduled') {
      message = `Pickup for your product "${product.name}" has been scheduled.`;
    } else if (status === 'in_transit') {
      message = `Pickup for your product "${product.name}" is in transit.`;
    } else if (status === 'completed') {
      message = `Pickup for your product "${product.name}" has been completed.`;
    } else {
      message = `Pickup status for your product "${product.name}" has been updated to ${status}.`;
    }

    await this.notifications
      .createInAppNotification({
        userId: product.userId,
        type: `pickup_${status}`,
        title: `Pickup Status: ${status.toUpperCase().replace('_', ' ')}`,
        message,
        link: `/client/listings`,
      })
      .catch(() => {});

    return { success: true };
  }

  async updateUserProfile(
    userId: string,
    data: {
      dob?: string;
      address?: string;
      panNumber?: string;
      bankAccountHolder?: string;
      bankName?: string;
      bankAccountNumber?: string;
      bankIfscCode?: string;
      bankAccountType?: string;
    },
  ) {
    const userRef = this.db.collection('users').doc(userId);
    const cleanData: any = {};
    Object.keys(data).forEach((key) => {
      if ((data as any)[key] !== undefined) {
        cleanData[key] = (data as any)[key];
      }
    });
    cleanData.updatedAt = new Date();
    await userRef.update(cleanData);

    const snap = await userRef.get();
    const { passwordHash, ...safe } = snap.data() as any;
    return { id: userId, ...safe };
  }
}
