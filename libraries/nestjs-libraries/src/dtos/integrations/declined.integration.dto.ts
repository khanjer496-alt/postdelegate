import { IsDefined, IsString, MaxLength } from 'class-validator';

// A connect the network sent back without a code (the person cancelled)
export class DeclinedIntegrationDto {
  @IsString()
  @IsDefined()
  @MaxLength(512)
  state: string;
}
