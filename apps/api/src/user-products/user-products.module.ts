import { Module } from '@nestjs/common';
import { UserProductsController } from './user-products.controller';
import { UserProductsService } from './user-products.service';
import { PrismaModule } from '../prisma/prisma.module';
import { S3Module } from '../s3/s3.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [PrismaModule, S3Module, NotificationModule],
  controllers: [UserProductsController],
  providers: [UserProductsService],
})
export class UserProductsModule {}
