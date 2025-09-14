// src/lib/openai.ts - In-Memory Processing (Privacy-First) + Reply Analysis
import OpenAI from 'openai';
import { APP_CONFIG } from '@/config/app';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface EmailData {
  id: string;
  subject: string;
  from: string;
  body: string;
  snippet: string;
  date: string;
  threadId?: string;
}

/**
 * Categorize email using full content for accuracy (in-memory only)
 * Content is processed and immediately discarded - never stored
 */
export async function categorizeEmailBasic(email: EmailData): Promise<string> {
  try {
    const categoryList = APP_CONFIG.defaultCategories.join(', ');
    
    const prompt = `
Categorize this email. Choose exactly ONE category from: ${categoryList}

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

Respond with just the category name: Work, Personal, Newsletter, Shopping, Support, or Other`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert email categorization assistant. Be precise and conservative with Work categorization. Most company emails should be Newsletter unless they involve direct business collaboration. Respond with just the category name.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent categorization
      max_tokens: 10, // Just need the category name
    });

    const category = response.choices[0]?.message?.content?.trim();
    
    if (!category) {
      console.warn('No category returned from OpenAI, defaulting to Other');
      return 'Other';
    }

    // Validate the category is in our allowed list
    if (!APP_CONFIG.defaultCategories.includes(category)) {
      console.warn(`Invalid category "${category}", defaulting to "Other"`);
      return 'Other';
    }

    console.log(`Categorized email "${email.subject}" as: ${category}`);
    return category;

  } catch (error) {
    console.error('Error categorizing email:', error);
    return 'Other';
  }
}

/**
 * NEW: Analyze if email needs a reply (Background processing)
 */
