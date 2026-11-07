import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class BillingSubscribeDto {
  @IsIn(['MONTHLY', 'YEARLY'])
  period: 'MONTHLY' | 'YEARLY';

  @IsIn(['STANDARD', 'PRO', 'TEAM', 'ULTIMATE'])
  billing: 'STANDARD' | 'PRO' | 'TEAM' | 'ULTIMATE';

  // A buyer who wants to start paying today rather than take the 7 free days.
  // It can only ever remove a trial, never grant one: see allowTrialFor.
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  skipTrial?: boolean;

  utm: string;

  dub: string;

  datafast_session_id: string;
  datafast_visitor_id: string;

  // Facebook pixel cookies (_fbc / _fbp), saved on the subscription for the
  // trial and conversion events. A value that doesn't fit Stripe metadata
  // (500 chars) is dropped instead of failing the checkout.
  @Transform(({ value }) =>
    typeof value === 'string' && value.length <= 500 ? value : undefined
  )
  fbc: string;

  @Transform(({ value }) =>
    typeof value === 'string' && value.length <= 500 ? value : undefined
  )
  fbp: string;
}
