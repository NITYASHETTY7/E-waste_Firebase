import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaymentStatus, UserRole } from '@prisma/client';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class PaymentsController {
  constructor(private svc: PaymentsService) {}

  @Post('payments/auction/:auctionId')
  create(
    @Param('auctionId') auctionId: string,
    @Body('clientAmount') amount: number,
  ) {
    return this.svc.createForAuction(auctionId, amount);
  }

  @Get('payments')
  findAll(@Query('status') status?: PaymentStatus) {
    return this.svc.findAll(status);
  }

  @Get('payments/auction/:auctionId')
  findOne(@Param('auctionId') auctionId: string) {
    return this.svc.findByAuction(auctionId);
  }

  @Patch('payments/:id/upload-proof')
  @UseInterceptors(FileInterceptor('file'))
  uploadProof(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('utrNumber') utrNumber?: string,
  ) {
    return this.svc.uploadProof(id, file, utrNumber);
  }

  // Route called by frontend AppContext: POST /payments/auction/:auctionId/proof
  @Post('payments/auction/:auctionId/proof')
  @UseInterceptors(FileInterceptor('file'))
  uploadProofByAuction(
    @Param('auctionId') auctionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('utrNumber') utrNumber?: string,
  ) {
    return this.svc.uploadProofByAuction(auctionId, file, utrNumber);
  }

  @Patch('admin/payments/:id/verify')
  @Roles(UserRole.ADMIN)
  verifyPayment(@Param('id') id: string, @Body('adminNotes') notes?: string) {
    return this.svc.verifyPayment(id, notes);
  }

  // Route called by frontend AppContext: PATCH /payments/auction/:auctionId/confirm
  @Patch('payments/auction/:auctionId/confirm')
  @Roles(UserRole.ADMIN)
  verifyPaymentByAuction(
    @Param('auctionId') auctionId: string,
    @Body('adminNotes') notes?: string,
  ) {
    return this.svc.verifyPaymentByAuction(auctionId, notes);
  }
}
