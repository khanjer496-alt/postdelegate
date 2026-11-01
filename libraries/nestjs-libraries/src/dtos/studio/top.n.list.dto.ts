import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  STUDIO_MAX_SECONDS,
  StudioTextStyle,
  StudioTrimDto,
  studioTextStyles,
} from '@gitroom/nestjs-libraries/dtos/studio/studio.clip.dto';
import { StudioMediaDto } from '@gitroom/nestjs-libraries/dtos/studio/studio.media.dto';
import { StudioMusicDto } from '@gitroom/nestjs-libraries/dtos/studio/studio.music.dto';

export const STUDIO_MIN_LIST_ITEMS = 3;
export const STUDIO_MAX_LIST_ITEMS = 7;
// how long a picture of the list stays when nothing is picked
export const STUDIO_LIST_ITEM_SECONDS = 3;

export class StudioListItemDto extends StudioMediaDto {
  @IsDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label: string;

  // the part of a video that plays
  @IsOptional()
  @Type(() => StudioTrimDto)
  @ValidateNested()
  trim?: StudioTrimDto;

  // how long a picture stays, or a video without a trim
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(1)
  @Max(STUDIO_MAX_SECONDS)
  seconds?: number;
}

// "Top-N list": a title over 3 to 7 pictures or clips one after the other,
// each numbered with its label
export class TopNListDto {
  @IsDefined()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title: string;

  @IsDefined()
  @IsArray()
  @ArrayMinSize(STUDIO_MIN_LIST_ITEMS)
  @ArrayMaxSize(STUDIO_MAX_LIST_ITEMS)
  @Type(() => StudioListItemDto)
  @ValidateNested({ each: true })
  items: StudioListItemDto[];

  // numbers counting down to #1 (the default) or up from #1
  @IsOptional()
  @IsBoolean()
  countdown?: boolean;

  @IsOptional()
  @IsIn(studioTextStyles)
  style?: StudioTextStyle;

  // the sound of the clips, unless muted
  @IsOptional()
  @IsBoolean()
  mute?: boolean;

  @IsOptional()
  @Type(() => StudioMusicDto)
  @ValidateNested()
  music?: StudioMusicDto;
}
