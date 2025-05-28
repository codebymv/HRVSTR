import axios from 'axios';
import { pool } from '../config/data-sources';

interface EarningsEvent {
  symbol: string;
  reportDate: string;
  estimate: number | null;
  actual: number | null;
  surprise: number | null;
  surprisePercent: number | null;
}

interface DividendEvent {
  symbol: string;
  exDate: string;
  paymentDate: string;
  amount: number;
}

interface NewsEvent {
  title: string;
  url: string;
  time_published: string;
  summary: string;
  source: string;
  category_within_source: string;
  source_domain: string;
  topics: Array<{
    topic: string;
    relevance_score: string;
  }>;
}

interface MarketEvent {
  symbol: string;
  event_type: string;
  scheduled_at: string;
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
}

export class FinancialCalendarService {
  private readonly apiKey: string;
  private readonly baseUrl: string = 'https://www.alphavantage.co/query';

  constructor() {
    // Get API key from environment variable
    this.apiKey = process.env.ALPHA_VANTAGE_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('Alpha Vantage API key not found in environment variables');
    }
  }

  // Fetch earnings calendar for a specific symbol
  async fetchEarningsCalendar(symbol: string): Promise<EarningsEvent[]> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'EARNINGS_CALENDAR',
          symbol,
          apikey: this.apiKey
        }
      });

      // Parse CSV response
      const events = this.parseEarningsCSV(response.data);
      
      // Store in database
      await this.storeEarningsEvents(events);
      
      return events;
    } catch (error) {
      console.error('Error fetching earnings calendar:', error);
      throw error;
    }
  }

  // Fetch dividend calendar for a specific symbol
  async fetchDividendCalendar(symbol: string): Promise<DividendEvent[]> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'TIME_SERIES_DAILY_ADJUSTED',
          symbol,
          apikey: this.apiKey
        }
      });

      const events = this.parseDividendData(response.data);
      
      // Store in database
      await this.storeDividendEvents(events);
      
      return events;
    } catch (error) {
      console.error('Error fetching dividend calendar:', error);
      throw error;
    }
  }

  // Fetch news and sentiment for a specific symbol
  async fetchNewsAndSentiment(symbol: string): Promise<void> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'NEWS_SENTIMENT',
          tickers: symbol,
          apikey: this.apiKey
        }
      });

      const news = response.data.feed || [];
      await this.storeNewsEvents(symbol, news);
    } catch (error) {
      console.error('Error fetching news and sentiment:', error);
      throw error;
    }
  }

  // Fetch company overview for additional context
  async fetchCompanyOverview(symbol: string): Promise<void> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'OVERVIEW',
          symbol,
          apikey: this.apiKey
        }
      });

      const data = response.data;
      if (data) {
        // Store important company events
        const events: MarketEvent[] = [];

        // Add dividend information if available
        if (data.DividendDate) {
          events.push({
            symbol,
            event_type: 'dividend',
            scheduled_at: data.DividendDate,
            title: `${symbol} Dividend Payment`,
            description: `Dividend Yield: ${data.DividendYield}%, Payout Ratio: ${data.PayoutRatio}%`,
            importance: 'medium'
          });
        }

        // Add earnings information if available
        if (data.LatestQuarter) {
          events.push({
            symbol,
            event_type: 'earnings',
            scheduled_at: data.LatestQuarter,
            title: `${symbol} Latest Earnings`,
            description: `EPS: ${data.EPS}, Revenue: ${data.Revenue}`,
            importance: 'high'
          });
        }

        // Store the events
        await this.storeMarketEvents(events);
      }
    } catch (error) {
      console.error('Error fetching company overview:', error);
      throw error;
    }
  }

  // Parse earnings CSV data
  private parseEarningsCSV(csvData: string): EarningsEvent[] {
    const lines = csvData.split('\n');
    const events: EarningsEvent[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const [symbol, reportDate, estimate, actual, surprise, surprisePercent] = lines[i].split(',');
      
      if (symbol && reportDate) {
        events.push({
          symbol,
          reportDate,
          estimate: estimate ? parseFloat(estimate) : null,
          actual: actual ? parseFloat(actual) : null,
          surprise: surprise ? parseFloat(surprise) : null,
          surprisePercent: surprisePercent ? parseFloat(surprisePercent) : null
        });
      }
    }

    return events;
  }

  // Parse dividend data from API response
  private parseDividendData(data: any): DividendEvent[] {
    const events: DividendEvent[] = [];
    const timeSeries = data['Time Series (Daily)'];

    if (!timeSeries) return events;

    for (const [date, values] of Object.entries(timeSeries)) {
      const dividendAmount = parseFloat((values as any)['7. dividend amount']);
      if (dividendAmount > 0) {
        events.push({
          symbol: data['Meta Data']['2. Symbol'],
          exDate: date,
          paymentDate: date, // Alpha Vantage doesn't provide payment date, using ex-date
          amount: dividendAmount
        });
      }
    }

    return events;
  }

  // Store earnings events in database
  private async storeEarningsEvents(events: EarningsEvent[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const event of events) {
        const description = [
          event.estimate ? `Expected EPS: ${event.estimate}` : null,
          event.actual ? `Actual EPS: ${event.actual}` : null,
          event.surprise ? `Surprise: ${event.surprise}` : null,
          event.surprisePercent ? `Surprise %: ${event.surprisePercent}%` : null
        ].filter(Boolean).join(', ');

        await client.query(
          `INSERT INTO events (
            symbol, 
            event_type, 
            scheduled_at, 
            status,
            title,
            description,
            importance
          )
          VALUES ($1, 'earnings', $2, 'scheduled', $3, $4, 'high')
          ON CONFLICT (symbol, event_type, scheduled_at) 
          DO UPDATE SET 
            status = 'scheduled',
            title = $3,
            description = $4,
            importance = 'high'`,
          [
            event.symbol,
            event.reportDate,
            `${event.symbol} Earnings Report`,
            description
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Store dividend events in database
  private async storeDividendEvents(events: DividendEvent[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const event of events) {
        await client.query(
          `INSERT INTO events (
            symbol, 
            event_type, 
            scheduled_at, 
            status,
            title,
            description,
            importance
          )
          VALUES ($1, 'dividend', $2, 'scheduled', $3, $4, 'medium')
          ON CONFLICT (symbol, event_type, scheduled_at) 
          DO UPDATE SET 
            status = 'scheduled',
            title = $3,
            description = $4,
            importance = 'medium'`,
          [
            event.symbol,
            event.exDate,
            `${event.symbol} Dividend Payment`,
            `Amount: $${event.amount.toFixed(2)}`
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Store news events in database
  private async storeNewsEvents(symbol: string, news: NewsEvent[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of news) {
        // Only store significant news
        const relevanceScore = parseFloat(item.topics[0]?.relevance_score || '0');
        if (relevanceScore > 0.7) {
          const importance = relevanceScore > 0.9 ? 'high' : 'medium';
          const description = `${item.summary}\nSource: ${item.source}`;

          await client.query(
            `INSERT INTO events (
              symbol, 
              event_type, 
              scheduled_at, 
              status,
              title,
              description,
              importance
            )
            VALUES ($1, 'news', $2, 'scheduled', $3, $4, $5)
            ON CONFLICT (symbol, event_type, scheduled_at) 
            DO UPDATE SET 
              status = 'scheduled',
              title = $3,
              description = $4,
              importance = $5`,
            [
              symbol,
              item.time_published,
              item.title,
              description,
              importance
            ]
          );
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Store market events in database
  private async storeMarketEvents(events: MarketEvent[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const event of events) {
        await client.query(
          `INSERT INTO events (
            symbol, 
            event_type, 
            scheduled_at, 
            status,
            title,
            description,
            importance
          )
          VALUES ($1, $2, $3, 'scheduled', $4, $5, $6)
          ON CONFLICT (symbol, event_type, scheduled_at) 
          DO UPDATE SET 
            status = 'scheduled',
            title = $4,
            description = $5,
            importance = $6`,
          [
            event.symbol,
            event.event_type,
            event.scheduled_at,
            event.title,
            event.description,
            event.importance
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Update events for all symbols in watchlist
  async updateEventsForWatchlist(userId: string): Promise<void> {
    try {
      // Get user's watchlist
      const watchlistResult = await pool.query(
        'SELECT DISTINCT symbol FROM watchlist WHERE user_id = $1',
        [userId]
      );

      // Update events for each symbol
      for (const { symbol } of watchlistResult.rows) {
        await this.fetchEarningsCalendar(symbol);
        await this.fetchDividendCalendar(symbol);
        await this.fetchNewsAndSentiment(symbol);
        await this.fetchCompanyOverview(symbol);
      }
    } catch (error) {
      console.error('Error updating events for watchlist:', error);
      throw error;
    }
  }
} 