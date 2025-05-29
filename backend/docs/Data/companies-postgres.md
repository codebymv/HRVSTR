# Companies Table

## Overview
The `companies` table serves as a master reference for company information, storing basic company data that gets populated from various external APIs. It acts as a lookup table for stock symbols and company names used throughout the HRVSTR platform.

## Schema

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | SERIAL or UUID | PRIMARY KEY | auto-increment or `uuid_generate_v4()` | Unique company identifier |
| `symbol` | VARCHAR(10) | UNIQUE NOT NULL | - | Stock ticker symbol (e.g., 'AAPL') |
| `company_name` | VARCHAR(255) | NOT NULL | - | Full company name |
| `sector` | VARCHAR(100) | - | NULL | Business sector classification |
| `industry` | VARCHAR(100) | - | NULL | Industry classification |
| `created_at` | TIMESTAMP WITH TIME ZONE | - | `CURRENT_TIMESTAMP` | Record creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | - | `CURRENT_TIMESTAMP` | Last update timestamp |

## Constraints

### Primary Key
- `id`: Unique identifier for each company record

### Unique Constraints
- `symbol`: Each stock symbol can only exist once

### Indexes
```sql
-- Primary symbol lookup index
CREATE UNIQUE INDEX idx_companies_symbol ON companies(symbol);

-- Company name search index
CREATE INDEX idx_companies_name ON companies(company_name);

-- Sector/industry filtering
CREATE INDEX idx_companies_sector ON companies(sector);
CREATE INDEX idx_companies_industry ON companies(industry);

-- Full-text search capability
CREATE INDEX idx_companies_name_fts ON companies USING gin(to_tsvector('english', company_name));
```

## Data Sources

### Primary APIs
- **Alpha Vantage**: Company overview and fundamental data
- **IEX Cloud**: Real-time company information
- **SEC EDGAR**: Official company filings and CIK mappings
- **Yahoo Finance**: Basic company data
- **Manual Entry**: Admin-curated company information

### Data Population
Companies are automatically added when:
- Users search for stocks
- Stocks are added to watchlists
- Events are processed for new symbols
- SEC filings reference new companies

## Common Queries

### Find Company by Symbol
```sql
SELECT * FROM companies WHERE symbol = $1;
```

### Search Companies by Name
```sql
SELECT symbol, company_name 
FROM companies 
WHERE company_name ILIKE '%' || $1 || '%' 
ORDER BY company_name;
```

### Insert or Update Company
```sql
INSERT INTO companies (symbol, company_name, sector, industry) 
VALUES ($1, $2, $3, $4)
ON CONFLICT (symbol) 
DO UPDATE SET 
  company_name = $2,
  sector = $3,
  industry = $4,
  updated_at = CURRENT_TIMESTAMP;
```

### Get Companies by Sector
```sql
SELECT symbol, company_name, industry 
FROM companies 
WHERE sector = $1 
ORDER BY company_name;
```

### Full-Text Search
```sql
SELECT symbol, company_name, 
       ts_rank(to_tsvector('english', company_name), plainto_tsquery($1)) as rank
FROM companies 
WHERE to_tsvector('english', company_name) @@ plainto_tsquery($1)
ORDER BY rank DESC, company_name;
```

## Business Logic

### Company Discovery and Storage
```javascript
async function ensureCompanyExists(symbol, source = 'api') {
  try {
    // Check if company exists
    const existing = await pool.query(
      'SELECT id, company_name FROM companies WHERE symbol = $1',
      [symbol]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Fetch company data from external API
    const companyData = await fetchCompanyData(symbol, source);
    
    // Store in database
    const result = await pool.query(`
      INSERT INTO companies (symbol, company_name, sector, industry) 
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (symbol) DO UPDATE SET 
        company_name = $2,
        sector = $3,
        industry = $4,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [symbol, companyData.name, companyData.sector, companyData.industry]);

    return result.rows[0];
  } catch (error) {
    console.error(`Error ensuring company exists for ${symbol}:`, error);
    throw error;
  }
}
```

### Company Data Enrichment
```javascript
async function enrichCompanyData(symbol) {
  const sources = ['alpha_vantage', 'iex_cloud', 'sec_edgar'];
  let companyData = {};

  for (const source of sources) {
    try {
      const data = await fetchFromSource(source, symbol);
      companyData = { ...companyData, ...data };
    } catch (error) {
      console.warn(`Failed to fetch from ${source} for ${symbol}:`, error.message);
    }
  }

  return companyData;
}
```

## Integration Patterns

### Watchlist Integration
Companies are automatically created when stocks are added to watchlists:
```javascript
// From watchlist.js
const companyResult = await pool.query(
  'SELECT company_name FROM companies WHERE symbol = $1',
  [symbol]
);

