import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class AiCredentialDto {
  @IsIn(['openai'])
  provider: 'openai';

  @IsString()
  @MinLength(20)
  @MaxLength(300)
  apiKey: string;
}
