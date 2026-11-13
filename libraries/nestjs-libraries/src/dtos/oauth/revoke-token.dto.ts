import { IsIn, IsOptional, IsString } from 'class-validator';

// RFC 7009 token revocation request (application/x-www-form-urlencoded or JSON)
export class RevokeTokenDto {
  @IsString()
  @IsOptional()
  token?: string;

  @IsString()
  @IsOptional()
  @IsIn(['access_token', 'refresh_token'])
  token_type_hint?: string;

  // client_secret_basic clients send these in the Authorization header
  @IsString()
  @IsOptional()
  client_id?: string;

  @IsString()
  @IsOptional()
  client_secret?: string;
}
