import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ratings')
export class RatingsController {
  constructor(private svc: RatingsService) {}

  @Post()
  submit(
    @Request() req: any,
    @Body()
    body: {
      auctionId: string;
      toCompanyId: string;
      score: number;
      comment?: string;
      type: 'CLIENT_TO_VENDOR' | 'VENDOR_TO_CLIENT';
    },
  ) {
    return this.svc.submitRating({
      ...body,
      fromCompanyId: req.user.companyId,
    });
  }

  @Get('auction/:auctionId')
  byAuction(@Param('auctionId') auctionId: string) {
    return this.svc.getRatingsForAuction(auctionId);
  }

  @Get('company/:companyId')
  byCompany(@Param('companyId') companyId: string) {
    return this.svc.getRatingsForCompany(companyId);
  }
}
