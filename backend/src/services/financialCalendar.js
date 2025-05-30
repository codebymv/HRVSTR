const axios = require('axios');
const { pool } = require('../config/data-sources');
const { getEffectiveApiKey } = require('../utils/userApiKeys');

class FinancialCalendarService {
  constructor(userId = null, userApiKey = null) {
    this.userId = userId;
    this.userApiKey = userApiKey;
    this.baseUrl = 'https://www.alphavantage.co/query';
    
    // If a user API key is provided directly, use it
    if (userApiKey) {
      this.apiKey = userApiKey;
      this.isConfigured = true;
    } else {
      // Fall back to environment variable for backward compatibility
      this.apiKey = process.env.ALPHA_VANTAGE_API_KEY || '';
      this.isConfigured = !!this.apiKey;
    }
    
    if (!this.isConfigured) {
      console.warn('⚠️ Alpha Vantage API key not found - financial calendar features will be limited');
    }
  }

  // Get the effective API key for the current user
  async getApiKey() {
    if (this.userApiKey) {
      return this.userApiKey;
    }
    
    if (this.userId) {
      const effectiveKey = await getEffectiveApiKey(this.userId, 'alpha_vantage');
      if (effectiveKey) {
        this.apiKey = effectiveKey;
        this.isConfigured = true;
        return effectiveKey;
      }
    }
    
    return this.apiKey;
  }

  // Check if the service is properly configured
  async isAvailable() {
    const apiKey = await this.getApiKey();
    return !!apiKey;
  }

  async fetchEarningsCalendar(symbol) {
    if (!(await this.isAvailable())) {
      console.log('Alpha Vantage not configured - skipping earnings calendar fetch');
      return [];
    }

    try {
      const apiKey = await this.getApiKey();
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'EARNINGS_CALENDAR',
          symbol,
          apikey: apiKey
        },
        responseType: 'text'
      });

      console.log('Earnings API response status:', response.status);
      console.log('Earnings API response data preview:', response.data ? response.data.substring(0, 200) : 'No data');

      // Check if the response starts with the expected CSV header
      const expectedHeader = 'symbol,name,reportDate,fiscalDateEnding,estimate,currency';
      if (!response.data || !response.data.trim().startsWith(expectedHeader)) {
         console.error('Alpha Vantage Earnings API returned unexpected data format:', response.data);
         return []; // Return empty array if unexpected response
      }

      const events = this.parseEarningsCSV(response.data);
      await this.storeEarningsEvents(events);
      return events;
    } catch (error) {
      console.error('Error fetching earnings calendar:', error);
      throw error;
    }
  }

  async fetchDividendCalendar(symbol) {
    if (!(await this.isAvailable())) {
      console.log('Alpha Vantage not configured - skipping dividend calendar fetch');
      return [];
    }

    try {
      const apiKey = await this.getApiKey();
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'TIME_SERIES_DAILY_ADJUSTED',
          symbol,
          apikey: apiKey
        }
      });

      const events = this.parseDividendData(response.data);
      await this.storeDividendEvents(events);
      return events;
    } catch (error) {
      console.error('Error fetching dividend calendar:', error);
      throw error;
    }
  }

  async fetchNewsAndSentiment(symbol) {
    if (!(await this.isAvailable())) {
      console.log('Alpha Vantage not configured - skipping news and sentiment fetch');
      return;
    }

    try {
      const apiKey = await this.getApiKey();
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'NEWS_SENTIMENT',
          tickers: symbol,
          apikey: apiKey
        }
      });

      const news = response.data.feed || [];
      await this.storeNewsEvents(symbol, news);
    } catch (error) {
      console.error('Error fetching news and sentiment:', error);
      throw error;
    }
  }

  async fetchCompanyOverview(symbol) {
    if (!(await this.isAvailable())) {
      console.log('Alpha Vantage not configured - skipping company overview fetch');
      return;
    }

    try {
      const apiKey = await this.getApiKey();
      const response = await axios.get(this.baseUrl, {
        params: {
          function: 'OVERVIEW',
          symbol,
          apikey: apiKey
        }
      });

      const data = response.data;
      if (data) {
        const events = [];

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

        await this.storeMarketEvents(events);
      }
    } catch (error) {
      console.error('Error fetching company overview:', error);
      throw error;
    }
  }

  parseEarningsCSV(csvData) {
    const lines = csvData.split('\n');
    const events = [];

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const [symbol, name, reportDate, fiscalDateEnding, estimate, currency] = line.split(',');
      
      if (symbol && reportDate) {
        // Validate reportDate
        if (isNaN(new Date(reportDate).getTime())) {
          console.error(`Invalid report date for ${symbol}: ${reportDate}`);
          continue;
        }

        events.push({
          symbol,
          name,
          reportDate,
          fiscalDateEnding,
          estimate: estimate ? parseFloat(estimate) : null,
          currency
        });
      }
    }

    return events;
  }

  parseDividendData(data) {
    const events = [];
    const timeSeries = data['Time Series (Daily)'];

    if (!timeSeries) return events;

    for (const [date, values] of Object.entries(timeSeries)) {
      const dividendAmount = parseFloat(values['7. dividend amount']);
      if (dividendAmount > 0) {
        events.push({
          symbol: data['Meta Data']['2. Symbol'],
          exDate: date,
          paymentDate: date,
          amount: dividendAmount
        });
      }
    }

    return events;
  }

  async storeEarningsEvents(events) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const event of events) {
        const description = [
          event.name ? `Company: ${event.name}` : null,
          event.fiscalDateEnding ? `Fiscal Period Ending: ${event.fiscalDateEnding}` : null,
          event.estimate ? `Expected EPS: ${event.estimate} ${event.currency}` : null
        ].filter(Boolean).join('\n');

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

  async storeDividendEvents(events) {
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

  async storeNewsEvents(symbol, news) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of news) {
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

  async storeMarketEvents(events) {
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

  async updateEventsForWatchlist(userId) {
    try {
      const watchlistResult = await pool.query(
        'SELECT DISTINCT symbol FROM watchlist WHERE user_id = $1',
        [userId]
      );

      for (const { symbol } of watchlistResult.rows) {
        await Promise.all([
          this.fetchEarningsCalendar(symbol),
          this.fetchDividendCalendar(symbol),
          this.fetchNewsAndSentiment(symbol),
          this.fetchCompanyOverview(symbol)
        ]);
      }
    } catch (error) {
      console.error('Error updating events for watchlist:', error);
      throw error;
    }
  }
}

module.exports = { FinancialCalendarService }; 