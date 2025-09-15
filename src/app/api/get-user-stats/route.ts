// src/app/api/get-user-stats/route.ts - Updated for email_cache_simple table with CORS + Reply Analysis
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { getOrCreateUser, checkUserLimits, getCategoryCounts, getReplyCounts } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-fallback-secret';

// CORS headers for extension requests
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://mail.google.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Google-Token',
  'Access-Control-Allow-Credentials': 'true'
};

// Helper function to get user email from either NextAuth session OR extension JWT
async function getUserEmail(request: NextRequest): Promise<string | null> {
  // Try NextAuth session first (for web app)
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    console.log('🌐 Using NextAuth session for:', session.user.email);
    return session.user.email;
  }

  // Try extension JWT token (for Chrome extension)
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.email && decoded.type === 'extension') {
        console.log('🔧 Using extension JWT for:', decoded.email);
        return decoded.email;
      }
    } catch (error) {
      console.error('❌ Invalid extension JWT:', error);
    }
  }

  return null;
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders
  });
}

export async function GET(request: NextRequest) {
  try {
    // Get user email from either NextAuth session or extension JWT
    const userEmail = await getUserEmail(request);
    
    if (!userEmail) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401, headers: corsHeaders });
    }

    console.log('📊 Getting user stats for:', userEmail);

    // Get user
    const user = await getOrCreateUser(userEmail);
    
    // Get user limits
    const limits = await checkUserLimits(user.id);

    // Get category counts from email_cache_simple table (privacy-first)
    const categoryCounts = await getCategoryCounts(user.id);

    // NEW: Get reply analysis stats
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
        // NEW: Include reply stats for frontend
        replyStats: {
          totalReplies: replyStats.totalReplies,
          highUrgency: replyStats.highUrgency,
          mediumUrgency: replyStats.mediumUrgency,
          lowUrgency: replyStats.lowUrgency
        },
        recentEmails: recentOrganizedEmails,
        totalEmails: totalOrganizedEmails,
        // Privacy note
        privacyNote: "Only organization metadata stored - no email content + reply analysis"
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
    const { userEmail } = await request.json();

    if (!userEmail) {
      return NextResponse.json({
        success: false,
        error: 'User email is required'
      }, { status: 400, headers: corsHeaders });
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