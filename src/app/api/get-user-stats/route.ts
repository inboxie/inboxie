// src/app/api/get-user-stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import { getOrCreateUser, checkUserLimits, detectPendingReplies} from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-fallback-secret';

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

export async function GET(request: NextRequest) {
  try {
    // Get user email from either NextAuth session or extension JWT
    const userEmail = await getUserEmail(request);
    
    if (!userEmail) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 });
    }

    console.log('📊 Getting user stats for:', userEmail);

    // Get user
    const user = await getOrCreateUser(userEmail);
    
    // Get user limits
    const limits = await checkUserLimits(user.id);

    // Get folder counts by category
    const { data: categoryData, error } = await supabase
      .from('email_cache')
      .select('ai_category')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching category data:', error);
    }

    // Count emails by category
    const folderCounts = (categoryData || []).reduce((acc, item) => {
      const category = item.ai_category || 'Other';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 🚀 NEW: Get AI replies count
    const { data: aiRepliesData, error: aiError } = await supabase
      .from('email_cache')
      .select('id')
      .eq('user_id', user.id)
      .not('ai_replied_at', 'is', null); // Count emails where ai_replied_at is NOT null

    const aiRepliesCount = aiRepliesData?.length || 0;
    console.log(`🤖 AI Replies count: ${aiRepliesCount}`);

    if (aiError) {
      console.error('Error fetching AI replies count:', aiError);
    }

    // Get recent emails for inbox view - HIGHER LIMITS FOR PAID USERS
    const emailDisplayLimit = limits.planType === 'paid' ? 500 : 50;
    console.log(`📧 Fetching ${emailDisplayLimit} emails for ${limits.planType} user`);
    
    const { data: recentEmails, error: emailError } = await supabase
      .from('email_cache')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(emailDisplayLimit);

    if (emailError) {
      console.error('Error fetching recent emails:', emailError);
    }

    // Transform emails for frontend
    const transformedEmails = (recentEmails || []).map(email => ({
      id: email.id,
      subject: email.subject,
      from: email.from_addr,
      snippet: email.subject,
      category: email.ai_category,
      aiReason: email.ai_reason,
      processed_at: email.created_at,
      date: email.date_iso || email.created_at
    }));

    // Get pending replies
    const pendingReplies = await detectPendingReplies(user.id);

    // Get total email count from Gmail (if needed for Sent/Archive/Trash)
    // For now, we'll use placeholders for non-processed folders
    const gmailFolderCounts = {
      Sent: 0, // Could fetch from Gmail API if needed
      Archive: 0, // Could fetch from Gmail API if needed  
      Trash: 0 // Could fetch from Gmail API if needed
    };

    console.log(`✅ Returning ${transformedEmails.length} emails for display`);

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
          Inbox: transformedEmails.length, // Total emails processed
          Work: folderCounts.Work || 0,
          Newsletter: folderCounts.Newsletter || 0,
          Personal: folderCounts.Personal || 0,
          Other: folderCounts.Other || 0,
          Sent: gmailFolderCounts.Sent,
          Archive: gmailFolderCounts.Archive,
          Trash: gmailFolderCounts.Trash,
          ...folderCounts // Include any other categories
        },
        recentEmails: transformedEmails,
        pendingReplies: pendingReplies,
        totalEmails: transformedEmails.length,
        // 🚀 NEW: Include AI replies count
        aiRepliesCount: aiRepliesCount
      }
    });

  } catch (error) {
    console.error('Error getting user stats:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get user stats',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userEmail } = await request.json();

    if (!userEmail) {
      return NextResponse.json({
        success: false,
        error: 'User email is required'
      }, { status: 400 });
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
        planType: limits.planType, // This will show 'paid' in alpha mode
        emailsProcessed: limits.emailsProcessed,
        limit: limits.limit,
        remaining: limits.limit - limits.emailsProcessed,
        canProcess: limits.canProcess
      }
    });

  } catch (error) {
    console.error('❌ Error fetching user stats:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch user stats'
    }, { status: 500 });
  }
}