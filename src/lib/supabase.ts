// src/lib/supabase.ts - Simplified for Chrome Extension
import { createClient } from '@supabase/supabase-js';
import { getEmailLimit } from '@/config/plans';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export type PlanType = 'free' | 'paid';

export interface UserTable {
  id: string;
  email: string;
  plan_type: PlanType;
  emails_processed: number;
  created_at: string;
  updated_at: string;
}

export interface EmailOrganization {
  id: string; // Gmail message ID
  user_id: string;
  date_iso: string;
  ai_category: string;
  gmail_thread_id: string;
  processed_at: string;
  created_at: string;
}

/**
 * USER MANAGEMENT
 */

/**
 * Get or create user - ALPHA MODE AWARE
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
 * Check user's plan limits
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
 * EMAIL ORGANIZATION (Privacy-First)
 */

/**
 * Save email organization data (no PII)
 */
export async function saveEmailOrganization(
  gmailId: string,
  userId: string,
  category: string,
  dateIso: string,
  threadId?: string
): Promise<EmailOrganization> {
  try {
    const { data, error } = await supabase
      .from('email_cache_simple')
      .insert([
        {
          id: gmailId,
          user_id: userId,
          ai_category: category,
          date_iso: dateIso,
          gmail_thread_id: threadId || gmailId,
          processed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log(`✅ Saved email organization: ${gmailId} -> ${category}`);
    return data;

  } catch (error) {
    console.error('Error saving email organization:', error);
    throw new Error('Failed to save email organization');
  }
}

/**
 * Get processed email IDs for a specific user (to avoid duplicates)
 */
export async function getProcessedEmailIds(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('email_cache_simple')
      .select('id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching processed email IDs:', error);
      return [];
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
 * Get email organization stats for dashboard
 */
export async function getEmailOrganizationStats(userId: string): Promise<{
  totalEmails: number;
  categoryBreakdown: { [category: string]: number };
  recentActivity: Array<{ date: string; count: number; category: string }>;
}> {
  try {
    // Get all organization data for user
    const { data, error } = await supabase
      .from('email_cache_simple')
      .select('ai_category, date_iso, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return {
        totalEmails: 0,
        categoryBreakdown: {},
        recentActivity: []
      };
    }

    // Calculate category breakdown
    const categoryBreakdown = data.reduce((acc, item) => {
      const category = item.ai_category || 'Other';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as { [category: string]: number });

    // Calculate recent activity (last 30 days by date)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentEmails = data.filter(item => {
      const emailDate = new Date(item.date_iso || item.created_at);
      return emailDate >= thirtyDaysAgo;
    });

    // Group by date for activity chart
    const activityMap = new Map();
    recentEmails.forEach(item => {
      const date = new Date(item.date_iso || item.created_at).toISOString().split('T')[0];
      const key = `${date}-${item.ai_category}`;
      
      if (!activityMap.has(key)) {
        activityMap.set(key, {
          date,
          category: item.ai_category,
          count: 0
        });
      }
      
      activityMap.get(key).count++;
    });

    const recentActivity = Array.from(activityMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 50); // Last 50 data points

    console.log(`📊 Email organization stats: ${data.length} total emails, ${Object.keys(categoryBreakdown).length} categories`);

    return {
      totalEmails: data.length,
      categoryBreakdown,
      recentActivity
    };

  } catch (error) {
    console.error('Error fetching email organization stats:', error);
    return {
      totalEmails: 0,
      categoryBreakdown: {},
      recentActivity: []
    };
  }
}

/**
 * Get simple category counts for Chrome extension display
 */
export async function getCategoryCounts(userId: string): Promise<{ [category: string]: number }> {
  try {
    const { data, error } = await supabase
      .from('email_cache_simple')
      .select('ai_category')
      .eq('user_id', userId);

    if (error) {
      throw error;
    }

    // Count emails by category
    const categoryCounts = (data || []).reduce((acc, item) => {
      const category = item.ai_category || 'Other';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as { [category: string]: number });

    return categoryCounts;

  } catch (error) {
    console.error('Error fetching category counts:', error);
    return {};
  }
}