const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function makeLive() {
  const auctions = await prisma.auction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  console.log("Recent Auctions:");
  auctions.forEach(a => console.log(`- ${a.id}: ${a.title} (${a.status})`));

  const target = auctions.find(a => a.status !== 'COMPLETED' && a.status !== 'CANCELLED');
  
  if (target) {
    console.log(`\nMaking auction ${target.title} (${target.id}) LIVE (OPEN_PHASE)...`);
    await prisma.auction.update({
      where: { id: target.id },
      data: { status: 'OPEN_PHASE' }
    });
    console.log("Success! The auction is now live.");
  } else {
    console.log("\nNo eligible recent auctions found to make live. Please create a new one.");
  }
}

makeLive()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
