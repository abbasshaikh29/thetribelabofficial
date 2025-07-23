import { ICommunityPlan } from '@/models/CommunityPlan';

export interface IPlanValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface IFeeCalculation {
  grossAmount: number; // Amount member pays (in paise)
  platformFeeRate: number; // Platform fee percentage
  platformFeeAmount: number; // Platform fee (in paise)
  processingFeeAmount: number; // Payment gateway fee (in paise)
  netAmount: number; // Amount admin receives (in paise)
  netPercentage: number; // Percentage admin keeps
}

export interface IPricingRecommendation {
  suggestedPrice: number; // Suggested price in rupees
  reason: string;
  competitiveRange: {
    min: number;
    max: number;
  };
}

export class PlanValidator {
  /**
   * Validate plan data
   */
  static validatePlan(plan: Partial<ICommunityPlan>): IPlanValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required field validation
    if (!plan.name || plan.name.trim().length === 0) {
      errors.push('Plan name is required');
    } else if (plan.name.length > 100) {
      errors.push('Plan name must be 100 characters or less');
    }

    if (!plan.amount || plan.amount <= 0) {
      errors.push('Plan amount must be greater than 0');
    } else {
      // Minimum viable amount check
      const fees = this.calculateFees(plan.amount);
      if (fees.netAmount <= 0) {
        errors.push('Plan amount is too low - admin would receive nothing after fees');
      } else if (fees.netAmount < 1000) { // Less than ₹10
        warnings.push('Plan amount is very low - admin will receive less than ₹10 per subscription');
      }
    }

    if (!plan.interval) {
      errors.push('Billing interval is required');
    }

    if (!plan.intervalCount || plan.intervalCount <= 0) {
      errors.push('Interval count must be greater than 0');
    } else if (plan.intervalCount > 12) {
      warnings.push('Interval count is very high - consider using yearly billing instead');
    }

    if (!plan.features || plan.features.length === 0) {
      errors.push('At least one feature is required');
    } else {
      const validFeatures = plan.features.filter(f => f && f.trim().length > 0);
      if (validFeatures.length === 0) {
        errors.push('At least one valid feature is required');
      } else if (validFeatures.length > 20) {
        warnings.push('Too many features - consider grouping similar features');
      }
    }

    if (!plan.accessLevel) {
      errors.push('Access level is required');
    }

    if (plan.trialPeriodDays && (plan.trialPeriodDays < 0 || plan.trialPeriodDays > 365)) {
      errors.push('Trial period must be between 0 and 365 days');
    }

    if (plan.maxMembers && plan.maxMembers <= 0) {
      errors.push('Maximum members must be greater than 0 if specified');
    }

    // Business logic validation
    if (plan.interval === 'one_time' && plan.trialPeriodDays && plan.trialPeriodDays > 0) {
      warnings.push('Trial periods are not recommended for one-time payments');
    }

    if (plan.amount && plan.amount > 1000000) { // More than ₹10,000
      warnings.push('High pricing may reduce conversion rates');
    }

