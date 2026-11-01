import {
  IsDefined,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { StudioFocusDto } from '@gitroom/nestjs-libraries/dtos/studio/studio.clip.dto';

// A picture (png, jpg or webp) or a video of the media library, by id. The
// templates made of several of them build their items on it
export class StudioMediaDto {
  @IsDefined()
  @IsUUID()
  mediaId: string;

  // what the editor shows; the render never reads it, it finds the file of
  // the media id in our own storage
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  path?: string;

  // where the vertical frame sits on the picture, 0 to 1 on each axis
  @IsOptional()
  @Type(() => StudioFocusDto)
  @ValidateNested()
  focus?: StudioFocusDto;
}
