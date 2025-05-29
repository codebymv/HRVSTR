# HRVSTR Frontend Testing Overview

## Introduction

This document provides an overview of the testing strategy and implementation for the HRVSTR frontend application. The frontend tests focus on validating the business logic, data transformation, and utility functions that power the user interface and data visualization components of the financial data analysis platform.

## Current Test Coverage

The frontend test suite currently covers the following core functionality:

### 1. Sentiment Analysis Utilities

#### Sentiment Data Processing
- **File**: `sentimentUtils.test.ts`
- **Purpose**: Tests the processing and aggregation of sentiment data from multiple sources.
- **Coverage Areas**:
  - Deduplication of sentiment data entries
  - Ensuring ticker diversity in displayed data
  - Merging sentiment data from different sources (Reddit, FinViz)
  - Aggregation of sentiment by ticker symbol
  - Time-based filtering of sentiment data

### 2. Chart Generation Utilities

- **File**: `chartUtils.test.ts`
- **Purpose**: Tests the generation of chart data for different visualization components.
- **Coverage Areas**:
  - Generation of daily/weekly chart data points based on time ranges
  - Calculation of sentiment percentages for visualization
  - Handling of empty or minimal data sets
  - Source attribution for multi-source data
  - Time range calculations for different periods (1d, 1w, 1m, 3m)

### 3. SEC Filings Processing

- **File**: `secFilingsUtils.test.ts`
- **Purpose**: Tests the processing and analysis of SEC filing data, focusing on insider trading.
- **Coverage Areas**:
  - Ticker symbol validation and normalization
  - Detection of investment firm tickers vs. standard company tickers
  - Analysis of abnormal trading activity patterns
  - Extraction of meaningful insights from insider trade data
  - Calculation of ownership percentages and significance

### 4. API Service Management

- **File**: `apiService.test.ts`
- **Purpose**: Tests the management of API configuration, proxy settings, and API keys.
- **Coverage Areas**:
  - Proxy URL configuration and fallback mechanisms
  - API key storage and retrieval from localStorage
  - Server communication for API key updates
  - Error handling for network and server errors
  - Data format validation

### 5. Settings Management

- **File**: `settingsManager.test.ts`
- **Purpose**: Tests the user settings persistence and management functionality.
- **Coverage Areas**:
  - Default settings initialization
  - Saving and loading user preferences
  - Theme mode management
  - Partial settings updates
  - Settings reset functionality
  - Error handling for corrupted settings data

## Testing Approach

The HRVSTR frontend testing strategy employs the following key principles:

### 1. Unit Testing Business Logic

The tests focus on isolated business logic and utility functions rather than UI components, ensuring that the core logic works correctly independently of the UI implementation.

### 2. Type Safety

Tests leverage TypeScript to ensure type safety across the application, with interfaces and types defined to match the production code.

### 3. Mock Integration

The tests use Vitest's mocking capabilities to simulate browser APIs (localStorage, fetch) and environment variables, allowing for controlled testing of integration points.

### 4. Test Isolation

Each test is designed to be independent, with proper setup and teardown phases to ensure clean test environments.

### 5. Multiple Test Cases

Functions are tested with multiple variations of input data to cover edge cases, error conditions, and normal operation.

## Test Organization

Tests are organized using Vitest's `describe` and `it` blocks to create a hierarchical structure that mirrors the functionality being tested. The typical structure includes:

1. **Test Suite**: A logical group of related tests defined with `describe`
2. **Test Categories**: Sub-groups within a test suite that focus on specific aspects
3. **Individual Tests**: Specific test cases with clear assertions
4. **Setup/Teardown**: Code to prepare and clean up the test environment

## Test Infrastructure

### Testing Framework

The project uses Vitest as the test runner and assertion library, which provides:

- Fast, parallelized test execution
- ESModule support for TypeScript files
- Built-in mocking capabilities
- Compatibility with Vite's development setup

### Mock Implementation

The tests implement custom mocks for:

- Browser APIs (localStorage, fetch)
- Environment variables
- API responses
- Data transformations

## Future Test Enhancements

To improve the frontend testing coverage, the following enhancements are recommended:

### 1. Component Testing

Add tests for React components using React Testing Library to ensure that UI components render correctly and handle user interactions appropriately.

### 2. Integration Testing

Develop tests that validate the interaction between different parts of the frontend application, such as data fetching, processing, and visualization.

### 3. Visual Regression Testing

Implement screenshot-based testing to catch unintended visual changes in the UI.

### 4. End-to-End Testing

Add end-to-end tests using tools like Cypress or Playwright to validate complete user flows through the application.

### 5. Accessibility Testing

Include tests that verify compliance with accessibility standards (WCAG) to ensure the application is usable by people with disabilities.

### 6. State Management Testing

Expand tests to cover state management logic, ensuring that application state transitions work correctly.

## Running the Tests

The frontend tests can be executed using the following commands:

```bash
# Run all tests
npm test

# Run a specific test file
npm test -- _tests_/filename.test.ts

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with UI (for visual inspection)
npm run test:ui

# Generate test coverage report
npm run coverage
```

## Test Maintenance

As the frontend evolves, it's important to:

1. Update tests when business logic or requirements change
2. Add tests for new features and functionality
3. Refactor tests as the codebase evolves to maintain readability
4. Continuously monitor test coverage and address gaps

## Key Challenges and Solutions

### Node.js Environment Limitations

Since frontend tests run in Node.js by default (not a browser), certain browser APIs like `window` and `localStorage` are not available. The test suite addresses this by:

1. Creating custom mocks for browser APIs
2. Using conditional logic to detect and handle the Node.js environment
3. Simulating browser behavior where needed

### Asynchronous Testing

Many frontend operations are asynchronous (data fetching, state updates). The tests handle this by:

1. Using async/await for test functions
2. Properly mocking Promise-based APIs
3. Using appropriate assertion timing

---

*Document last updated: May 6, 2025*
