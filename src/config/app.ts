// src/config/app.ts
export const APP_CONFIG = {
  name: 'Inboxie',
  description: 'Smart Gmail Assistant with AI Categorization',
  version: '1.0.0',
  
  // Processing limits - EASY TO CHANGE HERE!
  processing: {
    free: {
      emailsPerBatch: 10,     // How many emails to process at once
      dailyLimit: 50,         // Total emails per day
    },
    paid: {
      emailsPerBatch: 50,     // Larger batches for paid users
      dailyLimit: 500,        // Higher daily limit
    }
  },

  // Plan limits
  plans: {
    free: {
      name: 'Free',
      emailLimit: 50,
      features: ['gmail_connect', 'categorization', 'quote_reply']
    },
    paid: {
      name: 'Pro',
      emailLimit: 500, // per day
      monthlyPrice: 9,
      yearlyPrice: 79,
      features: ['gmail_connect', 'categorization', 'quote_reply', 'tone_training', 'vector_search']
    }
  },

  // Simplified default categories (shorter list for faster processing)
  defaultCategories: [
    'Work',
    'Personal', 
    'Shopping',
    'Newsletter',
    'Support',
    'Other'
  ]
} as const;