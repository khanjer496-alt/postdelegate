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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  StudioPosition,
  StudioTextStyle,
  studioPositions,
  studioTextStyles,
} from '@gitroom/nestjs-libraries/dtos/studio/studio.clip.dto';
import { StudioMediaDto } from '@gitroom/nestjs-libraries/dtos/studio/studio.media.dto';
import { StudioMusicDto } from '@gitroom/nestjs-libraries/dtos/studio/studio.music.dto';

// The xfade transitions offered between two slides, "none" cuts
export const studioTransitions = [
  'fade',
  'slideleft',
  'wipeleft',
  'smoothleft',
  'circleopen',
  'none',
] as const;
export type StudioTransition = (typeof studioTransitions)[number];
export const STUDIO_MIN_SLIDES = 2;
export const STUDIO_MAX_SLIDES = 10;
export const STUDIO_SLIDE_MIN_SECONDS = 1.5;
export const STUDIO_SLIDE_MAX_SECONDS = 5;

export class StudioSlideDto extends StudioMediaDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  text?: string;

  @IsDefined()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(STUDIO_SLIDE_MIN_SECONDS)
  @Max(STUDIO_SLIDE_MAX_SECONDS)
  seconds: number;
}

// "Image slideshow": pictures one after the other, each slowly panning, with
// a line of text each and a transition between them
export class ImageSlideshowDto {
  @IsDefined()
  @IsArray()
  @ArrayMinSize(STUDIO_MIN_SLIDES)
  @ArrayMaxSize(STUDIO_MAX_SLIDES)
  @Type(() => StudioSlideDto)
  @ValidateNested({ each: true })
  slides: StudioSlideDto[];

  @IsOptional()
  @IsIn(studioTransitions)
  transition?: StudioTransition;

  // the slow pan across each picture, on unless switched off
  @IsOptional()
  @IsBoolean()
  pan?: boolean;

  @IsOptional()
  @IsIn(studioTextStyles)
  style?: StudioTextStyle;

  @IsOptional()
  @IsIn(studioPositions)
  position?: StudioPosition;

  @IsOptional()
  @Type(() => StudioMusicDto)
  @ValidateNested()
  music?: StudioMusicDto;
}
