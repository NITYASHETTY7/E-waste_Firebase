import { Test, TestingModule } from '@nestjs/testing';
import { RatingsService } from './ratings.service';
import { FirebaseService } from '../firebase/firebase.service';
import { NotificationService } from '../notifications/notification.service';
import { BadRequestException } from '@nestjs/common';

describe('RatingsService', () => {
  let service: RatingsService;
  let firebaseService: any;
  let notifications: any;

  const mockDb = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn(),
    set: jest.fn(),
    where: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    firebaseService = {
      db: mockDb,
    };

    notifications = {
      notifyCompanyUsers: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsService,
        { provide: FirebaseService, useValue: firebaseService },
        { provide: NotificationService, useValue: notifications },
      ],
    }).compile();

    service = module.get<RatingsService>(RatingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('submitRating', () => {
    it('should throw BadRequestException if score is less than 1 or greater than 5', async () => {
      await expect(
        service.submitRating({
          auctionId: 'a1',
          fromCompanyId: 'c1',
          toCompanyId: 'c2',
          score: 0,
          type: 'CLIENT_TO_VENDOR',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.submitRating({
          auctionId: 'a1',
          fromCompanyId: 'c1',
          toCompanyId: 'c2',
          score: 6,
          type: 'CLIENT_TO_VENDOR',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully save rating and send in-app notification', async () => {
      // Mock company snap & auction snap
      const mockCompanySnap = { exists: true, data: () => ({ name: 'Sender Company' }) };
      const mockAuctionSnap = { exists: true, data: () => ({ title: 'E-Waste Auction' }) };

      mockDb.get
        .mockResolvedValueOnce(mockCompanySnap) // fromCompany
        .mockResolvedValueOnce(mockAuctionSnap); // auction

      const ratingPayload = {
        auctionId: 'auction123',
        fromCompanyId: 'sender456',
        toCompanyId: 'receiver789',
        score: 5,
        comment: 'Excellent work!',
        type: 'CLIENT_TO_VENDOR' as const,
      };

      const result = await service.submitRating(ratingPayload);

      expect(mockDb.collection).toHaveBeenCalledWith('ratings');
      expect(mockDb.doc).toHaveBeenCalledWith('auction123_sender456_CLIENT_TO_VENDOR');
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'auction123_sender456_CLIENT_TO_VENDOR',
          score: 5,
          comment: 'Excellent work!',
          type: 'CLIENT_TO_VENDOR',
        }),
        { merge: true },
      );

      expect(notifications.notifyCompanyUsers).toHaveBeenCalledWith(
        'receiver789',
        expect.objectContaining({
          type: 'rating_received',
          title: 'New Rating Received',
          message: '"Sender Company" rated you 5/5 stars for "E-Waste Auction".',
        }),
      );

      expect(result.score).toBe(5);
    });
  });
});
