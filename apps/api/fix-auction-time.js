const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateAuction() {
  const auctionId = 'cmpuwi66p003zn101wqvjex5h';
  
  // Target: 10:26 AM to 10:35 AM (IST) on June 2, 2026
  // IST is UTC+5:30
  // 10:26 IST = 04:56 UTC
  // 10:35 IST = 05:05 UTC
  
  const startDate = new Date('2026-06-02T04:56:00Z');
  const endDate = new Date('2026-06-02T05:05:00Z');

  try {
    const updated = await prisma.auction.update({
      where: { id: auctionId },
      data: {
        openPhaseStart: startDate,
        openPhaseEnd: endDate,
        status: 'OPEN_PHASE'
      }
    });
    console.log('Successfully updated auction:', updated.id);
    console.log('New Start:', updated.openPhaseStart);
    console.log('New End:', updated.openPhaseEnd);
    console.log('Status:', updated.status);
  } catch (error) {
    console.error('Error updating auction:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateAuction();
