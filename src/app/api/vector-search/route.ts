// src/app/api/vector-search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding } from '@/lib/openai';
import { 
  getOrCreateUser, 
  checkUserLimits,
  searchEmailsByVector,
  saveEmailEmbedding 
} from '@/lib/supabase';
import { APIResponse, SearchQuery, SearchResult } from '@/types';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Processing semantic email search...');

    // Get request data
    const body = await request.json();
    const { 
      userEmail,
      query,           // Natural language search query
      limit = 10,      // Number of results to return
      searchType = 'semantic', // 'semantic' or 'keyword'
      filters = {}     // Optional filters (date range, categories, etc.)
    } = body;

    // Validate required fields
    if (!userEmail || !query) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: userEmail and query'
      } as APIResponse, { status: 400 });
    }

    // Step 1: Verify user has paid plan
    console.log('💳 Checking user plan access...');
    const user = await getOrCreateUser(userEmail);
    const limits = await checkUserLimits(user.id);

    if (limits.planType !== 'paid') {
      return NextResponse.json({
        success: false,
        error: 'Vector search is a Pro feature. Please upgrade your plan.',
        data: { 
          feature: 'vector_search',
          requiredPlan: 'paid',
          currentPlan: limits.planType,
          searchQuery: query
        }
      } as APIResponse, { status: 403 });
    }

    // Step 2: Process search query
    console.log(`🤖 Processing search query: "${query}"`);
    
    let searchResults: any[] = [];

    if (searchType === 'semantic') {
      // Generate embedding for the search query
      console.log('🧮 Generating query embedding...');
      const queryEmbedding = await generateEmbedding(query);

      // Search using vector similarity
      console.log('🔍 Performing semantic search...');
      searchResults = await searchEmailsByVector(
        queryEmbedding,
        limit,
        0.7 // Similarity threshold
      );
    } else {
      // Fallback to keyword search (simplified)
      console.log('📝 Performing keyword search...');
      // This would be implemented with full-text search in production
      searchResults = [];
    }

    // Step 3: Apply additional filters if provided
    let filteredResults = searchResults;

    if (filters.dateFrom || filters.dateTo) {
      filteredResults = filteredResults.filter(result => {
        const emailDate = new Date(result.metadata.date);
        const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null;
        const toDate = filters.dateTo ? new Date(filters.dateTo) : null;
        
        if (fromDate && emailDate < fromDate) return false;
        if (toDate && emailDate > toDate) return false;
        
        return true;
      });
    }

    if (filters.categories && filters.categories.length > 0) {
      filteredResults = filteredResults.filter(result => 
        filters.categories.includes(result.metadata.category)
      );
    }

    if (filters.senders && filters.senders.length > 0) {
      filteredResults = filteredResults.filter(result => 
        filters.senders.some((sender: string) => 
          result.metadata.from.toLowerCase().includes(sender.toLowerCase())
        )
      );
    }

    // Step 4: Format results for response
    const formattedResults: SearchResult[] = filteredResults.map(result => ({
      email: {
        id: result.emailId,
        subject: result.metadata.subject,
        from: result.metadata.from,
        date: result.metadata.date,
        snippet: result.content.substring(0, 200) + '...',
        threadId: '', // Would be populated in real implementation
        to: '',
        body: result.content,
        labels: []
      },
      score: result.similarity || 0,
      matchReason: generateMatchReason(query, result, searchType)
    }));

    // Step 5: Generate search insights
    const insights = generateSearchInsights(query, formattedResults, searchType);

    console.log(`✅ Search completed: ${formattedResults.length} results found`);

    // Step 6: Return results
    return NextResponse.json({
      success: true,
      message: `Found ${formattedResults.length} matching emails`,
      data: {
        query,
        searchType,
        results: formattedResults,
        insights,
        metadata: {
          totalResults: formattedResults.length,
          searchTime: Date.now(), // In production, calculate actual search time
          filtersApplied: Object.keys(filters).length,
          avgScore: formattedResults.length > 0 
            ? formattedResults.reduce((sum, r) => sum + r.score, 0) / formattedResults.length 
            : 0
        },
        suggestions: generateSearchSuggestions(query, formattedResults)
      }
    } as APIResponse);

  } catch (error) {
    console.error('❌ Vector search failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Vector search failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    } as APIResponse, { status: 500 });
  }
}

