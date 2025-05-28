# HRVSTR Technology Stack Overview

## Frontend Stack

### Core Framework
- **React 18**: Modern React with hooks and concurrent features
- **Vite**: Fast build tool and development server
- **TypeScript**: Type-safe JavaScript development

### UI/UX Libraries
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/ui**: Modern component library
- **Lucide React**: Icon library
- **Recharts**: Data visualization and charting

### State Management
- **Zustand**: Lightweight state management
- **React Query/TanStack Query**: Server state management and caching

### Development Tools
- **ESLint**: Code linting and quality
- **Prettier**: Code formatting
- **Vite**: Development and build tooling

## Backend Stack

### Core Framework
- **Node.js**: JavaScript runtime
- **Express.js**: Web framework
- **TypeScript**: Type-safe development

### Data & Caching
- **Redis**: In-memory caching and session storage
- **Node-cache**: Application-level caching

### External Integrations
- **Reddit API**: Social sentiment data
- **SEC EDGAR**: Financial filings data
- **FinViz**: Market data and news
- **Yahoo Finance**: Stock prices and earnings

### Security & Authentication
- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: API rate protection

### Development Tools
- **Nodemon**: Development server auto-restart
- **Jest**: Unit testing framework
- **Supertest**: API testing

## Infrastructure & Deployment

### Development
- **Docker**: Containerization (optional)
- **Redis**: Local caching
- **Git**: Version control

### Production (Railway/Heroku)
- **Railway**: Platform-as-a-Service hosting
- **Redis Cloud**: Managed Redis instance
- **Environment Variables**: Configuration management

## Key Dependencies

### Frontend
```json
{
  "react": "^18.2.0",
  "typescript": "^5.0.0",
  "vite": "^4.4.0",
  "tailwindcss": "^3.3.0",
  "zustand": "^4.4.0",
  "@tanstack/react-query": "^4.32.0",
  "recharts": "^2.8.0"
}
```

### Backend
```json
{
  "express": "^4.18.0",
  "redis": "^4.6.0",
  "axios": "^1.5.0",
  "helmet": "^7.0.0",
  "cors": "^2.8.5",
  "express-rate-limit": "^6.10.0"
}
```

## Architecture Principles

1. **Separation of Concerns**: Clear separation between frontend and backend
2. **API-First Design**: Backend provides RESTful APIs
3. **Caching Strategy**: Multi-layer caching for performance
4. **Type Safety**: TypeScript throughout the stack
5. **Modern Tooling**: Latest stable versions of all tools

## Performance Considerations

- **Frontend**: Code splitting, lazy loading, optimized builds
- **Backend**: Redis caching, efficient API design, rate limiting
- **Network**: CORS optimization, compression, CDN-ready

This stack provides a modern, scalable, and maintainable foundation for financial data analysis and visualization. 