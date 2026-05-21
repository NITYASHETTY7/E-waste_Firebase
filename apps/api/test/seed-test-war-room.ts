import { PrismaClient, AuctionStatus, BidPhase, UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

const prisma = new PrismaClient();
const AUCTION_ID = process.argv.find(arg => arg.startsWith('--auctionId='))?.split('=')[1];

async function seed() {
  if (!AUCTION_ID) {
    console.error('Usage: npx ts-node seed-test-war-room.ts --auctionId=<id>');
    process.exit(1);
  }

  console.log(`🏗️ Seeding 100 Shortlisted Vendors for Auction: ${AUCTION_ID}`);

  const auction = await prisma.auction.findUnique({ where: { id: AUCTION_ID } });
  if (!auction) throw new Error('Auction not found');

  const vendors = [];

  // 1. Create a Test Company for the bots
  const botCompany = await prisma.company.create({
    data: {
      name: `Bot Recyclers Corp`,
      type: 'VENDOR',
      status: 'APPROVED',
    }
  });

  for (let i = 0; i < 100; i++) {
    const email = `bot-${i}-${uuidv4().substring(0,8)}@ecoloop-test.com`;
    
    // 2. Create User
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'hashed_password',
        name: `Bot Bidder #${i}`,
        role: UserRole.VENDOR,
        companyId: botCompany.id,
        isActive: true,
      }
    });

    // 3. Create Shortlisted Sealed Bid
    await prisma.bid.create({
      data: {
        auctionId: AUCTION_ID,
        vendorId: user.id,
        amount: auction.basePrice,
        phase: BidPhase.SEALED,
        isShortlisted: true,
        clientStatus: 'approved',
      }
    });

    vendors.push({ id: user.id, name: user.name });
    if (i % 10 === 0) console.log(`Created ${i} bots...`);
  }

  fs.writeFileSync('test-vendors.json', JSON.stringify(vendors, null, 2));
  console.log('✅ Done! 100 vendors seeded. Data saved to test-vendors.json');
}

seed().catch(console.error).finally(() => prisma.$disconnect());
