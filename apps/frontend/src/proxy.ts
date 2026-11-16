import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCookieUrlFromDomain } from '@gitroom/helpers/subdomain/subdomain.management';
import { internalFetch } from '@gitroom/helpers/utils/internal.fetch';
import acceptLanguage from 'accept-language';
import {
  cookieName,
  headerName,
  languages,
  normalizeLanguage,
} from '@gitroom/react/translation/i18n.config';
import {
  normalizeUiFlagMode,
  UI_FLAG_COOKIE,
  UI_FLAG_COOKIE_MAX_AGE,
  UI_FLAG_ENV,
  UI_FLAG_QUERY,
} from '@gitroom/frontend/components/new-layout/v2/ui.flag';
import {
  FEATURE_COOKIE,
  FEATURE_QUERY,
  nextFeatureCookie,
} from '@gitroom/frontend/components/features/feature.flags';
acceptLanguage.languages(languages);

// This function can be marked `async` if using `await` inside
export async function proxy(request: NextRequest) {
  const nextUrl = request.nextUrl;
  const authCookie =
    request.cookies.get('auth') ||
    request.headers.get('auth') ||
    nextUrl.searchParams.get('loggedAuth');
  const savedLanguage = request.cookies.get(cookieName)?.value;
  const lng = normalizeLanguage(
    savedLanguage ||
      acceptLanguage.get(
        request.headers.get('Accept-Language') ||
          request.headers.get('accept-language')
      )
  );

  const requestHeaders = new Headers(request.headers);
  if (lng) {
    requestHeaders.set(headerName, lng);
  }

  const topResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (lng) {
    topResponse.headers.set(cookieName, lng);
  }
  if (savedLanguage && savedLanguage !== lng) {
    topResponse.cookies.set(cookieName, lng, { path: '/' });
  }

  if (nextUrl.pathname.startsWith('/modal/') && !authCookie) {
    return NextResponse.redirect(new URL(`/auth/login-required`, nextUrl.href));
  }

  if (
    nextUrl.pathname.startsWith('/uploads/') ||
    nextUrl.pathname.startsWith('/p/') ||
    // client approval links are opened without an account
    nextUrl.pathname.startsWith('/approve/') ||
    nextUrl.pathname.startsWith('/provider/') ||
    nextUrl.pathname.startsWith('/icons/') ||
    // the consent screen of MCP / OAuth clients handles signed-out visitors
    // itself (sign in and come back, or connect a self-hosted instance)
    nextUrl.pathname.startsWith('/oauth/authorize')
  ) {
    return topResponse;
  }

  if (
    nextUrl.pathname.startsWith('/integrations/social/') &&
    nextUrl.href.indexOf('state=login') === -1
  ) {
    return topResponse;
  }

  // If the URL is logout, delete the cookie and redirect to login
  if (nextUrl.href.indexOf('/auth/logout') > -1) {
    const response = NextResponse.redirect(
      new URL('/auth/login', nextUrl.href)
    );
    response.cookies.set('auth', '', {
      path: '/',
      ...(!process.env.NOT_SECURED
        ? {
            secure: true,
            httpOnly: true,
            sameSite: false,
          }
        : {}),
      maxAge: -1,
      domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
    });
    return response;
  }

  if (
    nextUrl.pathname.startsWith('/auth/register') &&
    process.env.DISABLE_REGISTRATION === 'true'
  ) {
    return NextResponse.redirect(new URL('/auth/login', nextUrl.href));
  }

  const org = nextUrl.searchParams.get('org');
  const url = new URL(nextUrl).search;
  if (!nextUrl.pathname.startsWith('/auth') && !authCookie) {
    // only a sign-in provider's callback carries a code, any other page
    // (a link from an email) is signed in to first, then opened
    const providers = ['google', 'settings'];
    const findIndex = nextUrl.searchParams.get('code')
      ? providers.find((p) => nextUrl.href.indexOf(p) > -1)
      : undefined;
    if (!findIndex && !org && nextUrl.pathname !== '/') {
      // a provider callback without a code (a cancelled sign-in) is not a
      // page to come back to
      return NextResponse.redirect(
        new URL(
          nextUrl.pathname.startsWith('/integrations/social/')
            ? '/auth/login'
            : `/auth/login?returnUrl=${encodeURIComponent(
                `${nextUrl.pathname}${url}`
              )}`,
          nextUrl.href
        )
      );
    }
    const additional = !findIndex
      ? ''
      : (url.indexOf('?') > -1 ? '&' : '?') +
        `provider=${(findIndex === 'settings'
          ? process.env.POSTIZ_GENERIC_OAUTH
            ? 'generic'
            : 'github'
          : findIndex
        ).toUpperCase()}`;
    return NextResponse.redirect(
      new URL(`/auth${url}${additional}`, nextUrl.href)
    );
  }

  // An emailed one-time link (activate the account, reset the password) is
  // opened by whoever holds it, whatever cookie the browser already has. This
  // check only sees that an auth cookie exists, not that it is valid, so a
  // stale or other account's cookie used to send the visitor to the app before
  // the link was ever used: the account stayed inactive on the first click
  // and the app's 401 cleared the cookie, which is why the second click worked.
  if (
    authCookie &&
    /^\/auth\/(activate|forgot)\/[^/]+\/?$/.test(nextUrl.pathname)
  ) {
    return topResponse;
  }

  // If the url is /auth and the cookie exists, redirect to /
  if (nextUrl.pathname.startsWith('/auth') && authCookie) {
    return NextResponse.redirect(new URL(`/${url}`, nextUrl.href));
  }
  if (nextUrl.pathname.startsWith('/auth') && !authCookie) {
    if (org) {
      const redirect = NextResponse.redirect(new URL(`/`, nextUrl.href));
      redirect.cookies.set('org', org, {
        ...(!process.env.NOT_SECURED
          ? {
              path: '/',
              secure: true,
              httpOnly: true,
              sameSite: false,
              domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
            }
          : {}),
        expires: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      });
      return redirect;
    }
    return topResponse;
  }
  try {
    if (org) {
      const { id, error } = await (
        await internalFetch('/user/join-org', {
          body: JSON.stringify({
            org,
          }),
          method: 'POST',
        })
      ).json();
      const redirect = NextResponse.redirect(
        new URL(`/?added=true`, nextUrl.href)
      );
      // the invite is spent by this attempt, whatever the outcome
      redirect.cookies.set('org', '', {
        path: '/',
        ...(!process.env.NOT_SECURED
          ? { domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!) }
          : {}),
        maxAge: 0,
      });
      // the app says why the invite could not be accepted
      if (error && error !== 'already_member') {
        redirect.cookies.set('invite_error', error, {
          path: '/',
          domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
          maxAge: 60 * 5,
        });
      }
      if (id) {
        redirect.cookies.set('showorg', id, {
          ...(!process.env.NOT_SECURED
            ? {
                path: '/',
                secure: true,
                httpOnly: true,
                sameSite: false,
                domain: getCookieUrlFromDomain(process.env.FRONTEND_URL!),
              }
            : {}),
          expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        });
      }
      return redirect;
    }
    // ?pd_ui=v2 (or v1) chooses the layout. The cookie is set here, on a
    // redirect that drops the param, so the request that follows already
    // carries it and the server renders the chosen shell. Set client-side, it
    // landed after the server render: the switch showed one load late, and the
    // client swap of the shell could leave a blank first load.
    const uiLayout = nextUrl.searchParams.get(UI_FLAG_QUERY);
    if (
      (uiLayout === 'v1' || uiLayout === 'v2') &&
      normalizeUiFlagMode(process.env[UI_FLAG_ENV]) !== 'off'
    ) {
      const target = new URL(nextUrl.href);
      target.searchParams.delete(UI_FLAG_QUERY);
      const redirect = NextResponse.redirect(target);
      // readable and host-only like the in-app switch, which rewrites it
      redirect.cookies.set(UI_FLAG_COOKIE, uiLayout, {
        path: '/',
        maxAge: UI_FLAG_COOKIE_MAX_AGE,
        sameSite: 'lax',
      });
      return redirect;
    }
    // ?pd_ff=<key> opts this browser into a parity feature whose flag is
    // optin (?pd_ff=off clears them), the same redirect way as ?pd_ui
    const featureQuery = nextUrl.searchParams.get(FEATURE_QUERY);
    if (featureQuery !== null) {
      const target = new URL(nextUrl.href);
      target.searchParams.delete(FEATURE_QUERY);
      const redirect = NextResponse.redirect(target);
      redirect.cookies.set(
        FEATURE_COOKIE,
        nextFeatureCookie(request.cookies.get(FEATURE_COOKIE)?.value, featureQuery),
        { path: '/', maxAge: UI_FLAG_COOKIE_MAX_AGE, sameSite: 'lax' }
      );
      return redirect;
    }
    if (nextUrl.pathname === '/') {
      return NextResponse.redirect(
        new URL(
          !!process.env.IS_GENERAL ? '/launches' : `/analytics`,
          nextUrl.href
        )
      );
    }

    return topResponse;
  } catch (err) {
    console.log('err', err);
    return NextResponse.redirect(new URL('/auth/logout', nextUrl.href));
  }
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: '/((?!api/|_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)',
};
