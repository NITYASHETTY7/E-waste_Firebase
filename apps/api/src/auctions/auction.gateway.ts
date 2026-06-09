// Live Auction Gateway — WebSocket for real-time open bidding
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuctionsService } from './auctions.service';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/auction',
})
export class AuctionGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  constructor(
    private auctionsService: AuctionsService,
    private redis: RedisService,
  ) {}

  afterInit() {
    console.log('🔌 Auction WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    console.log(`WS connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`WS disconnected: ${client.id}`);
  }

  // Vendor joins an auction room
  @SubscribeMessage('joinAuction')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { auctionId: string },
  ) {
    await client.join(payload.auctionId);
    const auction = await this.auctionsService.findOne(payload.auctionId);
    client.emit('auctionState', auction);
  }

  // Vendor places a live bid
  @SubscribeMessage('placeBid')
  async handleBid(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      auctionId: string;
      vendorId: string;
      amount: number;
      idempotencyKey?: string;
    },
  ) {
    // 1. Rate Limiting
    const rateLimitKey = `ratelimit:bid:${payload.vendorId}`;
    const isAllowed = await this.redis.checkRateLimit(rateLimitKey, 3, 1);
    if (!isAllowed) {
      client.emit('bidError', {
        message: 'Too many bids. Please wait a second.',
      });
      return;
    }

    try {
      // 2. Place bid using service (which handles lock, validation, timer, etc.)
      const result = await this.auctionsService.placeLiveBid({
        auctionId: payload.auctionId,
        vendorId: payload.vendorId,
        amount: payload.amount,
        idempotencyKey: payload.idempotencyKey,
      });

      // 3. Broadcast success
      // If timer was extended, notify everyone
      if (result.auction.extensionCount > 0) {
        this.server.to(payload.auctionId).emit('timerExtended', {
          newEndTime: result.auction.openPhaseEnd,
          extensionCount: result.auction.extensionCount,
        });
      }

      this.server.to(payload.auctionId).emit('newBid', {
        bid: result.bid,
        leaderboard: result.leaderboard,
      });
    } catch (e) {
      client.emit('bidError', { message: e.message || 'Failed to place bid' });
    }
  }

  async broadcastAuctionEnded(auctionId: string) {
    const leaderboard = await this.auctionsService.getLeaderboard(auctionId);
    const winnerId = leaderboard[0]?.vendorId ?? null;
    this.server.to(auctionId).emit('auctionEnded', { auctionId, winnerId });
  }

  broadcastWinnerSelected(auctionId: string, vendorId: string) {
    this.server.to(auctionId).emit('winnerSelected', { auctionId, vendorId });
  }
}
