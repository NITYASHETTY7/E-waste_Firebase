import {
  Controller,
  Get,
  Patch,
  Param,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getMyNotifications(@Request() req: any) {
    const userId = req.user?.userId;
    return this.prisma.inAppNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.userId;
    return this.prisma.inAppNotification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  @Patch('read-all')
  async markAllRead(@Request() req: any) {
    const userId = req.user?.userId;
    return this.prisma.inAppNotification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}
