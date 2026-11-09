import { IsDefined, IsString, Matches } from 'class-validator';
export class ProviderProofStatusDto {
  @IsDefined()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  state: string;
}
