// src/app/api/process-background/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { getGmailLabels, createGmailLabel, applyLabelToEmail } from '@/lib/gmail';
import { categorizeEmailBasic, analyzeEmailForReply } from '@/lib/openai';

// Extract the core processing logic into a separate function for recursion
async function processBatch(
  supabase: any,
  accessToken: string,
  batchSize: number,
  userId?: string,
  totalProcessed = 0,
  maxBatches = 10 // Reduced from 20 since we're doing 50 emails per batch
): Promise<{
  totalProcessed: number;
  allComplete: boolean;
  processingTimeMs: number;
  results: any[];
}> {
  
  if (maxBatches <= 0) {
    console.log('🛑 Reached maximum batch limit, stopping processing');
    return {
      totalProcessed,
      allComplete: false,
      processingTimeMs: 0,
      results: []
    };
  }

  const batchStartTime = performance.now();
  
  // Get emails that need AI categorization (same logic as before)
  let query = supabase
    .from('email_cache')
    .select('*')
    .eq('status', 'imported')
    .eq('ai_category', 'Pending')
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: emailsToProcess, error: fetchError } = await query;

  if (fetchError) {
    console.error('Error fetching emails to process:', fetchError);
    throw new Error('Failed to fetch emails');
  }

  if (!emailsToProcess || emailsToProcess.length === 0) {
    console.log('🎉 No more emails to process - all complete!');
    return {
      totalProcessed,
      allComplete: true,
      processingTimeMs: Math.round(performance.now() - batchStartTime),
      results: []
    };
  }

  console.log(`🤖 Processing batch: ${emailsToProcess.length} emails (Total processed so far: ${totalProcessed})`);

  // Pre-fetch Gmail labels for efficiency (same logic)
  const existingLabels = await getGmailLabels(accessToken);
  const labelMap = new Map<string, string>();
  existingLabels.forEach(label => {
    if (label.name.startsWith('Inboxie: ')) {
      const category = label.name.replace('Inboxie: ', '');
      labelMap.set(category.toLowerCase(), label.id);
    }
  });

  // BATCH AI CATEGORIZATION - KEEP THIS IN PARALLEL (fast, no rate limits)
  console.log('🤖 Running AI categorization in parallel...');
  const categorizePromises = emailsToProcess.map(async (email) => {
    try {
      const emailForAI = {
        id: email.id,
        subject: email.subject,
        from: email.from_addr,
        snippet: email.subject,
        body: email.subject || '',
        bodyText: email.subject || ''
      };

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

  // NEW: BATCH REPLY ANALYSIS - Run in parallel with categorization results
  console.log('💬 Running AI reply analysis in parallel...');
  const replyAnalysisPromises = successfulCategorizations.map(async (result) => {
    try {
      // Add category to email for reply analysis
      const emailWithCategory = {
        ...result.email,
        ai_category: result.categoryResult.category
      };

      const replyResult = await analyzeEmailForReply(emailWithCategory);
      
      return {
        emailId: result.email.id,
        ...replyResult,
        success: true
      };
    } catch (error) {
      console.error(`Reply analysis failed for email ${result.email.id}:`, error);
      return {
        emailId: result.email.id,
        needsReply: false,
        reason: 'Reply analysis error',
        urgency: 'low',
        success: false
      };
    }
  });

  const replyAnalysisResults = await Promise.all(replyAnalysisPromises);
  console.log(`✅ AI reply analysis complete: ${replyAnalysisResults.filter(r => r.success).length}/${successfulCategorizations.length} successful`);

  // Create missing Gmail labels in batch (same logic)
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

  // SEQUENTIAL GMAIL LABELING - This is the rate-limited part
  console.log('🏷️ Applying Gmail labels sequentially to avoid rate limits...');
  const updateResults = [];

  for (let i = 0; i < successfulCategorizations.length; i++) {
    const result = successfulCategorizations[i];
    try {
      const { email, categoryResult } = result;
      
      // Apply Gmail label sequentially (this is the rate-limited part)
      const labelId = labelMap.get(categoryResult.category.toLowerCase());
      if (labelId) {
        await applyLabelToEmail(accessToken, email.id, labelId);
        console.log(`🏷️ Applied label "${categoryResult.category}" to email ${i + 1}/${successfulCategorizations.length}`);
        
        // Add delay between Gmail API calls to respect rate limits
        if (i < successfulCategorizations.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 150)); // 150ms between Gmail calls
        }
      }

      // NEW: Get reply analysis result for this email
      const replyResult = replyAnalysisResults.find(r => r.emailId === email.id);

      // Update database with BOTH categorization AND reply analysis
      const { error: updateError } = await supabase
        .from('email_cache')
        .update({
          ai_category: categoryResult.category,
          ai_reason: categoryResult.reason || 'AI categorization',
          status: 'categorized',
          // NEW: Add reply analysis fields (using correct column names)
          needs_reply: replyResult?.needsReply || false,
          reply_reason: replyResult?.reason || 'No analysis',
          urgency: replyResult?.urgency || 'low',
          ai_analyzed_at: new Date().toISOString()
        })
        .eq('id', email.id);

      if (updateError) {
        console.error(`Failed to update email ${email.id}:`, updateError);
        updateResults.push(null);
        continue;
      }

      // Remove from processing queue
      await supabase
        .from('processing_queue')
        .delete()
        .eq('email_id', email.id)
        .eq('phase', 'categorize');

      updateResults.push({
        emailId: email.id,
        category: categoryResult.category,
        needsReply: replyResult?.needsReply || false,
        replyReason: replyResult?.reason || 'No analysis',
        success: true
      });

    } catch (error) {
      console.error(`Failed to process email ${result.email.id}:`, error);
      updateResults.push(null);
    }
  }

  const successfulUpdates = updateResults.filter(result => result !== null);
  const batchTime = Math.round(performance.now() - batchStartTime);
  
  console.log(`🤖 BATCH COMPLETE: ${successfulUpdates.length} emails processed in ${batchTime}ms`);
  console.log(`💬 Reply analysis: ${successfulUpdates.filter(r => r.needsReply).length} emails need replies`);

  // Check if more emails need processing
  const remainingEmails = await supabase
    .from('email_cache')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'imported')
    .eq('ai_category', 'Pending');

  const remainingCount = remainingEmails.count || 0;
  console.log(`📊 Remaining emails to process: ${remainingCount}`);

  // If more emails exist, process the next batch IMMEDIATELY (recursive call)
  if (remainingCount > 0) {
    console.log(`🔄 CONTINUING: ${remainingCount} emails still pending, processing next batch...`);
    
    // Add a small delay between batches to be extra safe with Gmail API
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second between batches
    
    // Recursive call to process next batch
    const nextBatchResult = await processBatch(
      supabase,
      accessToken,
      batchSize,
      userId,
      totalProcessed + successfulUpdates.length,
      maxBatches - 1
    );

    return {
      totalProcessed: nextBatchResult.totalProcessed,
      allComplete: nextBatchResult.allComplete,
      processingTimeMs: batchTime + nextBatchResult.processingTimeMs,
      results: [...successfulUpdates, ...nextBatchResult.results]
    };
  } else {
    console.log(`🎉 ALL PROCESSING COMPLETE! No more emails to process.`);
    
    return {
      totalProcessed: totalProcessed + successfulUpdates.length,
      allComplete: true,
      processingTimeMs: batchTime,
      results: successfulUpdates
    };
  }
}

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    console.log('🤖 BACKGROUND AI: Starting background processing with reply analysis...');

    // Authentication (same logic as before)
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { batchSize = 50, userId } = body; // Keep your 50 email batch size

    // Create Supabase client locally (same logic)
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    // Get Gmail access token (same logic as before)
    let accessToken = session?.accessToken as string;
    
    if (!accessToken && userId) {
      const { data: userSession } = await supabase
        .from('accounts')
        .select('access_token')
        .eq('userId', userId)
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

    // Process all batches recursively until complete
    const result = await processBatch(supabase, accessToken, batchSize, userId);
    
    const totalTime = Math.round(performance.now() - startTime);
    const repliesFound = result.results.filter(r => r.needsReply).length;
    
    console.log(`🎉 ALL BACKGROUND PROCESSING COMPLETE: ${result.totalProcessed} total emails processed in ${totalTime}ms`);
    console.log(`💬 REPLY ANALYSIS COMPLETE: ${repliesFound} emails need replies`);

    return NextResponse.json({
      success: true,
      message: `🎉 All background processing complete! ${result.totalProcessed} emails processed, ${repliesFound} need replies.`,
      data: {
        processed: result.totalProcessed,
        allComplete: result.allComplete,
        processingTimeMs: totalTime,
        repliesFound: repliesFound,
        results: result.results
      }
    });

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

// GET endpoint to check what needs processing (same as before)
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
      .eq('ai_category', 'Pending');

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