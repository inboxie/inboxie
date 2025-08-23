// src/types/index.ts

// User Plans
export type PlanType = 'free' | 'paid';

export interface UserPlan {
  type: PlanType;
  emailsProcessed: number;
  dailyLimit: number;
  features: string[];
  subscription?: {
    id: string;
    status: 'active' | 'cancelled' | 'expired';
    currentPeriodEnd: Date;
  };
}

// Email Data Structures
export interface EmailData {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to?: string;
  body: string;
  snippet: string;
  date: string;
  labels?: string[];
}

export interface ProcessedEmail extends EmailData {
  category?: string;
  confidence?: number;
  aiReason?: string;
  processed_at?: string;
}

// Categorization
export interface CategoryResult {
  category: string;
  confidence: number;
  reason: string;
}

export interface CustomCategory {
  id: string;
  userId: string;
  name: string;
  description?: string;
  keywords?: string[];
  examples?: string[];
  created_at: string;
}

// Tone Training (Feature 3)
export interface ToneProfile {
  userId: string;
  sentEmailsAnalyzed: number;
  toneCharacteristics: {
    formality: 'formal' | 'casual' | 'mixed';
    length: 'brief' | 'moderate' | 'detailed';
    style: string[];
    commonPhrases: string[];
  };
  lastTraining: string;
}

export interface AIResponse {
  originalEmailId: string;
  generatedResponse: string;
  confidence: number;
  toneMatched: boolean;
  created_at: string;
}

// Vector Search (Feature 4)
export interface EmailEmbedding {
  emailId: string;
  embedding: number[];
  content: string;
  metadata: {
    from: string;
    subject: string;
    date: string;
    category?: string;
  };
}

export interface SearchQuery {
  query: string;
  type: 'semantic' | 'keyword';
  limit?: number;
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    categories?: string[];
    senders?: string[];
  };
}

export interface SearchResult {
  email: EmailData;
  score: number;
  matchReason: string;
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ProcessingResult {
  success: boolean;
  processed: number;
  skipped: number;
  errors: number;
  results: ProcessedEmail[];
  message?: string;
}

// Database Tables
export interface EmailCacheTable {
  id: string;
  from_addr: string;
  subject: string;
  date_iso: string;
  ai_category: string;
  ai_reason: string;
  created_at: string;
}

export interface UserTable {
  id: string;
  email: string;
  plan_type: PlanType;
  emails_processed: number;
  subscription_id?: string;
  created_at: string;
  updated_at: string;
}