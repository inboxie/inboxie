// src/app/api/tone-training/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route'; // ADD THIS IMPORT
import { fetchSentEmails, createGmailDraft } from '@/lib/gmail';
import { analyzeToneProfile, generateTonedResponse } from '@/lib/openai';
import { 
  getOrCreateUser, 
  checkUserLimits, 
  saveToneProfile, 
  getToneProfile 
} from '@/lib/supabase';
import { APIResponse, ToneProfile } from '@/types';

// POST: Train user's tone profile from sent emails
export async function POST(request: NextRequest) {
  try {
    console.log('🎭 Starting tone profile training...');

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
    const { analyzeCount = 50 } = body;
    const userEmail = session.user.email;
    const accessToken = session.accessToken as string;

    console.log(`📧 Training tone for authenticated user: ${userEmail}`);

    // Step 1: Verify user has paid plan
    console.log('💳 Checking user plan access...');
    const user = await getOrCreateUser(userEmail);
    const limits = await checkUserLimits(user.id);

    if (limits.planType !== 'paid') {
      return NextResponse.json({
        success: false,
        error: 'Tone training is a Pro feature. Please upgrade your plan.',
        data: { 
          feature: 'tone_training',
          requiredPlan: 'paid',
          currentPlan: limits.planType 
        }
      } as APIResponse, { status: 403 });
    }

    // Step 2: Fetch user's sent emails for analysis
    console.log(`📤 Fetching up to ${analyzeCount} sent emails for tone analysis...`);
    const sentEmails = await fetchSentEmails(accessToken, analyzeCount); // FIXED: Pass accessToken

    console.log(`📊 Actually retrieved ${sentEmails.length} sent emails from Gmail`);

    if (sentEmails.length < 5) {
      return NextResponse.json({
        success: false,
        error: 'Not enough sent emails to analyze tone. Need at least 5 sent emails.',
        data: { 
          sentEmailsFound: sentEmails.length, 
          minimumRequired: 5,
          tip: 'Send a few more emails and try again'
        }
      } as APIResponse, { status: 400 });
    }

    // Step 3: Analyze tone profile using OpenAI
    console.log(`🤖 Analyzing tone from ${sentEmails.length} emails...`);
    const toneProfile = await analyzeToneProfile(sentEmails);
    
    // Set the correct user ID
    toneProfile.userId = user.id;

    // Step 4: Save tone profile to database
    console.log('💾 Saving tone profile...');
    await saveToneProfile(toneProfile);

    console.log('✅ Tone profile training completed successfully!');

    // Step 5: Return results with ACCURATE counts
    return NextResponse.json({
      success: true,
      message: `Tone profile trained successfully using ${sentEmails.length} emails`,
      data: {
        toneProfile: {
          sentEmailsAnalyzed: sentEmails.length,
          emailsRequested: analyzeCount,
          emailsActuallyUsed: sentEmails.length,
          formality: toneProfile.toneCharacteristics.formality,
          length: toneProfile.toneCharacteristics.length,
          styleCount: toneProfile.toneCharacteristics.style.length,
          phrasesLearned: toneProfile.toneCharacteristics.commonPhrases.length,
          lastTraining: toneProfile.lastTraining
        },
        nextSteps: [
          'Tone profile is now ready',
          'You can now generate AI responses that match your writing style',
          'Use the /generate-response endpoint to create replies'
        ]
      }
    } as APIResponse);

  } catch (error) {
    console.error('❌ Tone training failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Tone training failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    } as APIResponse, { status: 500 });
  }
}

// GET: Retrieve user's current tone profile
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('userEmail');

    if (!userEmail) {
      return NextResponse.json({
        success: false,
        error: 'User email parameter is required'
      } as APIResponse, { status: 400 });
    }

    // Verify user access
    const user = await getOrCreateUser(userEmail);
    const limits = await checkUserLimits(user.id);

    if (limits.planType !== 'paid') {
      return NextResponse.json({
        success: false,
        error: 'Tone training is a Pro feature',
        data: { currentPlan: limits.planType, requiredPlan: 'paid' }
      } as APIResponse, { status: 403 });
    }

    // Get tone profile
    const toneProfile = await getToneProfile(user.id);

    if (!toneProfile) {
      return NextResponse.json({
        success: false,
        error: 'No tone profile found. Please train your tone first.',
        data: { 
          hasToneProfile: false,
          action: 'POST to /api/tone-training to create profile'
        }
      } as APIResponse, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Tone profile retrieved successfully',
      data: {
        toneProfile: {
          sentEmailsAnalyzed: toneProfile.sentEmailsAnalyzed,
          formality: toneProfile.toneCharacteristics.formality,
          length: toneProfile.toneCharacteristics.length,
          style: toneProfile.toneCharacteristics.style,
          commonPhrases: toneProfile.toneCharacteristics.commonPhrases.slice(0, 5),
          lastTraining: toneProfile.lastTraining,
          isReady: true
        }
      }
    } as APIResponse);

  } catch (error) {
    console.error('❌ Error retrieving tone profile:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve tone profile',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    } as APIResponse, { status: 500 });
  }
}