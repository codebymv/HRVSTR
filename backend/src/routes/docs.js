const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Function to find the docs folder in different deployment scenarios
const findDocsPath = () => {
  // Possible locations for the !docs folder
  const possiblePaths = [
    path.join(__dirname, '../../docs'),          // Copied docs folder in backend/docs
    path.join(__dirname, '../../../!docs'),      // Development: backend/src/routes -> project root
    path.join(__dirname, '../../!docs'),         // Production scenario 1: backend -> project root
    path.join(__dirname, '../!docs'),            // Production scenario 2: src -> project root
    path.join(__dirname, '../../../../!docs'),   // Production scenario 3: deeper nesting
    path.join(process.cwd(), '!docs'),          // Using process working directory
    path.join(process.cwd(), '../!docs'),       // One level up from working directory
    path.join(process.cwd(), 'docs'),           // Copied docs in working directory
  ];

  // Try each path and return the first one that exists
  for (const docsPath of possiblePaths) {
    try {
      // Check if the path exists and is a directory
      const stats = require('fs').statSync(docsPath);
      if (stats.isDirectory()) {
        console.log(`Found docs folder at: ${docsPath}`);
        return docsPath;
      }
    } catch (error) {
      // Path doesn't exist, try next one
      continue;
    }
  }

  // If no docs folder found, log error and use default
  console.error('!docs folder not found in any expected location. Tried:', possiblePaths);
  return path.join(__dirname, '../../../!docs'); // fallback to original path
};

// Base path to the docs folder
const DOCS_BASE_PATH = findDocsPath();

/**
 * Get markdown content for a specific document path
 * GET /api/docs/content?path=getting-started
 * GET /api/docs/content?path=API/api-overview
 */
router.get('/content', async (req, res) => {
  try {
    const { path: docPath } = req.query;
    
    if (!docPath) {
      return res.status(400).json({
        error: 'Path parameter is required'
      });
    }

    // Construct the full file path
    const fileName = docPath.endsWith('.md') ? docPath : `${docPath}.md`;
    const fullPath = path.join(DOCS_BASE_PATH, fileName);

    // Security check: ensure the path is within the docs directory
    const resolvedPath = path.resolve(fullPath);
    const resolvedDocsPath = path.resolve(DOCS_BASE_PATH);
    
    if (!resolvedPath.startsWith(resolvedDocsPath)) {
      return res.status(403).json({
        error: 'Access denied: Path outside docs directory'
      });
    }

    try {
      const content = await fs.readFile(resolvedPath, 'utf-8');
      const stats = await fs.stat(resolvedPath);
      
      res.json({
        content,
        path: docPath,
        lastModified: stats.mtime.toISOString(),
        size: stats.size
      });
    } catch (fileError) {
      if (fileError.code === 'ENOENT') {
        // File not found, try fallback content
        const fallbackContent = getFallbackDocContent(docPath);
        if (fallbackContent) {
          res.json({
            content: fallbackContent,
            path: docPath,
            lastModified: new Date().toISOString(),
            size: fallbackContent.length,
            source: 'fallback'
          });
        } else {
          res.status(404).json({
            error: 'Document not found',
            path: docPath
          });
        }
      } else {
        throw fileError;
      }
    }
  } catch (error) {
    console.error('Error reading document:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to read document'
    });
  }
});

/**
 * Get the structure of the documentation directory
 * GET /api/docs/structure
 */
router.get('/structure', async (req, res) => {
  try {
    const structure = await buildDocStructure(DOCS_BASE_PATH);
    res.json(structure);
  } catch (error) {
    console.error('Error building doc structure:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to build documentation structure'
    });
  }
});

/**
 * Search documentation files
 * GET /api/docs/search?q=API
 */
router.get('/search', async (req, res) => {
  try {
    const { q: query } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        error: 'Query parameter is required'
      });
    }

    const searchResults = await searchDocuments(DOCS_BASE_PATH, query.trim());
    res.json(searchResults);
  } catch (error) {
    console.error('Error searching documents:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to search documents'
    });
  }
});

/**
 * Recursively build the documentation directory structure
 */
