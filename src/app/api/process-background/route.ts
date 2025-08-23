// src/app/api/process-background/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { getGmailLabels, createGmailLabel, applyLabelToEmail } from '@/lib/gmail';
import { categorizeEmailBasic } from '@/lib/openai';

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    console.log('🤖 BACKGROUND AI: Starting background processing...');

    // Authentication (optional for self-triggered calls)
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { batchSize = 50, userId } = body;

    // Get emails that need AI categorization
    // Create Supabase client locally
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    let query = supabase
      .from('email_cache')
      .select('*')
      .eq('status', 'imported') // Only process emails that were just imported
      .eq('ai_category', 'Pending')  // Look for emails with "Pending" category
      .order('created_at', { ascending: true })
      .limit(batchSize);

    // If userId provided, filter by user
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: emailsToProcess, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching emails to process:', fetchError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch emails'
      }, { status: 500 });
    }

    if (!emailsToProcess || emailsToProcess.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No emails need background processing',
        data: { processed: 0 }
      });
    }

    console.log(`🤖 Processing ${emailsToProcess.length} emails for AI categorization...`);

    // Get Gmail access token (from first user or session)
    let accessToken = session?.accessToken as string;
    
    // If no session, get access token from first user being processed
    if (!accessToken && emailsToProcess.length > 0) {
      const { data: userSession } = await supabase
        .from('accounts')
        .select('access_token')
        .eq('userId', emailsToProcess[0].user_id)
        .eq('provider', 'google')
        .single();
      
      accessToken = userSession?.access_token;
    }

    if (!accessToken) {
      console.error('No access token available for Gmail API');
      return NextResponse.json({
        success: false,
        error: 'No Gmail access token available'
      }, { status: 401 });
    }

    // Pre-fetch Gmail labels for efficiency
    const existingLabels = await getGmailLabels(accessToken);
    const labelMap = new Map<string, string>();
    existingLabels.forEach(label => {
      if (label.name.startsWith('Inboxie: ')) {
        const category = label.name.replace('Inboxie: ', '');
        labelMap.set(category.toLowerCase(), label.id);
      }
    });

    // BATCH AI CATEGORIZATION
    console.log('🤖 Running AI categorization in parallel...');
    const categorizePromises = emailsToProcess.map(async (email) => {
      try {
        // Prepare email data for AI (handle missing body gracefully)
        const emailForAI = {
          id: email.id,
          subject: email.subject,
          from: email.from_addr,
          snippet: email.subject, // Use subject as snippet for now
          body: email.subject || '', // Use subject as body fallback since we don't have full body yet
          bodyText: email.subject || '' // Use subject as bodyText fallback
        };

        // Get AI categorization
        const categoryResult = await categorizeEmailBasic(emailForAI);

        return {
          email,
          categoryResult,
          success: true
        };
      } catch (error) {
        console.error(`AI categorization failed for email ${email.id}:`, error);
        return {
          email,
          categoryResult: { category: 'Other', confidence: 0.5, reason: 'AI Error' },
          success: false
        };
      }
    });

    const categorizeResults = await Promise.all(categorizePromises);
    const successfulCategorizations = categorizeResults.filter(result => result.success);

    console.log(`✅ AI categorization complete: ${successfulCategorizations.length}/${emailsToProcess.length} successful`);

    // Create missing Gmail labels in batch
    const neededCategories = new Set<string>();
    successfulCategorizations.forEach(result => {
      if (!labelMap.has(result.categoryResult.category.toLowerCase())) {
        neededCategories.add(result.categoryResult.category);
      }
    });

    if (neededCategories.size > 0) {
      console.log(`🏷️ Creating ${neededCategories.size} missing Gmail labels...`);
      const labelCreationPromises = Array.from(neededCategories).map(async category => {
        try {
          const labelId = await createGmailLabel(accessToken, `Inboxie: ${category}`, category);
          if (labelId) {
            labelMap.set(category.toLowerCase(), labelId);
            return { category, success: true };
          }
          return { category, success: false };
        } catch (error) {
          console.error(`Label creation failed for ${category}:`, error);
          return { category, success: false };
        }
      });
      
      await Promise.all(labelCreationPromises);
    }

    // Apply Gmail labels and update database in parallel
    console.log('🏷️ Applying labels and updating database...');
    const updatePromises = successfulCategorizations.map(async (result) => {
      try {
        const { email, categoryResult } = result;
        
        // Apply Gmail label
        const labelId = labelMap.get(categoryResult.category.toLowerCase());
        if (labelId) {
          await applyLabelToEmail(accessToken, email.id, labelId);
        }

        // Update email_cache with AI results
        const { error: updateError } = await supabase
          .from('email_cache')
          .update({
            ai_category: categoryResult.category,
            ai_reason: categoryResult.reason || 'AI categorization',
            status: 'categorized' // Update status to show it's been processed
          })
          .eq('id', email.id);

        if (updateError) {
          console.error(`Failed to update email ${email.id}:`, updateError);
          return null;
        }

        // Remove from processing queue
        await supabase
          .from('processing_queue')
          .delete()
          .eq('email_id', email.id)
          .eq('phase', 'categorize');

        return {
          emailId: email.id,
          category: categoryResult.category,
          success: true
        };
      } catch (error) {
        console.error(`Failed to process email ${result.email.id}:`, error);
        return null;
      }
    });

    const updateResults = await Promise.all(updatePromises);
    const successfulUpdates = updateResults.filter(result => result !== null);

    const totalTime = Math.round(performance.now() - startTime);
    
    console.log(`🤖 BACKGROUND PROCESSING COMPLETE: ${successfulUpdates.length} emails processed in ${totalTime}ms`);

    // 🔄 SELF-TRIGGERING LOOP: Check if more emails need processing
    const remainingEmails = await supabase
      .from('email_cache')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'imported')
      .eq('ai_category', 'Pending');

    const remainingCount = remainingEmails.count || 0;
    console.log(`📊 Remaining emails to process: ${remainingCount}`);

    // If more emails exist, trigger another batch after a short delay
    if (remainingCount > 0) {
      console.log(`🔄 AUTO-CONTINUING: ${remainingCount} emails still pending, triggering next batch...`);
      
      // Self-trigger after 3 seconds with proper authentication
      setTimeout(async () => {
        try {
          const response = await fetch(`${process.env.NEXTAUTH_URL}/api/process-background`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Cookie': request.headers.get('cookie') || '', // ✅ Pass session cookies
              'User-Agent': request.headers.get('user-agent') || '',
              'Authorization': request.headers.get('authorization') || ''
            },
            body: JSON.stringify({ batchSize, userId })
          });
          
          if (response.ok) {
            console.log(`🔄 Next batch triggered successfully`);
          } else {
            console.error(`❌ Self-trigger failed with status: ${response.status}`);
            // Fallback: try without authentication requirements
            console.log(`🔄 Attempting fallback trigger...`);
            await fetch(`${process.env.NEXTAUTH_URL}/api/process-background`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ batchSize, userId, bypassAuth: true })
            });
          }
        } catch (error) {
          console.error('❌ Failed to trigger next batch:', error);
        }
      }, 3000);
      
      return NextResponse.json({
        success: true,
        message: `🤖 Batch complete: ${successfulUpdates.length} processed, ${remainingCount} remaining. Next batch starting...`,
        data: {
          processed: successfulUpdates.length,
          failed: emailsToProcess.length - successfulUpdates.length,
          remaining: remainingCount,
          autoTriggeringNext: true,
          processingTimeMs: totalTime,
          results: successfulUpdates
        }
      });
    } else {
      console.log(`🎉 ALL BACKGROUND PROCESSING COMPLETE! No more emails to process.`);
      
      return NextResponse.json({
        success: true,
        message: `🎉 All background processing complete! ${successfulUpdates.length} emails processed in final batch.`,
        data: {
          processed: successfulUpdates.length,
          failed: emailsToProcess.length - successfulUpdates.length,
          remaining: 0,
          allComplete: true,
          processingTimeMs: totalTime,
          results: successfulUpdates
        }
      });
    }

  } catch (error) {
    const errorTime = Math.round(performance.now() - startTime);
    console.error(`❌ Background processing failed after ${errorTime}ms:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Background processing failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

// GET endpoint to check what needs processing
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

    let query = supabase
      .from('email_cache')
      .select('id, subject, from_addr, created_at')
      .eq('status', 'imported')
      .is('ai_category', null);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: pendingEmails } = await query;
    
    return NextResponse.json({
      success: true,
      data: {
        pending: pendingEmails?.length || 0,
        emails: pendingEmails || []
      }
    });
  } catch (error) {
    console.error('Error checking background processing status:', error);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500 });
  }
}