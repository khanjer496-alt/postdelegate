import { AnalyticsReportFrequency } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class AnalyticsReportSettingsDto {
  @IsEnum(AnalyticsReportFrequency)
  frequency: AnalyticsReportFrequency;

  // user ids, only active members of the workspace are kept
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  recipients: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brandName?: string | null;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2048)
  logoUrl?: string | null;

  // report template (PD_FF_REPORT_TEMPLATES); left out keeps the saved value
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  brandColor?: string | null;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  accentColor?: string | null;

  @IsOptional()
  @IsIn(['classic', 'bold', 'minimal'])
  template?: string | null;
}

export class AnalyticsReportDataDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;

  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
