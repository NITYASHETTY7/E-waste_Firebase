import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AuditsService } from './audits.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('audits')
export class AuditsController {
  constructor(private svc: AuditsService) {}

  @Post(':requirementId/invite')
  invite(
    @Param('requirementId') requirementId: string,
    @Body() body: { vendorIds: string[] },
  ) {
    return this.svc.inviteVendors(requirementId, body.vendorIds);
  }

  @Get('vendor/:vendorId')
  findByVendor(@Param('vendorId') vendorId: string) {
    return this.svc.findAllInvitations(vendorId);
  }

  @Get('invitations')
  findAll(
    @Query('vendorId') vendorId?: string,
    @Query('requirementId') requirementId?: string,
  ) {
    return this.svc.findAllInvitations(vendorId, requirementId);
  }

  @Get('invitations/:id')
  findOne(@Param('id') id: string) {
    return this.svc.findOneInvitation(id);
  }

  @Patch(':id/accept')
  accept(@Param('id') id: string) {
    return this.svc.acceptAudit(id);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string) {
    return this.svc.respondToInvitation(id, 'REJECTED');
  }

  @Patch(':id/complete')
  @UseInterceptors(FilesInterceptor('photos'))
  complete(
    @Param('id') id: string,
    @Body()
    body: {
      productMatch: string;
      remarks?: string;
      latitude?: string;
      longitude?: string;
      capturedAt?: string;
    },
    @Request() req: any,
    @UploadedFiles() photos?: Express.Multer.File[],
  ) {
    const isProductMatch =
      body.productMatch === 'true' || body.productMatch === true.toString();

    if (!isProductMatch && (!body.remarks || body.remarks.trim() === '')) {
      throw new BadRequestException(
        'Remarks are mandatory when product match is false.',
      );
    }

    return this.svc.submitReport(id, {
      productMatch: isProductMatch,
      remarks: body.remarks,
      vendorUserId: req.user.userId,
      photos,
      latitude: body.latitude ? parseFloat(body.latitude) : undefined,
      longitude: body.longitude ? parseFloat(body.longitude) : undefined,
      capturedAt: body.capturedAt ? new Date(body.capturedAt) : undefined,
    });
  }
  // Admin provides spoc details to the audit invitation initially (if needed)
  @Patch('invitations/:id/spoc')
  shareSpoc(@Param('id') id: string, @Body() body: any) {
    return this.svc.shareSpoc(id, body);
  }
}
