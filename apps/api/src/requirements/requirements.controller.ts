import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  FileInterceptor,
  FileFieldsInterceptor,
} from '@nestjs/platform-express';
import { RequirementsService } from './requirements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateRequirementDto,
  ClientApproveRequirementDto,
} from './requirements.dto';

@UseGuards(JwtAuthGuard)
@Controller('requirements')
export class RequirementsController {
  constructor(private svc: RequirementsService) {}

  @Post()
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
      { name: 'documents', maxCount: 20 },
    ]),
  )
  create(
    @Body() body: CreateRequirementDto,
    @UploadedFiles()
    files: { file?: Express.Multer.File[]; documents?: Express.Multer.File[] },
    @Request() req: any,
  ) {
    let invitedVendorIds: string[] = [];
    if (body.invitedVendorIds) {
      try {
        invitedVendorIds =
          typeof body.invitedVendorIds === 'string'
            ? JSON.parse(body.invitedVendorIds)
            : body.invitedVendorIds;
      } catch {
        invitedVendorIds = body.invitedVendorIds
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
    }

    let documentTypes: string[] = [];
    if (body.documentTypes) {
      try {
        documentTypes =
          typeof body.documentTypes === 'string'
            ? JSON.parse(body.documentTypes)
            : body.documentTypes;
      } catch {
        documentTypes = [];
      }
    }

    return this.svc.create({
      ...body,
      clientId: body.clientId || req.user.companyId,
      invitedVendorIds,
      file: files?.file?.[0],
      documentFiles: files?.documents,
      documentTypes,
    });
  }

  @Get()
  findAll(@Query('clientId') clientId?: string) {
    return this.svc.findAll(clientId);
  }

  @Get('audit-docs/all')
  getAllAuditDocs() {
    return this.svc.getAllAuditDocs();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  // Admin uploads cleaned / standardised sheet + selects invited vendors
  @Post(':id/processed-sheet')
  @UseInterceptors(FileInterceptor('file'))
  uploadProcessed(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
  ) {
    let vendorIds: string[] = [];
    if (body.vendorIds) {
      try {
        vendorIds =
          typeof body.vendorIds === 'string'
            ? JSON.parse(body.vendorIds)
            : body.vendorIds;
      } catch {
        vendorIds = [];
      }
    }
    return this.svc.uploadProcessedSheet(id, file, vendorIds);
  }

  // Admin rejects the listing
  @Patch(':id/reject')
  reject(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.svc.reject(id, body.reason);
  }

  // Vendor accepts or declines the sealed bid invitation
  @Patch(':id/invitation-respond')
  vendorRespond(
    @Param('id') id: string,
    @Body() body: { action: 'accept' | 'decline' },
    @Request() req: any,
  ) {
    const vendorUserId = req.user?.userId;
    return this.svc.vendorRespond(id, vendorUserId, body.action);
  }

  // Get a single requirement (for vendor invitation page)
  @Get(':id/invitation')
  getInvitation(@Param('id') id: string, @Request() req: any) {
    return this.svc.getInvitationDetails(id, req.user?.userId);
  }

  // Vendor uploads audit docs (audit report + images + filled excel) — NO bid price
  @Post(':id/audit-docs')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'auditReport', maxCount: 1 },
      { name: 'filledExcel', maxCount: 1 },
      { name: 'images', maxCount: 10 },
    ]),
  )
  uploadAuditDocs(
    @Param('id') id: string,
    @UploadedFiles()
    files: {
      auditReport?: Express.Multer.File[];
      filledExcel?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
    @Request() req: any,
  ) {
    return this.svc.uploadAuditDocs(id, req.user?.userId, {
      auditReport: files.auditReport?.[0],
      filledExcel: files.filledExcel?.[0],
      images: files.images,
    });
  }

  // Admin/client get all audit submissions for a requirement
  @Get(':id/audit-docs')
  getAuditDocs(@Param('id') id: string) {
    return this.svc.getAuditDocs(id);
  }

  // Admin approves or rejects a vendor's audit submission
  @Patch(':id/audit-docs/:docId/review')
  reviewAuditDoc(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body() body: { action: 'approve' | 'reject'; remarks?: string },
  ) {
    return this.svc.reviewAuditDoc(id, docId, body.action, body.remarks);
  }

  // Admin creates sealed bid event → notifies approved vendors
  @Post(':id/sealed-bid-event')
  createSealedBidEvent(
    @Param('id') id: string,
    @Body() body: { sealedBidDeadline: string; sealedBidStart?: string },
  ) {
    return this.svc.createSealedBidEvent(
      id,
      body.sealedBidDeadline,
      body.sealedBidStart,
    );
  }

  // Vendor submits sealed bid price (after audit approved + event created)
  @Post(':id/sealed-bid')
  submitSealedBid(
    @Param('id') id: string,
    @Body() body: { amount: number; remarks?: string },
    @Request() req: any,
  ) {
    return this.svc.submitSealedBid(
      id,
      req.user?.userId,
      Number(body.amount),
      body.remarks,
    );
  }

  // Admin/client get all sealed bids for a requirement
  @Get(':id/sealed-bids')
  getSealedBids(@Param('id') id: string) {
    return this.svc.getSealedBids(id);
  }

  // Admin shortlists bids and shares with client
  @Patch(':id/share-bids-with-client')
  shareShortlistedBidsWithClient(
    @Param('id') id: string,
    @Body() body: { bidIds: string[] },
  ) {
    return this.svc.shareShortlistedBidsWithClient(id, body.bidIds || []);
  }

  // Admin notifies client to approve live auction params
  @Post(':id/notify-client-live')
  notifyClientForLiveApproval(@Param('id') id: string) {
    return this.svc.notifyClientForLiveApproval(id);
  }

  // Client requests changes to admin-set governance params
  @Post(':id/client-request-changes')
  clientRequestChanges(
    @Param('id') id: string,
    @Body() body: { message?: string },
  ) {
    return this.svc.clientRequestParamChanges(id, body.message);
  }

  // Client approves live auction → vendors get notified
  @Patch(':id/client-approve-live')
  clientApproveLive(
    @Param('id') id: string,
    @Body()
    body: {
      basePrice?: number;
      targetPrice?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.svc.clientApproveLive(id, body);
  }

  // Client approves the processed sheet with target price
  @Patch(':id/approve')
  clientApprove(
    @Param('id') id: string,
    @Body() body: ClientApproveRequirementDto,
  ) {
    return this.svc.clientApprove(id, body);
  }

  // Admin approves the listing → creates auction + sends vendor emails
  @Patch(':id/admin-approve')
  adminApprove(@Param('id') id: string, @Request() req: any) {
    return this.svc.adminApprove(id, req.user?.userId);
  }

  @Get(':id/download/:field')
  getSignedUrl(
    @Param('id') id: string,
    @Param('field') field: 'raw' | 'processed',
  ) {
    return this.svc.getSignedUrl(id, field);
  }
}
