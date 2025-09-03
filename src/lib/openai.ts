// src/lib/openai.ts
import OpenAI from 'openai';
import { EmailData, CategoryResult, ToneProfile, CustomCategory } from '@/types';
import { APP_CONFIG } from '@/config/app';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Feature 1: Categorize email using predefined categories (Free users)
 * UPDATED: Removed aggressive pre-filtering, rely on better AI prompts
 */
export async function categorizeEmailBasic(email: EmailData): Promise<CategoryResult> {
  try {
    const categories = APP_CONFIG.defaultCategories.join(', ');
    
    const prompt = `
Categorize this email. Choose exactly ONE category from: ${categories}

From: ${email.from}
Subject: ${email.subject}
Content: ${email.body.substring(0, 1500)}

CATEGORIES EXPLAINED:

PERSONAL: Your personal life and accounts:
- Personal banking, credit cards, loans (statements, notifications)
- Personal investments, trading accounts, pensions (account updates)
- Personal insurance, healthcare, utilities (bills, notifications)
- Personal shopping, subscriptions (confirmations, renewals)
- Friends, family communications
- Personal services (gym, subscriptions, personal tools)

WORK: Your job and professional business:
- Emails from coworkers, managers, team members
- Client communications, vendor discussions
- Work project updates, meeting requests
- Business development, professional networking
- Work-related tools and systems (deployment alerts, work notifications)
- Professional opportunities and career discussions

NEWSLETTER: Mass marketing and promotional content:
- Sales campaigns with discount offers
- Company blog posts and content marketing
- Industry news and insights (not personally addressed)
- Product announcements and feature updates
- Weekly/monthly company newsletters
- Clear promotional campaigns designed to sell products

SHOPPING: E-commerce transactions:
- Purchase confirmations and receipts
- Shipping and delivery tracking
- Return/exchange processes
- Product recommendations after purchases

SUPPORT: Customer service interactions:
- Help desk tickets requiring your response
- Account troubleshooting and technical issues
- Service problems needing resolution
- Billing disputes requiring action

OTHER: Everything else:
- Government, legal, medical communications
- Educational content, research materials
- Unclear or ambiguous emails

IMPORTANT: Account notifications from financial services (banks, trading platforms, pensions) are PERSONAL, not newsletters. These are important personal account communications, not marketing.

Respond in JSON:
{
  "category": "category_name",
  "confidence": 0.95,
  "reason": "Brief explanation"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert email categorization assistant. Be precise and conservative with Work categorization. Most company emails should be Newsletter unless they involve direct business collaboration. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent categorization
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(content);
    
    // Validate the category is in our allowed list
    if (!APP_CONFIG.defaultCategories.includes(result.category)) {
      console.warn(`Invalid category "${result.category}", defaulting to "Other"`);
      result.category = 'Other';
    }

    return {
      category: result.category,
      confidence: result.confidence || 0.8,
      reason: result.reason || 'Categorized by AI',
    };

  } catch (error) {
    console.error('Error categorizing email:', error);
    return {
      category: 'Other',
      confidence: 0.5,
      reason: 'Error in categorization',
    };
  }
}

/**
 * Feature 1: Categorize email using custom categories (Paid users)
 */
export async function categorizeEmailCustom(
  email: EmailData, 
  customCategories: CustomCategory[]
): Promise<CategoryResult> {
  try {
    const categoryList = customCategories.map(cat => 
      `${cat.name}: ${cat.description || ''}`
    ).join('\n');
    
    const categoryNames = customCategories.map(cat => cat.name).join(', ');

    const prompt = `
Analyze this email and categorize it using these CUSTOM categories:

${categoryList}

Email Details:
From: ${email.from}
Subject: ${email.subject}
Content: ${email.body.substring(0, 1000)}

You must choose ONE category from: ${categoryNames}

IMPORTANT: 
- Be DETERMINISTIC - same email should always get same category
- Consider the category descriptions carefully
- If no custom category fits well, use the closest match

Respond with JSON only:
{
  "category": "exact_category_name",
  "confidence": 0.95,
  "reason": "Brief explanation why this category fits"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert email categorization assistant. Always respond with valid JSON. Use the user\'s custom categories precisely.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(content);
    
    // Validate category exists in custom list
    const validCategory = customCategories.find(cat => cat.name === result.category);
    if (!validCategory) {
      result.category = customCategories[0]?.name || 'Other';
    }

    return {
      category: result.category,
      confidence: result.confidence || 0.8,
      reason: result.reason || 'Categorized by AI',
    };

  } catch (error) {
    console.error('Error categorizing email with custom categories:', error);
    return {
      category: customCategories[0]?.name || 'Other',
      confidence: 0.5,
      reason: 'Error in categorization',
    };
  }
}

/**
 * Feature 3: Analyze sent emails to build tone profile
 */
export async function analyzeToneProfile(sentEmails: EmailData[]): Promise<ToneProfile> {
  try {
    console.log(`Analyzing tone from ${sentEmails.length} sent emails...`);

    // Combine email content for analysis
    const emailContent = sentEmails.map(email => 
      `Subject: ${email.subject}\nContent: ${email.body.substring(0, 500)}`
    ).join('\n\n---\n\n').substring(0, 8000);

    const prompt = `
Analyze these sent emails to understand the user's writing tone and style:

${emailContent}

Analyze for:
1. Formality level (formal/casual/mixed)
2. Typical length (brief/moderate/detailed)
3. Writing style characteristics
4. Common phrases or expressions used

Respond with JSON only:
{
  "formality": "formal|casual|mixed",
  "length": "brief|moderate|detailed", 
  "style": ["characteristic1", "characteristic2", "characteristic3"],
  "commonPhrases": ["phrase1", "phrase2", "phrase3"]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert communication analyst. Analyze writing patterns and respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Clean the response - remove markdown code blocks if present
    const cleanContent = content
      .replace(/```json\s*/, '')
      .replace(/```\s*$/, '')
      .trim();

    const analysis = JSON.parse(cleanContent);

    return {
      userId: 'current_user',
      sentEmailsAnalyzed: sentEmails.length,
      toneCharacteristics: {
        formality: analysis.formality || 'mixed',
        length: analysis.length || 'moderate',
        style: analysis.style || [],
        commonPhrases: analysis.commonPhrases || [],
      },
      lastTraining: new Date().toISOString(),
    };

  } catch (error) {
    console.error('Error analyzing tone profile:', error);
    throw new Error('Failed to analyze tone profile');
  }
}

/**
 * Feature 3: Generate AI response using learned tone
 */
export async function generateTonedResponse(
  originalEmail: EmailData,
  toneProfile: ToneProfile,
  includeQuoting: boolean = true
): Promise<string> {
  try {
    const { formality, length, style, commonPhrases } = toneProfile.toneCharacteristics;

    let quotedContent = '';
    if (includeQuoting) {
      quotedContent = `\n\nOn ${originalEmail.date}, ${originalEmail.from} wrote:\n> ${originalEmail.body.split('\n').join('\n> ')}`;
    }

    const prompt = `
Generate a response to this email using the user's specific writing tone:

Original Email:
From: ${originalEmail.from}
Subject: ${originalEmail.subject}
Content: ${originalEmail.body.substring(0, 1000)}

User's Writing Style:
- Formality: ${formality}
- Length: ${length}  
- Style characteristics: ${style.join(', ')}
- Common phrases: ${commonPhrases.join(', ')}

Generate a response that:
1. Matches the user's tone and style exactly
2. Uses their typical formality level
3. Matches their usual email length
4. Incorporates their common phrases naturally
5. Addresses the original email appropriately

${includeQuoting ? 'Include the quoted original email at the end.' : ''}

Response:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert email writer. Generate responses that perfectly match the user\'s established writing tone and style.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 600,
    });

    const generatedResponse = response.choices[0]?.message?.content;
    if (!generatedResponse) {
      throw new Error('No response generated');
    }

    return includeQuoting ? generatedResponse + quotedContent : generatedResponse;

  } catch (error) {
    console.error('Error generating toned response:', error);
    throw new Error('Failed to generate AI response');
  }
}

