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
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuctionsService } from './auctions.service';
import { AuctionGateway } from './auction.gateway';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuctionStatus, UserRole } from '@prisma/client';
import {
  CreateAuctionDto,
  ScheduleAuctionDto,
  SubmitSealedBidDto,
} from './auctions.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('auctions')
export class AuctionsController {
  constructor(
    private svc: AuctionsService,
    private gateway: AuctionGateway,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() body: CreateAuctionDto, @Request() req: any) {
    return this.svc.create({
      ...body,
      clientId: body.clientId || req.user.companyId,
    });
  }

  @Get()
  findAll(
    @Query('status') status?: AuctionStatus,
    @Query('clientId') clientId?: string,
  ) {
    return this.svc.findAll(status, clientId);
  }

  // List all bids across auctions (used by frontend fetchAllData)
  @Get('bids')
  findAllBids(@Query('auctionId') auctionId?: string) {
    return this.svc.findAllBids(auctionId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id/schedule')
  schedule(@Param('id') id: string, @Body() body: ScheduleAuctionDto) {
    return this.svc.schedule(id, body);
  }

  @Patch(':id/approve-live')
  approveLive(@Param('id') id: string) {
    return this.svc.approveLiveAuction(id);
  }

  @Patch(':id/share-with-client')
  @Roles(UserRole.ADMIN)
  shareWithClient(@Param('id') id: string, @Body('bidIds') bidIds: string[]) {
    return this.svc.shareSealedBids(id, bidIds);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: AuctionStatus,
  ) {
    const result = await this.svc.updateStatus(id, status);
    // Notify all vendors in the auction room when auction ends
    if (
      status === AuctionStatus.COMPLETED ||
      status === AuctionStatus.PENDING_SELECTION
    ) {
      this.gateway.broadcastAuctionEnded(id).catch(console.error);
    }
    return result;
  }

  @Post(':id/sealed-bid')
  @UseInterceptors(FileInterceptor('file'))
  sealedBid(
    @Param('id') id: string,
    @Body() body: SubmitSealedBidDto,
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const amount = body.amount;
    if (isNaN(amount))
      throw new BadRequestException('amount is required and must be a number');
    return this.svc.submitSealedBid(
      id,
      req.user.userId,
      amount,
      file,
      body.remarks,
    );
  }

  @Patch(':id/winner')
  async selectWinner(
    @Param('id') id: string,
    @Body('vendorId') vendorId: string,
  ) {
    const result = await this.svc.selectWinner(id, vendorId);
    this.gateway.broadcastWinnerSelected(id, vendorId);
    return result;
  }

  @Patch(':id/disqualify-winner')
  @Roles(UserRole.ADMIN)
  async disqualifyWinner(
    @Param('id') id: string,
    @Body('disqualifiedVendorId') disqualifiedVendorId: string,
    @Body('reason') reason: string,
    @Body('fineAmount') fineAmount: number,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException('Reason for disqualification is required.');
    }
    const result = await this.svc.disqualifyWinner(
      id,
      disqualifiedVendorId,
      reason,
      fineAmount ?? 0,
    );
    this.gateway.broadcastWinnerSelected(id, result.winnerId ?? '');
    return result;
  }

  @Post(':id/final-quote')
  @UseInterceptors(FileInterceptor('file'))
  uploadFinalQuote(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: 'FINAL_QUOTE' | 'LETTERHEAD_QUOTATION',
  ) {
    return this.svc.uploadFinalQuote(id, file, type);
  }

  @Patch(':id/approve-quote')
  approveQuote(@Param('id') id: string) {
    return this.svc.approveQuote(id);
  }

  @Patch(':id/reject-quote')
  rejectQuote(@Param('id') id: string, @Body('remarks') remarks: string) {
    return this.svc.rejectQuote(id, remarks);
  }

  @Post(':id/generate-docs')
  @Roles(UserRole.ADMIN)
  generateDocs(@Param('id') id: string) {
    return this.svc.generatePostAuctionDocs(id);
  }

  @Get(':id/post-auction')
  getPostAuction(@Param('id') id: string) {
    return this.svc.getAuctionWithPostDocs(id);
  }
}
