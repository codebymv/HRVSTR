/**
 * Date Range Processor - Specialized utilities for processing date ranges in earnings scraping
 */

/**
 * Generate date range between two dates
 * @param {string|Date} fromDate - Start date
 * @param {string|Date} toDate - End date
 * @returns {Object} - Date range information
 */
function generateDateRange(fromDate, toDate) {
  try {
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    
    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format');
    }
    
    if (startDate > endDate) {
      throw new Error('Start date must be before end date');
    }
    
    // Calculate range info
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    const dateList = [];
    
    // Generate array of date strings
    for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
      dateList.push(currentDate.toISOString().split('T')[0]);
    }
    
    return {
      success: true,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalDays,
      dateList,
      isValidRange: true
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      startDate: null,
      endDate: null,
      totalDays: 0,
      dateList: [],
      isValidRange: false
    };
  }
}

/**
 * Create a progress calculator for date range iteration
 * @param {number} totalDays - Total number of days to process
 * @returns {Function} - Progress calculation function
 */
function createProgressCalculator(totalDays) {
  return (currentDay, customMessage = null) => {
    const progressPercent = Math.round((currentDay / totalDays) * 100);
    const defaultMessage = `Processing day ${currentDay}/${totalDays}`;
    
    return {
      progress: progressPercent,
      current: currentDay,
      total: totalDays,
      message: customMessage || defaultMessage,
      isComplete: currentDay >= totalDays
    };
  };
}

/**
 * Format date for Yahoo Finance URLs
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date string (YYYY-MM-DD)
 */
