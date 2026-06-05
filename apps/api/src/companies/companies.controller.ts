import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CompanyStatus,
  CompanyType,
  DocumentType,
  UserRole,
} from '../firebase/firestore-types';

@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private companiesService: CompaniesService) {}

  @Post()
  create(@Request() req: any, @Body() body: any) {
    return this.companiesService.create(body, req.user?.userId);
  }

  @Get()
  findAll(
    @Query('type') type?: CompanyType,
    @Query('status') status?: CompanyStatus,
  ) {
    return this.companiesService.findAll(type, status);
  }

  // Must be before :id routes — NestJS matches in declaration order
  @Get('signed-url')
  getSignedUrl(
    @Query('s3Key') s3Key: string,
    @Query('s3Bucket') s3Bucket?: string,
  ) {
    return this.companiesService.getSignedUrl(s3Key, s3Bucket);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.companiesService.update(id, body);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: CompanyStatus) {
    return this.companiesService.updateStatus(id, status);
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: DocumentType,
  ) {
    return this.companiesService.uploadKycDocument(id, file, type);
  }

  @Patch(':id/rating')
  updateRating(@Param('id') id: string, @Body('rating') rating: number) {
    return this.companiesService.updateRating(id, rating);
  }

  // --- Admin Approval / Hold / Reject ---

  @Patch('admin/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  approveCompany(@Param('id') id: string) {
    return this.companiesService.approveCompany(id);
  }

  @Patch('admin/:id/hold')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  holdCompany(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.companiesService.holdCompany(id, reason);
  }

  @Patch('admin/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  rejectCompany(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.companiesService.rejectCompany(id, reason);
  }

  // --- Admin Risk Control Endpoints ---

  @Patch('admin/:id/lock')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  lockVendor(@Param('id') id: string, @Body('reason') reason: string) {
    return this.companiesService.lockCompany(id, reason);
  }

  @Patch('admin/:id/unlock')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  unlockVendor(@Param('id') id: string) {
    return this.companiesService.unlockCompany(id);
  }

  @Post('admin/:id/penalty')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  applyPenalty(
    @Param('id') id: string,
    @Body('amount') amount: number,
    @Body('reason') reason: string,
  ) {
    return this.companiesService.applyPenalty(id, amount, reason);
  }
}
