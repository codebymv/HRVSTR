# Python Sentiment Analysis Service

Advanced financial sentiment analysis service using state-of-the-art ML models including FinBERT, VADER, and custom financial lexicons.

## Features

- **FinBERT Integration**: Financial domain-specific BERT model for accurate sentiment analysis
- **VADER Sentiment**: Rule-based sentiment analysis optimized for social media text
- **Custom Financial Lexicon**: Domain-specific terms and phrases for financial context
- **Entity Extraction**: Automatic extraction of tickers, financial numbers, and entities
- **Ensemble Analysis**: Combines multiple models for improved accuracy
- **Confidence Scoring**: Provides confidence metrics for sentiment predictions
- **Batch Processing**: Efficient processing of multiple texts
- **Caching**: Redis-based caching for improved performance
- **RESTful API**: Easy integration with existing systems

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Node.js API   │───▶│  Python Service  │───▶│   ML Models     │
│   (Express)     │    │    (Flask)       │    │  (FinBERT,etc.) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│     Redis       │    │  Text Processor  │    │   Cache Layer   │
│   (Caching)     │    │   (Cleaning)     │    │  (Results)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Installation

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- Redis (optional, for caching)

### Setup

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Download required models:**
   ```bash
   python -m spacy download en_core_web_sm
   ```

3. **Set environment variables:**
   ```bash
   export REDIS_URL="redis://localhost:6379"  # Optional
   export FLASK_ENV="development"             # or "production"
   export PORT="5000"                         # Default port
   ```

4. **Start the service:**
   ```bash
   python start.py
   ```

   Or directly:
   ```bash
   python app.py
   ```

## API Endpoints

### Health Check
```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

### Single Text Analysis
```http
POST /analyze/single
Content-Type: application/json

{
  "text": "AAPL is looking bullish after the earnings report",
  "ticker": "AAPL",
  "source": "reddit",
  "options": {
    "use_finbert": true,
    "use_vader": true,
    "extract_entities": true,
    "confidence_threshold": 0.7
  }
}
```

Response:
```json
{
  "sentiment": {
    "score": 0.75,
    "label": "bullish",
    "confidence": 0.89,
    "strength": "strong",
    "quality": "high"
  },
  "analysis": {
    "text_length": 45,
    "word_count": 8,
    "source": "reddit",
    "source_reliability": 0.7,
    "model_agreement": 0.85,
    "processing_timestamp": "2024-01-15T10:30:00Z"
  },
  "models": {
    "finbert": {
      "score": 0.78,
      "label": "positive",
      "confidence": 0.91
    },
    "vader": {
      "score": 0.72,
      "label": "positive",
      "confidence": 0.87
    }
  },
  "entities": {
    "tickers": ["AAPL"],
    "financial_numbers": [],
    "organizations": ["Apple Inc."],
    "persons": [],
    "entity_count": 2
  },
  "metadata": {
    "ticker": "AAPL",
    "original_text_preview": "AAPL is looking bullish after the earnings...",
    "analysis_version": "1.0.0",
    "enhanced_analysis": true
  }
}
```

### Batch Text Analysis
```http
POST /analyze
Content-Type: application/json

{
  "texts": [
    "AAPL earnings beat expectations!",
    "Tesla stock is overvalued IMO",
    "Market looking uncertain today"
  ],
  "tickers": ["AAPL", "TSLA", null],
  "source": "mixed",
  "options": {
    "use_finbert": true,
    "confidence_threshold": 0.6
  }
}
```

### Model Information
```http
GET /models/info
```

### Cache Management
```http
DELETE /cache/clear
GET /cache/stats
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Service port |
| `FLASK_ENV` | `development` | Flask environment |
| `REDIS_URL` | `None` | Redis connection URL |
| `HOST` | `0.0.0.0` | Service host |
| `TOKENIZERS_PARALLELISM` | `false` | Tokenizer parallelism |
| `TRANSFORMERS_CACHE` | `.cache/transformers` | Model cache directory |
| `HF_HOME` | `.cache/huggingface` | HuggingFace cache |

### Model Configuration

The service uses the following models:

- **FinBERT**: `ProsusAI/finbert` - Financial sentiment analysis
- **spaCy**: `en_core_web_sm` - Entity recognition and text processing
- **VADER**: Built-in lexicon-based sentiment analysis
- **Custom Lexicon**: Financial domain-specific terms

## Integration with Node.js Backend

The Python service is automatically managed by the Node.js backend through the `PythonSentimentService` class:

```javascript
const pythonSentimentService = require('./services/pythonSentimentService');

// Analyze single text
const result = await pythonSentimentService.analyzeSingleText(
  "AAPL is bullish",
  "AAPL",
  "reddit"
);

// Analyze multiple texts
const batchResult = await pythonSentimentService.analyzeBatchTexts(
  ["Text 1", "Text 2"],
  ["AAPL", "TSLA"],
  "mixed"
);
```

## Performance Considerations

### Model Loading
- Models are loaded on first use and cached in memory
- Initial startup may take 30-60 seconds for model downloads
- Subsequent requests are much faster (< 100ms per text)

### Memory Usage
- Base memory: ~200MB
- With models loaded: ~1-2GB
- Scales with batch size and model complexity

### Caching Strategy
- Results cached for 30 minutes by default
- Cache keys based on text content and analysis options
- Redis fallback to in-memory caching

## Error Handling

The service includes comprehensive error handling:

- **Model Loading Errors**: Graceful fallback to available models
- **Network Errors**: Retry logic with exponential backoff
- **Memory Errors**: Automatic garbage collection and model unloading
- **Validation Errors**: Clear error messages for invalid inputs

## Monitoring and Logging

### Health Checks
- `/health` endpoint for service status
- Model availability checks
- Memory and performance metrics

### Logging
- Structured logging with timestamps
- Configurable log levels
- Request/response logging
- Error tracking and reporting

## Development

### Running in Development Mode
```bash
export FLASK_ENV=development
python start.py
```

### Testing
```bash
# Install test dependencies
pip install pytest pytest-cov

# Run tests
pytest tests/ -v --cov=.
```

### Code Structure
```
python-sentiment-service/
├── app.py                 # Flask application
├── sentiment_analyzer.py  # Core sentiment analysis
├── start.py              # Startup script
├── requirements.txt      # Python dependencies
├── utils/
│   ├── __init__.py
│   ├── text_preprocessor.py
│   ├── cache_manager.py
│   └── response_formatter.py
├── tests/                # Test files
├── .cache/              # Model cache directory
└── README.md            # This file
```

## Troubleshooting

### Common Issues

1. **Model Download Failures**
   - Check internet connection
   - Verify disk space (models require ~2GB)
   - Try manual download: `python -c "from transformers import AutoModel; AutoModel.from_pretrained('ProsusAI/finbert')"`

2. **Memory Issues**
   - Reduce batch size
   - Increase system memory
   - Enable model unloading: set `UNLOAD_MODELS=true`

3. **Redis Connection Issues**
   - Service falls back to in-memory caching
   - Check Redis URL and connectivity
   - Verify Redis server is running

4. **Port Conflicts**
   - Change port: `export PORT=5001`
   - Check for other services on port 5000

### Debug Mode
```bash
export FLASK_ENV=development
export LOG_LEVEL=DEBUG
python start.py
```

## License

This project is part of the HRVSTR platform and follows the same licensing terms.

## Contributing

Contributions are welcome! Please follow the existing code style and include tests for new features.