/**
 * Auth Proxy Middleware (Server-side)
 * 
 * Manages protected routes and session persistence across the application.
 * Handles redirection logic for unauthenticated users and session synchronization
 * to avoid hydration flickering on sensitive pages.
 */

import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { env } from '@/env';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const isProtectedRoute = request.nextUrl.pathname.startsWith('/portfolio');
  const isLoginPage = request.nextUrl.pathname === '/login';

  let user = null;

  if (isProtectedRoute || isLoginPage) {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }

  if (isProtectedRoute && !user) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isLoginPage && user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets, icons, and specialized API routes.
     */
    '/((?!_next/static|_next/image|favicon.ico|icons|api).*)',
  ],
};