async function buildDocStructure(dirPath, relativePath = '') {
  const items = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      const relativeEntryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        const children = await buildDocStructure(entryPath, relativeEntryPath);
        items.push({
          name: formatName(entry.name),
          path: relativeEntryPath,
          type: 'folder',
          children
        });
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const nameWithoutExt = entry.name.replace('.md', '');
        const pathWithoutExt = relativeEntryPath.replace('.md', '');
        
        items.push({
          name: formatName(nameWithoutExt),
          path: pathWithoutExt,
          type: 'file'
        });
      }
    }
    
    // Sort items: folders first, then files, both alphabetically
    items.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
    
    return items;
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
    return [];
  }
}

/**
 * Search for documents containing the query text
 */
async function searchDocuments(dirPath, query, relativePath = '', results = []) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      const relativeEntryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      
      if (entry.isDirectory()) {
        await searchDocuments(entryPath, query, relativeEntryPath, results);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const content = await fs.readFile(entryPath, 'utf-8');
          const nameWithoutExt = entry.name.replace('.md', '');
          const pathWithoutExt = relativeEntryPath.replace('.md', '');
          
          // Search in filename and content
          const nameMatch = nameWithoutExt.toLowerCase().includes(query.toLowerCase());
          const contentMatch = content.toLowerCase().includes(query.toLowerCase());
          
          if (nameMatch || contentMatch) {
            results.push({
              name: formatName(nameWithoutExt),
              path: pathWithoutExt,
              type: 'file',
              excerpt: contentMatch ? extractExcerpt(content, query) : null
            });
          }
        } catch (readError) {
          console.error(`Error reading file ${entryPath}:`, readError);
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error(`Error searching directory ${dirPath}:`, error);
    return results;
  }
}

/**
 * Extract a text excerpt around the search query
 */
function extractExcerpt(content, query, contextLength = 100) {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerContent.indexOf(lowerQuery);
  
  if (index === -1) return null;
  
  const start = Math.max(0, index - contextLength);
  const end = Math.min(content.length, index + query.length + contextLength);
  
  let excerpt = content.substring(start, end);
  
  // Add ellipsis if we truncated
  if (start > 0) excerpt = '...' + excerpt;
  if (end < content.length) excerpt = excerpt + '...';
  
  return excerpt;
}

/**
 * Format file/directory names for display
 */