// GET: Get search capabilities and status
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

    // Check user access
    const user = await getOrCreateUser(userEmail);
    const limits = await checkUserLimits(user.id);

    const hasAccess = limits.planType === 'paid';

    return NextResponse.json({
      success: true,
      message: 'Search capabilities retrieved',
      data: {
        hasAccess,
        planType: limits.planType,
        features: {
          semanticSearch: hasAccess,
          keywordSearch: true, // Available to all
          dateFiltering: hasAccess,
          categoryFiltering: hasAccess,
          senderFiltering: hasAccess
        },
        searchTypes: [
          {
            type: 'semantic',
            name: 'Semantic Search',
            description: 'Find emails by meaning, not just keywords',
            examples: [
              'emails about my mortgage application',
              'conversations with lawyers or solicitors',
              'messages about travel bookings',
              'emails discussing project deadlines'
            ],
            available: hasAccess
          },
          {
            type: 'keyword',
            name: 'Keyword Search',
            description: 'Traditional text-based search',
            examples: [
              'contract AND payment',
              'meeting OR appointment',
              'invoice OR receipt'
            ],
            available: true
          }
        ],
        limits: hasAccess ? {
          maxResults: 50,
          maxQueryLength: 500,
          dailySearches: 1000
        } : {
          maxResults: 5,
          maxQueryLength: 100,
          dailySearches: 10
        }
      }
    } as APIResponse);

  } catch (error) {
    console.error('❌ Error getting search capabilities:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to get search capabilities',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    } as APIResponse, { status: 500 });
  }
}

// Helper functions

function generateMatchReason(query: string, result: any, searchType: string): string {
  if (searchType === 'semantic') {
    const score = Math.round((result.similarity || 0) * 100);
    return `${score}% semantic match - content relates to "${query}"`;
  } else {
    return `Keyword match found in email content`;
  }
}

function generateSearchInsights(query: string, results: SearchResult[], searchType: string) {
  const insights = {
    totalMatches: results.length,
    averageScore: results.length > 0 
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length * 100) 
      : 0,
    topSenders: getTopSenders(results),
    dateRange: getDateRange(results),
    searchInterpretation: interpretQuery(query, searchType)
  };

  return insights;
}

function getTopSenders(results: SearchResult[]): { sender: string; count: number }[] {
  const senderCounts = results.reduce((acc, result) => {
    const sender = result.email.from;
    acc[sender] = (acc[sender] || 0) + 1;
    return acc;
  }, {} as { [sender: string]: number });

  return Object.entries(senderCounts)
    .map(([sender, count]) => ({ sender, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function getDateRange(results: SearchResult[]): { earliest: string; latest: string } | null {
  if (results.length === 0) return null;
  
  const dates = results.map(r => new Date(r.email.date)).sort();
  return {
    earliest: dates[0].toISOString().split('T')[0],
    latest: dates[dates.length - 1].toISOString().split('T')[0]
  };
}

function interpretQuery(query: string, searchType: string): string {
  if (searchType === 'semantic') {
    if (query.toLowerCase().includes('lawyer') || query.toLowerCase().includes('solicitor')) {
      return 'Looking for legal-related correspondence';
    }
    if (query.toLowerCase().includes('travel') || query.toLowerCase().includes('booking')) {
      return 'Searching for travel and booking related emails';
    }
    if (query.toLowerCase().includes('payment') || query.toLowerCase().includes('invoice')) {
      return 'Finding financial and payment related messages';
    }
    return `Semantic search for emails relating to: ${query}`;
  }
  
  return `Keyword search for: ${query}`;
}

function generateSearchSuggestions(query: string, results: SearchResult[]): string[] {
  const suggestions = [];
  
  if (results.length === 0) {
    suggestions.push('Try using different keywords or phrases');
    suggestions.push('Check if the email content might use different terminology');
    suggestions.push('Consider broadening your search terms');
  } else if (results.length < 3) {
    suggestions.push('Try broader search terms to find more results');
    suggestions.push('Consider using synonyms or related terms');
  } else {
    suggestions.push('Use date filters to narrow down results');
    suggestions.push('Filter by specific senders if needed');
  }
  
  return suggestions;
}