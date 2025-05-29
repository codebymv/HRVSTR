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

```bash
git clone https://github.com/yourusername/hrvstr.git
cd hrvstr
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

### 3. Environment Setup

Create environment files in both frontend and backend directories:

**Backend (.env)**:
```env
PORT=3001
NODE_ENV=development
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
SEC_USER_AGENT=YourApp/1.0 (your.email@example.com)
REDIS_URL=redis://localhost:6379
API_KEY=your_api_key_here
```

**Frontend (.env)**:
```env
VITE_API_BASE_URL=http://localhost:3001
VITE_API_KEY=your_api_key_here
```

### 4. Start Redis (Required for Caching)

```bash
# On macOS with Homebrew
brew services start redis

# On Ubuntu/Debian
sudo systemctl start redis-server

# Or using Docker
docker run -d -p 6379:6379 redis:alpine
```

### 5. Run the Application

**Development Mode:**

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

### 6. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api/docs

## API Keys Setup

HRVSTR integrates with several external services. You'll need to obtain API keys for:

### Reddit API
1. Go to https://www.reddit.com/prefs/apps
2. Create a new app (script type)
3. Use the client ID and secret in your `.env`

### SEC EDGAR
- No API key required, but you must provide a valid User-Agent
- Format: `YourApp/1.0 (your.email@example.com)`

## Project Structure

```
hrvstr/
├── frontend/          # React/Vite frontend application
├── backend/           # Node.js/Express backend API
├── !docs/            # Project documentation
├── package.json      # Root package.json for workspace
└── README.md         # Project overview
```

## Testing

```bash
# Run backend tests
cd backend
npm run test

# Run frontend tests
cd frontend
npm run test

# Run all tests from root
npm run test
```

## Building for Production

```bash
# Build backend
cd backend
npm run build

# Build frontend
cd frontend
npm run build
```

## Common Issues

### Redis Connection Error
- Ensure Redis is running: `redis-cli ping` should return `PONG`
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
- **Documentation**: All docs are in the `!docs/` directory
- **API Reference**: Available at `/api/docs` when running the backend

## Development Workflow

1. Create feature branches from `main`
2. Write tests for new functionality
3. Update documentation as needed
4. Submit pull requests for review
5. Deploy to staging for testing before production

For detailed information about specific components, see the respective documentation sections in the `!docs/` directory. 