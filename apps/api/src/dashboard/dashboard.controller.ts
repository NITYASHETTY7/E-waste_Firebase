import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../firebase/firestore-types';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private svc: DashboardService) {}

  @Get('admin')
  adminStats() {
    return this.svc.getAdminStats();
  }

  @Get('admin/analytics/revenue')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  adminRevenue() {
    return this.svc.getAdminRevenueAnalytics();
  }

  @Get('client/:companyId')
  clientStats(@Param('companyId') companyId: string) {
    return this.svc.getClientStats(companyId);
  }

  @Get('vendor/:companyId')
  vendorStats(@Param('companyId') companyId: string) {
    return this.svc.getVendorStats(companyId);
  }

  @Get('vendor/:companyId/analytics')
  vendorAnalytics(@Param('companyId') companyId: string) {
    return this.svc.getVendorAnalytics(companyId);
  }
}
