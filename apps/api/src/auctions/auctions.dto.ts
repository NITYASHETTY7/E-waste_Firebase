import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAuctionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Type(() => Number)
  basePrice: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  targetPrice?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  tickSize?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxTicks?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maximumTickSize?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  extensionMinutes?: number;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  requirementId?: string;
}

export class ScheduleAuctionDto {
  @IsDateString()
  @IsNotEmpty()
  sealedPhaseStart: string;

  @IsDateString()
  @IsNotEmpty()
  sealedPhaseEnd: string;

  @IsDateString()
  @IsNotEmpty()
  openPhaseStart: string;

  @IsDateString()
  @IsNotEmpty()
  openPhaseEnd: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  tickSize?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxTicks?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maximumTickSize?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  extensionMinutes?: number;
}

export class SubmitSealedBidDto {
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class GenerateDocsDto {
  @IsString()
  @IsOptional()
  paymentTerms?: string;

  @IsString()
  @IsOptional()
  deliveryTerms?: string;

  @IsString()
  @IsOptional()
  penaltyClause?: string;

  @IsString()
  @IsOptional()
  specialConditions?: string;
}
