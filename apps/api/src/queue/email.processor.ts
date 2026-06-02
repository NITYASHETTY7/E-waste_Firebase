import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { NotificationService } from '../notifications/notification.service';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly notificationsService: NotificationService) {}

  @Process('send')
  async handleSendEmail(job: Job<any>) {
    this.logger.debug('Processing background email job...');
    try {
      // Execute the actual email sending directly using the AWS SES logic from notificationService
      // To avoid circular dependency, notificationService will queue the job, and this processor will execute a private/internal method
      await this.notificationsService.executeSendEmail(job.data);
      this.logger.debug('Background email job completed');
    } catch (err) {
      this.logger.error('Failed to process email job', err);
      throw err;
    }
  }
}
