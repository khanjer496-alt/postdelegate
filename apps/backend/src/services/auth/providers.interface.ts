import { Injectable } from '@nestjs/common';

export interface AuthProviderContext {
  state?: string;
  browserNonce?: string;
  purpose?: 'login' | 'register';
}
export interface AuthProviderUser {
  email: string;
  id: string;
  // Optional one-use continuation, never persisted as user identity.
  registrationToken?: string;
}

export abstract class AuthProviderAbstract {
  // Such providers validate a private cookie binding in their proof store.
  readonly requiresBrowserContext: boolean = false;
  abstract generateLink(query?: any): Promise<string> | string;
  abstract getToken(
    code: string,
    redirectUri?: string,
    context?: AuthProviderContext
  ): Promise<string>;
  abstract getUser(
    providerToken: string,
    context?: AuthProviderContext
  ): Promise<AuthProviderUser> | false;
  async postRegistration(providerToken: string, orgId: string): Promise<void> {}
}

export interface AuthProviderParams {
  provider: string;
}

export function AuthProvider(params: AuthProviderParams) {
  return function (target: any) {
    Injectable()(target);

    const existingMetadata =
      Reflect.getMetadata('auth-provider', AuthProviderAbstract) || [];

    existingMetadata.push({ target, provider: params.provider });

    Reflect.defineMetadata(
      'auth-provider',
      existingMetadata,
      AuthProviderAbstract
    );
  };
}
