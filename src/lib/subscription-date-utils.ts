/**
 * Utility functions for handling subscription dates and timestamps
 */

/**
 * Validates if a date is valid and not Unix epoch
 */
export function isValidSubscriptionDate(date: any): boolean {
  if (!date) return false;
  
  const dateObj = new Date(date);
  
  // Check if it's a valid date
  if (isNaN(dateObj.getTime())) return false;
  
  // Check if it's not Unix epoch (1970-01-01) or close to it
  const epochTime = new Date('1970-01-01').getTime();
  const oneYearInMs = 365 * 24 * 60 * 60 * 1000;
  
  // Date should be at least one year after epoch to be considered valid
  return dateObj.getTime() > (epochTime + oneYearInMs);
}

/**
 * Validates and converts Unix timestamp to Date with fallback
 */
export function validateAndConvertTimestamp(
  timestamp: number | null | undefined, 
  fallbackDate: Date,
  context: string = 'subscription'
): Date {
  if (!timestamp || timestamp === 0) {
    console.log(`${context}: Invalid timestamp ${timestamp}, using fallback:`, fallbackDate.toISOString());
    return fallbackDate;
  }
  
  const convertedDate = new Date(timestamp * 1000);
  
  // Check if the converted date is valid and not Unix epoch
  if (!isValidSubscriptionDate(convertedDate)) {
    console.log(`${context}: Invalid converted date ${convertedDate.toISOString()}, using fallback:`, fallbackDate.toISOString());
    return fallbackDate;
  }
  
  return convertedDate;
}

/**
 * Calculate subscription end date based on start date and interval
 */
export function calculateSubscriptionEndDate(
  startDate: Date, 
  interval: 'monthly' | 'yearly' = 'monthly',
  intervalCount: number = 1
): Date {
  const endDate = new Date(startDate);
  
  if (interval === 'monthly') {
    endDate.setMonth(endDate.getMonth() + intervalCount);
  } else if (interval === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + intervalCount);
  }
  
  return endDate;
}

/**
 * Calculate trial end date
 */
export function calculateTrialEndDate(trialPeriodDays: number): Date {
  return new Date(Date.now() + trialPeriodDays * 24 * 60 * 60 * 1000);
}

/**
 * Format date for display with validation
 */
export function formatSubscriptionDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);

  // Check if it's an invalid date
  if (isNaN(date.getTime())) return 'Invalid Date';

  // Check if it's Unix epoch (1970-01-01) or close to it
  if (!isValidSubscriptionDate(date)) {
    return `Invalid (Unix Epoch: ${date.toISOString()})`;
  }

  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

/**
 * Get safe subscription dates from Razorpay data
 */
export function getSafeSubscriptionDates(razorpayData: any, plan?: any) {
  const now = new Date();
  
  // Calculate safe start date
  const currentStart = validateAndConvertTimestamp(
    razorpayData.current_start,
    now,
    'getSafeSubscriptionDates'
  );
  
  // Calculate safe end date
  const currentEnd = validateAndConvertTimestamp(
    razorpayData.current_end,
    calculateSubscriptionEndDate(currentStart, 'monthly', 1),
    'getSafeSubscriptionDates'
  );
  
  // Calculate safe charge date
  const chargeAt = validateAndConvertTimestamp(
    razorpayData.charge_at,
    plan?.trialPeriodDays > 0 
      ? calculateTrialEndDate(plan.trialPeriodDays)
      : now,
    'getSafeSubscriptionDates'
  );
  
  return {
    currentStart,
    currentEnd,
    chargeAt,
    startAt: razorpayData.start_at ? validateAndConvertTimestamp(razorpayData.start_at, currentStart, 'getSafeSubscriptionDates') : undefined,
    endAt: razorpayData.end_at ? validateAndConvertTimestamp(razorpayData.end_at, currentEnd, 'getSafeSubscriptionDates') : undefined
  };
}
