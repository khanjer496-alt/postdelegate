import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import {
  SearchForwardResult,
  WebsiteStatsService,
} from '@gitroom/nestjs-libraries/services/website.stats.service';

@Injectable()
@Activity()
export class SearchConsoleForwardActivity {
  constructor(private _websiteStatsService: WebsiteStatsService) {}

  // takes a single object, so a field can be added later without a new
  // activity
  @ActivityMethod()
  async forwardSearchConsoleV1(
    _args: Record<string, never> = {}
  ): Promise<SearchForwardResult> {
    return this._websiteStatsService.forwardSearch();
  }
}
