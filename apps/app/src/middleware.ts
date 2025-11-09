import { createI18nMiddleware } from "next-international/middleware";
import { type NextRequest, NextResponse } from "next/server";

const I18nMiddleware = createI18nMiddleware({
  locales: ["en", "fr"],
  defaultLocale: "en",
  urlMappingStrategy: "rewrite",
});

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot)$/i)
  ) {
    return NextResponse.next();
  }

  // Handle root and locale-only paths - redirect to dashboard
  if (pathname === "/" || pathname === "/en" || pathname === "/fr") {
    const url = request.nextUrl.clone();
    url.pathname = "/en/dashboard";
    return NextResponse.redirect(url);
  }

  // Redirect /dashboard to /en/dashboard
  if (pathname === "/dashboard") {
    const url = request.nextUrl.clone();
    url.pathname = "/en/dashboard";
    return NextResponse.redirect(url);
  }

  // Let i18n middleware handle the rest
  return I18nMiddleware(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - files with extensions (images, fonts, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
