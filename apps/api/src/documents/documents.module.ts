import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { S3Module } from '../s3/s3.module';

@Module({
  imports: [S3Module],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
