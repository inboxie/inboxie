// src/app/api/process-emails-fast/route.ts - Optimized with Parallel Processing + Gmail Labeling
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { fetchLatestEmails, createGmailLabel, applyLabelToEmail, getGmailLabels } from '@/lib/gmail';
import { processEmailsInMemory } from '@/lib/openai';
import { 
  getOrCreateUser, 
  checkUserLimits,
  getProcessedEmailIds,
  updateUserEmailCount,
  saveEmailOrganization 
} from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-fallback-secret';

// Performance configuration
const PERFORMANCE_CONFIG = {
  PARALLEL_FETCH_BATCHES: 4,      // Fetch 4 batches simultaneously
  FETCH_BATCH_SIZE: 20,           // 20 emails per fetch batch
  AI_PROCESSING_CHUNK_SIZE: 8,    // Process 8 emails per AI chunk
  MAX_PARALLEL_AI_CHUNKS: 3,      // Max 3 AI chunks running simultaneously
  DB_SAVE_CHUNK_SIZE: 10,         // Save 10 records per DB chunk
  LABEL_BATCH_SIZE: 10            // Apply 10 labels per batch
};

// Helper function to get user email from either NextAuth session OR extension JWT
async function getUserEmail(request: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    return session.user.email;
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.email && decoded.type === 'extension') {
        return decoded.email;
      }
    } catch (error) {
      console.error('Invalid extension JWT:', error);
    }
  }

  return null;
}

// Helper function to get access token for Gmail API
async function getGmailAccessToken(request: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.accessToken) {
    return session.accessToken as string;
  }

  const googleToken = request.headers.get('x-google-token');
  if (googleToken) {
    return googleToken;
  }

  return null;
}

