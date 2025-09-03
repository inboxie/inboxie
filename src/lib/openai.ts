// src/lib/openai.ts
import OpenAI from 'openai';
import { EmailData, CategoryResult, ToneProfile, CustomCategory } from '@/types';
import { APP_CONFIG } from '@/config/app';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * Feature 1: Categorize email using predefined categories (Free users)
 */
/**
 * IMPROVED: Categorize email using predefined categories with better newsletter detection
 */
export async function categorizeEmailBasic(email: EmailData): Promise<CategoryResult> {
  try {
    // Pre-check for obvious newsletters/marketing before AI analysis
    const isNewsletter = detectNewsletter(email);
    if (isNewsletter.isNewsletter) {
      return {
        category: 'Newsletter',
        confidence: 0.95,
        reason: isNewsletter.reason,
      };
    }

    const categories = APP_CONFIG.defaultCategories.join(', ');
    
    const prompt = `
Analyze this email and categorize it. You must choose ONE category from this exact list: ${categories}

Email Details:
From: ${email.from}
Subject: ${email.subject}
Content: ${email.body.substring(0, 1500)}

CRITICAL CATEGORIZATION RULES:
1. NEWSLETTER/MARKETING: If sender is a company, brand, service, or has "unsubscribe", "promotional", "marketing" indicators → Newsletter
2. WORK: Only if it's clearly business communication between colleagues/clients/vendors about work matters
3. PERSONAL: Only if it's from a person you know personally (friends, family) about personal matters
4. SUPPORT: Customer service, help desk, technical support, account issues
5. SHOPPING: Order confirmations, shipping, receipts, e-commerce
6. OTHER: Government, legal, medical, or unclear communications

SENDER ANALYSIS:
- Does the sender domain look like a company/service? → Likely Newsletter
- Does it have "no-reply", "noreply", "do-not-reply"? → Likely Newsletter  
- Is it from a person's name + personal domain? → Could be Personal/Work
- Is it from support@, help@, billing@? → Likely Support

SUBJECT ANALYSIS:
- Contains "newsletter", "update", "digest", "weekly"? → Newsletter
- Contains "order", "shipped", "receipt"? → Shopping
- Contains "urgent", "action required", "verify"? → Could be Support
- Contains personal names and casual language? → Personal
- Contains business terms, meetings, projects? → Work

Be VERY strict about what counts as "Work" vs "Newsletter". Most promotional emails should be Newsletter.

Respond with JSON only:
{
  "category": "exact_category_name",
  "confidence": 0.95,
  "reason": "Brief explanation focusing on key indicators"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert email categorization assistant. Be VERY strict about Newsletter vs Work categorization. Most company/brand emails should be Newsletter, not Work. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.05, // Even lower temperature for more consistent results
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
 * Pre-check for newsletters using deterministic rules
 */
function detectNewsletter(email: EmailData): { isNewsletter: boolean; reason: string } {
  const from = email.from.toLowerCase();
  const subject = email.subject.toLowerCase();
  const body = email.body.toLowerCase().substring(0, 1000);

  // Strong newsletter indicators in sender
  const newsletterSenders = [
    'no-reply', 'noreply', 'do-not-reply', 'donotreply',
    'newsletter', 'news@', 'marketing@'
  ];
  
  for (const indicator of newsletterSenders) {
    if (from.includes(indicator)) {
      return { isNewsletter: true, reason: `Newsletter sender pattern: ${indicator}` };
    }
  }

  // Newsletter subject patterns
  const newsletterSubjects = [
    'newsletter', 'weekly update', 'monthly digest', 'news update',
    'unsubscribe', 'view in browser', 'forward to a friend',
    'breaking news', 'latest news', 'industry update'
  ];

  for (const pattern of newsletterSubjects) {
    if (subject.includes(pattern)) {
      return { isNewsletter: true, reason: `Newsletter subject pattern: ${pattern}` };
    }
  }

  // Newsletter body patterns
  const newsletterBodyPatterns = [
    'unsubscribe', 'view in browser', 'forward this email',
    'manage preferences', 'update subscription', 'privacy policy',
    'you received this email because', 'if you no longer wish'
  ];

  for (const pattern of newsletterBodyPatterns) {
    if (body.includes(pattern)) {
      return { isNewsletter: true, reason: `Newsletter body pattern: ${pattern}` };
    }
  }

  // Company domain patterns (common newsletter domains)
  const companyDomains = [
    '.com', '.co', '.io', '.net', '.org'
  ];
  
  // If sender has company-like domain and no personal name, likely newsletter
  const hasPersonalName = /^[A-Za-z]+ [A-Za-z]+/.test(email.from);
  const hasCompanyDomain = companyDomains.some(domain => from.includes(domain));
  
  if (!hasPersonalName && hasCompanyDomain && from.includes('@')) {
    // Additional check: is it a service/product name?
    const serviceKeywords = ['app', 'service', 'platform', 'tool', 'system', 'bot'];
    for (const keyword of serviceKeywords) {
      if (from.includes(keyword)) {
        return { isNewsletter: true, reason: `Service/company sender without personal name` };
      }
    }
  }

  return { isNewsletter: false, reason: 'Not detected as newsletter' };
}

/**
 * Additional helper: Detect work emails more accurately
 */
function isWorkEmail(email: EmailData): boolean {
  const from = email.from.toLowerCase();
  const subject = email.subject.toLowerCase();
  
  // Work indicators
  const workKeywords = [
    'meeting', 'project', 'deadline', 'review', 'approval',
    'client', 'customer', 'proposal', 'contract', 'budget',
    'team', 'colleague', 'manager', 'director', 'ceo'
  ];
  
  // Business email patterns
  const businessDomains = [
    // Common business email providers
    'company.com', 'corp.com', 'inc.com',
    // But exclude obvious newsletter services
    '!mailchimp', '!constantcontact', '!sendgrid'
  ];
  
  const hasWorkKeywords = workKeywords.some(keyword => 
    subject.includes(keyword) || email.body.toLowerCase().includes(keyword)
  );
  
  return hasWorkKeywords;
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
      model: 'gpt-4o-mini', // UPGRADED from gpt-3.5-turbo
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
    console.log(`🎯 Analyzing tone from ${sentEmails.length} sent emails...`);

    // Combine email content for analysis
    const emailContent = sentEmails.map(email => 
      `Subject: ${email.subject}\nContent: ${email.body.substring(0, 500)}`
    ).join('\n\n---\n\n').substring(0, 8000); // Limit to fit in context

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
      model: 'gpt-4o-mini', // UPGRADED from gpt-3.5-turbo
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
.replace(/```json\s*/, '')  // Remove opening ```json
.replace(/```\s*$/, '')     // Remove closing ```
.trim();

const analysis = JSON.parse(cleanContent);

    return {
      userId: 'current_user', // Will be replaced with actual user ID
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
      model: 'gpt-4o', // UPGRADED from gpt-4 (better for complex tone matching)
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
      model: 'text-embedding-3-small', // UPGRADED from text-embedding-ada-002
      input: text.substring(0, 8000), // Limit input size
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Create inline quote reply format (Free Feature - No AI)
 * Now handles pre-formatted Superhuman-style content
 */
export function createInlineQuoteReply(
  originalEmail: EmailData,
  userResponse: string
): string {
  try {
    console.log('📝 Processing Superhuman-style reply...');

    // The userResponse is already formatted with quotes and replies
    // Just add a clean header and signature
    const cleanReply = `${userResponse}

Best regards`;

    console.log('✅ Processed Superhuman-style reply');
    return cleanReply;

  } catch (error) {
    console.error('❌ Error processing reply:', error);
    return userResponse; // Fallback to original
  }
}
// Add this function to your src/lib/openai.ts file

/**
 * Restructure email content for better readability (used in reply interfaces)
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
    return content; // Return original if restructuring fails
  }
}