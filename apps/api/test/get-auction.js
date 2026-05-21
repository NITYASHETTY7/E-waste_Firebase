const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const auction = await prisma.auction.findFirst();
  console.log(auction ? 'AUCTION_ID=' + auction.id : 'NO_AUCTIONS');
  await prisma.$disconnect();
}
main();
