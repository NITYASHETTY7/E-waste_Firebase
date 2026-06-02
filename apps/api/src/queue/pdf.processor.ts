import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { DocumentsService } from '../documents/documents.service';

@Processor('pdf')
export class PdfProcessor {
  private readonly logger = new Logger(PdfProcessor.name);

  constructor(private readonly documentsService: DocumentsService) {}

  @Process('generateWorkOrder')
  async handleGeneratePdf(job: Job<any>) {
    this.logger.debug(
      `Processing background PDF generation job for auction ${job.data.auctionId}...`,
    );
    try {
      await this.documentsService.executeGenerateWorkOrderPdf(job.data);
      this.logger.debug('Background PDF job completed');
    } catch (err) {
      this.logger.error('Failed to process PDF job', err);
      throw err;
    }
  }
}
