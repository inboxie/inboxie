// src/app/api/get-email-details/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { 
  getOrCreateUser, 
  getEmailWithDetails
} from '@/lib/supabase';
import { APIResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    console.log('📧 Fetching email details for reply...');

    // Get authenticated session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      } as APIResponse, { status: 401 });
    }

    const body = await request.json();
    const { emailId } = body;
    const userEmail = session.user.email;

    // Validate required fields
    if (!emailId) {
      return NextResponse.json({
        success: false,
        error: 'Missing emailId'
      } as APIResponse, { status: 400 });
    }

    // Get user and fetch email details
    console.log(`📧 Fetching email details: ${emailId} for user: ${userEmail}`);
    const user = await getOrCreateUser(userEmail);
    const emailDetails = await getEmailWithDetails(emailId, user.id);

    if (!emailDetails) {
      return NextResponse.json({
        success: false,
        error: 'Email not found or access denied'
      } as APIResponse, { status: 404 });
    }

    // Return email details
    return NextResponse.json({
      success: true,
      message: 'Email details retrieved successfully',
      data: {
        id: emailDetails.id,
        subject: emailDetails.subject,
        from: emailDetails.from,
        snippet: emailDetails.snippet,
        body: emailDetails.body, // This is the key - the full email body
        date: emailDetails.date,
        category: emailDetails.category,
        threadId: emailDetails.threadId,
        hasBody: !!emailDetails.body
      }
    } as APIResponse);

  } catch (error) {
    console.error('❌ Error fetching email details:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch email details',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    } as APIResponse, { status: 500 });
  }
}