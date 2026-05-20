import {
  Controller, Get, Post, Patch, Body, Param,
  UseGuards, Request, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserProductsService } from './user-products.service';
import { CreateUserProductDto, SubmitQuoteDto, AdminReviewDto, UpdateUserProfileDto } from './user-products.dto';

@UseGuards(JwtAuthGuard)
@Controller('user-products')
export class UserProductsController {
  constructor(private svc: UserProductsService) {}

  // USER: submit a new product
  @Post()
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'photos', maxCount: 5 },
    { name: 'invoice', maxCount: 1 },
  ]))
  create(
    @Request() req: any,
    @Body() dto: CreateUserProductDto,
    @UploadedFiles() files: { photos?: Express.Multer.File[]; invoice?: Express.Multer.File[] },
  ) {
    return this.svc.create(req.user.userId, dto, files.photos ?? [], files.invoice?.[0]);
  }

  // USER: list own products
  @Get('mine')
  findMine(@Request() req: any) {
    return this.svc.findMyProducts(req.user.userId);
  }

  // ADMIN: list all products
  @Get('admin/all')
  findAll() {
    return this.svc.findAllForAdmin();
  }

  // VENDOR: list approved products open for quoting
  @Get('vendor/open')
  findOpen(@Request() req: any) {
    // req.user.companyId is set by JWT payload — fallback to empty string if missing
    return this.svc.findApprovedForVendors(req.user.companyId ?? '');
  }

  // ADMIN: approve or reject a product
  @Patch(':id/review')
  adminReview(
    @Param('id') id: string,
    @Body() dto: AdminReviewDto,
  ) {
    return this.svc.adminReview(id, dto.action, dto.remarks);
  }

  // VENDOR: submit a quote
  @Post(':id/quote')
  submitQuote(
    @Param('id') id: string,
    @Body() dto: SubmitQuoteDto,
    @Request() req: any,
  ) {
    return this.svc.submitQuote(id, req.user.companyId ?? '', dto.offeredPrice, dto.remarks);
  }

  // USER: accept a vendor quote
  @Patch(':id/accept-quote/:quoteId')
  acceptQuote(
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
    @Request() req: any,
  ) {
    return this.svc.acceptQuote(id, quoteId, req.user.userId);
  }

  // USER: get pickup status for a product
  @Get(':id/pickup')
  getPickup(@Param('id') id: string, @Request() req: any) {
    return this.svc.getPickupStatus(id, req.user.userId);
  }

  // VENDOR/ADMIN: update pickup status
  @Patch(':id/pickup-status')
  updatePickupStatus(
    @Param('id') id: string,
    @Body() body: { status: string; scheduledDate?: string },
  ) {
    return this.svc.updatePickupStatus(
      id,
      body.status,
      body.scheduledDate ? new Date(body.scheduledDate) : undefined,
    );
  }

  // USER: update own profile (dob, address, PAN, bank)
  @Patch('me/profile')
  updateProfile(@Request() req: any, @Body() dto: UpdateUserProfileDto) {
    return this.svc.updateUserProfile(req.user.userId, dto);
  }
}
