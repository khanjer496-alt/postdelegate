import { IsOptional, IsString } from 'class-validator';

// RFC 7009 token revocation request (application/x-www-form-urlencoded or JSON)
export class RevokeTokenDto {
  @IsString()
  @IsOptional()
  token?: string;

  // only a hint (RFC 7009 §2.1): an unknown value is ignored, never a 400.
  // The token is looked up the same way whatever the hint says
  @IsString()
  @IsOptional()
  token_type_hint?: string;

  // client_secret_basic clients send these in the Authorization header
  @IsString()
  @IsOptional()
  client_id?: string;

  @IsString()
  @IsOptional()
  client_secret?: string;
}
