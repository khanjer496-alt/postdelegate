import { ArrayMaxSize, IsArray, IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
export class CreateAgentCredentialDto {
  @IsString() @MaxLength(80) name: string;
  @IsOptional() @IsIn(['ANALYST', 'DRAFT_ONLY', 'PUBLISHER']) role?: 'ANALYST' | 'DRAFT_ONLY' | 'PUBLISHER';
  @IsOptional() @IsIn(['DEFAULT', 'CUSTOM', 'NEVER']) expiry?: 'DEFAULT' | 'CUSTOM' | 'NEVER';
  @IsOptional() @IsISO8601() expiresAt?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(200) @IsString({ each: true }) channelIds?: string[];
}
