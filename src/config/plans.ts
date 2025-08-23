// src/config/plans.ts
export interface PlanConfig {
    name: string;
    emailLimit: number;
    features: {
      aiReplies: boolean;
      voiceTraining: boolean;
      customCategories: boolean;
      advancedSearch: boolean;
    };
  }
  
  export const PLAN_CONFIGS: Record<string, PlanConfig> = {
    free: {
      name: 'Free',
      emailLimit: 50,
      features: {
        aiReplies: false,
        voiceTraining: false,
        customCategories: false,
        advancedSearch: false,
      },
    },
    paid: {
      name: 'Pro',
      emailLimit: 500, // Alpha testing limit - easily changeable
      features: {
        aiReplies: true,
        voiceTraining: true,
        customCategories: true,
        advancedSearch: true,
      },
    },
  };
  
  // Helper functions
  export function getPlanConfig(planType: string): PlanConfig {
    return PLAN_CONFIGS[planType] || PLAN_CONFIGS.free;
  }
  
  export function getEmailLimit(planType: string): number {
    return getPlanConfig(planType).emailLimit;
  }
  
  export function canUseFeature(planType: string, feature: keyof PlanConfig['features']): boolean {
    return getPlanConfig(planType).features[feature];
  }