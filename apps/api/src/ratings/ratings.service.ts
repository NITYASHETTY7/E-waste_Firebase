import { Injectable, BadRequestException } from '@nestjs/common';
import { NotificationService } from '../notifications/notification.service';
import { FirebaseService } from '../firebase/firebase.service';

const convertDate = (field: any): Date | null => {
  if (!field) return null;
  return typeof field.toDate === 'function' ? field.toDate() : new Date(field);
};

@Injectable()
export class RatingsService {
  constructor(
    private firebaseService: FirebaseService,
    private notifications: NotificationService,
  ) {}

  async submitRating(data: {
    auctionId: string;
    fromCompanyId: string;
    toCompanyId: string;
    score: number;
    comment?: string;
    type: 'CLIENT_TO_VENDOR' | 'VENDOR_TO_CLIENT';
  }) {
    if (data.score < 1 || data.score > 5) {
      throw new BadRequestException('Score must be between 1 and 5');
    }

    const [fromCompanySnap, auctionSnap] = await Promise.all([
      this.firebaseService.db.collection('companies').doc(data.fromCompanyId).get(),
      this.firebaseService.db.collection('auctions').doc(data.auctionId).get(),
    ]);

    const fromCompany = fromCompanySnap.exists ? fromCompanySnap.data() : null;
    const auction = auctionSnap.exists ? auctionSnap.data() : null;

    const docId = `${data.auctionId}_${data.fromCompanyId}_${data.type}`;
    const docRef = this.firebaseService.db.collection('ratings').doc(docId);

    const ratingDoc = {
      id: docId,
      auctionId: data.auctionId,
      fromCompanyId: data.fromCompanyId,
      toCompanyId: data.toCompanyId,
      score: data.score,
      comment: data.comment || null,
      type: data.type,
      createdAt: new Date(),
    };

    await docRef.set(ratingDoc, { merge: true });

    const senderName = fromCompany?.name || 'A partner';
    const auctionTitle = auction?.title || 'an auction';

    await this.notifications
      .notifyCompanyUsers(data.toCompanyId, {
        type: 'rating_received',
        title: 'New Rating Received',
        message: `"${senderName}" rated you ${data.score}/5 stars for "${auctionTitle}".`,
        link:
          data.type === 'CLIENT_TO_VENDOR'
            ? '/vendor/ratings'
            : '/client/ratings',
      })
      .catch(() => {});

    return ratingDoc;
  }

  async getRatingsForAuction(auctionId: string) {
    const snap = await this.firebaseService.db
      .collection('ratings')
      .where('auctionId', '==', auctionId)
      .get();

    const ratings = [];
    for (const doc of snap.docs) {
      const rData = doc.data();
      const fromCompanySnap = await this.firebaseService.db
        .collection('companies')
        .doc(rData.fromCompanyId)
        .get();
      const toCompanySnap = await this.firebaseService.db
        .collection('companies')
        .doc(rData.toCompanyId)
        .get();

      ratings.push({
        id: doc.id,
        ...rData,
        createdAt: convertDate(rData.createdAt),
        fromCompany: fromCompanySnap.exists
          ? { id: fromCompanySnap.id, name: fromCompanySnap.data()?.name }
          : null,
        toCompany: toCompanySnap.exists
          ? { id: toCompanySnap.id, name: toCompanySnap.data()?.name }
          : null,
      });
    }

    return ratings;
  }

  async getRatingsForCompany(companyId: string) {
    const snap = await this.firebaseService.db
      .collection('ratings')
      .where('toCompanyId', '==', companyId)
      .get();

    const received = [];
    for (const doc of snap.docs) {
      const rData = doc.data();
      const fromCompanySnap = await this.firebaseService.db
        .collection('companies')
        .doc(rData.fromCompanyId)
        .get();
      const auctionSnap = await this.firebaseService.db
        .collection('auctions')
        .doc(rData.auctionId)
        .get();

      received.push({
        id: doc.id,
        ...rData,
        createdAt: convertDate(rData.createdAt),
        fromCompany: fromCompanySnap.exists
          ? { id: fromCompanySnap.id, name: fromCompanySnap.data()?.name }
          : null,
        auction: auctionSnap.exists
          ? { id: auctionSnap.id, title: auctionSnap.data()?.title }
          : null,
      });
    }

    received.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const avg =
      received.length > 0
        ? received.reduce((s, r) => s + r.score, 0) / received.length
        : 0;

    return {
      ratings: received,
      averageScore: Math.round(avg * 10) / 10,
      count: received.length,
    };
  }
}
