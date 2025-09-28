// src/app/api/get-user-stats/route.ts - Updated with Chrome Extension Authentication
import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser, checkUserLimits, getCategoryCounts, getReplyCounts } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// CORS headers for extension requests
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://mail.google.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Gmail-Token', // Updated for Gmail token
  'Access-Control-Allow-Credentials': 'true'
};

/**
 * Validate Gmail token and get user info
 */
async function validateGmailTokenAndGetUser(token: string): Promise<{ email: string; isValid: boolean }> {
  try {
    // Validate token with Google
    const tokenResponse = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
    if (!tokenResponse.ok) {
      return { email: '', isValid: false };
    }

    // Get user profile
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!profileResponse.ok) {
      return { email: '', isValid: false };
    }

    const profile = await profileResponse.json();
    return {
      email: profile.email,
      isValid: true
    };
  } catch (error) {
    console.error('Token validation failed:', error);
    return { email: '', isValid: false };
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders
  });
}

export async function GET(request: NextRequest) {
  try {
    // Get Gmail token from Chrome extension
    const gmailToken = request.headers.get('x-gmail-token');
    
    if (!gmailToken) {
      return NextResponse.json({
        success: false,
        error: 'Gmail token required'
      }, { status: 401, headers: corsHeaders });
    }

    // Validate token and get user
    const { email: userEmail, isValid } = await validateGmailTokenAndGetUser(gmailToken);
    
    if (!isValid || !userEmail) {
      return NextResponse.json({
        success: false,
        error: 'Invalid Gmail token'
      }, { status: 401, headers: corsHeaders });
    }

    console.log('📊 Getting user stats for:', userEmail);

    // Get user
    const user = await getOrCreateUser(userEmail);
    
    // Get user limits
    const limits = await checkUserLimits(user.id);

    // Get category counts from email_cache_simple table (privacy-first)
    const categoryCounts = await getCategoryCounts(user.id);

    // Get reply analysis stats
    const replyStats = await getReplyCounts(user.id);

    // Get total organized emails count
    const totalOrganizedEmails = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);

    // Get recent activity from email_cache_simple table
    const { data: recentActivity, error: activityError } = await supabase
      .from('email_cache_simple')
      .select('ai_category, date_iso, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (activityError) {
      console.error('Error fetching recent activity:', activityError);
    }

    // Transform for frontend (minimal data, no email content)
    const recentOrganizedEmails = (recentActivity || []).slice(0, 20).map(item => ({
      id: `org_${Math.random().toString(36).substr(2, 9)}`, // Generate temp ID for display
      category: item.ai_category,
      date: item.date_iso || item.created_at,
      organized_at: item.created_at
    }));

    console.log(`✅ Returning stats for ${totalOrganizedEmails} organized emails, ${replyStats.totalReplies} need replies`);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          planType: limits.planType,
          emailsProcessed: limits.emailsProcessed,
          limit: limits.limit,
          remaining: limits.limit - limits.emailsProcessed
        },
        folderCounts: {
          // Use category counts from email_cache_simple (privacy-first)
          Work: categoryCounts.Work || 0,
          Personal: categoryCounts.Personal || 0,
          Newsletter: categoryCounts.Newsletter || 0,
          Shopping: categoryCounts.Shopping || 0,
          Support: categoryCounts.Support || 0,
          Other: categoryCounts.Other || 0,
          // Add total count
          Total: totalOrganizedEmails,
          // Placeholder for Gmail folders (not implemented in privacy-first approach)
          Sent: 0,
          Archive: 0,
          Trash: 0
        },
        // Include reply stats for frontend
        replyStats: {
          totalReplies: replyStats.totalReplies,
          highUrgency: replyStats.highUrgency,
          mediumUrgency: replyStats.mediumUrgency,
          lowUrgency: replyStats.lowUrgency
        },
        recentEmails: recentOrganizedEmails,
        totalEmails: totalOrganizedEmails,
        // Privacy note
        privacyNote: "Chrome extension authentication - no email content stored"
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error getting user stats:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get user stats',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get Gmail token from Chrome extension
    const gmailToken = request.headers.get('x-gmail-token');
    
    if (!gmailToken) {
      return NextResponse.json({
        success: false,
        error: 'Gmail token required'
      }, { status: 400, headers: corsHeaders });
    }

    // Validate token and get user
    const { email: userEmail, isValid } = await validateGmailTokenAndGetUser(gmailToken);
    
    if (!isValid || !userEmail) {
      return NextResponse.json({
        success: false,
        error: 'Invalid Gmail token'
      }, { status: 401, headers: corsHeaders });
    }

    console.log(`📊 Fetching user stats for: ${userEmail}`);
    
    // Get user from database
    const user = await getOrCreateUser(userEmail);
    
    // Get user limits (this respects alpha mode)
    const limits = await checkUserLimits(user.id);

    console.log(`✅ User stats: ${limits.planType} plan, ${limits.emailsProcessed}/${limits.limit} emails`);

    // Return user stats
    return NextResponse.json({
      success: true,
      data: {
        planType: limits.planType,
        emailsProcessed: limits.emailsProcessed,
        limit: limits.limit,
        remaining: limits.limit - limits.emailsProcessed,
        canProcess: limits.canProcess
      }
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('❌ Error fetching user stats:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch user stats'
    }, { status: 500, headers: corsHeaders });
  }
}