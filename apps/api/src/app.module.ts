import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { FirebaseModule } from './firebase/firebase.module';
import { S3Module } from './s3/s3.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { RequirementsModule } from './requirements/requirements.module';
import { AuditsModule } from './audits/audits.module';
import { AuctionsModule } from './auctions/auctions.module';
import { PaymentsModule } from './payments/payments.module';
import { PickupsModule } from './pickups/pickups.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { NotificationModule } from './notifications/notification.module';
import { DocumentsModule } from './documents/documents.module';
import { QueueModule } from './queue/queue.module';
import { RatingsModule } from './ratings/ratings.module';
import { UserProductsModule } from './user-products/user-products.module';
import { AiModule } from './ai/ai.module';

import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    // Enable cron scheduler for auction phase transitions
    ScheduleModule.forRoot(),

    // Core infrastructure (global)
    FirebaseModule,
    S3Module,
    QueueModule,
    RedisModule,

    // Feature modules
    AuthModule,
    UsersModule,
    CompaniesModule,
    RequirementsModule,
    AuditsModule,
    AuctionsModule,
    PaymentsModule,
    PickupsModule,
    DashboardModule,
    NotificationModule,
    DocumentsModule,
    RatingsModule,
    UserProductsModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
