// src/app/api/process-emails-fast/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { fetchLatestEmails } from '@/lib/gmail';
import { 
  getOrCreateUser, 
  checkUserLimits,
  getProcessedEmailIds,
  updateUserEmailCount,
  saveProcessedEmail 
} from '@/lib/supabase';

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    console.log('⚡ LIGHTNING IMPORT: Starting fast email import...');

    // Authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !session.accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const body = await request.json();
    const { emailLimit = 50 } = body;
    const userEmail = session.user.email;
    const accessToken = session.accessToken as string;

    console.log(`⚡ Lightning import for: ${userEmail} (limit: ${emailLimit})`);

    // Get user ID using your existing function
    const user = await getOrCreateUser(userEmail);
    const userId = user.id;

    // Check user limits using your existing function
    const limits = await checkUserLimits(userId);
    
    if (!limits.canProcess) {
      return NextResponse.json({
        success: false,
        error: `Email limit reached. ${limits.planType === 'free' ? 'Upgrade to Pro for more emails!' : 'Daily limit exceeded.'}`,
      }, { status: 429 });
    }

    // Get already processed email IDs using your existing function
    console.log('📋 Getting existing emails...');
    const existingEmailIds = await getProcessedEmailIds(userId);
    console.log(`📋 Found ${existingEmailIds.length} existing emails`);

    // Fetch emails from Gmail - FAST FETCHING (Higher limits for paid users)
    console.log(`📧 Fetching emails from Gmail...`);
    let allEmails: any[] = [];
    let offset = 0;
    const fetchBatchSize = 50;
    
    // Set higher limits for paid users
    const maxFetchLimit = limits.planType === 'paid' ? 1000 : 300; // 1000 for paid vs 300 for free
    const searchDepth = emailLimit * 3; // Search deeper to find unprocessed emails

    while (allEmails.length < searchDepth && offset < maxFetchLimit) {
      const batchEmails = await fetchLatestEmails(accessToken, fetchBatchSize, offset);
      
      if (batchEmails.length === 0) break;
      
      allEmails.push(...batchEmails);
      offset += fetchBatchSize;
      
      // Check if we have enough unprocessed emails
      const unprocessedCount = allEmails.filter(email => !existingEmailIds.includes(email.id)).length;
      if (unprocessedCount >= emailLimit) {
        console.log(`⚡ Found ${unprocessedCount} unprocessed emails, stopping fetch`);
        break;
      }
    }

    // Filter to unprocessed emails only
    const unprocessedEmails = allEmails
      .filter(email => !existingEmailIds.includes(email.id))
      .slice(0, emailLimit);

    console.log(`⚡ Found ${unprocessedEmails.length} unprocessed emails to import`);

    if (unprocessedEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new emails to import',
        data: {
          imported: 0,
          existing: existingEmailIds.length,
          results: []
        }
      });
    }

    // LIGHTNING SAVE - Use your existing saveProcessedEmail function
    console.log(`⚡ LIGHTNING SAVE: Saving ${unprocessedEmails.length} emails with full details...`);
    
    // Create Supabase client for status updates
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
    
    const savePromises = unprocessedEmails.map(async (email) => {
      try {
        // Use your existing function that saves BOTH email_cache AND email_details
        // But with placeholder category that will be updated by background processing
        const savedEmail = await saveProcessedEmail(
          email,
          'Pending', // Temporary category - will be updated by background AI
          'Pending AI categorization',
          userId
        );

        // Update the saved email to have 'imported' status for background processing
        await supabaseClient
          .from('email_cache')
          .update({ status: 'imported' })
          .eq('id', email.id);

        // Queue for background processing to update the category
        await supabaseClient
          .from('processing_queue')
          .insert([{
            email_id: email.id,
            phase: 'categorize',
            status: 'pending',
            created_at: new Date().toISOString()
          }]);

        return {
          id: savedEmail.id,
          gmail_id: email.id,
          subject: email.subject,
          from: email.from,
          date: email.date,
          snippet: email.snippet,
          status: 'imported',
          category: 'Pending',
          aiReason: 'Pending AI categorization',
          processed_at: savedEmail.created_at,
          success: true
        };
      } catch (error) {
        console.error(`❌ Failed to save email ${email.id}:`, error);
        return null;
      }
    });

    const results = await Promise.all(savePromises);
    const successfulResults = results.filter(result => result !== null);
    
    // Update user email count using your existing function
    if (successfulResults.length > 0) {
      await updateUserEmailCount(userId, successfulResults.length);
    }

    const totalTime = Math.round(performance.now() - startTime);
    
    console.log(`⚡ LIGHTNING IMPORT COMPLETE: ${successfulResults.length} emails saved in ${totalTime}ms!`);
    console.log(`🔄 ${successfulResults.length} emails queued for background AI processing`);

    return NextResponse.json({
      success: true,
      message: `⚡ Lightning import: ${successfulResults.length} emails saved in ${totalTime}ms`,
      data: {
        imported: successfulResults.length,
        failed: unprocessedEmails.length - successfulResults.length,
        results: successfulResults,
        processingTimeMs: totalTime,
        queuedForAI: successfulResults.length,
        user: {
          planType: limits.planType,
          emailsProcessed: limits.emailsProcessed + successfulResults.length,
          limit: limits.limit,
          remaining: limits.limit - (limits.emailsProcessed + successfulResults.length)
        }
      }
    });

  } catch (error) {
    const errorTime = Math.round(performance.now() - startTime);
    console.error(`❌ Lightning import failed after ${errorTime}ms:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Lightning import failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}