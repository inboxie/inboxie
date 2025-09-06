// src/lib/supabase.ts - Updated with config import
import { createClient } from '@supabase/supabase-js';
import { 
  EmailData, 
  ProcessedEmail, 
  UserTable, 
  EmailCacheTable, 
  CustomCategory, 
  ToneProfile, 
  EmailEmbedding,
  PlanType 
} from '@/types';
import { getEmailLimit } from '@/config/plans';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

/**
 * EMAIL CACHE OPERATIONS
 */

/**
 * Check if email exists in cache for a specific user
 */
export async function checkEmailExists(emailId: string, userId: string): Promise<EmailCacheTable | null> {
  try {
    const { data, error } = await supabase
      .from('email_cache')
      .select('*')
      .eq('id', emailId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error checking email existence:', error);
    return null;
  }
}

/**
 * Save email details to the details table
 */
export async function saveEmailDetails(
  email: EmailData,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('email_details')
      .insert([
        {
          email_id: email.id,
          user_id: userId,
          body: email.body || '',
          snippet: email.snippet || email.subject?.substring(0, 150) || '',
          thread_id: email.threadId,
          gmail_labels: email.labels || [],
          attachments: email.attachments || null,
          headers: email.headers || null,
          message_id: email.messageId,
          reply_to: email.replyTo,
          cc: email.cc || [],
          bcc: email.bcc || [],
        },
      ]);

    if (error) {
      console.error('Failed to save email details:', error);
      // Don't throw - details are supplementary
    } else {
      console.log(`💾 Saved email details for ${email.id}`);
    }
  } catch (error) {
    console.error('Error saving email details:', error);
    // Don't throw - details are supplementary to cache
  }
}

/**
 * Save processed email to cache with user ID + save details separately
 */
export async function saveProcessedEmail(
  email: EmailData, 
  category: string, 
  reason: string,
  userId: string
): Promise<EmailCacheTable> {
  try {
    // Save to email_cache (lightweight summary)
    const { data, error } = await supabase
      .from('email_cache')
      .insert([
        {
          id: email.id,
          user_id: userId,
          from_addr: email.from,
          subject: email.subject,
          date_iso: new Date(email.date).toISOString(),
          ai_category: category,
          ai_reason: reason,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Save email details separately (non-blocking)
    await saveEmailDetails(email, userId);

    console.log(`✅ Saved email cache + details for ${email.id}`);
    return data;

  } catch (error) {
    console.error('Error saving processed email:', error);
    throw new Error('Failed to save processed email');
  }
}

/**
 * Get processed emails for a specific user only
 */
export async function getProcessedEmails(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('email_cache')
      .select('*')
      .eq('user_id', userId)  // Filter by user_id
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    // Transform the data to match expected email format for the UI
    const transformedEmails = (data || []).map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from_addr,
      snippet: email.subject, // Use subject as snippet if no snippet available
      body: email.subject, // Use subject as body for now
      category: email.ai_category,
      aiReason: email.ai_reason,
      processed_at: email.created_at,
      date: email.date_iso || email.created_at
    }));

    console.log(`📚 Retrieved ${transformedEmails.length} processed emails for user ${userId}`);
    return transformedEmails;
  } catch (error) {
    console.error('Error fetching processed emails:', error);
    return [];
  }
}

/**
 * Get list of processed email IDs for a specific user only
 */
export async function getProcessedEmailIds(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('email_cache')
      .select('id')
      .eq('user_id', userId);  // Filter by user_id

    if (error) {
      console.error('Error fetching processed email IDs:', error);
      return []; // Return empty array on error - safer to reprocess than skip
    }

    const emailIds = data?.map(row => row.id).filter(Boolean) || [];
    console.log(`📋 Retrieved ${emailIds.length} processed email IDs for user ${userId}`);
    
    return emailIds;
  } catch (error) {
    console.error('Unexpected error fetching processed email IDs:', error);
    return [];
  }
}

/**
 * Get email with full details for replies/viewing - FIXED VERSION
 */
