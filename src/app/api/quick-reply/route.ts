// src/app/api/quick-reply/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { createGmailDraft } from '@/lib/gmail';
import { createInlineQuoteReply } from '@/lib/openai';
import { 
  getOrCreateUser, 
  checkUserLimits,
  getEmailWithDetails
} from '@/lib/supabase';
import { APIResponse } from '@/types';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for database updates
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    console.log('✉️ Creating quick reply with inline quoting...');

    // Get authenticated session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !session.accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      } as APIResponse, { status: 401 });
    }

    // Get request data
    const body = await request.json();
    const { 
      emailId,        
      userResponse,   
      includeQuoting = true,
      // 🚀 NEW: AI tracking fields from InlineReplyModal
      usedAI = false,
      aiReplyMethod = 'manual'
    } = body;

    const userEmail = session.user.email; // Get from session

    // Validate required fields
    if (!emailId || !userResponse) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: emailId and userResponse'
      } as APIResponse, { status: 400 });
    }

    console.log(`🤖 AI Tracking Info: usedAI=${usedAI}, method=${aiReplyMethod}`);

    // Step 1: Get user and check limits
    console.log('👤 Checking user permissions...');
    const user = await getOrCreateUser(userEmail);
    const limits = await checkUserLimits(user.id);

    console.log(`✅ User ${limits.planType} plan verified`);

    // Step 2: Get full email details with body for proper quoting
    console.log('📧 Fetching full email details for quoting...');
    const originalEmail = await getEmailWithDetails(emailId, user.id);
    
    if (!originalEmail) {
      return NextResponse.json({
        success: false,
        error: 'Email not found or access denied'
      } as APIResponse, { status: 404 });
    }

    // Step 3: Create inline quote reply format
    console.log('📝 Formatting inline quote reply...');
    const formattedReply = includeQuoting 
      ? createInlineQuoteReply(originalEmail, userResponse)
      : userResponse;

    // Step 4: Extract recipient from original email
    const replyTo = originalEmail.from;
    const replySubject = originalEmail.subject.startsWith('Re:') 
      ? originalEmail.subject 
      : `Re: ${originalEmail.subject}`;

      console.log('🔍 Threading debug info:', {
        originalEmailId: originalEmail.id,
        originalEmailThreadId: originalEmail.threadId,
        threadIdType: typeof originalEmail.threadId,
        threadIdLength: originalEmail.threadId?.length
      });

      // Step 5: Create draft in Gmail with proper session and threading
console.log('📧 Creating Gmail draft with HTML and threading...');
const draftId = await createGmailDraft(
    session.accessToken as string,
    replyTo,
    replySubject,
    formattedReply,
    originalEmail.id,      // inReplyTo for threading
    originalEmail          // Pass full email for threading headers
);

    console.log(`✅ Successfully created Gmail draft: ${draftId}`);

    // 🚀 NEW: Step 6: Update database with AI reply tracking (if AI was used)
    if (usedAI) {
      try {
        console.log(`🤖 Updating email ${emailId} with AI reply tracking...`);
        
        const { error: updateError } = await supabase
          .from('email_cache')
          .update({
            ai_replied_at: new Date().toISOString(),
            ai_reply_method: aiReplyMethod,
            reply_status: 'draft_created',
            needs_reply: false // Mark as no longer needing reply since we replied
          })
          .eq('id', emailId)
          .eq('user_id', user.id); // 🚀 FIXED: Use user.id (UUID) instead of userEmail (string)

        if (updateError) {
          console.error('❌ Failed to update AI tracking:', updateError);
          // Don't fail the whole request - the draft was created successfully
        } else {
          console.log(`✅ AI reply tracking updated for email ${emailId}`);
        }
      } catch (trackingError) {
        console.error('❌ AI tracking error:', trackingError);
        // Don't fail the whole request - the draft was created successfully
      }
    } else {
      // Even for manual replies, update the reply status
      try {
        const { error: updateError } = await supabase
          .from('email_cache')
          .update({
            reply_status: 'draft_created',
            needs_reply: false
          })
          .eq('id', emailId)
          .eq('user_id', user.id); // 🚀 FIXED: Use user.id (UUID) instead of userEmail (string)

        if (updateError) {
          console.error('❌ Failed to update reply status:', updateError);
        } else {
          console.log(`✅ Reply status updated for email ${emailId}`);
        }
      } catch (updateError) {
        console.error('❌ Reply status update error:', updateError);
      }
    }

    // Step 7: Return success response
    return NextResponse.json({
      success: true,
      message: 'Quick reply draft created successfully',
      data: {
        draftId,
        replyTo,
        subject: replySubject,
        formattedReply,
        originalEmailId: originalEmail.id,
        originalEmailSubject: originalEmail.subject,
        originalEmailFrom: originalEmail.from,
        includeQuoting,
        hasFullEmailBody: !!originalEmail.body,
        // 🚀 NEW: Include AI tracking info in response
        aiTracking: {
          usedAI,
          aiReplyMethod,
          trackedInDatabase: usedAI
        }
      }
    } as APIResponse);

  } catch (error) {
    console.error('❌ Quick reply creation failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to create quick reply',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    } as APIResponse, { status: 500 });
  }
}

