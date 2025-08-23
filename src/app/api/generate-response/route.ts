// src/app/api/generate-response/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route'; // ADD THIS
import { createGmailDraft } from '@/lib/gmail';
import { generateTonedResponse } from '@/lib/openai';
import { 
  getOrCreateUser, 
  checkUserLimits, 
  getToneProfile,
  getEmailWithDetails
} from '@/lib/supabase';
import { APIResponse, EmailData } from '@/types';

export async function POST(request: NextRequest) {
  try {
    console.log('🤖 Generating AI response with learned tone...');

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
      emailId,
      responseContext,
      includeQuoting = true,
      createDraft = true
    } = body;

    const userEmail = session.user.email;
    const accessToken = session.accessToken as string;

    // Validate required fields
    if (!emailId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: emailId'
      } as APIResponse, { status: 400 });
    }

    // Step 1: Verify user has paid plan
    console.log('💳 Checking user plan access...');
    const user = await getOrCreateUser(userEmail);
    const limits = await checkUserLimits(user.id);

    if (limits.planType !== 'paid') {
      return NextResponse.json({
        success: false,
        error: 'AI response generation is a Pro feature. Please upgrade your plan.',
        data: { 
          feature: 'ai_response_generation',
          requiredPlan: 'paid',
          currentPlan: limits.planType 
        }
      } as APIResponse, { status: 403 });
    }

    // Step 2: Get full email details with body
    console.log('📧 Fetching full email details...');
    const originalEmail = await getEmailWithDetails(emailId, user.id);
    
    if (!originalEmail) {
      return NextResponse.json({
        success: false,
        error: 'Email not found or access denied'
      } as APIResponse, { status: 404 });
    }

    // Step 3: Get user's tone profile
    console.log('🎭 Retrieving user tone profile...');
    const toneProfile = await getToneProfile(user.id);

    if (!toneProfile) {
      return NextResponse.json({
        success: false,
        error: 'No tone profile found. Please train your writing tone first.',
        data: { 
          action: 'POST to /api/tone-training to create your tone profile',
          hasToneProfile: false
        }
      } as APIResponse, { status: 400 });
    }

    // Check if tone profile is recent (optional warning)
    const profileAge = Date.now() - new Date(toneProfile.lastTraining).getTime();
    const daysOld = Math.floor(profileAge / (1000 * 60 * 60 * 24));
    
    if (daysOld > 30) {
      console.log(`⚠️ Tone profile is ${daysOld} days old. Consider retraining for best results.`);
    }

    // Step 4: Generate AI response using learned tone
    console.log('✍️ Generating personalized response...');
    
    // Enhance original email with context if provided
    const emailWithContext: EmailData = {
      ...originalEmail,
      body: responseContext 
        ? `${originalEmail.body}\n\nUser Context: ${responseContext}`
        : originalEmail.body
    };

    const generatedResponse = await generateTonedResponse(
      emailWithContext,
      toneProfile,
      includeQuoting
    );

    // Step 5: Create Gmail draft if requested
    let draftId = null;
    let draftUrl = null;

    if (createDraft) {
      console.log('📧 Creating Gmail draft...');
      
      const replyTo = originalEmail.from;
      const replySubject = originalEmail.subject.startsWith('Re:') 
        ? originalEmail.subject 
        : `Re: ${originalEmail.subject}`;

      try {
        // FIXED: Pass accessToken properly
        draftId = await createGmailDraft(
          accessToken, // Now accessToken is available in this scope
          replyTo,
          replySubject,
          generatedResponse,
          originalEmail.id
        );
        
        draftUrl = `https://mail.google.com/mail/u/0/#drafts/${draftId}`;
        console.log(`✅ Gmail draft created: ${draftId}`);
      } catch (draftError) {
        console.warn('⚠️ Failed to create Gmail draft, but response generated successfully:', draftError);
      }
    }

    // Step 6: Calculate confidence metrics
    const responseMetrics = {
      toneMatch: calculateToneMatch(generatedResponse, toneProfile),
      lengthMatch: calculateLengthMatch(generatedResponse, toneProfile),
      styleElements: findStyleElements(generatedResponse, toneProfile)
    };

    console.log('✅ AI response generated successfully!');

    // Step 7: Return comprehensive response
    return NextResponse.json({
      success: true,
      message: 'AI response generated successfully',
      data: {
        generatedResponse,
        responseMetrics,
        toneProfile: {
          formality: toneProfile.toneCharacteristics.formality,
          length: toneProfile.toneCharacteristics.length,
          lastTraining: toneProfile.lastTraining,
          emailsAnalyzed: toneProfile.sentEmailsAnalyzed
        },
        draft: draftId ? {
          id: draftId,
          url: draftUrl,
          status: 'created'
        } : null,
        originalEmail: {
          id: originalEmail.id,
          subject: originalEmail.subject,
          from: originalEmail.from
        },
        settings: {
          includeQuoting,
          responseContext: !!responseContext,
          autoCreateDraft: createDraft
        },
        warnings: daysOld > 30 ? [
          `Your tone profile is ${daysOld} days old. Consider retraining for more accurate results.`
        ] : []
      }
    } as APIResponse);

  } catch (error) {
    console.error('❌ AI response generation failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'AI response generation failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    } as APIResponse, { status: 500 });
  }
}

// Helper functions for response analysis
function calculateToneMatch(response: string, toneProfile: any): number {
  const formalWords = ['please', 'thank you', 'sincerely', 'regards'];
  const casualWords = ['hey', 'thanks', 'cheers', 'cool'];
  
  const responseWords = response.toLowerCase().split(' ');
  const formalCount = formalWords.filter(word => responseWords.includes(word)).length;
  const casualCount = casualWords.filter(word => responseWords.includes(word)).length;
  
  const expectedFormality = toneProfile.toneCharacteristics.formality;
  
  if (expectedFormality === 'formal' && formalCount > casualCount) return 0.8;
  if (expectedFormality === 'casual' && casualCount > formalCount) return 0.8;
  if (expectedFormality === 'mixed') return 0.7;
  
  return 0.6;
}

function calculateLengthMatch(response: string, toneProfile: any): number {
  const wordCount = response.split(' ').length;
  const expectedLength = toneProfile.toneCharacteristics.length;
  
  if (expectedLength === 'brief' && wordCount < 50) return 0.9;
  if (expectedLength === 'moderate' && wordCount >= 50 && wordCount <= 150) return 0.9;
  if (expectedLength === 'detailed' && wordCount > 150) return 0.9;
  
  return 0.6;
}

function findStyleElements(response: string, toneProfile: any): string[] {
  const commonPhrases = toneProfile.toneCharacteristics.commonPhrases || [];
  const foundElements = [];
  
  for (const phrase of commonPhrases) {
    if (response.toLowerCase().includes(phrase.toLowerCase())) {
      foundElements.push(phrase);
    }
  }
  
  return foundElements;
}