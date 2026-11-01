import {
  IsDefined,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { STUDIO_MAX_SOURCE_SECONDS } from '@gitroom/nestjs-libraries/dtos/studio/studio.clip.dto';

// Music the workspace uploaded with POST /studio/assets. Only the id is read
// by the render, which finds the file of the asset in our own storage
export const STUDIO_MUSIC_MAX_BYTES = 30 * 1024 * 1024;
// how loud the music sits under the sound of the clip when nothing is picked
export const STUDIO_MUSIC_VOLUME = 0.25;

export class StudioMusicDto {
  @IsDefined()
  @IsUUID()
  assetId: string;

  // what the editor shows and plays; never read by the render
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  path?: string;

  // where the track starts, in seconds
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(STUDIO_MAX_SOURCE_SECONDS)
  start?: number;

  // the level of the music under the sound of the clip, 0 to 1. Music on its
  // own is brought to the same loudness as every other video
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  volume?: number;
}
