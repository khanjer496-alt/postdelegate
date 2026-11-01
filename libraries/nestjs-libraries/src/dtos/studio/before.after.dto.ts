import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  STUDIO_MAX_SOURCE_SECONDS,
  StudioTextStyle,
  studioTextStyles,
} from '@gitroom/nestjs-libraries/dtos/studio/studio.clip.dto';
import { StudioMediaDto } from '@gitroom/nestjs-libraries/dtos/studio/studio.media.dto';
import { StudioMusicDto } from '@gitroom/nestjs-libraries/dtos/studio/studio.music.dto';

export const STUDIO_COMPARE_MIN_SECONDS = 2;
export const STUDIO_COMPARE_MAX_SECONDS = 30;

export class StudioCompareSideDto extends StudioMediaDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  label?: string;

  // where a video starts, in seconds
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(STUDIO_MAX_SOURCE_SECONDS)
  start?: number;
}

// "Before/after": two pictures or videos, one above the other or the second
// wiping over the first, each with its label
export class BeforeAfterDto {
  @IsDefined()
  @Type(() => StudioCompareSideDto)
  @ValidateNested()
  before: StudioCompareSideDto;

  @IsDefined()
  @Type(() => StudioCompareSideDto)
  @ValidateNested()
  after: StudioCompareSideDto;

  // "stack" puts them one above the other, "wipe" reveals the second over
  // the first half way through
  @IsOptional()
  @IsIn(['stack', 'wipe'])
  layout?: 'stack' | 'wipe';

  @IsDefined()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(STUDIO_COMPARE_MIN_SECONDS)
  @Max(STUDIO_COMPARE_MAX_SECONDS)
  seconds: number;

  @IsOptional()
  @IsIn(studioTextStyles)
  style?: StudioTextStyle;

  // the sound of the first video that has one, unless muted
  @IsOptional()
  @IsBoolean()
  mute?: boolean;

  @IsOptional()
  @Type(() => StudioMusicDto)
  @ValidateNested()
  music?: StudioMusicDto;
}
