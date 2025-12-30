import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, refreshToken } = await request.json();

    const cookieStore = await cookies();

    if (accessToken) {
      // Store tokens in cookies so Server Components can access them
      cookieStore.set('sb-access-token', accessToken, {
        maxAge: 60 * 60, // 1 hour
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }

    if (refreshToken) {
      cookieStore.set('sb-refresh-token', refreshToken, {
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: '/',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[/api/auth/sync] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync tokens' },
      { status: 500 }
    );
  }
}
