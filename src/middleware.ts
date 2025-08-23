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
        // Allow access to login page and auth routes
        if (req.nextUrl.pathname.startsWith('/login') || 
            req.nextUrl.pathname.startsWith('/api/auth')) {
          return true;
        }
        
        // For all other routes, require authentication
        return !!token;
      },
    },
  }
);

export const config = {
  // Protect all routes except login and auth
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};