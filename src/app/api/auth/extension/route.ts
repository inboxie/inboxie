// src/app/api/auth/extension/route.ts - Chrome Extension Authentication
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/supabase';

// CORS headers for extension requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true'
};

/**
 * Validate Gmail token with Google and get user profile
 */
async function validateGmailTokenAndGetProfile(token: string): Promise<{
  isValid: boolean;
  email: string;
  name: string;
  picture: string;
  error?: string;
}> {
  try {
    // Validate token with Google
    const tokenResponse = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
    
    if (!tokenResponse.ok) {
      return { isValid: false, email: '', name: '', picture: '', error: 'Invalid token' };
    }

    const tokenInfo = await tokenResponse.json();

    // Check if token has required scopes
    const requiredScopes = [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels'
    ];

    const hasRequiredScopes = requiredScopes.every(scope => 
      tokenInfo.scope && tokenInfo.scope.includes(scope)
    );

    if (!hasRequiredScopes) {
      return { 
        isValid: false, 
        email: '', 
        name: '', 
        picture: '', 
        error: 'Insufficient permissions. Please grant Gmail access.' 
      };
    }

    // Get user profile
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!profileResponse.ok) {
      return { isValid: false, email: '', name: '', picture: '', error: 'Failed to get user profile' };
    }

    const profile = await profileResponse.json();

    return {
      isValid: true,
      email: profile.email,
      name: profile.name || '',
      picture: profile.picture || '',
    };

  } catch (error) {
    console.error('Token validation failed:', error);
    return { 
      isValid: false, 
      email: '', 
      name: '', 
      picture: '', 
      error: error instanceof Error ? error.message : 'Validation failed' 
    };
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders
  });
}

/**
 * Authenticate extension user with Gmail token
 */
export async function POST(request: NextRequest) {
  try {
    console.log('📱 EXTENSION AUTH: Processing authentication request...');

    // Get Gmail token from request BODY
    const body = await request.json();
    const gmailToken = body.googleToken;
    
    if (!gmailToken) {
      return NextResponse.json({
        success: false,
        error: 'Gmail token required'
      }, { status: 400, headers: corsHeaders });
    }

    // Validate token and get user profile
    const validation = await validateGmailTokenAndGetProfile(gmailToken);

    if (!validation.isValid) {
      console.log('❌ Token validation failed:', validation.error);
      return NextResponse.json({
        success: false,
        error: validation.error || 'Invalid Gmail token'
      }, { status: 401, headers: corsHeaders });
    }

    console.log(`✅ Token validated for user: ${validation.email}`);

    // Get or create user in Supabase
    const user = await getOrCreateUser(validation.email);
    console.log(`👤 User ready: ${user.email} (${user.plan_type})`);

    // Return user session data
    return NextResponse.json({
      success: true,
      message: 'Authentication successful',
      user: {
        id: user.id,
        email: user.email,
        name: validation.name,
        picture: validation.picture,
        planType: user.plan_type,
        emailsProcessed: user.emails_processed,
        createdAt: user.created_at,
        isNewUser: user.created_at === user.updated_at
      },
      authMethod: 'chrome-extension'
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Extension authentication failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500, headers: corsHeaders });
  }
}

/**
 * Get current user info (for checking auth status)
 */
export async function GET(request: NextRequest) {
  try {
    // Get Gmail token from request header for GET requests
    const gmailToken = request.headers.get('x-gmail-token');
    
    if (!gmailToken) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated'
      }, { status: 401, headers: corsHeaders });
    }

    // Validate token and get user profile
    const validation = await validateGmailTokenAndGetProfile(gmailToken);

    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid or expired token'
      }, { status: 401, headers: corsHeaders });
    }

    // Get user from Supabase
    const user = await getOrCreateUser(validation.email);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: validation.name,
        picture: validation.picture,
        planType: user.plan_type,
        emailsProcessed: user.emails_processed,
      },
      authMethod: 'chrome-extension'
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Get user info failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get user info'
    }, { status: 500, headers: corsHeaders });
  }
}