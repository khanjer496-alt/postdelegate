import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const ADMIN_USER_FILTERS = [
  'all',
  'trialing',
  'paying',
  'cancelling',
  'no_plan',
  'needs_attention',
] as const;

export type AdminUserFilter = (typeof ADMIN_USER_FILTERS)[number];

// The users list of the admin pages: a search, a plan filter and a page
export class AdminUsersListDto {
  // name, email, workspace name, or an exact user, workspace, Stripe
  // customer or subscription id
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(ADMIN_USER_FILTERS)
  filter?: AdminUserFilter;

  // starts at 1
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
