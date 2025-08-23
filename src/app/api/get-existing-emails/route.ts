// Create: src/app/api/get-existing-emails/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { 
  getOrCreateUser, 
  getProcessedEmails
} from '@/lib/supabase';
import { APIResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    console.log('📚 Loading existing processed emails...');

    // Get the authenticated session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      } as APIResponse, { status: 401 });
    }

    // Get request data
    const body = await request.json();
    const { limit = 50, offset = 0 } = body;
    const userEmail = session.user.email;

    console.log(`📧 Loading existing emails for user: ${userEmail}`);

    // Get user
    const user = await getOrCreateUser(userEmail);
    
    // Load existing processed emails
    const existingEmails = await getProcessedEmails(user.id, limit, offset);
    
    console.log(`✅ Loaded ${existingEmails.length} existing emails`);

    return NextResponse.json({
      success: true,
      message: `Loaded ${existingEmails.length} existing emails`,
      data: {
        emails: existingEmails,
        count: existingEmails.length,
        limit,
        offset
      }
    } as APIResponse);

  } catch (error) {
    console.error('❌ Error loading existing emails:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to load existing emails',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    } as APIResponse, { status: 500 });
  }
}