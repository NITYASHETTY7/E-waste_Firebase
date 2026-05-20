import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '@prisma/client';
import { CreateAdminDto } from './users.dto';
import { NotificationService } from '../notifications/notification.service';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private notifications: NotificationService,
    private prisma: PrismaService,
  ) {}

  @Public()
  @Get('admin/debug/user/:email')
  async debugUser(@Param('email') email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return { error: 'User not found' };
    return {
      email: user.email,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      role: user.role,
      companyStatus: user.company?.status,
    };
  }

  @Get()
  findAll(@Query('role') role?: UserRole) {
    return this.usersService.findAll(role);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id/role')
  updateRole(@Param('id') id: string, @Body('role') role: UserRole) {
    return this.usersService.updateRole(id, role);
  }

  @Patch(':id/company')
  linkCompany(@Param('id') id: string, @Body('companyId') companyId: string) {
    return this.usersService.linkToCompany(id, companyId);
  }

  // --- Admin Endpoints --- //
  
  @Patch(':id/approve')
  async approveUser(@Param('id') id: string) {
    const user = await this.usersService.approveUser(id);
    this.notifications.notifyAccountApproved(user.email, user.name, user.phone ?? undefined).catch(() => {});
    const dashboardLink = user.role === 'CLIENT' ? '/client/dashboard' : user.role === 'VENDOR' ? '/vendor/dashboard' : '/user/dashboard';
    await this.notifications.createInAppNotification({
      userId: user.id,
      type: 'account_approved',
      title: 'Account Approved',
      message: 'Your account has been approved. Welcome to Ecoloop!',
      link: dashboardLink,
    }).catch(() => {});
    return user;
  }

  @Patch(':id/reject')
  async rejectUser(@Param('id') id: string, @Body('reason') reason?: string) {
    const user = await this.usersService.rejectUser(id);
    this.notifications.notifyAccountRejected(user.email, user.name, user.phone ?? undefined, reason).catch(() => {});
    await this.notifications.createInAppNotification({
      userId: user.id,
      type: 'account_rejected',
      title: 'Account Application Update',
      message: `Your account application was not approved. ${reason ? `Reason: ${reason}` : ''}`,
    }).catch(() => {});
    return user;
  }

  @Patch(':id/hold')
  async holdUser(@Param('id') id: string, @Body('reason') reason?: string) {
    const user = await this.usersService.holdUser(id);
    this.notifications.notifyAccountOnHold(user.email, user.name, user.phone ?? undefined, reason).catch(() => {});
    await this.notifications.createInAppNotification({
      userId: user.id,
      type: 'account_on_hold',
      title: 'Account On Hold',
      message: `Your account has been placed on hold. ${reason ? `Reason: ${reason}` : ''}`,
    }).catch(() => {});
    return user;
  }

  @Post('admin')
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.usersService.createAdmin(dto);
  }

  @Delete('me')
  deleteMe(@Request() req: any) {
    return this.usersService.deleteMe(req.user.userId);
  }
}