    if (plan.setupFee && plan.amount && plan.setupFee > plan.amount) {
      warnings.push('Setup fee is higher than the plan amount');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Calculate fee breakdown for a plan
   */
  static calculateFees(amountInRupees: number, platformFeeRate: number = 5.0): IFeeCalculation {
    const grossAmount = Math.round(amountInRupees * 100); // Convert to paise
    
    // Platform fee calculation
    const platformFeeAmount = Math.round((grossAmount * platformFeeRate) / 100);
    
    // Razorpay processing fee: 2% + ₹2
    const processingFeeAmount = Math.round((grossAmount * 2) / 100) + 200;
    
    // Net amount for admin
    const netAmount = Math.max(0, grossAmount - platformFeeAmount - processingFeeAmount);
    
    // Calculate percentage admin keeps
    const netPercentage = grossAmount > 0 ? (netAmount / grossAmount) * 100 : 0;

    return {
      grossAmount,
      platformFeeRate,
      platformFeeAmount,
      processingFeeAmount,
      netAmount,
      netPercentage
    };
  }

  /**
   * Get pricing recommendations based on plan type and features
   */
  static getPricingRecommendations(plan: Partial<ICommunityPlan>): IPricingRecommendation {
    const featureCount = plan.features?.filter(f => f && f.trim().length > 0).length || 0;
    const accessLevel = plan.accessLevel || 'basic';
    const interval = plan.interval || 'monthly';

    let basePrice = 0;
    let reason = '';

    // Base pricing by access level
    switch (accessLevel) {
      case 'basic':
        basePrice = interval === 'monthly' ? 99 : 999;
        reason = 'Basic access level with essential features';
        break;
      case 'premium':
        basePrice = interval === 'monthly' ? 299 : 2999;
        reason = 'Premium access level with advanced features';
        break;
      case 'vip':
        basePrice = interval === 'monthly' ? 599 : 5999;
        reason = 'VIP access level with exclusive features';
        break;
    }

    // Adjust based on feature count
    if (featureCount > 10) {
      basePrice *= 1.5;
      reason += ' (adjusted up for extensive features)';
    } else if (featureCount < 3) {
      basePrice *= 0.7;
      reason += ' (adjusted down for limited features)';
    }

    // Yearly discount
    if (interval === 'yearly') {
      basePrice *= 10; // 10 months price for yearly
      reason += ' (yearly discount applied)';
    }

    const competitiveRange = {
      min: Math.round(basePrice * 0.7),
      max: Math.round(basePrice * 1.5)
    };

    return {
      suggestedPrice: Math.round(basePrice),
      reason,
      competitiveRange
    };
  }

  /**
   * Validate plan pricing strategy
   */
  static validatePricingStrategy(plans: ICommunityPlan[]): {
    isValid: boolean;
    suggestions: string[];
  } {
    const suggestions: string[] = [];
    
    if (plans.length === 0) {
      return {
        isValid: false,
        suggestions: ['Create at least one pricing plan']
      };
    }

    // Check for default plan
    const defaultPlans = plans.filter(p => p.isDefault);
    if (defaultPlans.length === 0) {
      suggestions.push('Set one plan as default for new members');
    } else if (defaultPlans.length > 1) {
      suggestions.push('Only one plan should be set as default');
    }

    // Check for active plans
    const activePlans = plans.filter(p => p.isActive);
    if (activePlans.length === 0) {
      suggestions.push('At least one plan should be active');
    }

    // Check pricing tiers
    const monthlyPlans = plans.filter(p => p.interval === 'monthly' && p.isActive);
    if (monthlyPlans.length > 1) {
      const prices = monthlyPlans.map(p => p.amount).sort((a, b) => a - b);
      const hasGoodSpread = prices.every((price, index) => {
        if (index === 0) return true;
        return price >= prices[index - 1] * 1.5; // At least 50% increase between tiers
      });

      if (!hasGoodSpread) {
        suggestions.push('Consider larger price differences between tiers for clear value distinction');
      }
    }

    // Check for trial offerings
    const trialPlans = plans.filter(p => p.trialPeriodDays > 0 && p.isActive);
    if (trialPlans.length === 0 && plans.some(p => p.amount > 50000)) { // Plans over ₹500
      suggestions.push('Consider offering free trials for higher-priced plans');
    }

    // Check for one-time vs recurring balance
    const recurringPlans = plans.filter(p => p.interval !== 'one_time' && p.isActive);
    const oneTimePlans = plans.filter(p => p.interval === 'one_time' && p.isActive);
    
    if (recurringPlans.length === 0 && oneTimePlans.length > 0) {
      suggestions.push('Consider adding recurring subscription options for predictable revenue');
    }

    return {
      isValid: suggestions.length === 0,
      suggestions
    };
  }

  /**
   * Format currency for display
   */
  static formatCurrency(amountInPaise: number, currency: string = 'INR'): string {
    const amount = amountInPaise / 100;
    const symbol = currency === 'INR' ? '₹' : '$';
    return `${symbol}${amount.toLocaleString('en-IN')}`;
  }

  /**
   * Calculate optimal pricing based on competitor analysis
   */
  static calculateOptimalPricing(
    targetMargin: number = 70, // Target 70% margin after fees
    platformFeeRate: number = 5.0
  ): {
    minPrice: number;
    recommendedPrice: number;
    explanation: string;
  } {
    // Work backwards from desired margin
    // If admin wants 70% margin, they need to account for platform fee (5%) + processing fee (2% + ₹2)
    
    let recommendedPrice = 100; // Start with ₹100
    let fees = this.calculateFees(recommendedPrice, platformFeeRate);
    
    // Iterate to find price that gives desired margin
    while (fees.netPercentage < targetMargin && recommendedPrice < 10000) {
      recommendedPrice += 10;
      fees = this.calculateFees(recommendedPrice, platformFeeRate);
    }

    const minPrice = 50; // Minimum viable price
    
    return {
      minPrice,
      recommendedPrice,
      explanation: `To achieve ${targetMargin}% margin after fees, minimum recommended price is ₹${recommendedPrice}. This accounts for ${platformFeeRate}% platform fee and payment processing charges.`
    };
  }
}
