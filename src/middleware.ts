// src/middleware.ts
import { withAuth } from 'next-auth/middleware';

export default withAuth(
  function middleware(req) {
    // This function runs only if user is authenticated
    console.log('Authenticated user accessing:', req.nextUrl.pathname);
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
        
        // For protected routes (like dashboard), require authentication
        return !!token;
      },
    },
  }
);

export const config = {
  // Only protect dashboard routes specifically
  matcher: [
    '/dashboard/:path*'
  ],
};