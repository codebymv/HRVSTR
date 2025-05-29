import axios from 'axios';

// Get the API URL with smart production detection (same logic as apiService.ts)
const getApiUrl = (): string => {
  // In production, use the Railway backend service URL
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.PROD) {
    return 'https://backend-production-81ee.up.railway.app';
  }
  // In development, use the environment variable or default
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:3001';
  }
  // Fallback for other environments
  return 'http://localhost:3001';
};

const API_BASE_URL = getApiUrl();

export interface DocFile {
  path: string;
  content: string;
  lastModified: string;
}

export interface DocStructure {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: DocStructure[];
}

const GETTING_STARTED_CONTENT = `
# Getting Started with HRVSTR

## Overview

HRVSTR is a financial analysis platform that aggregates data from multiple sources including SEC EDGAR filings, Reddit sentiment, FinViz data, and earnings information. The platform provides unified APIs and a modern web interface for financial data analysis.

## Prerequisites

Before you begin, make sure you have the following installed:
- Node.js (v18 or higher)
- npm or yarn
- Redis (for caching)
- Git

## Quick Start

### 1. Clone the Repository

\`\`\`bash
git clone https://github.com/yourusername/hrvstr.git
cd hrvstr
\`\`\`

### 2. Install Dependencies

\`\`\`bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
\`\`\`

### 3. Environment Setup

Create environment files in both frontend and backend directories:

**Backend (.env)**:
\`\`\`env
PORT=3001
NODE_ENV=development
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
SEC_USER_AGENT=YourApp/1.0 (your.email@example.com)
REDIS_URL=redis://localhost:6379
API_KEY=your_api_key_here
\`\`\`

**Frontend (.env)**:
\`\`\`env
VITE_API_BASE_URL=http://localhost:3001
VITE_API_KEY=your_api_key_here
\`\`\`

### 4. Start Redis (Required for Caching)

\`\`\`bash
# On macOS with Homebrew
brew services start redis

# On Ubuntu/Debian
sudo systemctl start redis-server

# Or using Docker
docker run -d -p 6379:6379 redis:alpine
\`\`\`

### 5. Run the Application

**Development Mode:**

Terminal 1 - Backend:
\`\`\`bash
cd backend
npm run dev
\`\`\`

Terminal 2 - Frontend:
\`\`\`bash
cd frontend
npm run dev
\`\`\`

### 6. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api/docs

## API Keys Setup

HRVSTR integrates with several external services. You'll need to obtain API keys for:

### Reddit API
1. Go to https://www.reddit.com/prefs/apps
2. Create a new app (script type)
3. Use the client ID and secret in your \`.env\`

### SEC EDGAR
- No API key required, but you must provide a valid User-Agent
- Format: \`YourApp/1.0 (your.email@example.com)\`

## Project Structure

\`\`\`
hrvstr/
├── frontend/          # React/Vite frontend application
├── backend/           # Node.js/Express backend API
├── !docs/            # Project documentation
├── package.json      # Root package.json for workspace
└── README.md         # Project overview
\`\`\`

## Testing

\`\`\`bash
# Run backend tests
cd backend
npm run test

# Run frontend tests
cd frontend
npm run test

# Run all tests from root
npm run test
\`\`\`

## Building for Production

\`\`\`bash
# Build backend
cd backend
npm run build

# Build frontend
cd frontend
npm run build
\`\`\`

## Common Issues

### Redis Connection Error
- Ensure Redis is running: \`redis-cli ping\` should return \`PONG\`
- Check Redis URL in environment variables

### CORS Issues
- Verify frontend URL is allowed in backend CORS configuration
- Check that API base URL is correct in frontend environment

### API Rate Limits
- SEC EDGAR has rate limits (10 requests per second)
- Reddit API has OAuth limits
- Consider implementing caching strategies

## Next Steps

1. **Read the API Documentation**: Start with [API Overview](./API/api-overview.md)
2. **Explore Endpoints**: Check individual endpoint docs in [./API/endpoints/](./API/endpoints/)
3. **Configuration**: Review [Config Documentation](./Config/) for advanced setup
4. **Security**: See [Security Documentation](./Security/) before production deployment

## Support

- **Issues**: File issues on GitHub repository
- **Documentation**: All docs are in the \`!docs/\` directory
- **API Reference**: Available at \`/api/docs\` when running the backend

## Development Workflow

1. Create feature branches from \`main\`
2. Write tests for new functionality
3. Update documentation as needed
4. Submit pull requests for review
5. Deploy to staging for testing before production

For detailed information about specific components, see the respective documentation sections in the \`!docs/\` directory. 
`;

