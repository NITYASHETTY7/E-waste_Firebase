import { Test, TestingModule } from '@nestjs/testing';
import { AuctionsService } from './auctions.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { S3Service } from '../s3/s3.service';
import { NotificationService } from '../notifications/notification.service';
import { DocumentsService } from '../documents/documents.service';
import { AuctionStatus, BidPhase } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('Auction Concurrency (Race Condition)', () => {
  let service: AuctionsService;
  let prisma: PrismaService;
  let redis: RedisService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuctionsService,
        PrismaService,
        RedisService,
        { provide: S3Service, useValue: {} },
        { provide: NotificationService, useValue: { notifyAdmins: jest.fn().mockResolvedValue({}), createInAppNotification: jest.fn().mockResolvedValue({}) } },
        { provide: DocumentsService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuctionsService>(AuctionsService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
    await redis.onModuleInit();
  });

  afterAll(async () => {
    await redis.onModuleDestroy();
    await prisma.$disconnect();
  });

  it('should handle 20 concurrent bids for the same amount and only accept ONE', async () => {
    // 1. Create a test auction
    const client = await prisma.company.create({
      data: { name: 'Test Client', type: 'CLIENT' }
    });
    const vendor = await prisma.company.create({
        data: { name: 'Test Vendor', type: 'VENDOR' }
    });
    const vendorUser = await prisma.user.create({
        data: { 
          email: `test-${Date.now()}@test.com`, 
          passwordHash: 'hashed', 
          name: 'Test User', 
          companyId: vendor.id, 
          role: 'VENDOR' 
        }
    });

    const auction = await prisma.auction.create({
      data: {
        title: 'Race Test Auction',
        category: 'E-Waste',
        basePrice: 10000,
        tickSize: 1000,
        status: AuctionStatus.OPEN_PHASE,
        clientId: client.id,
        openPhaseStart: new Date(Date.now() - 10000),
        openPhaseEnd: new Date(Date.now() + 60000),
      }
    });

    // Create a shortlisted sealed bid for this vendor
    await prisma.bid.create({
      data: {
        auctionId: auction.id,
        vendorId: vendorUser.id,
        amount: 9000,
        phase: BidPhase.SEALED,
        isShortlisted: true,
      }
    });

    // Clear any existing Redis leaderboard/locks for this auction ID
    await redis.reset();

    // 2. Launch 20 concurrent bids for 11000
    const bidAmount = 11000;
    const requests = Array(20).fill(null).map((_, i) => 
      service.placeLiveBid({
        auctionId: auction.id,
        vendorId: vendorUser.id,
        amount: bidAmount,
        idempotencyKey: `race-test-${i}` // Different idempotency keys to simulate different requests
      }).catch(e => e)
    );

    const results = await Promise.all(requests);

    // 3. Assertions
    const successes = results.filter(r => r && r.bid);
    const failures = results.filter(r => r instanceof BadRequestException);

    console.log(`Successes: ${successes.length}, Failures: ${failures.length}`);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(19);

    // Check DB
    const bidsInDb = await prisma.bid.findMany({
        where: { auctionId: auction.id, amount: bidAmount }
    });
    expect(bidsInDb.length).toBe(1);

    // Cleanup (optional)
    await prisma.bid.deleteMany({ where: { auctionId: auction.id } });
    await prisma.auction.delete({ where: { id: auction.id } });
    await prisma.user.delete({ where: { id: vendorUser.id } });
    await prisma.company.deleteMany({ where: { id: { in: [client.id, vendor.id] } } });
  }, 30000);
});
