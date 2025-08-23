// src/app/api/process-emails-stream/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { fetchLatestEmails, getGmailLabels, createGmailLabel, applyLabelToEmail } from '@/lib/gmail';
import { categorizeEmailBasic } from '@/lib/openai';
import { 
  checkEmailExists, 
  saveProcessedEmail, 
  getOrCreateUser, 
  checkUserLimits,
  updateUserEmailCount,
  getProcessedEmailIds,
  getProcessedEmails
} from '@/lib/supabase';
import { APIResponse, ProcessingResult } from '@/types';
import { getEmailLimit } from '@/config/plans';

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    console.log('🚀 Starting STREAMING email processing workflow...');

    // Get the authenticated session
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
      streamUpdates = true,
      loadExisting = true 
    } = body;
    const userEmail = session.user.email;
    const accessToken = session.accessToken as string;

    console.log(`📧 STREAMING processing for: ${userEmail}`);

    // Step 1: Get or create user
    console.log('👤 Getting user information...');
    const user = await getOrCreateUser(userEmail);
    
    // Step 2: Check user's plan limits
    console.log('📊 Checking user plan limits...');
    const limits = await checkUserLimits(user.id);
    
    if (!limits.canProcess) {
      return NextResponse.json({
        success: false,
        error: `Email limit reached. ${limits.planType === 'free' ? 'Upgrade to Pro for more emails!' : 'Daily limit exceeded.'}`,
        data: {
          planType: limits.planType,
          emailsProcessed: limits.emailsProcessed,
          limit: limits.limit
        }
      } as APIResponse, { status: 429 });
    }

    // Calculate how many emails we can process
    const remainingLimit = limits.limit - limits.emailsProcessed;
    const emailsToProcess = Math.min(remainingLimit, getEmailLimit(limits.planType));

    console.log(`📧 Can process ${emailsToProcess} emails (${remainingLimit} remaining)`);

    // Step 3: Load existing processed emails for display
    let existingProcessedEmails: any[] = [];
    if (loadExisting) {
      console.log('📚 Loading existing processed emails...');
      existingProcessedEmails = await getProcessedEmails(user.id, 100);
      console.log(`📋 Found ${existingProcessedEmails.length} existing processed emails`);
    }

    // Step 4: Get already processed email IDs to avoid duplicates
    console.log('🔍 Getting list of already processed email IDs...');
    const processedEmailIds = await getProcessedEmailIds(user.id);
    console.log(`📋 Found ${processedEmailIds.length} already processed email IDs`);

    // Step 5: Fetch emails from Gmail - KEEP FETCHING UNTIL WE FIND UNPROCESSED
    console.log(`📧 Fetching emails from Gmail...`);
    let allEmails: any[] = [];
    let offset = 0;
    const fetchBatchSize = 20;
    const maxFetch = 200; // Safety limit

    while (offset < maxFetch) {
      console.log(`📧 Fetching ${fetchBatchSize} emails from offset ${offset}...`);
      const batchEmails = await fetchLatestEmails(accessToken, fetchBatchSize, offset);
      
      if (batchEmails.length === 0) {
        console.log('📭 No more emails available from Gmail');
        break;
      }
      
      allEmails.push(...batchEmails);
      offset += fetchBatchSize;
      
      // Check how many unprocessed we have so far
      const unprocessedSoFar = allEmails.filter(email => !processedEmailIds.includes(email.id));
      console.log(`🔍 Found ${unprocessedSoFar.length} unprocessed emails so far out of ${allEmails.length} fetched`);
      
      if (unprocessedSoFar.length >= emailsToProcess) {
        console.log(`✅ Found enough unprocessed emails (${unprocessedSoFar.length}), stopping fetch`);
        break;
      }
      
      if (batchEmails.length < fetchBatchSize) {
        console.log('📭 Reached end of available emails');
        break;
      }
    }

    console.log(`📊 Total emails fetched: ${allEmails.length}`);

    // Step 6: Filter out already processed emails and limit to what we can process
    const unprocessedEmails = allEmails
      .filter(email => !processedEmailIds.includes(email.id))
      .slice(0, emailsToProcess);

    console.log(`🔍 Found ${unprocessedEmails.length} unprocessed emails to process`);

    // Step 7: Process emails in FAST BATCHES
    const newResults = [];
    let processed = 0;
    let errors = 0;

    if (unprocessedEmails.length > 0) {
      console.log(`🚀 STREAMING: Processing ${unprocessedEmails.length} emails in batches...`);

      // Pre-fetch Gmail labels
      const existingLabels = await getGmailLabels(accessToken);
      const labelMap = new Map<string, string>();
      existingLabels.forEach(label => {
        if (label.name.startsWith('Inboxie: ')) {
          const category = label.name.replace('Inboxie: ', '');
          labelMap.set(category.toLowerCase(), label.id);
        }
      });

      // Process emails in FAST BATCHES of 5
      const BATCH_SIZE = 5;
      for (let i = 0; i < unprocessedEmails.length; i += BATCH_SIZE) {
        const batch = unprocessedEmails.slice(i, Math.min(i + BATCH_SIZE, unprocessedEmails.length));
        const batchNum = Math.floor(i/BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(unprocessedEmails.length / BATCH_SIZE);
        
        console.log(`🚀 Processing batch ${batchNum}/${totalBatches}: emails ${i + 1}-${Math.min(i + BATCH_SIZE, unprocessedEmails.length)}`);

        // Process this batch in parallel
        const batchPromises = batch.map(async (email, batchIndex) => {
          try {
            // Step 1: Categorize email
            const categoryResult = await categorizeEmailBasic(email);
            
            // Step 2: Create Gmail label if needed
            let labelId = labelMap.get(categoryResult.category.toLowerCase());
            if (!labelId) {
              labelId = await createGmailLabel(accessToken, `Inboxie: ${categoryResult.category}`, categoryResult.category);
              if (labelId) {
                labelMap.set(categoryResult.category.toLowerCase(), labelId);
              }
            }

            // Step 3: Apply label to email
            if (labelId) {
              await applyLabelToEmail(accessToken, email.id, labelId);
            }

            // Step 4: Save to database
            const savedEmail = await saveProcessedEmail(
              email,
              categoryResult.category,
              categoryResult.reason || 'AI categorization',
              user.id
            );

            // Step 5: Prepare result
            const result = {
              ...email,
              category: categoryResult.category,
              confidence: categoryResult.confidence,
              aiReason: categoryResult.reason || 'AI categorization',
              processed_at: savedEmail.created_at,
              success: true
            };

            console.log(`✅ Processed email ${i + batchIndex + 1}/${unprocessedEmails.length}: ${categoryResult.category}`);
            return result;

          } catch (error) {
            console.error(`❌ Error processing email ${email.id}:`, error);
            return null;
          }
        });

        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Filter successful results and add to main results
        const successfulResults = batchResults.filter(result => result !== null);
        newResults.push(...successfulResults);
        processed += successfulResults.length;
        errors += (batch.length - successfulResults.length);

        // Update user count after each batch (not individual emails)
        if (successfulResults.length > 0) {
          await updateUserEmailCount(user.id, successfulResults.length);
        }

        console.log(`✅ Batch ${batchNum} complete: ${successfulResults.length}/${batch.length} successful`);
      }
    }

    // Step 8: Combine existing and new results
    const allResults = [...newResults, ...existingProcessedEmails];

    // Step 9: Return results
    const totalTime = Math.round(performance.now() - startTime);
    console.log(`🎉 STREAMING processing completed! Processed: ${processed}, Errors: ${errors}`);
    console.log(`📊 Returning ${allResults.length} total emails (${newResults.length} new + ${existingProcessedEmails.length} existing)`);
    console.log(`⚡ TOTAL PROCESSING TIME: ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      message: processed > 0
        ? `🚀 STREAMING: Processed ${processed} emails in ${totalTime}ms${errors > 0 ? ` (${errors} errors)` : ''}`
        : existingProcessedEmails.length > 0
          ? `Loaded ${existingProcessedEmails.length} existing processed emails. ${unprocessedEmails.length === 0 ? 'No new emails to process.' : ''}`
          : 'No emails found to process',
      data: {
        success: true,
        processed,
        errors,
        results: allResults,
        newEmails: newResults.length,
        existingEmails: existingProcessedEmails.length,
        totalFetched: allEmails.length,
        processingTimeMs: totalTime,
        user: {
          planType: limits.planType,
          emailsProcessed: limits.emailsProcessed + processed,
          limit: limits.limit,
          remaining: limits.limit - (limits.emailsProcessed + processed)
        }
      }
    } as any);

  } catch (error) {
    const errorTime = Math.round(performance.now() - startTime);
    console.error(`❌ STREAMING email processing failed after ${errorTime}ms:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Email processing failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    } as APIResponse, { status: 500 });
  }
}