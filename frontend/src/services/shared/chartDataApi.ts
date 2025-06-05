import { ChartData } from '../../types';
import { TimeRange, buildApiUrl, handleApiResponse } from './apiUtils';
import { generateChartData } from '../chartUtils';

/**
 * Fetch chart data for visualization
 * @param timeRange Time range for chart data
 * @param signal Optional abort signal for cancellation
 * @returns Promise of chart data array
 */
export const fetchChartData = async (timeRange: TimeRange = '1w', signal?: AbortSignal): Promise<ChartData[]> => {
  try {
    console.log(`[CHART DATA API] Fetching chart data for timeRange: ${timeRange}`);
    
    const url = buildApiUrl(`/api/chart/data?timeRange=${timeRange}`);
    console.log(`[CHART DATA API] Making request to: ${url}`);

    const response = await fetch(url, { signal });
    const data = await handleApiResponse(response);
    
    console.log(`[CHART DATA API] Response data:`, data);
    
    // Check if chartData exists and is an array
    if (!data || !data.chartData || !Array.isArray(data.chartData)) {
      console.warn('[CHART DATA API] Unexpected response format, using chart data generator');
      // Fallback to generated chart data (synthetic for free users)
      return generateChartData([], timeRange, false);
    }
    
    const chartArray = data.chartData as ChartData[];
    console.log(`[CHART DATA API] Successfully received ${chartArray.length} chart items`);
    
    // Validate each item has required fields based on ChartData interface
    const validatedData = chartArray.filter((item, index) => {
      const isValid = item && 
                     typeof item.date === 'string' && 
                     typeof item.bullish === 'number' &&
                     typeof item.bearish === 'number' &&
                     typeof item.neutral === 'number';
      
      if (!isValid) {
        console.warn(`[CHART DATA API] Invalid chart item at index ${index}:`, item);
        return false;
      }
      
      return true;
    });
    
    console.log(`[CHART DATA API] Returning ${validatedData.length} validated chart items`);
    return validatedData;
    
  } catch (error) {
    console.error('[CHART DATA API] Chart data API error:', error);
    console.warn('[CHART DATA API] Falling back to generated chart data');
    
    // Fallback to generated chart data (synthetic for free users)
    return generateChartData([], timeRange, false);
  }
}; 