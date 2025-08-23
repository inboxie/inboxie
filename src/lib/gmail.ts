// src/lib/gmail.ts
import { google } from 'googleapis';
import { EmailData } from '@/types';

/**
 * Create Gmail client with user's access token
 */
function createGmailClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  // Use the authenticated user's token instead of hardcoded refresh token
  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Fetch latest emails from Gmail with PROPER pagination support
 */
export async function fetchLatestEmails(accessToken: string, limit: number = 50, offset: number = 0): Promise<EmailData[]> {
  try {
    console.log(`📧 Fetching ${limit} emails from Gmail (offset: ${offset})...`);

    const gmail = createGmailClient(accessToken);

    // Calculate how many API calls we need to reach the offset
    const batchSize = 50; // Gmail API max
    let currentOffset = 0;
    let pageToken: string | undefined = undefined;
    let allMessages: any[] = [];

    // Keep fetching until we have enough emails to cover the offset + limit
    while (currentOffset < offset + limit) {
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: batchSize,
        q: 'in:inbox',
        pageToken: pageToken, // This is how Gmail does pagination
      });

      if (!response.data.messages || response.data.messages.length === 0) {
        console.log('📬 No more messages found in inbox');
        break;
      }

      allMessages.push(...response.data.messages);
      currentOffset += response.data.messages.length;

      // Get the next page token for the next batch
      pageToken = response.data.nextPageToken;
      
      // If no more pages, stop
      if (!pageToken) {
        console.log('📭 Reached end of Gmail messages');
        break;
      }

      console.log(`📧 Fetched ${allMessages.length} total messages so far...`);
    }

    // Now slice the messages we actually want (apply offset and limit)
    const messagesToFetch = allMessages.slice(offset, offset + limit);
    console.log(`🔍 Slicing ${messagesToFetch.length} messages from ${allMessages.length} total (offset: ${offset})`);

    // Fetch full details for each message
    const emails: EmailData[] = [];
    
    for (const message of messagesToFetch) {
      if (message.id) {
        try {
          const emailDetails = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full',
          });

          const parsedEmail = parseGmailMessage(emailDetails.data);
          if (parsedEmail) {
            emails.push(parsedEmail);
          }
        } catch (error) {
          console.error(`Error fetching email ${message.id}:`, error);
          continue; // Skip this email and continue with others
        }
      }
    }

    console.log(`✅ Successfully fetched ${emails.length} emails (offset: ${offset})`);
    return emails;

  } catch (error) {
    console.error('❌ Error fetching emails from Gmail:', error);
    throw new Error('Failed to fetch emails from Gmail');
  }
}

/**
 * Parse Gmail message into our EmailData format
 */
function parseGmailMessage(message: any): EmailData | null {
  try {
    const headers = message.payload?.headers || [];
    const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
    const from = headers.find((h: any) => h.name === 'From')?.value || '';
    const to = headers.find((h: any) => h.name === 'To')?.value || '';
    const date = headers.find((h: any) => h.name === 'Date')?.value || '';

    // Extract email body
    let body = '';
    if (message.payload?.body?.data) {
      body = Buffer.from(message.payload.body.data, 'base64').toString();
    } else if (message.payload?.parts) {
      // Handle multipart messages
      const textPart = message.payload.parts.find((part: any) => 
        part.mimeType === 'text/plain' || part.mimeType === 'text/html'
      );
      if (textPart?.body?.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString();
      }
    }

    return {
      id: message.id,
      threadId: message.threadId,
      subject: cleanText(subject),
      from: cleanText(from),
      to: cleanText(to),
      body: cleanText(body),
      snippet: cleanText(message.snippet || ''),
      date,
      labels: message.labelIds || [],
    };
  } catch (error) {
    console.error('Error parsing Gmail message:', error);
    return null;
  }
}

/**
 * Clean text content (remove junk characters)
 */
function cleanText(text: string): string {
  return text
    .replace(/[\r\n\t]+/g, ' ') // Replace line breaks and tabs with spaces
    .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '') // Remove non-printable characters
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim();
}

/**
 * Get existing Gmail labels
 */
export async function getGmailLabels(accessToken: string): Promise<{ id: string; name: string }[]> {
  try {
    const gmail = createGmailClient(accessToken);

    const response = await gmail.users.labels.list({
      userId: 'me',
    });

    return response.data.labels?.map(label => ({
      id: label.id || '',
      name: label.name || '',
    })) || [];
  } catch (error) {
    console.error('Error fetching Gmail labels:', error);
    throw new Error('Failed to fetch Gmail labels');
  }
}

/**
 * Simple label creation with colors from your working Gmail labels
 */
