import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { NotificationService } from '../notifications/notification.service';
import { UserProductStatus } from '@prisma/client';

@Injectable()
export class UserProductsService {
  constructor(
    private prisma: PrismaService,
    private s3: S3Service,
    private notifications: NotificationService,
  ) {}

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
      photos.map(f => this.s3.upload(f, 'user-products/photos', false)),
    );

    let invoiceKey: string | undefined;
    let invoiceBucket: string | undefined;
    let invoiceFileName: string | undefined;

    if (invoice) {
      const inv = await this.s3.upload(invoice, 'user-products/invoices', false);
      invoiceKey = inv.key;
      invoiceBucket = inv.bucket;
      invoiceFileName = invoice.originalname;
    }

    return this.prisma.userProduct.create({
      data: {
        userId,
        name: data.name,
        weightKg: data.weightKg,
        condition: data.condition,
        askingPrice: data.askingPrice,
        description: data.description,
        photoS3Keys: photoUploads.map(u => u.key),
        photoS3Bucket: photoUploads[0]?.bucket,
        invoiceS3Key: invoiceKey,
        invoiceS3Bucket: invoiceBucket,
        invoiceFileName,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async findMyProducts(userId: string) {
    const products = await this.prisma.userProduct.findMany({
      where: { userId },
      include: {
        quotes: {
          include: { vendorCompany: { select: { id: true, name: true } } },
          orderBy: { offeredPrice: 'desc' },
        },
        pickup: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      products.map(async p => ({
        ...p,
        photoUrls: await Promise.all(
          p.photoS3Keys.map(key =>
            this.s3.getSignedUrl(key, p.photoS3Bucket ?? undefined),
          ),
        ),
        invoiceUrl: p.invoiceS3Key
          ? await this.s3.getSignedUrl(p.invoiceS3Key, p.invoiceS3Bucket ?? undefined)
          : null,
      })),
    );
  }

  async findAllForAdmin() {
    const products = await this.prisma.userProduct.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        quotes: {
          include: { vendorCompany: { select: { id: true, name: true } } },
        },
        pickup: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      products.map(async p => ({
        ...p,
        photoUrls: await Promise.all(
          p.photoS3Keys.map(key =>
            this.s3.getSignedUrl(key, p.photoS3Bucket ?? undefined),
          ),
        ),
        invoiceUrl: p.invoiceS3Key
          ? await this.s3.getSignedUrl(p.invoiceS3Key, p.invoiceS3Bucket ?? undefined)
          : null,
      })),
    );
  }

  async findApprovedForVendors(vendorCompanyId: string) {
    const products = await this.prisma.userProduct.findMany({
      where: {
        status: {
          in: [
            UserProductStatus.ADMIN_APPROVED,
            UserProductStatus.QUOTE_RECEIVED,
          ],
        },
      },
      include: {
        user: { select: { id: true, name: true } },
        quotes: {
          where: { vendorCompanyId },
          select: { id: true, offeredPrice: true, status: true },
        },
      },
      orderBy: { adminApprovedAt: 'desc' },
    });

    return Promise.all(
      products.map(async p => ({
        ...p,
        photoUrls: await Promise.all(
          p.photoS3Keys.map(key =>
            this.s3.getSignedUrl(key, p.photoS3Bucket ?? undefined),
          ),
        ),
        alreadyQuoted: p.quotes.length > 0,
        myQuote: p.quotes[0] ?? null,
      })),
    );
  }

  async adminReview(productId: string, action: 'approve' | 'reject', remarks?: string) {
    const product = await this.prisma.userProduct.findUnique({
      where: { id: productId },
      include: { user: { select: { email: true, name: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');

    const updated = await this.prisma.userProduct.update({
      where: { id: productId },
      data: {
        status:
          action === 'approve'
            ? UserProductStatus.ADMIN_APPROVED
            : UserProductStatus.REJECTED,
        adminApprovedAt: action === 'approve' ? new Date() : null,
        adminRemarks: remarks,
      },
    });

    if (action === 'approve') {
      this.notifications.sendEmail({
        to: product.user.email,
        subject: 'Your product listing has been approved',
        body: `Hi ${product.user.name},\n\nYour product "${product.name}" has been approved and is now visible to vendors for quoting.\n\nWeConnect Team`,
      }).catch(() => {});
    } else {
      this.notifications.sendEmail({
        to: product.user.email,
        subject: 'Update on your product listing',
        body: `Hi ${product.user.name},\n\nYour product "${product.name}" was not approved.\nReason: ${remarks ?? 'Not specified'}\n\nWeConnect Team`,
      }).catch(() => {});
    }

    return updated;
  }

  async submitQuote(productId: string, vendorCompanyId: string, offeredPrice: number, remarks?: string) {
    const product = await this.prisma.userProduct.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (
      product.status !== UserProductStatus.ADMIN_APPROVED &&
      product.status !== UserProductStatus.QUOTE_RECEIVED
    ) {
      throw new BadRequestException('Product is not open for quoting');
    }

    const existing = await this.prisma.userProductQuote.findFirst({
      where: { productId, vendorCompanyId },
    });
    if (existing) throw new BadRequestException('You have already submitted a quote for this product');

    const quote = await this.prisma.userProductQuote.create({
      data: { productId, vendorCompanyId, offeredPrice, remarks },
      include: { vendorCompany: { select: { name: true } } },
    });

    await this.prisma.userProduct.update({
      where: { id: productId },
      data: { status: UserProductStatus.QUOTE_RECEIVED },
    });

    return quote;
  }

  async acceptQuote(productId: string, quoteId: string, userId: string) {
    const product = await this.prisma.userProduct.findUnique({
      where: { id: productId },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        quotes: { include: { vendorCompany: { select: { id: true, name: true } } } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.userId !== userId) throw new ForbiddenException('Not your product');

    const quote = product.quotes.find(q => q.id === quoteId);
    if (!quote) throw new NotFoundException('Quote not found');

    await this.prisma.$transaction([
      this.prisma.userProductQuote.update({
        where: { id: quoteId },
        data: { status: 'accepted' },
      }),
      this.prisma.userProductQuote.updateMany({
        where: { productId, id: { not: quoteId } },
        data: { status: 'rejected' },
      }),
      this.prisma.userProduct.update({
        where: { id: productId },
        data: {
          status: UserProductStatus.PICKUP_REQUESTED,
          acceptedQuoteId: quoteId,
        },
      }),
      this.prisma.userProductPickup.create({
        data: {
          productId,
          vendorCompanyId: quote.vendorCompanyId,
          status: 'requested',
        },
      }),
    ]);

    // Email vendor with user contact details
    const vendorUsers = await this.prisma.user.findMany({
      where: { companyId: quote.vendorCompanyId },
      select: { email: true, name: true },
    });

    for (const vu of vendorUsers) {
      this.notifications.notifyVendorPickupRequested(
        vu.email,
        vu.name,
        product.name,
        quote.offeredPrice,
        product.user.name,
        product.user.email,
        product.user.phone ?? null,
      ).catch(() => {});
    }

    return { success: true };
  }

  async getPickupStatus(productId: string, userId: string) {
    const product = await this.prisma.userProduct.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.userId !== userId) throw new ForbiddenException('Not your product');

    return this.prisma.userProductPickup.findUnique({
      where: { productId },
      include: { vendorCompany: { select: { id: true, name: true } } },
    });
  }

  async updatePickupStatus(productId: string, status: string, scheduledDate?: Date) {
    await this.prisma.userProductPickup.update({
      where: { productId },
      data: { status, ...(scheduledDate && { scheduledDate }) },
    });

    const statusMap: Record<string, UserProductStatus> = {
      scheduled: UserProductStatus.PICKUP_IN_PROGRESS,
      in_transit: UserProductStatus.PICKUP_IN_PROGRESS,
      completed: UserProductStatus.COMPLETED,
    };

    if (statusMap[status]) {
      await this.prisma.userProduct.update({
        where: { id: productId },
        data: { status: statusMap[status] },
      });
    }

    return { success: true };
  }

  async updateUserProfile(userId: string, data: {
    dob?: string;
    address?: string;
    panNumber?: string;
    bankAccountHolder?: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankIfscCode?: string;
    bankAccountType?: string;
  }) {
    const { passwordHash, ...safe } = await this.prisma.user.update({
      where: { id: userId },
      data,
    }) as any;
    return safe;
  }
}
