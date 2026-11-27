import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

// the admin Users page: a page of 50, newest first, filtered by email or
// workspace name
export class AdminUsersDto {
  // zero based, like the admin errors list
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  page?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