export async function createGmailLabel(accessToken: string, name: string, category?: string): Promise<string> {
  try {
    const gmail = createGmailClient(accessToken);

    // Check if label already exists
    const existingLabels = await getGmailLabels(accessToken);
    const existingLabel = existingLabels.find(
      label => label.name.toLowerCase() === name.toLowerCase()
    );
    
    if (existingLabel) {
      console.log(`🏷️ Label "${name}" already exists`);
      return existingLabel.id;
    }

    const colorMap: { [key: string]: { textColor: string; backgroundColor: string } } = {
      'newsletter': { textColor: '#000000', backgroundColor: '#a4c2f4' }, // Light blue
      'work': { textColor: '#ffffff', backgroundColor: '#3c78d8' }, // Blue  
      'personal': { textColor: '#ffffff', backgroundColor: '#16a766' }, // Green
      'shopping': { textColor: '#ffffff', backgroundColor: '#f691b3' }, // Pink
      'support': { textColor: '#ffffff', backgroundColor: '#a479e2' }, // Purple (ALLOWED)
      'other': { textColor: '#ffffff', backgroundColor: '#666666' }, // Gray
      'default': { textColor: '#ffffff', backgroundColor: '#666666' } // Gray
    };

    const colors = colorMap[category?.toLowerCase() || 'default'] || colorMap['default'];

    console.log(`🎨 Creating label "${name}" with category "${category}" using colors:`, colors);

    const response = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
        color: colors
      },
    });

    console.log(`✅ Created label: ${name} with ID: ${response.data.id}`);

    // Update colors after creation
    if (response.data.id && category) {
      await updateLabelColors(accessToken, response.data.id, category);
    }
    
    return response.data.id || '';

  } catch (error) {
    console.error(`❌ Error creating label "${name}":`, error);
    return '';
  }
}

/**
 * Apply label to email
 */
export async function applyLabelToEmail(accessToken: string, emailId: string, labelId: string): Promise<void> {
  try {
    if (!labelId || !emailId) {
      console.warn(`⚠️ Invalid IDs - email: ${emailId}, label: ${labelId}`);
      return;
    }

    console.log(`🏷️ Applying label ${labelId} to email ${emailId}`);

    const gmail = createGmailClient(accessToken);

    await gmail.users.messages.modify({
      userId: 'me',
      id: emailId,
      requestBody: {
        addLabelIds: [labelId],
      },
    });

    console.log(`✅ Successfully applied label to email`);

  } catch (error) {
    console.error(`❌ Error applying label:`, error);
  }
}

/**
 * Create Gmail draft - SIMPLE VERSION (No threading)
 */
export async function createGmailDraft(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
  inReplyTo?: string,
  originalEmail?: any
): Promise<string> {
  try {
    console.log(`📝 Creating draft email to: ${to} (SIMPLE VERSION)`);
    
    const gmail = createGmailClient(accessToken);

    // Create both plain text and HTML versions
    const plainTextBody = body;
    const htmlBody = convertReplyToHtml(body);

    // Create multipart email
    const boundary = `boundary_${Date.now()}`;
    
    const headers = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ''
    ].join('\r\n');

    const emailBody = [
      `--${boundary}`,
      `Content-Type: text/plain; charset=utf-8`,
      '',
      plainTextBody,
      '',
      `--${boundary}`,
      `Content-Type: text/html; charset=utf-8`,
      '',
      htmlBody,
      '',
      `--${boundary}--`
    ].join('\r\n');

    const email = headers + '\r\n' + emailBody;
    
    const encodedEmail = Buffer.from(email).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Simple draft creation - NO threading, NO fallback
    const response = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: encodedEmail
        }
      }
    });

    console.log(`✅ Created draft: ${response.data.id}`);
    return response.data.id || '';

  } catch (error) {
    console.error('❌ Error creating Gmail draft:', error);
    throw new Error(`Failed to create Gmail draft: ${(error as any)?.message || error}`);
  }
}

/**
 * Convert plain text reply to HTML with proper quote styling
 */
