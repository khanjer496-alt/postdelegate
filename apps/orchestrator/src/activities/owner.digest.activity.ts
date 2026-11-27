import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { OwnerAlertsService } from '@gitroom/nestjs-libraries/database/prisma/owner-alerts/owner.alerts.service';

@Injectable()
@Activity()
export class OwnerDigestActivity {
  constructor(private _ownerAlertsService: OwnerAlertsService) {}

  @ActivityMethod()
  async sendOwnerDigestV1(): Promise<{
    workspaces: number;
    sent: boolean;
  }> {
    return this._ownerAlertsService.sendDailyDigest();
  }
}
