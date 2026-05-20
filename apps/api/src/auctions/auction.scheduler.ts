import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuctionsService } from './auctions.service';
import { AuctionGateway } from './auction.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { PickupStatus } from '@prisma/client';

@Injectable()
export class AuctionScheduler {
  private readonly logger = new Logger(AuctionScheduler.name);

  constructor(
    private auctionsService: AuctionsService,
    private gateway: AuctionGateway,
    private prisma: PrismaService,
    private notifications: NotificationService,
  ) {}

  // Runs every minute to transition auction phases automatically
  @Cron(CronExpression.EVERY_MINUTE)
  async handlePhaseTransitions() {
    const { endedAuctionIds } = await this.auctionsService.transitionPhases();
    // Notify all WebSocket clients in ended auction rooms so the UI updates immediately
    for (const id of endedAuctionIds) {
      await this.gateway.broadcastAuctionEnded(id);
    }
  }

  // Runs daily at 9:00 AM
  @Cron('0 9 * * *')
  async sendComplianceReminders() {
    this.logger.log('Running daily compliance reminders check');
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const pendingPickups = await this.prisma.pickup.findMany({
      where: {
        status: { not: PickupStatus.COMPLETED },
        createdAt: { lt: twentyFourHoursAgo }
      },
      include: {
        pickupDocs: true,
        auction: {
          include: { winner: { include: { users: { take: 1 } } } }
        }
      }
    });

    for (const pickup of pendingPickups) {
      const requiredTypes = [
        'FORM_6',
        'WEIGHT_SLIP_EMPTY',
        'WEIGHT_SLIP_LOADED',
        'RECYCLING_CERTIFICATE',
        'DISPOSAL_CERTIFICATE'
      ];
      
      const uploadedTypes = pickup.pickupDocs.map(d => d.type);
      const missingTypes = requiredTypes.filter(t => !uploadedTypes.includes(t as any));

      if (missingTypes.length > 0) {
        const vendorUser = pickup.auction?.winner?.users?.[0];
        if (vendorUser?.email) {
          try {
            await this.notifications.sendEmail({
              to: vendorUser.email,
              subject: `Action Required: Upload missing compliance documents - ${pickup.auction.title}`,
              body: `
                <h2>Compliance Documents Missing</h2>
                <p>Hello ${vendorUser.name},</p>
                <p>You have missing compliance documents for the auction <strong>${pickup.auction.title}</strong>.</p>
                <p>Please log in and upload the following missing documents to avoid penalties:</p>
                <ul>
                  ${missingTypes.map(t => `<li>${t.replace(/_/g, ' ')}</li>`).join('')}
                </ul>
                <p><a href="${process.env.WEB_URL || 'http://localhost:3000'}/vendor/pickups">Go to Pickups Dashboard</a></p>
              `
            });
            this.logger.log(`Sent reminder to ${vendorUser.email} for pickup ${pickup.id}`);
          } catch (err) {
            this.logger.error(`Failed to send reminder for pickup ${pickup.id}`, err);
          }
        }
      }
    }
  }
}
