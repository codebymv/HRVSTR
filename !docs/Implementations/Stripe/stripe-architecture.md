# Stripe Architecture Overview

## System Design

The HRVSTR Stripe integration follows a webhook-driven architecture that automatically synchronizes subscription and credit data between Stripe and the application database.

## Component Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │    │   Backend   │    │   Stripe    │    │  Database   │
│   (React)   │    │(Node.js/Exp)│    │  (Webhooks) │    │(PostgreSQL) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
       │ TierContext       │ API Routes        │ Webhook Events    │ User Data
       │ State Mgmt        │ /api/billing/*    │ subscription.*    │ Credit Info
       │                   │ /api/subscription │ checkout.*        │ Tier Status
       └───────────────────┼───────────────────┼───────────────────┘
                           │                   │
                    ┌─────────────┐    ┌─────────────┐
                    │   Stripe    │    │   ngrok     │
                    │  Checkout   │    │ (Dev Only)  │
                    │             │    │  Tunneling  │
                    └─────────────┘    └─────────────┘
```

## Data Flow Patterns

### 1. Subscription Creation Flow
```
User → Frontend → Backend → Stripe Checkout → Payment → Webhook → Database Update
```

### 2. Credit Purchase Flow
```
User → TierManagement → Stripe Checkout → Payment → Webhook → Credit Addition
```

### 3. Tier Information Retrieval
```
Frontend → TierContext → API Call → Database → Combined Response (Tier + Credits)
```

## Key Components

### Frontend Layer
- **TierContext**: Centralized state management for subscription and credit data
- **TierManagement**: UI component for displaying usage and purchase options
- **Checkout Integration**: Redirects to Stripe Checkout for payments

### Backend Layer
- **Billing Routes** (`/api/billing/*`): Stripe checkout session creation
- **Subscription Routes** (`/api/subscription/*`): Tier and credit information
- **Webhook Handler**: Processes Stripe events and updates database

### Database Layer
- **User Table**: Stores tier, credits, and subscription metadata
- **Activities Table**: Logs credit transactions and usage events

## Security Considerations

1. **Webhook Verification**: All webhook events verified using Stripe signature
2. **Authentication**: JWT tokens required for billing operations
3. **Environment Separation**: Test vs live Stripe keys properly isolated
4. **Rate Limiting**: Prevents abuse of credit purchase endpoints

## Performance Optimizations

1. **Webhook Idempotency**: Duplicate webhook events handled gracefully
2. **Database Indexing**: Optimized queries for user tier lookups
3. **Frontend Caching**: TierContext prevents unnecessary API calls
4. **Error Handling**: Comprehensive error recovery and user feedback

## Development vs Production

### Development Environment
- Uses Stripe test keys and test credit cards
- ngrok tunnel for webhook testing
- Detailed logging and debugging

### Production Environment
- Live Stripe keys with real payment processing
- Secure webhook endpoints with HTTPS
- Production-grade error monitoring

## Integration Points

### With HRVSTR Core Systems
- **User Authentication**: Leverages existing JWT authentication
- **Activity Logging**: Integrates with central activity tracking
- **Feature Access Control**: Tier-based feature restrictions

### External Dependencies
- **Stripe API**: Payment processing and subscription management
- **PostgreSQL**: Primary data storage
- **ngrok**: Development webhook tunneling

## Scalability Considerations

### Database Performance
- Indexed queries for tier and credit lookups
- Connection pooling for concurrent requests
- Optimized credit calculation queries

### API Rate Limits
- Stripe API rate limiting handled gracefully
- Credit usage tracking prevents API abuse
- Bulk operations optimized for efficiency

### Frontend Performance
- Lazy loading of billing components
- Efficient state management with TierContext
- Minimal re-renders through proper dependency management

## Related Documentation

- [**Credit System Details**](/help/Implementations/Stripe/stripe-credits) - Detailed credit mechanics
- [**Webhook Implementation**](/help/Implementations/Stripe/stripe-webhooks) - Event handling specifics
- [**Testing Procedures**](/help/Implementations/Stripe/stripe-testing) - Development and testing setup
- [**Troubleshooting Guide**](/help/Implementations/Stripe/stripe-troubleshooting) - Common issues and solutions 