import { BadRequestException, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { AuthProviderAbstract } from '@gitroom/backend/services/auth/providers.interface';

@Injectable()
export class AuthProviderManager {
  constructor(private _moduleRef: ModuleRef) {}

  getProvider(provider: string): AuthProviderAbstract {
    // Authentication is a separate opt-in from social channel credentials.
    const enableFlags: Partial<Record<string, string>> = {
      WALLET: 'WALLET_LOGIN_ENABLED',
      FARCASTER: 'FARCASTER_LOGIN_ENABLED',
    };
    const enableFlag = enableFlags[provider];
    if (enableFlag && process.env[enableFlag] !== 'true') {
      throw new BadRequestException('This sign-in method is disabled');
    }

    const metadata =
      Reflect.getMetadata('auth-provider', AuthProviderAbstract) || [];

    const found = metadata.find(
      (m: any) => m.provider === provider
    );

    if (!found) {
      throw new Error(`Auth provider ${provider} not found`);
    }

    return this._moduleRef.get(found.target, { strict: false });
  }
}
