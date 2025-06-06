# HRVSTR Stripe Integration Documentation

## Overview

HRVSTR uses Stripe for subscription management and credit-based usage billing. The system supports multiple subscription tiers with monthly credit allocations and additional credit purchases.

## Architecture

- **Frontend**: React components with TierContext for state management
- **Backend**: Node.js/Express with PostgreSQL database
- **Payment Processing**: Stripe Checkout and webhooks
- **Credit System**: Monthly tier-based allocations + purchasable credit bundles

## Documentation Structure

- [**Architecture Overview**](/help/Implementations/Stripe/stripe-architecture) - System design and data flow
- [**Subscription Management**](/help/Implementations/Stripe/stripe-subscriptions) - Tier system and subscription flow
- [**Credit System**](/help/Implementations/Stripe/stripe-credits) - Credit allocation and purchase system
- [**Webhook Integration**](/help/Implementations/Stripe/stripe-webhooks) - Stripe webhook handling
- [**Database Schema**](/help/Implementations/Stripe/stripe-database) - Data structure and relationships
- [**Frontend Implementation**](/help/Implementations/Stripe/stripe-frontend) - React components and state management
- [**Testing Guide**](/help/Implementations/Stripe/stripe-testing) - Test environment setup and procedures
- [**Troubleshooting**](/help/Implementations/Stripe/stripe-troubleshooting) - Common issues and solutions

## Quick Start

1. **Environment Setup**: Configure Stripe keys and webhook endpoints
2. **Database**: Ensure user credit fields are properly set up
3. **Frontend**: TierContext provides subscription and credit data
4. **Backend**: Webhook handlers automatically update user tiers and credits

## Key Features

✅ **Multi-tier Subscriptions** (Free, Pro, Elite, Institutional)  
✅ **Monthly Credit Allocations** (0, 500, 2000, custom)  
✅ **Credit Bundle Purchases** (250 credits for $10)  
✅ **Automatic Tier Updates** via webhooks  
✅ **Usage Tracking** and credit management  
✅ **Test Environment** with ngrok and test cards  

## Current Status

- **Production Ready**: All core functionality implemented and tested
- **Webhook System**: Handles all subscription lifecycle events
- **Credit Display**: Enhanced UI showing monthly + purchased credits
- **Tier Upgrades**: Automatic credit allocation on tier changes
- **Purchase Flow**: Working credit bundle purchases via Stripe Checkout

## Integration Points

### With HRVSTR Core Features
- **Sentiment Analysis**: 1 credit per analysis
- **Earnings Data**: 2 credits per request
- **SEC Filings**: 3 credits per filing
- **Bulk Operations**: 5+ credits depending on scope

### With User Management
- **Authentication**: JWT-based user identification
- **Activity Logging**: All credit usage and purchases tracked
- **Tier Restrictions**: Feature access based on subscription level

## Related Documentation

- [**Getting Started Guide**](/help/getting-started) - General HRVSTR setup
- [**API Documentation**](/help/API/overview) - Backend API reference
- [**Database Schema**](/help/Database/schema) - Complete database structure
- [**User Management**](/help/Authentication/overview) - Authentication system 