function formatDateForUrl(date) {
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Invalid date: ${date}`);
    }
    
    return dateObj.toISOString().split('T')[0];
  } catch (error) {
    console.error('[dateRangeProcessor] Error formatting date:', error.message);
    return new Date().toISOString().split('T')[0]; // Fallback to today
  }
}

/**
 * Get business days within a date range (excludes weekends)
 * @param {string|Date} fromDate - Start date
 * @param {string|Date} toDate - End date
 * @returns {Array} - Array of business day date strings
 */
function getBusinessDaysInRange(fromDate, toDate) {
  const dateRange = generateDateRange(fromDate, toDate);
  
  if (!dateRange.success) {
    return [];
  }
  
  const businessDays = dateRange.dateList.filter(dateStr => {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    // 0 = Sunday, 6 = Saturday
    return dayOfWeek !== 0 && dayOfWeek !== 6;
  });
  
  console.log(`[dateRangeProcessor] Found ${businessDays.length} business days out of ${dateRange.totalDays} total days`);
  return businessDays;
}

/**
 * Split large date range into smaller chunks for efficient processing
 * @param {string|Date} fromDate - Start date
 * @param {string|Date} toDate - End date
 * @param {number} chunkSize - Maximum days per chunk
 * @returns {Array} - Array of date range chunks
 */
function chunkDateRange(fromDate, toDate, chunkSize = 7) {
  const dateRange = generateDateRange(fromDate, toDate);
  
  if (!dateRange.success) {
    return [];
  }
  
  const chunks = [];
  const dateList = dateRange.dateList;
  
  for (let i = 0; i < dateList.length; i += chunkSize) {
    const chunkDates = dateList.slice(i, i + chunkSize);
    chunks.push({
      startDate: chunkDates[0],
      endDate: chunkDates[chunkDates.length - 1],
      dates: chunkDates,
      chunkIndex: Math.floor(i / chunkSize),
      totalChunks: Math.ceil(dateList.length / chunkSize)
    });
  }
  
  console.log(`[dateRangeProcessor] Split ${dateRange.totalDays} days into ${chunks.length} chunks of max ${chunkSize} days`);
  return chunks;
}

/**
 * Validate date range for reasonable bounds
 * @param {string|Date} fromDate - Start date
 * @param {string|Date} toDate - End date
 * @returns {Object} - Validation result
 */
function validateDateRange(fromDate, toDate) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    adjustedRange: null
  };
  
  try {
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    
    // Check for valid dates
    if (isNaN(startDate.getTime())) {
      validation.isValid = false;
      validation.errors.push('Invalid start date format');
    }
    
    if (isNaN(endDate.getTime())) {
      validation.isValid = false;
      validation.errors.push('Invalid end date format');
    }
    
    if (!validation.isValid) {
      return validation;
    }
    
    // Check logical order
    if (startDate > endDate) {
      validation.isValid = false;
      validation.errors.push('Start date must be before end date');
      return validation;
    }
    
    // Check reasonable bounds
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    
    // Warn if dates are too far in the past
    if (startDate < oneYearAgo) {
      validation.warnings.push(`Start date is more than 1 year ago: ${startDate.toDateString()}`);
    }
    
    // Warn if dates are too far in the future
    if (endDate > oneYearFromNow) {
      validation.warnings.push(`End date is more than 1 year in the future: ${endDate.toDateString()}`);
    }
    
    // Check range size
    const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      validation.warnings.push(`Date range is very large: ${daysDiff} days. Consider processing in smaller chunks.`);
    }
    
    if (daysDiff > 31) {
      validation.warnings.push(`Date range spans ${daysDiff} days. This may take significant time to process.`);
    }
    
    // Suggest adjusted range if needed
    if (validation.warnings.length > 0 && daysDiff > 90) {
      const suggestedEndDate = new Date(startDate);
      suggestedEndDate.setDate(suggestedEndDate.getDate() + 30);
      
      validation.adjustedRange = {
        startDate: startDate.toISOString().split('T')[0],
        endDate: Math.min(suggestedEndDate, endDate).toISOString().split('T')[0],
        reason: 'Reduced range for better performance'
      };
    }
    
  } catch (error) {
    validation.isValid = false;
    validation.errors.push(`Date validation error: ${error.message}`);
  }
  
  return validation;
}

/**
 * Get recent earnings dates (common date ranges)
 * @returns {Object} - Common date range presets
 */
function getCommonDateRanges() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // Calculate various date ranges
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of this week
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6); // End of this week
  
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
  
  return {
    today: {
      name: 'Today',
      fromDate: today,
      toDate: today,
      description: 'Earnings events for today only'
    },
    yesterday: {
      name: 'Yesterday',
      fromDate: yesterday.toISOString().split('T')[0],
      toDate: yesterday.toISOString().split('T')[0],
      description: 'Earnings events from yesterday'
    },
    thisWeek: {
      name: 'This Week',
      fromDate: weekStart.toISOString().split('T')[0],
      toDate: weekEnd.toISOString().split('T')[0],
      description: 'Earnings events for the current week'
    },
    thisMonth: {
      name: 'This Month',
      fromDate: monthStart.toISOString().split('T')[0],
      toDate: monthEnd.toISOString().split('T')[0],
      description: 'Earnings events for the current month'
    },
    thisQuarter: {
      name: 'This Quarter',
      fromDate: quarterStart.toISOString().split('T')[0],
      toDate: quarterEnd.toISOString().split('T')[0],
      description: 'Earnings events for the current quarter'
    },
    next7Days: {
      name: 'Next 7 Days',
      fromDate: today,
      toDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: 'Earnings events for the next 7 days'
    },
    last30Days: {
      name: 'Last 30 Days',
      fromDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      toDate: today,
      description: 'Earnings events from the last 30 days'
    }
  };
}

/**
 * Calculate optimal scraping strategy for a date range
 * @param {string|Date} fromDate - Start date
 * @param {string|Date} toDate - End date
 * @returns {Object} - Recommended scraping strategy
 */
function calculateScrapingStrategy(fromDate, toDate) {
  const dateRange = generateDateRange(fromDate, toDate);
  
  if (!dateRange.success) {
    return {
      strategy: 'error',
      error: dateRange.error,
      recommendation: 'Fix date range issues before proceeding'
    };
  }
  
  const totalDays = dateRange.totalDays;
  const businessDays = getBusinessDaysInRange(fromDate, toDate);
  
  let strategy = {
    approach: 'sequential',
    batchSize: 1,
    estimatedTime: totalDays * 2, // 2 seconds per day estimate
    recommendation: '',
    useBusinessDaysOnly: false,
    maxConcurrency: 1
  };
  
  if (totalDays <= 1) {
    strategy.approach = 'single';
    strategy.recommendation = 'Single day scraping - fastest approach';
    strategy.estimatedTime = 5;
  } else if (totalDays <= 7) {
    strategy.approach = 'sequential';
    strategy.recommendation = 'Sequential scraping recommended for small range';
    strategy.estimatedTime = totalDays * 3;
  } else if (totalDays <= 31) {
    strategy.approach = 'batched';
    strategy.batchSize = 5;
    strategy.recommendation = 'Process in small batches to balance speed and reliability';
    strategy.estimatedTime = totalDays * 2;
    strategy.useBusinessDaysOnly = true;
  } else {
    strategy.approach = 'chunked';
    strategy.batchSize = 7;
    strategy.recommendation = 'Large range detected - consider breaking into smaller chunks';
    strategy.estimatedTime = totalDays * 1.5;
    strategy.useBusinessDaysOnly = true;
    strategy.maxConcurrency = 2;
  }
  
  // Add business days optimization
  if (strategy.useBusinessDaysOnly) {
    strategy.actualDays = businessDays.length;
    strategy.skipWeekends = true;
    strategy.estimatedTime = businessDays.length * 2;
    strategy.recommendation += ` (${businessDays.length} business days)`;
  }
  
  return {
    ...strategy,
    totalDays,
    dateRange,
    businessDaysCount: businessDays.length
  };
}

/**
 * Create an async iterator for date range processing
 * @param {string|Date} fromDate - Start date
 * @param {string|Date} toDate - End date
 * @param {Object} options - Processing options
 * @returns {AsyncGenerator} - Async iterator for dates
 */
async function* createDateIterator(fromDate, toDate, options = {}) {
  const { 
    businessDaysOnly = false, 
    chunkSize = 1,
    delayBetweenDates = 0
  } = options;
  
  const dates = businessDaysOnly ? 
    getBusinessDaysInRange(fromDate, toDate) : 
    generateDateRange(fromDate, toDate).dateList;
  
  if (chunkSize === 1) {
    // Yield individual dates
    for (let i = 0; i < dates.length; i++) {
      if (delayBetweenDates > 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenDates));
      }
      
      yield {
        date: dates[i],
        index: i,
        total: dates.length,
        isLast: i === dates.length - 1
      };
    }
  } else {
    // Yield chunks of dates
    for (let i = 0; i < dates.length; i += chunkSize) {
      if (delayBetweenDates > 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenDates));
      }
      
      const chunk = dates.slice(i, i + chunkSize);
      yield {
        dates: chunk,
        startDate: chunk[0],
        endDate: chunk[chunk.length - 1],
        chunkIndex: Math.floor(i / chunkSize),
        totalChunks: Math.ceil(dates.length / chunkSize),
        isLast: i + chunkSize >= dates.length
      };
    }
  }
}

module.exports = {
  generateDateRange,
  createProgressCalculator,
  formatDateForUrl,
  getBusinessDaysInRange,
  chunkDateRange,
  validateDateRange,
  getCommonDateRanges,
  calculateScrapingStrategy,
  createDateIterator
}; 