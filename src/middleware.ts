import createIntlMiddleware from "next-intl/middleware";
import { auth } from "@/auth";
import { routing } from "./i18n/navigation";
import { NextResponse } from "next/server";

const intlMiddleware = createIntlMiddleware(routing);

const publicPaths = ["/login", "/register", "/api/auth"];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some(
    (path) =>
      pathname === path ||
      pathname.startsWith(path + "/") ||
      !!pathname.match(
        new RegExp(`^/[a-z]{2}(-[A-Z]{2})?${path.replace("/", "\\/")}(/|$)`)
      )
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Skip auth check for public paths
  if (isPublicPath(pathname)) {
    return intlMiddleware(req);
  }

  // Check auth for all other paths
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api/auth|_next|_vercel|.*\\..*).*)"],
};