// GET endpoint to retrieve email details for reply - DEBUG VERSION
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    console.log('🔍 [0ms] Starting email details fetch...');
    
    // Get authenticated session
    const sessionStart = performance.now();
    const session = await getServerSession(authOptions);
    console.log(`🔍 [${Math.round(performance.now() - startTime)}ms] Session check completed`);
    
    if (!session?.user?.email) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      } as APIResponse, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const emailId = searchParams.get('emailId');

    if (!emailId) {
      return NextResponse.json({
        success: false,
        error: 'Missing emailId parameter'
      } as APIResponse, { status: 400 });
    }

    const userEmail = session.user.email;
    console.log(`🔍 [${Math.round(performance.now() - startTime)}ms] EmailId: ${emailId}, UserEmail: ${userEmail}`);

    // Get user
    const userStart = performance.now();
    const user = await getOrCreateUser(userEmail);
    console.log(`🔍 [${Math.round(performance.now() - startTime)}ms] User found/created (took ${Math.round(performance.now() - userStart)}ms)`);

    // Get email details
    const detailsStart = performance.now();
    const emailDetails = await getEmailWithDetails(emailId, user.id);
    const detailsTime = Math.round(performance.now() - detailsStart);
    
    console.log(`🔍 [${Math.round(performance.now() - startTime)}ms] getEmailWithDetails took ${detailsTime}ms`);
    console.log(`🔍 [${Math.round(performance.now() - startTime)}ms] Email details result:`, {
      found: !!emailDetails,
      id: emailDetails?.id,
      subject: emailDetails?.subject,
      bodyLength: emailDetails?.body?.length || 0,
      hasBody: !!emailDetails?.body
    });

    if (!emailDetails) {
      return NextResponse.json({
        success: false,
        error: 'Email not found or access denied'
      } as APIResponse, { status: 404 });
    }

    // Prepare response
    const responseStart = performance.now();
    const responseData = {
      id: emailDetails.id,
      subject: emailDetails.subject,
      from: emailDetails.from,
      snippet: emailDetails.snippet,
      body: emailDetails.body,
      date: emailDetails.date,
      category: emailDetails.category,
      threadId: emailDetails.threadId,
      hasBody: !!emailDetails.body
    };

    console.log(`🔍 [${Math.round(performance.now() - startTime)}ms] Response prepared (took ${Math.round(performance.now() - responseStart)}ms)`);
    console.log(`🔍 [${Math.round(performance.now() - startTime)}ms] Final body length: ${responseData.body?.length || 0}`);

    const totalTime = Math.round(performance.now() - startTime);
    console.log(`🔍 [${totalTime}ms] TOTAL API TIME - returning data`);

    return NextResponse.json({
      success: true,
      message: 'Email details retrieved for reply',
      data: responseData
    } as APIResponse);

  } catch (error) {
    const errorTime = Math.round(performance.now() - startTime);
    console.error(`❌ [${errorTime}ms] Error fetching email for reply:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch email details',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    } as APIResponse, { status: 500 });
  }
}