export async function getEmailWithDetails(emailId: string, userId: string): Promise<any | null> {
  try {
    console.log(`⚡ FAST: Fetching email details for ${emailId}...`);
    
    // Step 1: Get the email cache entry
    const { data: emailCache, error: cacheError } = await supabase
      .from('email_cache')
      .select('*')
      .eq('id', emailId)
      .eq('user_id', userId)
      .single();

    if (cacheError || !emailCache) {
      console.error('Email not found in cache:', cacheError);
      return null;
    }

    console.log('✅ Found email in cache:', emailCache.subject);

    // Step 2: Get the email details separately with explicit matching
    const { data: emailDetails, error: detailsError } = await supabase
      .from('email_details')
      .select('*')
      .eq('email_id', emailId)
      .eq('user_id', userId)
      .single();

    // Log what we found
    console.log('📧 Email details query result:', {
      found: !!emailDetails,
      error: detailsError?.message,
      bodyLength: emailDetails?.body?.length || 0,
      hasBody: !!emailDetails?.body
    });

    // Return combined data
    const result = {
      id: emailCache.id,
      subject: emailCache.subject,
      from: emailCache.from_addr,
      body: emailDetails?.body || '', // This should now have the full body
      snippet: emailDetails?.snippet || emailCache.subject,
      threadId: emailDetails?.thread_id,
      labels: emailDetails?.gmail_labels || [],
      attachments: emailDetails?.attachments || [],
      headers: emailDetails?.headers || {},
      messageId: emailDetails?.message_id,
      replyTo: emailDetails?.reply_to,
      cc: emailDetails?.cc || [],
      bcc: emailDetails?.bcc || [],
      date: emailCache.date_iso,
      category: emailCache.ai_category,
      aiReason: emailCache.ai_reason,
      processed_at: emailCache.created_at
    };

    console.log(`✅ FIXED: Email details fetched - body length: ${result.body.length}`);
    return result;

  } catch (error) {
    console.error('Error fetching email details:', error);
    return null;
  }
}

/**
 * USER MANAGEMENT
 */

/**
 * Get or create user - ALPHA MODE AWARE - FIXED VERSION
 */