// Parallel Gmail fetching with rate limit awareness
async function fetchEmailsParallel(
  accessToken: string, 
  totalLimit: number,
  existingEmailIds: Set<string>
): Promise<any[]> {
  const { PARALLEL_FETCH_BATCHES, FETCH_BATCH_SIZE } = PERFORMANCE_CONFIG;
  
  console.log(`🚀 PARALLEL FETCH: Starting ${PARALLEL_FETCH_BATCHES} parallel batches of ${FETCH_BATCH_SIZE} emails each`);
  
  let allEmails: any[] = [];
  let currentOffset = 0;
  let foundEnoughEmails = false;

  // Fetch in waves to respect rate limits
  while (!foundEnoughEmails && currentOffset < totalLimit * 2) {
    // Create parallel fetch promises for this wave
    const fetchPromises = [];
    for (let i = 0; i < PARALLEL_FETCH_BATCHES; i++) {
      const offset = currentOffset + (i * FETCH_BATCH_SIZE);
      fetchPromises.push(
        fetchLatestEmails(accessToken, FETCH_BATCH_SIZE, offset)
          .catch(error => {
            console.warn(`Fetch batch at offset ${offset} failed:`, error.message);
            return []; // Return empty array on error, don't fail entire operation
          })
      );
    }

    // Wait for this wave to complete
    const waveStartTime = performance.now();
    const batchResults = await Promise.all(fetchPromises);
    const waveTime = Math.round(performance.now() - waveStartTime);
    
    // Flatten results and add to collection
    const waveEmails = batchResults.flat();
    allEmails.push(...waveEmails);
    
    // Check if we have enough unprocessed emails
    const unprocessedCount = allEmails.filter(email => !existingEmailIds.has(email.id)).length;
    
    console.log(`📊 Wave complete: ${waveEmails.length} emails fetched in ${waveTime}ms, ${unprocessedCount} unprocessed`);
    
    if (unprocessedCount >= totalLimit) {
      foundEnoughEmails = true;
      break;
    }

    // If we got less than expected, we're probably at the end
    if (waveEmails.length < PARALLEL_FETCH_BATCHES * FETCH_BATCH_SIZE) {
      console.log(`📭 Reached end of emails (got ${waveEmails.length} < expected ${PARALLEL_FETCH_BATCHES * FETCH_BATCH_SIZE})`);
      break;
    }

    currentOffset += PARALLEL_FETCH_BATCHES * FETCH_BATCH_SIZE;
    
    // Small delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`✅ PARALLEL FETCH COMPLETE: ${allEmails.length} total emails fetched`);
  return allEmails;
}

// Parallel AI processing with chunking
async function processEmailsParallel(emails: any[]): Promise<any[]> {
  const { AI_PROCESSING_CHUNK_SIZE, MAX_PARALLEL_AI_CHUNKS } = PERFORMANCE_CONFIG;
  
  console.log(`🧠 PARALLEL AI: Processing ${emails.length} emails in chunks of ${AI_PROCESSING_CHUNK_SIZE}`);

  // Split emails into chunks
  const chunks = [];
  for (let i = 0; i < emails.length; i += AI_PROCESSING_CHUNK_SIZE) {
    chunks.push(emails.slice(i, i + AI_PROCESSING_CHUNK_SIZE));
  }

  console.log(`📦 Created ${chunks.length} chunks for parallel processing`);

  // Process chunks in parallel batches to avoid overwhelming OpenAI
  const results = [];
  for (let i = 0; i < chunks.length; i += MAX_PARALLEL_AI_CHUNKS) {
    const parallelChunks = chunks.slice(i, i + MAX_PARALLEL_AI_CHUNKS);
    
    console.log(`🔄 Processing batch ${Math.floor(i / MAX_PARALLEL_AI_CHUNKS) + 1}/${Math.ceil(chunks.length / MAX_PARALLEL_AI_CHUNKS)} (${parallelChunks.length} chunks)`);
    
    const chunkStartTime = performance.now();
    
    // Process chunks in parallel
    const chunkPromises = parallelChunks.map(async (chunk, index) => {
      try {
        const chunkResult = await processEmailsInMemory(chunk);
        console.log(`   ✅ Chunk ${i + index + 1} complete: ${chunkResult.length} emails`);
        return chunkResult;
      } catch (error) {
        console.error(`   ❌ Chunk ${i + index + 1} failed:`, error.message);
        // Return fallback results for failed chunk
        return chunk.map((email: any) => ({
          id: email.id,
          category: 'Other',
          date: email.date,
          threadId: email.threadId || email.id
        }));
      }
    });

    const batchResults = await Promise.all(chunkPromises);
    results.push(...batchResults.flat());
    
    const batchTime = Math.round(performance.now() - chunkStartTime);
    console.log(`📊 Batch ${Math.floor(i / MAX_PARALLEL_AI_CHUNKS) + 1} complete in ${batchTime}ms`);

    // Small delay between batches to respect OpenAI rate limits
    if (i + MAX_PARALLEL_AI_CHUNKS < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log(`✅ PARALLEL AI COMPLETE: ${results.length} emails processed`);
  return results;
}

// NEW: Apply Gmail labels in parallel
async function applyGmailLabelsParallel(
  accessToken: string, 
  processedMetadata: any[]
): Promise<{ applied: number; failed: number; labelIds: { [category: string]: string } }> {
  const { LABEL_BATCH_SIZE } = PERFORMANCE_CONFIG;
  
  console.log(`🏷️ PARALLEL LABELS: Applying labels to ${processedMetadata.length} emails`);

  try {
    // Get existing labels first
    const existingLabels = await getGmailLabels(accessToken);
    const labelMap = new Map(existingLabels.map(label => [label.name.toLowerCase(), label.id]));
    console.log(`📋 Found ${existingLabels.length} existing Gmail labels`);
    
    // Create missing labels for each category
    const categories = [...new Set(processedMetadata.map(m => m.category))];
    const labelIds: { [category: string]: string } = {};
    
    console.log(`🎯 Categories to process: ${categories.join(', ')}`);
    
    for (const category of categories) {
      const labelName = `Inboxie/${category}`;
      let labelId = labelMap.get(labelName.toLowerCase());
      
      if (!labelId) {
        console.log(`🆕 Creating new label: ${labelName}`);
        labelId = await createGmailLabel(accessToken, labelName, category.toLowerCase());
        
        if (labelId) {
          labelMap.set(labelName.toLowerCase(), labelId);
          console.log(`✅ Created label ${labelName} with ID: ${labelId}`);
        } else {
          console.error(`❌ Failed to create label: ${labelName}`);
          continue;
        }
      } else {
        console.log(`✅ Using existing label: ${labelName} (${labelId})`);
      }
      
      labelIds[category] = labelId;
    }
    
    // Apply labels in batches
    const batches = [];
    for (let i = 0; i < processedMetadata.length; i += LABEL_BATCH_SIZE) {
      batches.push(processedMetadata.slice(i, i + LABEL_BATCH_SIZE));
    }
    
    console.log(`📦 Processing ${batches.length} label batches of ${LABEL_BATCH_SIZE} emails each`);
    
    let applied = 0;
    let failed = 0;
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchStartTime = performance.now();
      
      // Apply labels in parallel within each batch
      const labelPromises = batch.map(async (metadata) => {
        try {
          const labelId = labelIds[metadata.category];
          
          if (!labelId) {
            console.warn(`⚠️ No label ID found for category: ${metadata.category}`);
            return { success: false, emailId: metadata.id };
          }
          
          await applyLabelToEmail(accessToken, metadata.id, labelId);
          return { success: true, emailId: metadata.id };
          
        } catch (error) {
          console.error(`❌ Failed to apply label to email ${metadata.id}:`, error.message);
          return { success: false, emailId: metadata.id };
        }
      });
      
      const batchResults = await Promise.all(labelPromises);
      const batchApplied = batchResults.filter(r => r.success).length;
      const batchFailed = batchResults.filter(r => !r.success).length;
      
      applied += batchApplied;
      failed += batchFailed;
      
      const batchTime = Math.round(performance.now() - batchStartTime);
      console.log(`   📊 Batch ${batchIndex + 1}/${batches.length}: ${batchApplied} applied, ${batchFailed} failed (${batchTime}ms)`);
      
      // Small delay between batches to respect rate limits
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }
    
    console.log(`✅ LABELS APPLIED: ${applied} success, ${failed} failed`);
    return { applied, failed, labelIds };
    
  } catch (error) {
    console.error(`❌ Error in parallel Gmail labeling:`, error);
    return { applied: 0, failed: processedMetadata.length, labelIds: {} };
  }
}

// Parallel database saves
async function saveMetadataParallel(
  processedMetadata: any[], 
  userId: string
): Promise<any[]> {
  const { DB_SAVE_CHUNK_SIZE } = PERFORMANCE_CONFIG;
  
  console.log(`💾 PARALLEL SAVE: Saving ${processedMetadata.length} records in chunks of ${DB_SAVE_CHUNK_SIZE}`);

  // Split into chunks for parallel saving
  const chunks = [];
  for (let i = 0; i < processedMetadata.length; i += DB_SAVE_CHUNK_SIZE) {
    chunks.push(processedMetadata.slice(i, i + DB_SAVE_CHUNK_SIZE));
  }

  const savePromises = chunks.map(async (chunk, chunkIndex) => {
    const chunkPromises = chunk.map(async (metadata) => {
      try {
        await saveEmailOrganization(
          metadata.id,
          userId,
          metadata.category,
          metadata.date,
          metadata.threadId
        );

        return {
          id: metadata.id,
          category: metadata.category,
          date: metadata.date,
          threadId: metadata.threadId,
          success: true
        };
      } catch (error) {
        console.error(`❌ Failed to save metadata for ${metadata.id}:`, error.message);
        return null;
      }
    });

    const chunkResults = await Promise.all(chunkPromises);
    console.log(`   ✅ Save chunk ${chunkIndex + 1}/${chunks.length} complete`);
    return chunkResults;
  });

  const allResults = await Promise.all(savePromises);
  const results = allResults.flat().filter(result => result !== null);
  
  console.log(`✅ PARALLEL SAVE COMPLETE: ${results.length} records saved`);
  return results;
}

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    console.log('⚡ OPTIMIZED PROCESSING: Starting high-performance email processing with Gmail labeling...');

    // Authentication
    const userEmail = await getUserEmail(request);
    if (!userEmail) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    const accessToken = await getGmailAccessToken(request);
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Gmail access token required'
      }, { status: 401 });
    }

    const body = await request.json();
    const { emailLimit = 50 } = body;

    console.log(`⚡ Processing ${emailLimit} emails for: ${userEmail}`);

    // Get user and check limits
    const user = await getOrCreateUser(userEmail);
    const limits = await checkUserLimits(user.id);
    
    if (!limits.canProcess) {
      return NextResponse.json({
        success: false,
        error: `Email limit reached. ${limits.planType === 'free' ? 'Upgrade to Pro for more emails!' : 'Daily limit exceeded.'}`,
      }, { status: 429 });
    }

    // Get existing email IDs
    const existingEmailIdsArray = await getProcessedEmailIds(user.id);
    const existingEmailIds = new Set(existingEmailIdsArray);
    console.log(`📋 Found ${existingEmailIds.size} existing emails`);

    // 🚀 PARALLEL GMAIL FETCHING
    const fetchStartTime = performance.now();
    const allEmails = await fetchEmailsParallel(accessToken, emailLimit, existingEmailIds);
    const fetchTime = Math.round(performance.now() - fetchStartTime);

    // Filter to unprocessed emails
    const unprocessedEmails = allEmails
      .filter(email => !existingEmailIds.has(email.id))
      .slice(0, emailLimit);

    console.log(`🎯 Found ${unprocessedEmails.length} unprocessed emails (fetch took ${fetchTime}ms)`);

    if (unprocessedEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new emails to process',
        data: {
          processed: 0,
          existing: existingEmailIds.size,
          categories: {},
          processingTimeMs: Math.round(performance.now() - startTime)
        }
      });
    }

    // Transform for AI processing
    const emailsForAI = unprocessedEmails.map(email => ({
      id: email.id,
      subject: email.subject || '',
      from: email.from || '',
      body: email.body || '',
      snippet: email.snippet || '',
      date: email.date || new Date().toISOString(),
      threadId: email.threadId || email.id
    }));

    // 🧠 PARALLEL AI PROCESSING
    const aiStartTime = performance.now();
    const processedMetadata = await processEmailsParallel(emailsForAI);
    const aiTime = Math.round(performance.now() - aiStartTime);

    console.log(`🗑️ Email content discarded. AI processing took ${aiTime}ms`);

    // 🏷️ APPLY GMAIL LABELS
    const labelStartTime = performance.now();
    const labelResults = await applyGmailLabelsParallel(accessToken, processedMetadata);
    const labelTime = Math.round(performance.now() - labelStartTime);

    console.log(`🏷️ Gmail labeling complete: ${labelResults.applied} applied, ${labelResults.failed} failed (${labelTime}ms)`);

    // 💾 PARALLEL DATABASE SAVES
    const saveStartTime = performance.now();
    const savedResults = await saveMetadataParallel(processedMetadata, user.id);
    const saveTime = Math.round(performance.now() - saveStartTime);

    // Update user email count
    if (savedResults.length > 0) {
      await updateUserEmailCount(user.id, savedResults.length);
    }

    // Calculate category breakdown and reply stats
    const categoryBreakdown = savedResults.reduce((acc, result) => {
      acc[result.category] = (acc[result.category] || 0) + 1;
      return acc;
    }, {} as { [category: string]: number });

    const replyStats = {
      totalReplies: savedResults.filter(r => r.needsReply).length,
      urgencyBreakdown: savedResults
        .filter(r => r.needsReply)
        .reduce((acc, result) => {
          acc[result.urgency] = (acc[result.urgency] || 0) + 1;
          return acc;
        }, { high: 0, medium: 0, low: 0 })
    };

    const totalTime = Math.round(performance.now() - startTime);
    
    console.log(`✅ OPTIMIZATION COMPLETE: ${savedResults.length} emails processed in ${totalTime}ms`);
    console.log(`📊 Performance breakdown - Fetch: ${fetchTime}ms, AI: ${aiTime}ms, Labels: ${labelTime}ms, Save: ${saveTime}ms`);
    console.log(`🏷️ Categories: ${Object.entries(categoryBreakdown).map(([cat, count]) => `${cat}:${count}`).join(', ')}`);
    console.log(`💬 Replies: ${replyStats.totalReplies} total (${replyStats.urgencyBreakdown.high} high, ${replyStats.urgencyBreakdown.medium} medium, ${replyStats.urgencyBreakdown.low} low)`);

    return NextResponse.json({
      success: true,
      message: `High-performance processing: ${savedResults.length} emails organized and labeled in ${totalTime}ms`,
      data: {
        processed: savedResults.length,
        failed: processedMetadata.length - savedResults.length,
        categories: categoryBreakdown,
        replies: replyStats,
        labels: {
          applied: labelResults.applied,
          failed: labelResults.failed,
          labelIds: labelResults.labelIds
        },
        performance: {
          totalMs: totalTime,
          fetchMs: fetchTime,
          aiMs: aiTime,
          labelMs: labelTime,
          saveMs: saveTime,
          emailsPerSecond: Math.round((savedResults.length * 1000) / totalTime)
        },
        privacyNote: "Zero email content stored - optimized in-memory processing with Gmail labeling + reply analysis",
        user: {
          planType: limits.planType,
          emailsProcessed: limits.emailsProcessed + savedResults.length,
          limit: limits.limit,
          remaining: limits.limit - (limits.emailsProcessed + savedResults.length)
        }
      }
    });

  } catch (error) {
    const errorTime = Math.round(performance.now() - startTime);
    console.error(`❌ Optimized processing failed after ${errorTime}ms:`, error);
    
    return NextResponse.json({
      success: false,
      error: 'Email processing failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}