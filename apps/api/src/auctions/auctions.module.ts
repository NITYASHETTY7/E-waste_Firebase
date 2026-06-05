import { Module } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { AuctionsController } from './auctions.controller';
import { AuctionGateway } from './auction.gateway';
import { AuctionScheduler } from './auction.scheduler';
import { NotificationModule } from '../notifications/notification.module';
import { DocumentsModule } from '../documents/documents.module';
import { FirebaseModule } from '../firebase/firebase.module';

@Module({
  imports: [NotificationModule, DocumentsModule, FirebaseModule],
  controllers: [AuctionsController],
  providers: [AuctionsService, AuctionGateway, AuctionScheduler],
  exports: [AuctionsService],
})
export class AuctionsModule {}
