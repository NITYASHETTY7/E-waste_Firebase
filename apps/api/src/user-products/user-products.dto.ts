import {
  IsString,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserProductDto {
  @IsString()
  name: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  weightKg: number;

  @IsString()
  condition: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  askingPrice: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class SubmitQuoteDto {
  @IsNumber()
  @IsPositive()
  offeredPrice: number;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class AdminReviewDto {
  @IsString()
  action: 'approve' | 'reject';

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class UpdateUserProfileDto {
  @IsString()
  @IsOptional()
  dob?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  panNumber?: string;

  @IsString()
  @IsOptional()
  bankAccountHolder?: string;

  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  bankAccountNumber?: string;

  @IsString()
  @IsOptional()
  bankIfscCode?: string;

  @IsString()
  @IsOptional()
  bankAccountType?: string;
}