export async function analyzeEmailForReply(email: any): Promise<{
  needsReply: boolean;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
}> {
  try {
    // Quick pre-filtering for obvious non-reply emails
    const skipCategories = ['newsletter', 'marketing', 'other'];
    if (skipCategories.includes(email.ai_category?.toLowerCase())) {
      return { needsReply: false, reason: 'Newsletter/marketing email', urgency: 'low' };
    }

    if (!email.from || 
        email.from.includes('no-reply') || 
        email.from.includes('noreply') ||
        email.from.includes('donotreply')) {
      return { needsReply: false, reason: 'No-reply sender', urgency: 'low' };
    }

    // Check if email is recent (within 14 days)
    const emailDate = new Date(email.date);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    if (emailDate < fourteenDaysAgo) {
      return { needsReply: false, reason: 'Email too old', urgency: 'low' };
    }

    const prompt = `
Analyze this email and determine if it requires a response from the recipient.

From: ${email.from}
Subject: ${email.subject}
Category: ${email.category || 'Unknown'}
Body: ${email.body || email.snippet || ''}

Consider:
- Is the sender asking a question or requesting information?
- Does it require action, confirmation, or feedback?
- Is it a request for a meeting, call, or collaboration?
- Does it express urgency or importance?
- Is the sender expecting a response?

IGNORE emails that are:
- Just informational updates or FYIs
- Automated confirmations or receipts
- Marketing or promotional content
- "Thank you" messages that don't require follow-up
- Newsletter-style content

Respond with JSON only:
{
  "needsReply": true/false,
  "reason": "Brief explanation why it needs/doesn't need a reply",
  "urgency": "low/medium/high"
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert email assistant that helps identify which emails need responses. Be precise and practical. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent results
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Clean the response - remove markdown code blocks if present
    const cleanContent = content
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const result = JSON.parse(cleanContent);
    
    return {
      needsReply: result.needsReply || false,
      reason: result.reason || 'AI analysis completed',
      urgency: result.urgency || 'low'
    };

  } catch (error) {
    console.error(`Reply analysis failed for email ${email.id}:`, error);
    return { needsReply: false, reason: 'Analysis error', urgency: 'low' };
  }
}

/**
 * Batch categorize multiple emails for efficiency (in-memory processing)
 * All email content is processed and immediately discarded
 */
export async function categorizeEmailsBatch(emailsList: EmailData[]): Promise<string[]> {
  try {
    if (emailsList.length === 0) return [];
    
    // For small batches, categorize individually for better accuracy
    if (emailsList.length <= 3) {
      console.log(`Processing ${emailsList.length} emails individually for accuracy`);
      const results = await Promise.all(
        emailsList.map(email => categorizeEmailBasic(email))
      );
      return results;
    }

    // For larger batches, use batch processing
    console.log(`Batch processing ${emailsList.length} emails`);
    const categoryOptions = APP_CONFIG.defaultCategories.join(', ');
    
    const emailsText = emailsList.map((email, index) => 
      `${index + 1}. From: ${email.from}
   Subject: ${email.subject}
   Content: ${email.body.substring(0, 500)}`
    ).join('\n\n');

    const prompt = `
Categorize these ${emailsList.length} emails. For each email, choose exactly ONE category from: ${categoryOptions}

${emailsText}

CATEGORIES: Work, Personal, Newsletter, Shopping, Support, Other

Use the same categorization rules as before. Respond with just the category names, one per line, numbered:
1. [Category]
2. [Category]
3. [Category]
...`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert email categorization assistant. Respond with just category names, one per line, numbered to match the input emails.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: emailsList.length * 5, // ~5 tokens per category line
    });

    const content = response.choices[0]?.message?.content?.trim();
    
    if (!content) {
      console.warn('No response from batch categorization, using individual fallback');
      return Promise.all(emailsList.map(email => categorizeEmailBasic(email)));
    }

    // Parse the numbered response
    const lines = content.split('\n');
    const responseCategories = lines
      .map(line => {
        // Extract category from "1. Category" format
        const match = line.match(/^\d+\.\s*(.+)$/);
        return match ? match[1].trim() : line.trim();
      })
      .filter(cat => APP_CONFIG.defaultCategories.includes(cat))
      .slice(0, emailsList.length); // Ensure we don't get more than we asked for

    // Fill any missing categories with 'Other'
    while (responseCategories.length < emailsList.length) {
      responseCategories.push('Other');
    }

    console.log(`Batch categorization complete: ${responseCategories.length} emails processed`);
    return responseCategories;

  } catch (error) {
    console.error('Error in batch categorization:', error);
    // Fallback to individual categorization
    console.log('Falling back to individual categorization');
    return Promise.all(emailsList.map(email => categorizeEmailBasic(email)));
  }
}

/**
 * NEW: Batch analyze emails for reply requirements
 */
export async function analyzeEmailsForReplyBatch(emails: any[]): Promise<Array<{
  id: string;
  needsReply: boolean;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
}>> {
  try {
    if (emails.length === 0) return [];
    
    // For small batches, analyze individually for better accuracy
    if (emails.length <= 3) {
      console.log(`Analyzing ${emails.length} emails for replies individually`);
      const results = await Promise.all(
        emails.map(async email => {
          const analysis = await analyzeEmailForReply(email);
          return {
            id: email.id,
            ...analysis
          };
        })
      );
      return results;
    }

    // For larger batches, use individual processing (reply analysis is complex)
    console.log(`Analyzing ${emails.length} emails for replies individually`);
    const results = await Promise.all(
      emails.map(async email => {
        const analysis = await analyzeEmailForReply(email);
        return {
          id: email.id,
          ...analysis
        };
      })
    );

    console.log(`Reply analysis complete: ${results.filter(r => r.needsReply).length}/${results.length} need replies`);
    return results;

  } catch (error) {
    console.error('Error in batch reply analysis:', error);
    // Return safe defaults
    return emails.map(email => ({
      id: email.id,
      needsReply: false,
      reason: 'Analysis error',
      urgency: 'low' as const
    }));
  }
}

/**
 * Process emails and return only metadata (content discarded immediately)
 * This function demonstrates the in-memory processing approach
 */
export async function processEmailsInMemory(emails: EmailData[]): Promise<Array<{
  id: string;
  category: string;
  date: string;
  threadId: string;
}>> {
  try {
    console.log(`Processing ${emails.length} emails in memory (content will be discarded)`);
    
    // Categorize emails using full content
    const emailCategories = await categorizeEmailsBatch(emails);
    
    // Extract only metadata, discard content
    const results = emails.map((email, index) => ({
      id: email.id,
      category: emailCategories[index] || 'Other',
      date: email.date,
      threadId: email.threadId || email.id
    }));
    
    // At this point, email content is out of scope and will be garbage collected
    console.log(`In-memory processing complete. Content discarded, returning ${results.length} metadata records`);
    
    return results;
    
  } catch (error) {
    console.error('Error in in-memory email processing:', error);
    
    // Return basic metadata even on error
    return emails.map(email => ({
      id: email.id,
      category: 'Other',
      date: email.date,
      threadId: email.threadId || email.id
    }));
  }
}

/**
 * NEW: Process emails with both categorization AND reply analysis
 * Returns enhanced metadata with reply information
 */
export async function processEmailsWithReplyAnalysis(emails: EmailData[]): Promise<Array<{
  id: string;
  category: string;
  date: string;
  threadId: string;
  needsReply: boolean;
  replyReason: string;
  urgency: 'low' | 'medium' | 'high';
}>> {
  try {
    console.log(`Processing ${emails.length} emails with categorization + reply analysis (content will be discarded)`);
    
    // Step 1: Categorize emails
    const emailCategories = await categorizeEmailsBatch(emails);
    
    // Step 2: Prepare emails for reply analysis (add categories)
    const emailsWithCategories = emails.map((email, index) => ({
      ...email,
      category: emailCategories[index] || 'Other'
    }));
    
    // Step 3: Analyze for replies
    const replyAnalysis = await analyzeEmailsForReplyBatch(emailsWithCategories);
    
    // Step 4: Combine results and extract only metadata
    const results = emails.map((email, index) => {
      const replyInfo = replyAnalysis.find(r => r.id === email.id);
      
      return {
        id: email.id,
        category: emailCategories[index] || 'Other',
        date: email.date,
        threadId: email.threadId || email.id,
        needsReply: replyInfo?.needsReply || false,
        replyReason: replyInfo?.reason || 'No analysis',
        urgency: replyInfo?.urgency || 'low'
      };
    });
    
    // At this point, email content is out of scope and will be garbage collected
    console.log(`Enhanced processing complete. Content discarded, returning ${results.length} metadata records with reply analysis`);
    console.log(`Reply summary: ${results.filter(r => r.needsReply).length} emails need replies`);
    
    return results;
    
  } catch (error) {
    console.error('Error in enhanced email processing:', error);
    
    // Return basic metadata even on error
    return emails.map(email => ({
      id: email.id,
      category: 'Other',
      date: email.date,
      threadId: email.threadId || email.id,
      needsReply: false,
      replyReason: 'Processing error',
      urgency: 'low' as const
    }));
  }
}