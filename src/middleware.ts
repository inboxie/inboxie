import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Handle CORS for Chrome extension API calls
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin') || '';
    
    // Allow both Gmail and Chrome extension origins
    const allowedOrigins = [
      'https://mail.google.com',
    ];
    const isChromeExtension = origin.startsWith('chrome-extension://');
    const isAllowed = allowedOrigins.includes(origin) || isChromeExtension;
    
    // Handle preflight OPTIONS requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': isAllowed ? origin : 'https://mail.google.com',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Gmail-Token, Authorization',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Add CORS headers to all API responses
    const response = NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', isAllowed ? origin : 'https://mail.google.com');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Gmail-Token, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};