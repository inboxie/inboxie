import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-fallback-secret';

export async function POST(request: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': 'https://mail.google.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };

  try {
    const { googleToken, extensionId } = await request.json();

    if (!googleToken) {
      return NextResponse.json({
        success: false,
        error: 'No Google token provided'
      }, { status: 400, headers });
    }

    // Get real user info from Google using the OAuth token
    const userResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${googleToken}`);
    
    if (!userResponse.ok) {
      throw new Error('Failed to fetch user info from Google');
    }
    
    const userInfo = await userResponse.json();
    
    if (!userInfo.email) {
      throw new Error('Could not get user email from Google token');
    }

    console.log('Extension auth successful for user:', userInfo.email);
    
    const extensionToken = jwt.sign({
      userId: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      extensionId,
      type: 'extension',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
    }, JWT_SECRET);

    return NextResponse.json({
      success: true,
      token: extensionToken,
      user: {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        planType: 'free'
      }
    }, { headers });

  } catch (error) {
    console.error('Extension auth error:', error);
    return NextResponse.json({
      success: false,
      error: 'Authentication failed'
    }, { status: 500, headers });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': 'https://mail.google.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}