class DocsService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/api/docs`;
  }

  async getDocContent(path: string): Promise<string> {
    try {
      const response = await axios.get(`${this.baseUrl}/content`, {
        params: { path }
      });
      return response.data.content;
    } catch (error) {
      console.error('Error fetching doc content for path:', path, error);
      if (path === 'getting-started' || path === '' || path === '/') {
        return GETTING_STARTED_CONTENT + 
               '\n\n---\n*This is fallback content. The actual content could not be loaded.*' ;
      }
      return this.getFallbackContent(path);
    }
  }

  async getDocStructure(): Promise<DocStructure[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/structure`);
      return response.data;
    } catch (error) {
      console.error('Error fetching doc structure:', error);
      return this.getStaticStructure();
    }
  }

  async searchDocs(query: string): Promise<DocStructure[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/docs/search?q=${encodeURIComponent(query)}`);
      return response.data;
    } catch (error) {
      console.error('Error searching docs:', error);
      return [];
    }
  }

  generateFolderContent(path: string): string {
    const structure = this.getStaticStructure();
    const folder = this.findFolderByPath(structure, path);
    
    if (!folder || folder.type !== 'folder') {
      return this.getFallbackContent(path);
    }

    const folderName = folder.name;
    let content = `# ${folderName}\n\n`;
    
    // Add context-aware descriptions
    const description = this.getFolderDescription(path, folderName);
    content += `${description}\n\n`;

    if (folder.children && folder.children.length > 0) {
      content += `## Contents\n\n`;
      
      // Separate folders and files
      const folders = folder.children.filter(child => child.type === 'folder');
      const files = folder.children.filter(child => child.type === 'file');

      // Add folders first
      if (folders.length > 0) {
        content += `### 📁 Folders\n\n`;
        folders.forEach(child => {
          content += `- **[${child.name}](/help/${child.path})** - `;
          content += `${child.children?.length || 0} item${(child.children?.length || 0) !== 1 ? 's' : ''}\n`;
        });
        content += `\n`;
      }

      // Add files
      if (files.length > 0) {
        content += `### 📄 Documentation Files\n\n`;
        files.forEach(child => {
          content += `- **[${child.name}](/help/${child.path})**\n`;
        });
        content += `\n`;
      }

      // Add quick navigation
      content += `## Quick Navigation\n\n`;
      content += `| Name | Type | Path |\n`;
      content += `|------|------|------|\n`;
      folder.children.forEach(child => {
        const icon = child.type === 'folder' ? '📁' : '📄';
        content += `| ${icon} [${child.name}](/help/${child.path}) | ${child.type} | \`${child.path}\` |\n`;
      });

    } else {
      content += `*This folder is currently empty or has no documented items.*\n\n`;
    }

    content += `\n---\n\n`;
    content += `💡 **Tip**: Use the sidebar navigation or search above to quickly find specific documentation.\n\n`;
    content += `[🏠 Back to Documentation Home](/help)`;

    return content;
  }

  private findFolderByPath(structure: DocStructure[], path: string): DocStructure | null {
    for (const item of structure) {
      if (item.path === path) {
        return item;
      }
      if (item.children) {
        const found = this.findFolderByPath(item.children, path);
        if (found) return found;
      }
    }
    return null;
  }

  private getFallbackContent(path: string): string {
    const fileName = path.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Documentation';
    return `# ${fileName}\n\n## Content Not Available\n\nThe content for \`${path}\` could not be loaded. Please check the API or try again later.\n\n---\n*This is fallback content.*`;
  }

  private getStaticStructure(): DocStructure[] {
    return [
      {
        name: 'Getting Started',
        path: 'getting-started',
        type: 'file'
      },
      {
        name: 'API',
        path: 'API',
        type: 'folder',
        children: [
          { name: 'API Overview', path: 'API/api-overview', type: 'file' },
          { name: 'API Structure', path: 'API/api-structure', type: 'file' },
          { name: 'Authentication', path: 'API/authentication', type: 'file' },
          { name: 'CORS Configuration', path: 'API/cors-configuration', type: 'file' },
          {
            name: 'Endpoints',
            path: 'API/endpoints',
            type: 'folder',
            children: [
              { name: 'Earnings', path: 'API/endpoints/earnings', type: 'file' },
              { name: 'FinViz', path: 'API/endpoints/finviz', type: 'file' },
              { name: 'Reddit', path: 'API/endpoints/reddit', type: 'file' },
              { name: 'SEC', path: 'API/endpoints/sec', type: 'file' },
              { name: 'Sentiment', path: 'API/endpoints/sentiment', type: 'file' },
              { name: 'Settings', path: 'API/endpoints/settings', type: 'file' }
            ]
          }
        ]
      },
      {
        name: 'Config',
        path: 'Config',
        type: 'folder',
        children: [
          { name: 'Backend Config', path: 'Config/backend-config', type: 'file' },
          { name: 'Frontend Config', path: 'Config/frontend-config', type: 'file' }
        ]
      },
      {
        name: 'Dependencies',
        path: 'Dependencies',
        type: 'folder',
        children: [
          { name: 'Dependencies Overview', path: 'Dependencies/dependencies-overview', type: 'file' }
        ]
      },
      {
        name: 'Deploy',
        path: 'Deploy',
        type: 'folder',
        children: [
          { name: 'Deployment Overview', path: 'Deploy/deployment-overview', type: 'file' }
        ]
      },
      {
        name: 'Implementations',
        path: 'Implementations',
        type: 'folder',
        children: [
          {
            name: 'APIs',
            path: 'Implementations/APIs',
            type: 'folder',
            children: [
              { name: 'FinViz API', path: 'Implementations/APIs/finviz-api', type: 'file' },
              { name: 'Proxy Server', path: 'Implementations/APIs/proxy-server', type: 'file' },
              { name: 'Reddit API', path: 'Implementations/APIs/reddit-api', type: 'file' },
              { name: 'SEC EDGAR', path: 'Implementations/APIs/sec-edgar', type: 'file' }
            ]
          },
          {
            name: 'Caching',
            path: 'Implementations/Caching',
            type: 'folder',
            children: [
              { name: 'Caching Overview', path: 'Implementations/Caching/caching-overview', type: 'file' },
              { name: 'Earnings Caching', path: 'Implementations/Caching/earnings-caching', type: 'file' },
              { name: 'SEC Filings Caching', path: 'Implementations/Caching/sec-filings-caching', type: 'file' },
              { name: 'Sentiment Caching', path: 'Implementations/Caching/sentiment-caching', type: 'file' }
            ]
          },
          {
            name: 'Charts',
            path: 'Implementations/Charts',
            type: 'folder',
            children: [
              { name: 'SEC Filings Visualization', path: 'Implementations/Charts/sec-filings-visualization', type: 'file' },
              { name: 'Sentiment Visualization', path: 'Implementations/Charts/sentiment-visualization', type: 'file' }
            ]
          },
          {
            name: 'Lists',
            path: 'Implementations/Lists',
            type: 'folder',
            children: [
              { name: 'Infinite Scroll', path: 'Implementations/Lists/infinite-scroll', type: 'file' },
              { name: 'Lists Overview', path: 'Implementations/Lists/lists-overview', type: 'file' }
            ]
          },
          {
            name: 'OAuth',
            path: 'Implementations/OAuth',
            type: 'folder',
            children: [
              { name: 'OAuth Overview', path: 'Implementations/OAuth/oauth-overview', type: 'file' }
            ]
          },
          {
            name: 'Processing',
            path: 'Implementations/Processing',
            type: 'folder',
            children: [
              { name: 'Earnings Processing', path: 'Implementations/Processing/earnings-processing', type: 'file' },
              { name: 'SEC Filings Processing', path: 'Implementations/Processing/sec-filings-processing', type: 'file' },
              { name: 'Sentiment Processing', path: 'Implementations/Processing/sentiment-processing', type: 'file' }
            ]
          },
          {
            name: 'Proxy Server',
            path: 'Implementations/ProxyServer',
            type: 'folder',
            children: [
              { name: 'Proxy Server Overview', path: 'Implementations/ProxyServer/proxy-server-overview', type: 'file' }
            ]
          },
          {
            name: 'Settings',
            path: 'Implementations/Settings',
            type: 'folder',
            children: [
              { name: 'User Preferences', path: 'Implementations/Settings/user-preferences', type: 'file' }
            ]
          }
        ]
      },
      {
        name: 'Security',
        path: 'Security',
        type: 'folder',
        children: [
          { name: 'Security Overview', path: 'Security/security-overview', type: 'file' }
        ]
      },
      {
        name: 'Stack',
        path: 'Stack',
        type: 'folder',
        children: [
          { name: 'Stack Overview', path: 'Stack/stack-overview', type: 'file' }
        ]
      },
      {
        name: 'Tests',
        path: 'Tests',
        type: 'folder',
        children: [
          {
            name: 'Backend',
            path: 'Tests/Backend',
            type: 'folder',
            children: [
              { name: 'Backend Testing Overview', path: 'Tests/Backend/backend-testing-overview', type: 'file' }
            ]
          },
          {
            name: 'Frontend',
            path: 'Tests/Frontend',
            type: 'folder',
            children: [
              { name: 'Frontend Testing Overview', path: 'Tests/Frontend/frontend-testing-overview', type: 'file' }
            ]
          }
        ]
      },
      {
        name: 'Version',
        path: 'Version',
        type: 'folder',
        children: [
          { name: '0.7.2 Overview', path: 'Version/0.7.2-overview', type: 'file' }
        ]
      }
    ];
  }

  private getFolderDescription(path: string, folderName: string): string {
    const descriptions: Record<string, string> = {
      'API': 'Complete API documentation including endpoints, authentication, and configuration details.',
      'Config': 'Configuration guides for both frontend and backend components.',
      'Dependencies': 'Information about project dependencies and how to manage them.',
      'Deploy': 'Deployment guides and best practices for production environments.',
      'Implementations': 'Detailed implementation guides for various features and integrations.',
      'Security': 'Security guidelines and best practices for the HRVSTR platform.',
      'Stack': 'Technology stack overview and architectural decisions.',
      'Tests': 'Testing documentation and guidelines for both frontend and backend.',
      'Version': 'Version history and release notes.',
      'API/endpoints': 'API endpoint documentation for all available services.',
      'Implementations/APIs': 'API integration implementations and examples.',
      'Implementations/Caching': 'Caching strategies and implementation details.',
      'Implementations/Charts': 'Chart and visualization implementation guides.',
      'Implementations/Lists': 'List components and data handling implementations.',
      'Implementations/OAuth': 'OAuth authentication implementation details.',
      'Implementations/Processing': 'Data processing and transformation implementations.',
      'Implementations/ProxyServer': 'Proxy server setup and configuration.',
      'Implementations/Settings': 'Settings and preferences implementation guides.',
      'Tests/Backend': 'Backend testing strategies and test suites.',
      'Tests/Frontend': 'Frontend testing approaches and component tests.'
    };

    return descriptions[path] || `This section contains documentation for ${folderName.toLowerCase()}.`;
  }
}

export const docsService = new DocsService(); 