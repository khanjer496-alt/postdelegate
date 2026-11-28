import { IsOptional, IsUUID } from 'class-validator';

export class AdminTrialsDto {
  // only this workspace's row, the link of an owner alert
  @IsOptional()
  @IsUUID()
  workspace?: string;
}
