import { type NextRequest, NextResponse } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { getToken } from "next-auth/jwt";
import { routing } from "./i18n/navigation";

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

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return intlMiddleware(req);
  }

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: req.nextUrl.protocol === "https:",
  });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!api/auth|_next|_vercel|.*\\..*).*)"],
};