function formatName(name) {
  return name
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Get fallback content for critical documents when files aren't available
 */
function getFallbackDocContent(docPath) {
  const fallbackDocs = {
    'getting-started': `# Getting Started with HRVSTR

Welcome to **HRVSTR** – your comprehensive financial sentiment and data analysis platform! If you're feeling overwhelmed, don't worry. This guide will walk you through everything step-by-step.

> 📋 **New to v0.7.2?** Check out the [Version 0.7.2 Release Notes](/help/Version/0.7.2-overview) to see the latest improvements including enhanced mobile experience, faster data loading, and improved dark/light mode consistency.

## 🎯 What is HRVSTR?

HRVSTR aggregates financial data from multiple sources and presents it in an easy-to-understand dashboard. Think of it as your command center for tracking market sentiment, insider trades, institutional moves, and earnings events.

## 🚀 Quick Start:

### 1. **Login & Your Dashboard**
When you first log in, you'll land on your **User Home** – your personalized command center featuring:
- **📊 Your Watchlist**: Stocks you're tracking with live sentiment indicators
- **🔔 Recent Activity**: Your latest actions and alerts
- **📅 Upcoming Events**: Earnings and important dates for your stocks

### 2. **What Works Right Out of the Box**
Good news! Several data sources work immediately **without any setup**:
- ✅ **FinViz News & Sentiment** (No API key needed)
- ✅ **SEC Insider Trades** (No API key needed)  
- ✅ **SEC Institutional Holdings** (No API key needed)
- ✅ **Earnings Data** (No API key needed)

### 3. **Add Your First Stock**
1. Click the "+" button in your watchlist
2. Enter any stock ticker (e.g., \`AAPL\`, \`TSLA\`, \`NVDA\`)
3. Watch as HRVSTR immediately starts tracking sentiment and data for that stock

## 📱 Main Features Overview

### 🏠 **User Home** (Dashboard)
Your starting point with three key sections:

**Watchlist Panel:**
- Track multiple stocks with live sentiment indicators
- See bullish/bearish/neutral sentiment at a glance
- Price changes and alerts for your tracked stocks

**Activity Feed:**
- Your recent searches, additions, and system alerts
- Track what you've been analyzing

**Upcoming Events:**
- Earnings dates for your watchlist stocks
- Important SEC filing deadlines
- Market events that might affect your positions

### 📊 **Sentiment Scraper** 
*Your market mood detector*

**What you'll see:**
- **📈 Sentiment Overview Chart**: Visual timeline of market mood
- **🎯 Top Sentiment Scores**: Stocks with the strongest bullish/bearish signals
- **💬 Reddit Posts**: Real-time social media sentiment (requires Reddit API keys)
- **📰 FinViz Analysis**: Professional news sentiment (works immediately)

**How to use it:**
1. Select your time range (1 day, 1 week, 1 month, 3 months)
2. Look for sentiment spikes – these often predict price movements
3. Click on stocks with strong sentiment for deeper analysis
4. Use the refresh button to get the latest data

### 🏛️ **SEC Filings**
*Follow the smart money*

**Two powerful tabs:**

**Insider Trades Tab:**
- See when company executives buy/sell their own stock
- Filter by time range and company
- Insider buying often signals confidence; selling might indicate concerns

**Institutional Holdings Tab:**
- Track what hedge funds and institutions are buying
- See 13F filings showing big money moves
- When institutions move together, pay attention

**Pro tip:** Look for unusual insider buying activity – it's often a strong bullish signal.

### 📈 **Earnings Monitor**
*Never miss an earnings surprise*

**What it shows:**
- Upcoming earnings dates for all stocks
- Historical earnings surprise analysis
- Which companies tend to beat/miss expectations

**How to use it:**
1. Review the upcoming earnings calendar
2. Click on any ticker to see detailed historical analysis
3. Look for patterns in earnings surprises
4. Plan your trades around earnings dates

### ⚙️ **Settings**
*Customize your experience*

**Usage Monitor:**
- Track your credit usage and remaining allowance
- See when your usage will reset

**Data Sources:**
- Enable/disable different data feeds
- See which sources require API keys vs. work automatically

**Interface Settings:**
- Switch between dark and light themes
- Set your default time ranges
- Customize what information displays

## 🔑 API Keys: What You Need to Know

### **Works Without Setup:**
- **FinViz** ✅ (Financial news and sentiment)
- **SEC Data** ✅ (Insider trades and institutional holdings)  
- **Earnings** ✅ (Upcoming earnings and analysis)
- **Yahoo Finance** ✅ (Price data and basic sentiment)

### **Requires Your API Keys:**
- **Reddit** (for social media sentiment)
- **Alpha Vantage** (for enhanced market data)

### **Getting Reddit API Keys** (Optional but Recommended):
Reddit provides some of the most valuable sentiment data. Here's how to get your keys:

1. Go to [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
2. Click "Create App" or "Create Another App"
3. Choose "script" as the app type
4. Copy your Client ID and Client Secret
5. Enter them in HRVSTR Settings → API Keys

**Why Reddit matters:** Retail sentiment often moves markets, especially for popular stocks like GameStop, Tesla, etc.

## 🎯 Getting the Most from HRVSTR

### **For Day Traders:**
1. **Start with Sentiment Scraper** – check overall market mood
2. **Monitor Insider Trades** – look for unusual buying activity
3. **Use 1-day time ranges** for immediate signals
4. **Set up Reddit keys** for real-time social sentiment

### **For Swing Traders:**
1. **Focus on 1-week to 1-month ranges** in sentiment data
2. **Check Institutional Holdings** for longer-term trends
3. **Use Earnings Monitor** to plan around earnings dates
4. **Watch for sentiment pattern breaks**

### **For Long-Term Investors:**
1. **Use 3-month timeframes** to spot major trends
2. **Focus heavily on Institutional Holdings** – follow the smart money
3. **Track insider buying patterns** over time
4. **Monitor earnings consistency** in the Earnings Monitor

### **Research Workflow Example:**
1. **Add ticker to watchlist** → Get instant sentiment overview
2. **Check Sentiment Scraper** → Understand market mood
3. **Review SEC Filings** → See what insiders and institutions are doing
4. **Check Earnings Monitor** → Plan around upcoming events
5. **Monitor regularly** → Watch for changes in sentiment or filing patterns

## 🎨 Customization Tips

### **Theme Selection:**
- **Dark Mode**: Better for extended use, easier on eyes
- **Light Mode**: Better contrast, good for presentations

### **Time Range Defaults:**
Set your preferred default time range based on your trading style:
- Day traders: 1 day
- Swing traders: 1 week  
- Position traders: 1 month
- Investors: 3 months

### **Data Source Management:**
In Settings, you can enable/disable data sources based on what's most valuable to you.

## 🚨 Common Beginner Mistakes

1. **Ignoring the time range** – Always check what time period you're viewing
2. **Not checking multiple data sources** – Combine sentiment, insider trades, and institutional data
3. **Focusing only on bullish signals** – Bearish sentiment can be just as valuable
4. **Not setting up Reddit keys** – You're missing 50% of sentiment data
5. **Only looking at price** – HRVSTR shows you WHY prices might move

## 📚 Understanding the Data

### **Sentiment Scores:**
- **Bullish (Green)**: Positive sentiment, potential upward pressure
- **Bearish (Red)**: Negative sentiment, potential downward pressure  
- **Neutral (Yellow)**: Mixed or unclear sentiment

### **Insider Trade Signals:**
- **Insider Buying**: Often bullish (executives betting on their company)
- **Insider Selling**: Could be neutral (personal reasons) or bearish
- **Multiple Insiders Buying**: Very bullish signal
- **Unusual Size Trades**: Pay extra attention

### **Institutional Activity:**
- **Increasing Holdings**: Institutional confidence
- **Decreasing Holdings**: Potential concerns
- **New Positions**: Fresh institutional interest
- **Whale Movements**: Very large position changes

## 🔄 Staying Updated

### **Refresh Strategy:**
- **Real-time needs**: Refresh every 15-30 minutes
- **Daily analysis**: Refresh 2-3 times per day
- **Weekly review**: Full refresh at start of each week

### **Data Freshness:**
HRVSTR automatically caches data to provide fast loading while ensuring you get fresh information when it matters.

## 💡 Pro Tips

1. **Combine Data Sources**: The most powerful insights come from correlating sentiment + insider trades + institutional activity
2. **Watch for Divergences**: When sentiment is very positive but insiders are selling, pay attention
3. **Time Range Matters**: A stock might look bearish on 1-day but bullish on 1-month
4. **Context is Key**: Always consider broader market conditions
5. **Document Patterns**: Keep notes on what signal combinations work best for your style

## 🆘 Need Help?

- **In-App Help**: Click the "?" icons throughout the interface
- **Documentation**: Comprehensive guides available in the Help section
- **API Setup Guides**: Step-by-step instructions for setting up Reddit and other APIs

Remember: HRVSTR is designed to enhance your analysis, not replace your judgment. Use it as a powerful tool in your trading and investment toolkit!

## 📖 Additional Resources

- **[Version 0.7.2 Release Notes](/help/Version/0.7.2-overview)** - See what's new in the latest update
- **[API Documentation](/help/API/api-overview)** - Detailed technical guides for advanced usage  
- **[Implementation Guides](/help/Implementations)** - Step-by-step setup instructions for data sources

*Ready to start analyzing? Jump back to your [User Home](/) to begin tracking your first stocks!*

---`,

    'Version/0.7.2-overview': `# HRVSTR v0.7.2

*Released: 05/28/25*

---

## 🚀 What's New in v0.7.2

Version 0.7.2 brings significant improvements to your HRVSTR experience, focusing on performance, usability, and visual consistency across all devices. This update makes the platform faster, more intuitive, and more enjoyable to use.

## ✨ Key Improvements

### 📱 **Mobile Experience Enhanced**
- **Improved Navigation**: The mobile menu now responds more intuitively, making it easier to navigate between sections on your phone or tablet
- **Optimized Touch Interactions**: Better touch targets and smoother transitions for a native app-like feel
- **Responsive Design**: All components now adapt perfectly to different screen sizes

### ⚡ **Faster Data Loading**
- **Quicker Insights**: Sentiment analysis and SEC filings now load significantly faster through optimized data processing
- **Parallel Processing**: Multiple data sources load simultaneously, reducing wait times by up to 50%
- **Smoother Performance**: Less lag when switching between different analysis views

### 📊 **Enhanced Watchlist & Activity Feeds**
- **Cleaner Layout**: Watchlist items and activity feeds now display information more clearly and consistently
- **Better Organization**: Improved formatting makes it easier to scan through your tracked stocks and recent activities
- **Visual Consistency**: All feed items follow the same design pattern for a more professional look

### 🌓 **Improved Dark/Light Mode**
- **Better Contrast**: Enhanced readability across all text elements in both light and dark themes
- **Consistent Theming**: Headers, labels, and secondary text now properly adapt to your chosen theme
- **Eye-Friendly**: Optimized color schemes reduce eye strain during extended use

### 📱 **Infinite Scroll Restored**
- **Seamless Browsing**: Reddit sentiment posts now load continuously as you scroll, eliminating the need to click "Load More"
- **Uninterrupted Analysis**: Stay in the flow while reviewing market sentiment without pagination breaks
- **Performance Optimized**: Smooth scrolling without memory leaks or performance degradation

## 🎯 User Benefits

### **For Traders & Investors**
- **Faster Decision Making**: Quicker data loading means you can react to market changes more rapidly
- **Better Mobile Trading**: Enhanced mobile experience lets you monitor markets effectively on-the-go
- **Clearer Information**: Improved layouts help you spot important trends and data points faster

### **For Research & Analysis**
- **Streamlined Workflow**: Continuous scrolling and better organization reduce friction in your research process
- **Enhanced Readability**: Better theming and formatting make extended analysis sessions more comfortable
- **Improved Focus**: Cleaner interfaces help you concentrate on the data that matters most

### **For All Users**
- **Professional Experience**: Consistent design and improved performance create a more polished, enterprise-grade feel
- **Accessibility**: Better contrast and theming options make the platform accessible to more users
- **Reliability**: Enhanced mobile interactions and optimized loading create a more dependable user experience

## 🔧 Technical Highlights

While these improvements happen behind the scenes, they directly enhance your experience:

- **Smart Loading**: Intelligent data fetching reduces server load and improves response times
- **Memory Optimization**: Better resource management ensures smooth performance during long sessions
- **Cross-Platform Consistency**: Unified behavior across desktop, tablet, and mobile devices

## 🎨 Visual & UX Improvements

- **Polished Interface**: Every component has been refined for better visual hierarchy
- **Intuitive Navigation**: More logical flow between sections and features
- **Professional Aesthetics**: Enhanced styling that reflects HRVSTR's growing maturity as a platform

## 📈 Coming Next

Version 0.7.2 brings us closer to our 1.0 stable release, with approximately **73% completion** toward our full feature roadmap. Stay tuned for upcoming improvements including:

- Advanced filtering and search capabilities
- Real-time notifications and alerts
- Enhanced portfolio tracking features
- Additional data sources and integrations

---

## 💡 Getting the Most from v0.7.2

To experience these improvements:

1. **Refresh your browser** or restart the app to ensure you're on the latest version
2. **Try the mobile experience** - navigate through different sections on your phone to feel the enhanced responsiveness
3. **Test the infinite scroll** in the Reddit sentiment section for seamless browsing
4. **Switch between themes** to see the improved dark/light mode consistency
5. **Check your watchlist** for the cleaner, more organized layout

---

*Questions or feedback about v0.7.2? We'd love to hear from you! Your input helps us continue improving the HRVSTR platform.*`
  };

  return fallbackDocs[docPath] || null;
}

module.exports = router; 