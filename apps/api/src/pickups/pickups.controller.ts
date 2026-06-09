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
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PickupsService } from './pickups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentType, PickupStatus } from '../firebase/firestore-types';
import type { Response } from 'express';

@UseGuards(JwtAuthGuard)
@Controller()
export class PickupsController {
  constructor(private svc: PickupsService) {}

  @Post('pickups')
  create(@Body() body: { auctionId: string; paymentId?: string }) {
    return this.svc.create(body.auctionId, body.paymentId);
  }

  @Get('pickups')
  findAll(@Query('status') status?: PickupStatus) {
    return this.svc.findAll(status);
  }

  @Get('pickups/by-auction/:auctionId')
  findByAuction(@Param('auctionId') auctionId: string) {
    return this.svc.findByAuction(auctionId);
  }

  @Get('pickups/:id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch('pickups/:id/schedule')
  schedule(@Param('id') id: string, @Body('scheduledDate') date: string) {
    return this.svc.schedule(id, date);
  }

  @Patch('pickups/:id/gate-pass')
  issueGatePass(
    @Param('id') id: string,
    @Body()
    body: {
      gatePassNumber: string;
      vehicleNumber?: string;
      driverName?: string;
      scheduledDate?: string;
      pickupNotes?: string;
    },
  ) {
    return this.svc.issueGatePass(id, body);
  }

  @Post('pickups/:id/upload-gate-pass')
  @UseInterceptors(FileInterceptor('file'))
  uploadGatePassDoc(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.svc.uploadGatePassDoc(id, file);
  }

  @Patch('pickups/by-auction/:auctionId/vendor-logistics')
  saveVendorLogistics(
    @Param('auctionId') auctionId: string,
    @Body()
    body: {
      vehicleNumber?: string;
      driverName?: string;
      preferredDate?: string;
    },
  ) {
    return this.svc.saveVendorLogistics(auctionId, body);
  }

  @Patch('pickups/:id/vendor-acknowledge')
  vendorAcknowledge(@Param('id') id: string) {
    return this.svc.vendorAcknowledge(id);
  }

  @Post('pickups/:id/upload-doc')
  @UseInterceptors(FileInterceptor('file'))
  uploadDoc(
    @Param('id') id: string,
    @Query('type') type: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const docType = type as DocumentType;
    return this.svc.uploadHandoverDoc(id, file, docType);
  }

  @Post('pickups/:id/reconcile')
  reconcile(
    @Param('id') id: string,
    @Body()
    body: {
      finalWeight: number;
      reconciliationNotes?: string;
      finalAmount: number;
    },
  ) {
    return this.svc.reconcile(id, body);
  }

  @Post('pickups/:id/generate-invoice')
  generateInvoice(@Param('id') id: string) {
    return this.svc.generateInvoice(id);
  }

  @Patch('admin/pickups/:id/release-payment')
  releasePayment(@Param('id') id: string) {
    return this.svc.releasePayment(id);
  }

  @Post('pickups/:id/upload-form6')
  @UseInterceptors(FileInterceptor('file'))
  uploadForm6(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.svc.uploadDocument(id, file, DocumentType.FORM_6);
  }

  @Post('pickups/:id/upload-weight-slip')
  @UseInterceptors(FileInterceptor('file'))
  uploadWeightSlip(
    @Param('id') id: string,
    @Query('type') type: 'empty' | 'loaded',
    @UploadedFile() file: Express.Multer.File,
  ) {
    const docType =
      type === 'empty'
        ? DocumentType.WEIGHT_SLIP_EMPTY
        : DocumentType.WEIGHT_SLIP_LOADED;
    return this.svc.uploadDocument(id, file, docType);
  }

  @Post('pickups/:id/upload-compliance')
  @UseInterceptors(FileInterceptor('file'))
  uploadCompliance(
    @Param('id') id: string,
    @Query('type') type: 'recycling' | 'disposal',
    @UploadedFile() file: Express.Multer.File,
  ) {
    const docType =
      type === 'recycling'
        ? DocumentType.RECYCLING_CERTIFICATE
        : DocumentType.DISPOSAL_CERTIFICATE;
    return this.svc.uploadDocument(id, file, docType);
  }

  @Get('pickups/:id/documents/download-all')
  async downloadAllDocs(@Param('id') id: string, @Res() res: Response) {
    const stream = await this.svc.downloadAllDocumentsZip(id);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="EcoLoop_Compliance_${id}.zip"`,
    });
    stream.pipe(res);
  }

  @Patch('pickups/:id/client-verify-compliance')
  clientVerifyCompliance(@Param('id') id: string) {
    return this.svc.clientVerifyCompliance(id);
  }

  @Patch('admin/pickups/:id/verify-compliance')
  verifyCompliance(@Param('id') id: string) {
    return this.svc.verifyCompliance(id);
  }

  @Patch('admin/pickups/:id/complete')
  complete(@Param('id') id: string, @Body('adminNotes') notes?: string) {
    return this.svc.completePickup(id, notes);
  }
}