if (companyResult.rows.length === 0) {
  // Fetch from Alpha Vantage and store
  const overviewResponse = await axios.get('https://www.alphavantage.co/query', {
    params: {
      function: 'OVERVIEW',
      symbol,
      apikey: process.env.ALPHA_VANTAGE_API_KEY
    }
  });

  await pool.query(
    'INSERT INTO companies (symbol, company_name) VALUES ($1, $2) ON CONFLICT (symbol) DO UPDATE SET company_name = $2',
    [symbol, overviewResponse.data.Name]
  );
}
```

### Search Integration
Companies are stored during search operations:
```javascript
// From stocks.js search endpoint
for (const result of formattedResults) {
  try {
    await pool.query(
      'INSERT INTO companies (symbol, company_name) VALUES ($1, $2) ON CONFLICT (symbol) DO UPDATE SET company_name = $2',
      [result.symbol, result.name]
    );
  } catch (dbError) {
    console.error(`Error storing ${result.symbol}:`, dbError.message);
  }
}
```

## Sector and Industry Classifications

### Standard Classifications
- **Technology**: Software, Hardware, Semiconductors
- **Healthcare**: Pharmaceuticals, Biotechnology, Medical Devices
- **Financial**: Banking, Insurance, Investment Services
- **Consumer Discretionary**: Retail, Automotive, Entertainment
- **Consumer Staples**: Food & Beverages, Household Products
- **Energy**: Oil & Gas, Renewable Energy
- **Materials**: Chemicals, Mining, Construction Materials
- **Industrials**: Aerospace, Manufacturing, Transportation
- **Utilities**: Electric, Gas, Water
- **Real Estate**: REITs, Real Estate Services
- **Communication Services**: Telecommunications, Media

### Industry Granularity
More specific industry classifications within each sector for detailed filtering and analysis.

## Data Quality

### Validation Rules
- `symbol`: Must be 1-10 uppercase alphanumeric characters
- `company_name`: Required, non-empty string
- `sector`/`industry`: Optional, from predefined lists

### Data Cleanup
```sql
-- Remove duplicate companies (by symbol)
DELETE FROM companies a USING companies b 
WHERE a.id > b.id AND a.symbol = b.symbol;

-- Normalize company names
UPDATE companies 
SET company_name = TRIM(REGEXP_REPLACE(company_name, '\s+', ' ', 'g'))
WHERE company_name != TRIM(REGEXP_REPLACE(company_name, '\s+', ' ', 'g'));

-- Update empty sectors/industries
UPDATE companies 
SET sector = 'Unknown', industry = 'Unknown' 
WHERE sector IS NULL OR industry IS NULL;
```

## Analytics Queries

### Popular Companies
```sql
-- Most watched companies
SELECT c.symbol, c.company_name, COUNT(w.id) as watchlist_count
FROM companies c
LEFT JOIN watchlist w ON c.symbol = w.symbol
GROUP BY c.id, c.symbol, c.company_name
ORDER BY watchlist_count DESC
LIMIT 20;
```

### Sector Distribution
```sql
-- Companies by sector
SELECT sector, COUNT(*) as company_count
FROM companies 
WHERE sector IS NOT NULL
GROUP BY sector
ORDER BY company_count DESC;
```

### Recent Additions
```sql
-- Recently added companies
SELECT symbol, company_name, created_at
FROM companies 
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY created_at DESC;
```

## Example Data

```sql
INSERT INTO companies (symbol, company_name, sector, industry) 
VALUES 
  ('AAPL', 'Apple Inc.', 'Technology', 'Consumer Electronics'),
  ('MSFT', 'Microsoft Corporation', 'Technology', 'Software'),
  ('GOOGL', 'Alphabet Inc.', 'Communication Services', 'Internet Content & Information'),
  ('AMZN', 'Amazon.com Inc.', 'Consumer Discretionary', 'Internet Retail'),
  ('TSLA', 'Tesla, Inc.', 'Consumer Discretionary', 'Automobiles'),
  ('META', 'Meta Platforms Inc.', 'Communication Services', 'Social Media'),
  ('NVDA', 'NVIDIA Corporation', 'Technology', 'Semiconductors'),
  ('JPM', 'JPMorgan Chase & Co.', 'Financial', 'Banking'),
  ('JNJ', 'Johnson & Johnson', 'Healthcare', 'Pharmaceuticals'),
  ('V', 'Visa Inc.', 'Financial', 'Payment Processing');
```

## Performance Considerations

### Caching Strategy
- Cache frequently accessed companies in Redis
- Preload popular companies at application startup
- Cache search results for common queries

### Database Optimization
- Regular VACUUM and ANALYZE operations
- Monitor query performance with EXPLAIN
- Consider read replicas for heavy search workloads

## Security Considerations

### Data Validation
- Sanitize company names to prevent XSS
- Validate symbol format before database operations
- Rate limit company data updates

### Access Control
- Company data is generally public information
- No user-specific access controls needed
- Admin access for manual data corrections

## Migration Notes

### Schema Evolution
The companies table may evolve to include:
- Market capitalization
- Exchange information (NYSE, NASDAQ)
- Country/region classification
- ESG ratings
- Financial metrics cache

### Future Enhancements
```sql
-- Potential schema additions
ALTER TABLE companies ADD COLUMN exchange VARCHAR(20);
ALTER TABLE companies ADD COLUMN country VARCHAR(50);
ALTER TABLE companies ADD COLUMN market_cap BIGINT;
ALTER TABLE companies ADD COLUMN ipo_date DATE;
ALTER TABLE companies ADD COLUMN employees INTEGER;
ALTER TABLE companies ADD COLUMN website VARCHAR(255);
```

## Related Files

- `backend/src/routes/stocks.js` - Stock search and company data
- `backend/src/routes/watchlist.js` - Watchlist management
- `backend/src/services/sec/companyDatabase.js` - SEC company mapping
- `backend/src/services/dataEnrichment.js` - Company data enrichment
- `frontend/src/components/CompanySearch.tsx` - Company search UI

## Monitoring & Maintenance

### Key Metrics
- Total companies in database
- New companies added per day
- Data completeness (sector/industry coverage)
- Search performance metrics

### Maintenance Tasks
- Weekly data quality checks
- Monthly sector/industry classification updates
- Quarterly data refresh from authoritative sources
- Annual data archive and cleanup 