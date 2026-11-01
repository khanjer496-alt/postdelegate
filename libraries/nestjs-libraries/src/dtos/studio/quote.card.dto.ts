import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  STUDIO_MAX_SOURCE_SECONDS,
  StudioFocusDto,
  StudioTextStyle,
  studioTextStyles,
} from '@gitroom/nestjs-libraries/dtos/studio/studio.clip.dto';
import { StudioMusicDto } from '@gitroom/nestjs-libraries/dtos/studio/studio.music.dto';

export const STUDIO_QUOTE_MIN_SECONDS = 5;
export const STUDIO_QUOTE_MAX_SECONDS = 15;
export const STUDIO_QUOTE_COLOR = '#111111';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// A plain colour, or a picture or video of the media library when a media
// is picked
export class StudioBackgroundDto {
  @IsOptional()
  @Matches(HEX_COLOR)
  color?: string;

  @IsOptional()
  @IsUUID()
  mediaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  path?: string;

  @IsOptional()
  @Type(() => StudioFocusDto)
  @ValidateNested()
  focus?: StudioFocusDto;

  // where a video starts, in seconds
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(STUDIO_MAX_SOURCE_SECONDS)
  start?: number;
}

// "Quote card": a quote appearing word by word with its author, over a
// colour, a picture or a video
export class QuoteCardDto {
  @IsDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  quote: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  author?: string;

  @IsDefined()
  @Type(() => StudioBackgroundDto)
  @ValidateNested()
  background: StudioBackgroundDto;

  @IsDefined()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(STUDIO_QUOTE_MIN_SECONDS)
  @Max(STUDIO_QUOTE_MAX_SECONDS)
  seconds: number;

  @IsOptional()
  @IsIn(studioTextStyles)
  style?: StudioTextStyle;

  @IsOptional()
  @Matches(HEX_COLOR)
  textColor?: string;

  // darkens a picture or video so the text stays readable, on by default
  @IsOptional()
  @IsBoolean()
  dim?: boolean;

  @IsOptional()
  @Type(() => StudioMusicDto)
  @ValidateNested()
  music?: StudioMusicDto;
}
