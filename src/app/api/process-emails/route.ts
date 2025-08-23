// src/app/api/process-emails/route.ts
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

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    console.log('🚀 Starting TURBO email processing workflow...');

    // Get the authenticated session
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !session.accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      } as APIResponse, { status: 401 });
    }

    // Get request data - INCREASED DEFAULTS
    const body = await request.json();
    const { 
      emailLimit = 50,  // ⬆️ INCREASED from 10 to 50
      loadExisting = true 
    } = body;
    const userEmail = session.user.email;
    const accessToken = session.accessToken as string;

    console.log(`📧 TURBO processing ${emailLimit} emails for: ${userEmail}`);

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

    // Step 3: Load existing processed emails for display
    let existingProcessedEmails: any[] = [];
    if (loadExisting) {
      console.log('📚 Loading existing processed emails...');
      existingProcessedEmails = await getProcessedEmails(user.id, 100); // ⬆️ INCREASED from 50
      console.log(`📋 Found ${existingProcessedEmails.length} existing processed emails`);
    }

    // Step 4: Get already processed email IDs to avoid duplicates
    console.log('🔍 Getting list of already processed email IDs...');
    const processedEmailIds = await getProcessedEmailIds(user.id);
    console.log(`📋 Found ${processedEmailIds.length} already processed email IDs`);

    // Step 5: Fetch emails from Gmail with BIGGER batches
    let allEmails: any[] = [];
    let fetchLimit = Math.min(emailLimit * 2, 100); // ⬆️ INCREASED from 50 to 100
    let maxFetchLimit = 500; // ⬆️ INCREASED from 200 to 500
    let totalFetched = 0;

    console.log(`📧 Starting aggressive email fetch...`);
    
    while (totalFetched < maxFetchLimit) {
      console.log(`📧 Fetching ${fetchLimit} emails (total fetched so far: ${totalFetched})...`);
      
      const batchEmails = await fetchLatestEmails(accessToken, fetchLimit, totalFetched);
      
      if (batchEmails.length === 0) {
        console.log('📭 No more emails to fetch');
        break;
      }
      
      allEmails = [...allEmails, ...batchEmails];
      totalFetched += batchEmails.length;
      
      // Check how many unprocessed emails we have
      const unprocessedInBatch = batchEmails.filter(email => !processedEmailIds.includes(email.id));
      console.log(`🔍 Found ${unprocessedInBatch.length} unprocessed emails in this batch`);
      
      // If we have enough unprocessed emails, stop fetching
      if (unprocessedInBatch.length >= emailLimit) {
        console.log(`✅ Found enough unprocessed emails, stopping fetch`);
        break;
      }
      
      // If we got fewer emails than requested, we've probably reached the end
      if (batchEmails.length < fetchLimit) {
        console.log('📭 Reached end of available emails');
        break;
      }
      
      // Increase fetch limit for next batch - BIGGER JUMPS
      fetchLimit = Math.min(fetchLimit + 50, 100); // ⬆️ INCREASED increments
    }

    console.log(`📊 Total emails fetched: ${allEmails.length}`);

    // Step 6: Filter out already processed emails and limit to batch size
    const unprocessedEmails = allEmails
      .filter(email => !processedEmailIds.includes(email.id))
      .slice(0, emailLimit);

    console.log(`🔍 Found ${unprocessedEmails.length} unprocessed emails out of ${allEmails.length} fetched`);

    // Step 7: TURBO PARALLEL PROCESSING
    const newResults = [];
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    if (unprocessedEmails.length > 0) {
      console.log(`🚀 TURBO MODE: Processing ${unprocessedEmails.length} emails in parallel...`);

      // Step 1: Pre-fetch ALL Gmail labels ONCE
      console.log('🏷️ Fetching existing Gmail labels...');
      const existingLabels = await getGmailLabels(accessToken);
      const labelMap = new Map<string, string>();
      
      existingLabels.forEach(label => {
        if (label.name.startsWith('Inboxie: ')) {
          const category = label.name.replace('Inboxie: ', '');
          labelMap.set(category.toLowerCase(), label.id);
        }
      });

      // Step 2: BATCH AI CATEGORIZATION - All emails at once!
      console.log('🤖 BATCH AI: Categorizing all emails simultaneously...');
      const categorizePromises = unprocessedEmails.map(email => 
        categorizeEmailBasic(email).catch(error => {
          console.error(`AI error for ${email.id}:`, error);
          return { category: 'Other', confidence: 0.5, reason: 'AI error' };
        })
      );
      
      const categoryResults = await Promise.all(categorizePromises);
      console.log(`✅ AI BATCH: Categorized ${categoryResults.length} emails in parallel!`);

      // Step 3: Identify missing labels and create them in BATCH
      const neededCategories = new Set<string>();
      categoryResults.forEach(result => {
        if (!labelMap.has(result.category.toLowerCase())) {
          neededCategories.add(result.category);
        }
      });

      if (neededCategories.size > 0) {
        console.log(`🏷️ BATCH LABELS: Creating ${neededCategories.size} missing labels...`);
        const labelCreationPromises = Array.from(neededCategories).map(async category => {
          try {
            const labelId = await createGmailLabel(accessToken, `Inboxie: ${category}`, category);
            if (labelId) {
              labelMap.set(category.toLowerCase(), labelId);
              return { category, labelId, success: true };
            }
            return { category, labelId: '', success: false };
          } catch (error) {
            console.error(`Label creation failed for ${category}:`, error);
            return { category, labelId: '', success: false };
          }
        });
        
        const labelResults = await Promise.all(labelCreationPromises);
        console.log(`✅ BATCH LABELS: Created ${labelResults.filter(r => r.success).length}/${neededCategories.size} labels`);
      }

      // Step 4: PARALLEL Gmail label application
      console.log('🏷️ BATCH APPLY: Applying labels to all emails...');
      const applyPromises = unprocessedEmails.map(async (email, index) => {
        const categoryResult = categoryResults[index];
        const labelId = labelMap.get(categoryResult.category.toLowerCase());
        
        if (labelId) {
          try {
            await applyLabelToEmail(accessToken, email.id, labelId);
            return { emailId: email.id, success: true, category: categoryResult.category };
          } catch (error) {
            console.error(`Label apply failed for ${email.id}:`, error);
            return { emailId: email.id, success: false, category: categoryResult.category };
          }
        }
        return { emailId: email.id, success: false, category: categoryResult.category };
      });

      const applyResults = await Promise.all(applyPromises);
      console.log(`✅ BATCH APPLY: Applied labels to ${applyResults.filter(r => r.success).length}/${unprocessedEmails.length} emails`);

      // Step 5: BATCH database saves
      console.log('💾 BATCH DB: Saving all emails to database...');
      const savePromises = unprocessedEmails.map(async (email, index) => {
        const categoryResult = categoryResults[index];
        
        try {
          const savedEmail = await saveProcessedEmail(
            email,
            categoryResult.category,
            categoryResult.reason || 'AI categorization',
            user.id
          );

          return {
            ...email,
            category: categoryResult.category,
            confidence: categoryResult.confidence,
            aiReason: categoryResult.reason || 'AI categorization',
            processed_at: savedEmail.created_at,
            success: true
          };
        } catch (error) {
          console.error(`DB save failed for ${email.id}:`, error);
          return {
            ...email,
            category: categoryResult.category,
            confidence: categoryResult.confidence,
            aiReason: 'DB save failed',
            success: false
          };
        }
      });

      const saveResults = await Promise.all(savePromises);
      const successfulSaves = saveResults.filter(r => r.success);
      
      console.log(`✅ BATCH DB: Saved ${successfulSaves.length}/${unprocessedEmails.length} emails to database`);

      // Step 6: SINGLE batch update of user email count
      if (successfulSaves.length > 0) {
        await updateUserEmailCount(user.id, successfulSaves.length);
      }

      // Prepare results
      newResults.push(...successfulSaves);
      processed = successfulSaves.length;
      errors = unprocessedEmails.length - successfulSaves.length;

      const processingTime = Math.round(performance.now() - startTime);
      console.log(`🎉 TURBO COMPLETE: ${processed} processed, ${errors} errors in ${processingTime}ms!`);
    }

    // Step 8: Combine existing and new results
    const allResults = [...newResults, ...existingProcessedEmails];

    // Step 9: Return results with performance metrics
    const totalTime = Math.round(performance.now() - startTime);
    console.log(`🎉 Email processing completed! Processed: ${processed}, Skipped: ${skipped}, Errors: ${errors}`);
    console.log(`📊 Returning ${allResults.length} total emails (${newResults.length} new + ${existingProcessedEmails.length} existing)`);
    console.log(`⚡ TOTAL PROCESSING TIME: ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      message: processed > 0 
        ? `🚀 TURBO: Processed ${processed} emails in ${totalTime}ms${errors > 0 ? ` (${errors} errors)` : ''}`
        : existingProcessedEmails.length > 0
          ? `Loaded ${existingProcessedEmails.length} existing processed emails. ${unprocessedEmails.length === 0 ? 'No new emails to process.' : ''}`
          : 'No emails found to process',
      data: {
        success: true,
        processed,
        skipped,
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
    } as APIResponse<ProcessingResult>);

  } catch (error) {
    const errorTime = Math.round(performance.now() - startTime);
    console.error(`❌ Email processing workflow failed after ${errorTime}ms:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Email processing failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    } as APIResponse, { status: 500 });
  }
}