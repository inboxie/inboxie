import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    // Create response
    const response = NextResponse.next();
    
    // Add CORS headers for API routes accessed by Chrome extension
    if (req.nextUrl.pathname.startsWith('/api/')) {
      response.headers.set('Access-Control-Allow-Origin', 'https://mail.google.com');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Google-Token');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      
      // Handle preflight OPTIONS requests
      if (req.method === 'OPTIONS') {
        return new Response(null, { 
          status: 200, 
          headers: {
            'Access-Control-Allow-Origin': 'https://mail.google.com',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Google-Token',
            'Access-Control-Allow-Credentials': 'true'
          }
        });
      }
    }
    
    console.log('Authenticated user accessing:', req.nextUrl.pathname);
    return response;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to public routes without authentication
        if (req.nextUrl.pathname === '/' ||
            req.nextUrl.pathname.startsWith('/login') || 
            req.nextUrl.pathname.startsWith('/api/auth') ||
            req.nextUrl.pathname.startsWith('/api/waitlist')) {
          return true;
        }
        
        // Allow specific extension endpoints from Gmail to pass through
        if (req.nextUrl.pathname === '/api/extension/auth' || 
            (req.nextUrl.pathname === '/api/extension/validate' ||
             req.nextUrl.pathname === '/api/extension/session-check' ||
             req.nextUrl.pathname === '/api/get-user-stats' ||
             req.nextUrl.pathname === '/api/process-emails-fast')) {
          return true;
        }
        
        // For protected routes (like dashboard), require authentication
        return !!token;
      },
    },
  }
);

export const config = {
  // Protect dashboard routes and add CORS to API routes
  matcher: [
    '/dashboard/:path*',
    '/api/:path*'
  ],
};