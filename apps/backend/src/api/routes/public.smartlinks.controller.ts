import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ThrottlerRealIpGuard } from '@gitroom/nestjs-libraries/throttler/throttler.provider';
import {
  smartLinksEnabled,
  SmartLinksService,
} from '@gitroom/nestjs-libraries/database/prisma/smartlinks/smartlinks.service';

const MINUTE = 60 * 1000;

// No account: the public link-in-bio page (PD_FF_SMARTLINKS) and its view
// and click counters, limited per visitor address. Nothing about the visitor
// is stored.
@ApiTags('Public')
@Controller('/public/smartlinks')
export class PublicSmartLinksController {
  constructor(private _smartLinksService: SmartLinksService) {}

  private check() {
    if (!smartLinksEnabled()) {
      throw new NotFoundException();
    }
  }

  @UseGuards(ThrottlerRealIpGuard)
  @Throttle({ default: { limit: 120, ttl: MINUTE } })
  @Header('Cache-Control', 'no-store')
  @Get('/:slug')
  page(@Param('slug') slug: string) {
    this.check();
    return this._smartLinksService.publicPage(slug);
  }

  @UseGuards(ThrottlerRealIpGuard)
  @Throttle({ default: { limit: 30, ttl: MINUTE } })
  @Header('Cache-Control', 'no-store')
  @Post('/:slug/view')
  view(@Param('slug') slug: string) {
    this.check();
    return this._smartLinksService.recordView(slug);
  }

  @UseGuards(ThrottlerRealIpGuard)
  @Throttle({ default: { limit: 60, ttl: MINUTE } })
  @Header('Cache-Control', 'no-store')
  @Post('/:slug/click/:item')
  click(@Param('slug') slug: string, @Param('item') item: string) {
    this.check();
    return this._smartLinksService.click(slug, item);
  }
}
