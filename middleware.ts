import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { inspectRequest, applySecurityHeaders } from '@/lib/security/wafEngine';

const locales = ['en', 'zh-CN', 'hi', 'es', 'ar', 'fr', 'bn', 'pt', 'ru', 'id', 'ur', 'de'];
const defaultLocale = 'ar';

export function middleware(request: NextRequest) {
  // 1. SoufShield WAF Perimeter Deep Inspection (Inspects all requests including /api)
  const wafResult = inspectRequest(request);
  if (!wafResult.allowed && wafResult.response) {
    return applySecurityHeaders(wafResult.response);
  }

  const { pathname } = request.nextUrl;

  // 2. Pass-through API routes and internal Next assets with security headers
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return applySecurityHeaders(NextResponse.next());
  }

  // 3. Locale Resolution & Redirects for UI Pages
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Detect preferred locale from cookie 'souftools_locale' or Accept-Language
  let targetLocale = defaultLocale;
  const cookieLocale = request.cookies.get('souftools_locale')?.value;
  
  if (cookieLocale && locales.includes(cookieLocale)) {
    targetLocale = cookieLocale;
  } else {
    const acceptLang = request.headers.get('accept-language');
    if (acceptLang) {
      for (const loc of locales) {
        if (acceptLang.toLowerCase().includes(loc.toLowerCase())) {
          targetLocale = loc;
          break;
        }
      }
    }
  }

  // If on root '/', allow Next.js app/page.tsx to render directly or rewrite
  if (pathname === '/' || pathname === '') {
    if (targetLocale === defaultLocale) {
      return applySecurityHeaders(NextResponse.next());
    }
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/${targetLocale}`;
    return applySecurityHeaders(NextResponse.rewrite(rewriteUrl));
  }

  // For other non-localized paths, redirect safely preserving request origin
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = `/${targetLocale}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  return applySecurityHeaders(NextResponse.redirect(redirectUrl));
}

export const config = {
  matcher: [
    // Intercept all routes including /api, excluding only Next.js static bundles and images
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
