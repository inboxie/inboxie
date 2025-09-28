import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  const headers = {
    'Access-Control-Allow-Origin': 'https://mail.google.com',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true'
  };

  try {
    console.log('Session check called from extension');
    const session = await getServerSession(authOptions);
    console.log('Session found:', !!session?.user?.email);
    
    if (session?.user?.email) {
      return NextResponse.json({
        success: true,
        authenticated: true
      }, { headers });
    } else {
      return NextResponse.json({
        success: false,
        authenticated: false
      }, { status: 401, headers });
    }
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({
      success: false,
      authenticated: false
    }, { status: 500, headers });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': 'https://mail.google.com',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}