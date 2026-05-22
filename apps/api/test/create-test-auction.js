const { PrismaClient, AuctionStatus, BidPhase, UserRole } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  const humanEmail = 'everyuse89@gmail.com';

  console.log(`🤖 Starting automated setup for simultaneous live auction...`);

  // 1. Find the human vendor user
  const humanUser = await prisma.user.findUnique({
    where: { email: humanEmail },
    include: { company: true }
  });

  if (!humanUser) {
    console.error(`❌ Error: Human user with email "${humanEmail}" not found in the database. Please register/create this user first.`);
    process.exit(1);
  }
  console.log(`👤 Found human bidder: ${humanUser.name} (${humanUser.email})`);

  // 2. Find or create a test client company (owner of the auction)
  let clientCompany = await prisma.company.findFirst({
    where: { type: 'CLIENT' }
  });
  if (!clientCompany) {
    clientCompany = await prisma.company.create({
      data: {
        name: 'Test Client Company',
        type: 'CLIENT',
        status: 'APPROVED',
      }
    });
    console.log(`🏢 Created Test Client Company: ${clientCompany.name}`);
  } else {
    console.log(`🏢 Reusing Client Company: ${clientCompany.name}`);
  }

  // Cleanup old test data
  console.log(`🧹 Cleaning up old test auctions/requirements...`);
  const oldAuctions = await prisma.auction.findMany({
    where: { title: 'Live Simultaneous Bidding Test' }
  });
  for (const oldAuction of oldAuctions) {
    await prisma.auction.delete({ where: { id: oldAuction.id } }).catch(() => {});
  }
  
  const oldReqs = await prisma.requirement.findMany({
    where: { title: 'Live Simultaneous Bidding Test' }
  });
  for (const oldReq of oldReqs) {
    await prisma.requirement.delete({ where: { id: oldReq.id } }).catch(() => {});
  }

  // 5. Find or create Bot Company
  let botCompany = await prisma.company.findFirst({
    where: { name: 'Bot Recyclers Corp', type: 'VENDOR' }
  });
  if (!botCompany) {
    botCompany = await prisma.company.create({
      data: {
        name: 'Bot Recyclers Corp',
        type: 'VENDOR',
        status: 'APPROVED',
      }
    });
    console.log(`🤖 Created Bot Company: ${botCompany.name}`);
  } else {
    console.log(`🤖 Reusing Bot Company: ${botCompany.name}`);
  }

  // 6. Find or create 20 bots
  const vendors = [];
  const botUserIds = [];
  for (let i = 0; i < 20; i++) {
    const botEmail = `bot-${i}@ecoloop-test.com`;
    let botUser = await prisma.user.findUnique({
      where: { email: botEmail }
    });

    if (!botUser) {
      botUser = await prisma.user.create({
        data: {
          email: botEmail,
          passwordHash: '$2b$10$3V.2GjJN.eS4iesMBKGOYOgiEoug9AUI/WoOdgeY/lKTCoxk9vF1K', // Reuses standard hash
          name: `Bot Bidder #${i}`,
          role: UserRole.VENDOR,
          companyId: botCompany.id,
          isActive: true,
        }
      });
    }

    botUserIds.push(botUser.id);
    vendors.push({ id: botUser.id, name: botUser.name });
  }
  console.log(`✅ Created/verified 20 bots.`);

  // Create the Requirement
  const requirement = await prisma.requirement.create({
    data: {
      title: 'Live Simultaneous Bidding Test',
      category: 'E-Waste',
      totalWeight: 1000,
      status: 'FINALIZED',
      clientId: clientCompany.id,
      invitedVendorIds: [humanUser.id, ...botUserIds],
      auditApprovedVendorIds: [humanUser.id, ...botUserIds],
    }
  });
  console.log(`📋 Created Requirement: "${requirement.title}" (ID: ${requirement.id})`);

  // Create the live auction in OPEN_PHASE linked to the requirement
  const now = new Date();
  const start = new Date(now.getTime() - 10 * 60 * 1000); // 10 mins ago
  const end = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

  const auction = await prisma.auction.create({
    data: {
      title: 'Live Simultaneous Bidding Test',
      category: 'E-Waste',
      basePrice: 50000,
      tickSize: 1000,
      status: AuctionStatus.OPEN_PHASE,
      clientId: clientCompany.id,
      requirementId: requirement.id,
      openPhaseStart: start,
      openPhaseEnd: end,
    }
  });
  console.log(`🚀 Created Auction: "${auction.title}"`);
  console.log(`   ID: ${auction.id}`);
  console.log(`   Base Price: ₹${auction.basePrice.toLocaleString()}`);
  console.log(`   Tick Size: ₹${auction.tickSize.toLocaleString()}`);

  // Shortlist the human user for this auction
  await prisma.bid.create({
    data: {
      auctionId: auction.id,
      vendorId: humanUser.id,
      amount: auction.basePrice,
      phase: BidPhase.SEALED,
      isShortlisted: true,
      clientStatus: 'approved',
    }
  });
  console.log(`✅ Shortlisted human bidder "${humanUser.name}" for this auction.`);

  // Shortlist bots
  for (const botId of botUserIds) {
    await prisma.bid.create({
      data: {
        auctionId: auction.id,
        vendorId: botId,
        amount: auction.basePrice,
        phase: BidPhase.SEALED,
        isShortlisted: true,
        clientStatus: 'approved',
      }
    });
  }
  console.log(`✅ Shortlisted 20 bots for this auction.`);
  console.log(`✅ Created and shortlisted 20 bots.`);

  // 7. Save bot info to test-vendors.json for simulator
  fs.writeFileSync('test-vendors.json', JSON.stringify(vendors, null, 2));
  console.log(`📂 Saved bot list to "test-vendors.json"`);

  console.log(`\n🎉 Setup Complete!`);
  console.log(`------------------------------------------------------------------------`);
  console.log(`🔗 Live Page: http://localhost:3000/vendor/auctions/${auction.id}/live`);
  console.log(`🔗 marketplace: http://localhost:3000/vendor/marketplace/${auction.id}`);
  console.log(`------------------------------------------------------------------------`);
  console.log(`\n👉 Run this command next to start the 20 bots in simultaneous mode:`);
  console.log(`   npx ts-node test/bid-bot-simulator.ts --auctionId=${auction.id} --mode=race --useSeedFile=test-vendors.json`);
  console.log(`------------------------------------------------------------------------\n`);

  await prisma.$disconnect();
}

main().catch(console.error);