export async function getOrCreateUser(email: string): Promise<UserTable> {
  try {
    // First, try to get existing user
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    // If user exists, return it
    if (existingUser) {
      console.log(`👤 Found existing user: ${email}`);
      return existingUser;
    }

    // If error is NOT "no rows found", it's a real error
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Unexpected error fetching user:', fetchError);
      throw fetchError;
    }

    // User doesn't exist, create new one
    console.log(`👤 Creating new user: ${email}`);

    // Smart plan assignment based on environment
    const isAlphaMode = process.env.ALPHA_MODE === 'true';
    const defaultPlan: PlanType = isAlphaMode ? 'paid' : 'free';

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([
        {
          email,
          plan_type: defaultPlan,
          emails_processed: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (createError) {
      // If it's a duplicate key error, try to fetch the user again
      if (createError.code === '23505') {
        console.log(`👤 User was created by another process, fetching: ${email}`);
        const { data: fetchedUser, error: refetchError } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single();
        
        if (refetchError) {
          throw refetchError;
        }
        
        return fetchedUser;
      }
      
      throw createError;
    }

    console.log(`👤 Created ${isAlphaMode ? 'ALPHA' : 'PRODUCTION'} user: ${email} (${defaultPlan})`);
    return newUser;
    
  } catch (error) {
    console.error('Error getting/creating user:', error);
    throw new Error('Failed to get or create user');
  }
}

/**
 * Update user's email count
 */
export async function updateUserEmailCount(userId: string, increment: number = 1): Promise<void> {
  try {
    // Get current count first
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('emails_processed')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    // Update with new count
    const { error } = await supabase
      .from('users')
      .update({
        emails_processed: (user.emails_processed || 0) + increment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error updating user email count:', error);
    throw new Error('Failed to update user email count');
  }
}

/**
 * Check user's plan limits - Uses config file
 */
export async function checkUserLimits(userId: string): Promise<{
  canProcess: boolean;
  emailsProcessed: number;
  planType: PlanType;
  limit: number;
}> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('plan_type, emails_processed')
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new Error('User not found');
    }

    // Alpha mode override - treat everyone as Pro for testing
    const isAlphaMode = process.env.ALPHA_MODE === 'true';
    const effectivePlanType = isAlphaMode ? 'paid' : user.plan_type;
    
    // Get limit from config file
    const limit = getEmailLimit(effectivePlanType);
    const canProcess = user.emails_processed < limit;

    console.log(`📊 User limits check: ${user.emails_processed}/${limit} (Plan: ${effectivePlanType})`);

    return {
      canProcess,
      emailsProcessed: user.emails_processed,
      planType: effectivePlanType,
      limit,
    };
  } catch (error) {
    console.error('Error checking user limits:', error);
    throw new Error('Failed to check user limits');
  }
}

/**
 * CUSTOM CATEGORIES (Paid Feature)
 */

/**
 * Get user's custom categories
 */
export async function getUserCustomCategories(userId: string): Promise<CustomCategory[]> {
  try {
    const { data, error } = await supabase
      .from('custom_categories')
      .select('*')
      .eq('userId', userId)
      .order('name');

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching custom categories:', error);
    return [];
  }
}

/**
 * Create custom category
 */
export async function createCustomCategory(
  userId: string,
  name: string,
  description?: string,
  keywords?: string[]
): Promise<CustomCategory> {
  try {
    const { data, error } = await supabase
      .from('custom_categories')
      .insert([
        {
          userId,
          name,
          description,
          keywords,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error creating custom category:', error);
    throw new Error('Failed to create custom category');
  }
}

/**
 * TONE PROFILES (Paid Feature)
 */

/**
 * Save user's tone profile
 */
export async function saveToneProfile(toneProfile: ToneProfile): Promise<void> {
  try {
    const { error } = await supabase
      .from('tone_profiles')
      .upsert([
        {
          userId: toneProfile.userId,
          sentEmailsAnalyzed: toneProfile.sentEmailsAnalyzed,
          toneCharacteristics: toneProfile.toneCharacteristics,
          lastTraining: toneProfile.lastTraining,
        },
      ]);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error saving tone profile:', error);
    throw new Error('Failed to save tone profile');
  }
}

/**
 * Get user's tone profile
 */
export async function getToneProfile(userId: string): Promise<ToneProfile | null> {
  try {
    const { data, error } = await supabase
      .from('tone_profiles')
      .select('*')
      .eq('userId', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error fetching tone profile:', error);
    return null;
  }
}

/**
 * VECTOR EMBEDDINGS (Paid Feature)
 */

/**
 * Save email embedding for semantic search
 */
export async function saveEmailEmbedding(embedding: EmailEmbedding): Promise<void> {
  try {
    const { error } = await supabase
      .from('email_embeddings')
      .upsert([
        {
          emailId: embedding.emailId,
          embedding: embedding.embedding,
          content: embedding.content,
          metadata: embedding.metadata,
          created_at: new Date().toISOString(),
        },
      ]);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error saving email embedding:', error);
    throw new Error('Failed to save email embedding');
  }
}

/**
 * Search emails by vector similarity (requires pgvector extension)
 */
export async function searchEmailsByVector(
  queryEmbedding: number[],
  limit: number = 10,
  threshold: number = 0.7
): Promise<EmailEmbedding[]> {
  try {
    // This requires pgvector extension in Supabase
    // For now, we'll use a simpler approach
    const { data, error } = await supabase
      .from('email_embeddings')
      .select('*')
      .limit(limit);

    if (error) {
      throw error;
    }

    // Simple similarity calculation (in production, use pgvector)
    const results = data?.map(item => ({
      ...item,
      similarity: cosineSimilarity(queryEmbedding, item.embedding),
    }))
    .filter(item => item.similarity > threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit) || [];

    return results;
  } catch (error) {
    console.error('Error searching emails by vector:', error);
    return [];
  }
}

/**
 * UTILITY FUNCTIONS
 */

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  totalEmails: number;
  totalUsers: number;
  categoriesProcessed: { [category: string]: number };
}> {
  try {
    // Get total emails
    const { count: emailCount } = await supabase
      .from('email_cache')
      .select('*', { count: 'exact', head: true });

    // Get total users
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Get category distribution
    const { data: categoryData } = await supabase
      .from('email_cache')
      .select('ai_category')
      .not('ai_category', 'is', null);

    const categoriesProcessed = categoryData?.reduce((acc, item) => {
      acc[item.ai_category] = (acc[item.ai_category] || 0) + 1;
      return acc;
    }, {} as { [category: string]: number }) || {};

    return {
      totalEmails: emailCount || 0,
      totalUsers: userCount || 0,
      categoriesProcessed,
    };
  } catch (error) {
    console.error('Error fetching database stats:', error);
    return {
      totalEmails: 0,
      totalUsers: 0,
      categoriesProcessed: {},
    };
  }
}

/**
 * Detect emails that need replies - UPDATED to read from database
 */
export async function detectPendingReplies(userId: string): Promise<any[]> {
  try {
    console.log('📭 Reading pending replies from database...');

    // Simple database query - read from needs_reply column
    const { data: emails, error } = await supabase
      .from('email_cache')
      .select(`
        *,
        email_details (
          body,
          thread_id,
          reply_to,
          cc,
          bcc
        )
      `)
      .eq('user_id', userId)
      .eq('needs_reply', true)  // Read from database instead of AI analysis
      .eq('reply_status', 'none')  // Filter for emails that haven't been replied to
      .is('ai_replied_at', null) // Still filter out emails with AI replies
      .order('created_at', { ascending: false })
      .limit(50); // Get most recent 50 emails that need replies

    if (error) {
      console.error('Error fetching pending replies from database:', error);
      return [];
    }

    if (!emails || emails.length === 0) {
      console.log('📭 No emails need replies (from database)');
      return [];
    }

    // Transform emails for frontend (same format as before)
    const pendingReplies = emails.map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from_addr,
      snippet: email.subject,
      category: email.ai_category,
      aiReason: email.ai_reason,
      processed_at: email.created_at,
      date: email.date_iso || email.created_at,
      threadId: email.email_details?.thread_id,
      needsReply: true, // We know this is true since we filtered for needs_reply = 'yes'
      aiReplyReason: email.reply_reason || 'AI analysis',
      urgency: email.urgency || 'medium'
    }));

    // Group by thread and only keep the most recent email from each thread
    const threadMap = new Map();
    
    pendingReplies.forEach(email => {
      const threadId = email.threadId || email.id;
      
      if (!threadMap.has(threadId) || 
          new Date(email.date) > new Date(threadMap.get(threadId).date)) {
        threadMap.set(threadId, email);
      }
    });

    const uniquePendingReplies = Array.from(threadMap.values())
      .sort((a, b) => {
        // Sort by urgency first, then by date
        const urgencyOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        const urgencyDiff = urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
        if (urgencyDiff !== 0) return urgencyDiff;
        
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
      .slice(0, 15); // Top 15 most important

    console.log(`✅ Found ${uniquePendingReplies.length} emails needing replies from database`);
    console.log(`🔥 High priority: ${uniquePendingReplies.filter(e => e.urgency === 'high').length}`);
    console.log(`⚡ Medium priority: ${uniquePendingReplies.filter(e => e.urgency === 'medium').length}`);
    console.log(`📝 Low priority: ${uniquePendingReplies.filter(e => e.urgency === 'low').length}`);
    
    return uniquePendingReplies;

  } catch (error) {
    console.error('Error reading pending replies from database:', error);
    
    // No fallback needed - if database read fails, just return empty
    console.log('❌ Database read failed, returning empty results');
    return [];
  }
}