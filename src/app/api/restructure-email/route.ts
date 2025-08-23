import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  let content: string = '';
  
  try {
    // Parse request body once and store content
    const body = await request.json();
    content = body.content;

    // Don't process if content is too short
    if (!content || content.length < 50) {
      return NextResponse.json({ 
        restructuredContent: content,
        processed: false 
      });
    }

    // REMOVED: Skip marketing emails logic - we want to clean them up too!
    
    // Use OpenAI to restructure the email
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an email formatting assistant. Your job is to take poorly formatted email content and restructure it for better readability while preserving all original meaning and content.

Rules:
1. Add proper line breaks and paragraph spacing
2. If there are numbered points, format them clearly with line breaks
3. Preserve all original text - don't summarize or change meaning
4. Add line breaks before questions
5. Separate different topics with appropriate spacing
6. Keep the same tone and voice
7. Don't add any new content or interpretation
8. For emails with many URLs, group them logically and add spacing
9. Make wall-of-text emails readable with proper paragraphs

Return only the restructured text, nothing else.`
        },
        {
          role: "user",
          content: `Please restructure this email content for better readability:\n\n${content}`
        }
      ],
      max_tokens: 1500, // Increased for longer emails
      temperature: 0.1,
    });

    const restructuredContent = completion.choices[0]?.message?.content?.trim();

    return NextResponse.json({
      restructuredContent: restructuredContent || content,
      processed: true,
      originalLength: content.length,
      newLength: restructuredContent?.length || content.length
    });

  } catch (error) {
    console.error('Error restructuring email:', error);
    
    // FIXED: Use the already-parsed content variable instead of re-reading request
    return NextResponse.json({
      restructuredContent: content || '',
      processed: false,
      error: 'AI processing failed'
    });
  }
}