function convertReplyToHtml(plainTextReply: string): string {
  // Split the reply into sections
  const lines = plainTextReply.split('\r\n');
  let html = '<div style="font-family: Arial, sans-serif; font-size: 13px; color: #333;">\n';
  
  let inQuoteBlock = false;
  let currentSection = '';
  
  for (const line of lines) {
    if (line.startsWith('On ') && line.includes(' wrote:')) {
      // Start of quote header
      if (currentSection.trim()) {
        // Add previous response section
        html += `<div style="margin: 10px 0;">${escapeHtml(currentSection.trim())}</div>\n`;
        currentSection = '';
      }
      
      html += `<div style="margin: 15px 0 5px 0; font-size: 12px; color: #666;">${escapeHtml(line)}</div>\n`;
      html += '<blockquote style="margin: 0 0 15px 10px; padding-left: 10px; border-left: 2px solid #ccc; color: #666; font-size: 12px;">\n';
      inQuoteBlock = true;
    } else if (line.startsWith('> ')) {
      // Quote line
      if (inQuoteBlock) {
        html += escapeHtml(line.substring(2)) + '<br>\n';
      }
    } else if (line.trim() === '---') {
      // Section separator
      if (inQuoteBlock) {
        html += '</blockquote>\n';
        inQuoteBlock = false;
      }
      html += '<hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">\n';
    } else if (line.trim() === '') {
      // Empty line
      if (inQuoteBlock) {
        html += '<br>\n';
      } else if (currentSection.trim()) {
        currentSection += '\n';
      }
    } else {
      // Regular response line
      if (inQuoteBlock) {
        html += '</blockquote>\n';
        inQuoteBlock = false;
      }
      currentSection += line + '\n';
    }
  }
  
  // Add final section
  if (currentSection.trim()) {
    html += `<div style="margin: 10px 0;">${escapeHtml(currentSection.trim()).replace(/\n/g, '<br>')}</div>\n`;
  }
  
  // Close any open quote block
  if (inQuoteBlock) {
    html += '</blockquote>\n';
  }
  
  html += '</div>';
  
  return html;
}

/**
 * Escape HTML characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Get sent emails for tone training
 */
export async function fetchSentEmails(accessToken: string, limit: number = 100): Promise<EmailData[]> {
  try {
    console.log(`📤 Fetching ${limit} sent emails for tone analysis...`);

    const gmail = createGmailClient(accessToken);

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: limit,
      q: 'in:sent', // Only sent emails
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      console.log('📭 No sent emails found');
      return [];
    }

    const sentEmails: EmailData[] = [];
    
    for (const message of response.data.messages) {
      if (message.id) {
        try {
          const emailDetails = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full',
          });

          const parsedEmail = parseGmailMessage(emailDetails.data);
          if (parsedEmail && parsedEmail.body.length > 50) { // Only include substantial emails
            sentEmails.push(parsedEmail);
          }
        } catch (error) {
          console.error(`Error fetching sent email ${message.id}:`, error);
          continue; // Skip this email and continue with others
        }
      }
    }

    console.log(`✅ Successfully fetched ${sentEmails.length} sent emails for tone analysis`);
    return sentEmails;

  } catch (error) {
    console.error('❌ Error fetching sent emails:', error);
    throw new Error('Failed to fetch sent emails for tone training');
  }
}

/**
 * Test Gmail connection and permissions
 */
export async function testGmailConnection(accessToken: string): Promise<boolean> {
  try {
    console.log('🔍 Testing Gmail connection...');
    
    const gmail = createGmailClient(accessToken);

    const response = await gmail.users.getProfile({
      userId: 'me',
    });

    if (response.data.emailAddress) {
      console.log(`✅ Gmail connection successful for: ${response.data.emailAddress}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Gmail connection test failed:', error);
    return false;
  }
}

/**
 * Update label colors after creation
 */
export async function updateLabelColors(accessToken: string, labelId: string, category: string): Promise<void> {
  try {
    const gmail = createGmailClient(accessToken);

    const colorMap: { [key: string]: { textColor: string; backgroundColor: string } } = {
      'newsletter': { textColor: '#000000', backgroundColor: '#a4c2f4' }, // Light blue
      'work': { textColor: '#ffffff', backgroundColor: '#3c78d8' }, // Blue
      'personal': { textColor: '#ffffff', backgroundColor: '#16a766' }, // Green  
      'shopping': { textColor: '#ffffff', backgroundColor: '#f691b3' }, // Pink
      'support': { textColor: '#ffffff', backgroundColor: '#a479e2' }, // Purple (ALLOWED)
      'other': { textColor: '#ffffff', backgroundColor: '#666666' }, // Gray
      'default': { textColor: '#ffffff', backgroundColor: '#666666' } // Gray
    };
    
    // Make it case-insensitive
    const colors = colorMap[category?.toLowerCase() || 'default'] || colorMap['default'];

    console.log(`🎨 Updating label ${labelId} with colors:`, colors);

    await gmail.users.labels.update({
      userId: 'me',
      id: labelId,
      requestBody: {
        color: colors
      },
    });

    console.log(`✅ Updated label colors for ${labelId}`);

  } catch (error) {
    console.error(`❌ Error updating label colors:`, error);
  }
}

/**
 * Get user's Gmail profile info
 */
export async function getGmailProfile(accessToken: string): Promise<{ email: string; messagesTotal: number }> {
  try {
    const gmail = createGmailClient(accessToken);

    const response = await gmail.users.getProfile({
      userId: 'me',
    });

    return {
      email: response.data.emailAddress || '',
      messagesTotal: response.data.messagesTotal || 0,
    };
  } catch (error) {
    console.error('Error fetching Gmail profile:', error);
    throw new Error('Failed to fetch Gmail profile');
  }
}