/**
 * Feature 4: Generate embeddings for semantic search
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000),
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Create inline quote reply format (Free Feature - No AI)
 */
export function createInlineQuoteReply(
  originalEmail: EmailData,
  userResponse: string
): string {
  try {
    console.log('Processing reply...');

    const cleanReply = `${userResponse}

Best regards`;

    console.log('Processed reply');
    return cleanReply;

  } catch (error) {
    console.error('Error processing reply:', error);
    return userResponse;
  }
}

/**
 * Restructure email content for better readability
 */
export async function restructureEmailContent(content: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an email formatting assistant. Restructure email content for better readability while preserving all original meaning.

Rules:
1. Add proper line breaks and paragraph spacing
2. Format numbered points clearly with line breaks
3. Preserve all original text - don't summarize or change meaning
4. Add line breaks before questions
5. Separate different topics with appropriate spacing
6. Keep the same tone and voice
7. Don't add any new content or interpretation
8. Remove excessive line breaks but maintain logical spacing
9. Format any lists or bullet points clearly

Return only the restructured text, nothing else.`
        },
        {
          role: 'user',
          content: `Please restructure this email content for better readability:\n\n${content}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.1,
    });

    const restructuredContent = response.choices[0]?.message?.content?.trim();
    return restructuredContent || content;

  } catch (error) {
    console.error('Error restructuring email content:', error);
    return content;
  }
}