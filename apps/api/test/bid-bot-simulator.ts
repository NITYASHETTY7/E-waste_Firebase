import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:4000';
const WS_URL = process.env.WS_URL || 'http://localhost:4000/auction';
const NUM_BOTS = 20; // Scalable to 100
const AUCTION_ID = process.argv.find(arg => arg.startsWith('--auctionId='))?.split('=')[1];
const MODE = process.argv.find(arg => arg.startsWith('--mode='))?.split('=')[1] || 'war';
const SEED_FILE = process.argv.find(arg => arg.startsWith('--useSeedFile='))?.split('=')[1];

let vendorList: { id: string, name: string }[] = [];
if (SEED_FILE && fs.existsSync(SEED_FILE)) {
  vendorList = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  console.log(`📂 Loaded ${vendorList.length} vendors from seed file.`);
}

let currentHighestPrice = 0;
let tickSize = 1000;
const errorCountsByPrice: Record<number, number> = {};
const botLastBidPrices: number[] = [];
let currentTargetPrice = 0;
let lastTriggeredPrice = 0;
const bots: Socket[] = [];

function triggerNextRaceRound() {
  const nextPrice = Math.max(currentHighestPrice, currentTargetPrice) + tickSize;
  currentTargetPrice = nextPrice;
  console.log(`\n🏁 NEXT RACE ROUND: Firing bids of amount ₹${nextPrice.toLocaleString()}...`);
  
  setTimeout(() => {
    bots.forEach((bot, i) => {
      const vendor = vendorList[i] || { id: `bot-vendor-${i}` };
      botLastBidPrices[i] = nextPrice;
      bot.emit('placeBid', {
        auctionId: AUCTION_ID,
        vendorId: vendor.id,
        amount: nextPrice,
        idempotencyKey: uuidv4()
      });
    });
  }, 1500); // 1.5 seconds delay so the user can easily observe the cycle
}

async function run() {
  console.log(`🚀 Starting Bot Simulator [Mode: ${MODE}] for Auction: ${AUCTION_ID}`);

  const numToSpawn = vendorList.length > 0 ? vendorList.length : NUM_BOTS;

  for (let i = 0; i < numToSpawn; i++) {
    const vendor = vendorList[i] || { id: `bot-vendor-${i}`, name: `Bot ${i}` };
    const socket = io(WS_URL, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log(`Bot ${i} (${vendor.name}) connected`);
      socket.emit('joinAuction', { auctionId: AUCTION_ID });
    });

    socket.on('auctionState', (auction: any) => {
      if (auction.tickSize) {
        tickSize = auction.tickSize;
      }
      const highest = auction.bids?.[0]?.amount || auction.basePrice || 0;
      if (highest > currentHighestPrice) {
        currentHighestPrice = highest;
        if (i === 0) {
          console.log(`ℹ️ Initialized price from auction state: ₹${currentHighestPrice.toLocaleString()} (Tick size: ₹${tickSize.toLocaleString()})`);
        }
      }
    });

    socket.on('bidError', (err) => {
      console.error(`Bot ${i} Error:`, err.message);
      if (MODE === 'race' && err.message === 'The price is already bid. Try the next highest bid.') {
        const failedPrice = botLastBidPrices[i];
        if (failedPrice) {
          errorCountsByPrice[failedPrice] = (errorCountsByPrice[failedPrice] || 0) + 1;
          if (errorCountsByPrice[failedPrice] >= 5 && lastTriggeredPrice < failedPrice) {
            lastTriggeredPrice = failedPrice;
            console.log(`⚠️ Received ${errorCountsByPrice[failedPrice]} error messages for ₹${failedPrice.toLocaleString()}. Triggering next bidding round...`);
            triggerNextRaceRound();
          }
        }
      }
    });

    socket.on('newBid', (data) => {
      const amount = data.bid.amount;
      if (amount > currentHighestPrice) {
        currentHighestPrice = amount;
      }
      if (i === 0) {
        console.log(`📢 Live Bid Update: ₹${amount.toLocaleString()} (Leader: ${data.bid.vendor?.name || data.bid.vendorId})`);
      }
    });

    bots.push(socket);
    
    // Stagger connections
    await new Promise(r => setTimeout(r, 30));
  }

  // Wait for at least one bot to receive the initial auctionState and set currentHighestPrice
  console.log('⏳ Waiting for auction state initialization...');
  for (let attempt = 0; attempt < 50; attempt++) {
    if (currentHighestPrice > 0) break;
    await new Promise(r => setTimeout(r, 200));
  }
  if (currentHighestPrice === 0) {
    console.error('❌ Failed to initialize auction price state. Exiting.');
    process.exit(1);
  }
  console.log(`✅ Auction state initialized. Starting simulation at ₹${currentHighestPrice.toLocaleString()}...`);

  // 3. Execution Logic
  if (MODE === 'race') {
    console.log('🏁 RACE MODE: All bots firing same amount simultaneously...');
    const amount = currentHighestPrice + tickSize;
    currentTargetPrice = amount;
    console.log(`Firing initial bids of amount ₹${amount.toLocaleString()}...`);
    bots.forEach((bot, i) => {
      const vendor = vendorList[i] || { id: `bot-vendor-${i}` };
      botLastBidPrices[i] = amount;
      bot.emit('placeBid', {
        auctionId: AUCTION_ID,
        vendorId: vendor.id,
        amount: amount,
        idempotencyKey: uuidv4()
      });
    });
  } else if (MODE === 'war') {
    console.log('⚔️ WAR MODE: Random staggered bidding...');
    setInterval(() => {
      const botIdx = Math.floor(Math.random() * bots.length);
      const vendor = vendorList[botIdx] || { id: `bot-vendor-${botIdx}` };
      
      const bidAmount = currentHighestPrice + tickSize;
      currentHighestPrice = bidAmount; // Optimistically increment to avoid self-collision in logs

      bots[botIdx].emit('placeBid', {
        auctionId: AUCTION_ID,
        vendorId: vendor.id,
        amount: bidAmount,
        idempotencyKey: uuidv4()
      });
    }, 1500); // 1.5s interval to play nicely with rate limit (3 bids/sec per user)
  }

  // Keep process alive
  process.on('SIGINT', () => {
    bots.forEach(b => b.disconnect());
    process.exit();
  });
}

run().catch(console.error);
