#!/usr/bin/env python3
"""
HRVSTR Advanced Sentiment Analysis Service
Python-based microservice for enhanced financial sentiment analysis
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Union

from flask import Flask, request, jsonify
from flask_cors import CORS
import redis
from loguru import logger

from sentiment_analyzer import AdvancedSentimentAnalyzer
from utils.text_preprocessor import TextPreprocessor
from utils.response_formatter import ResponseFormatter

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure logging
logger.add("logs/sentiment_service.log", rotation="1 day", retention="30 days")

# Initialize components
sentiment_analyzer = AdvancedSentimentAnalyzer()
text_preprocessor = TextPreprocessor()
response_formatter = ResponseFormatter()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'python-sentiment-service',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0'
    })

@app.route('/analyze', methods=['POST'])
def analyze_sentiment():
    """
    Advanced sentiment analysis endpoint
    
    Expected payload:
    {
        "texts": ["text1", "text2", ...],
        "tickers": ["AAPL", "MSFT", ...],  # optional
        "source": "reddit|finviz|news",
        "options": {
            "use_finbert": true,
            "use_vader": true,
            "extract_entities": true,
            "confidence_threshold": 0.7
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'texts' not in data:
            return jsonify({'error': 'Missing required field: texts'}), 400
        
        texts = data['texts']
        tickers = data.get('tickers', [])
        source = data.get('source', 'unknown')
        options = data.get('options', {})
        
        # Skip internal caching - let Node.js handle all caching
        # This ensures unified cache management across the application
        
        # Preprocess texts
        processed_texts = [text_preprocessor.preprocess(text, source) for text in texts]
        
        # Perform sentiment analysis
        results = sentiment_analyzer.analyze_batch(
            processed_texts,
            tickers=tickers,
            source=source,
            **options
        )
        
        # Format response
        formatted_response = response_formatter.format_batch_results(
            results, texts, tickers, source
        )
        
        # No internal caching - Node.js handles this
        
        logger.info(f"Processed {len(texts)} texts for sentiment analysis")
        return jsonify(formatted_response)
        
    except Exception as e:
        logger.error(f"Error in sentiment analysis: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@app.route('/analyze/single', methods=['POST'])
def analyze_single_text():
    """
    Single text sentiment analysis endpoint
    
    Expected payload:
    {
        "text": "Sample text to analyze",
        "ticker": "AAPL",  # optional
        "source": "reddit",
        "options": {...}
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({'error': 'Missing required field: text'}), 400
        
        text = data['text']
        ticker = data.get('ticker')
        source = data.get('source', 'unknown')
        options = data.get('options', {})
        
        # Skip internal caching - let Node.js handle all caching
        # This ensures unified cache management across the application
        
        # Preprocess text
        processed_text = text_preprocessor.preprocess(text, source)
        
        # Analyze sentiment
        result = sentiment_analyzer.analyze_single(
            processed_text,
            ticker=ticker,
            source=source,
            **options
        )
        
        # Format response
        formatted_response = response_formatter.format_single_result(
            result, text, ticker, source
        )
        
        # No internal caching - Node.js handles this
        
        return jsonify(formatted_response)
        
    except Exception as e:
        logger.error(f"Error in single text analysis: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500

@app.route('/models/info', methods=['GET'])
def get_model_info():
    """Get information about loaded models"""
    try:
        model_info = sentiment_analyzer.get_model_info()
        return jsonify(model_info)
    except Exception as e:
        logger.error(f"Error getting model info: {str(e)}")
        return jsonify({'error': 'Failed to get model info'}), 500

@app.route('/cache/stats', methods=['GET'])
def get_cache_stats():
    """Get cache statistics - Note: Caching is handled by Node.js application"""
    return jsonify({
        'message': 'Cache management is handled by the Node.js application',
        'note': 'Python service does not maintain internal cache',
        'cache_location': 'Node.js cacheManager'
    })

@app.route('/cache/clear', methods=['POST'])
def clear_cache():
    """Clear sentiment analysis cache - Note: Caching is handled by Node.js application"""
    return jsonify({
        'message': 'Cache management is handled by the Node.js application',
        'note': 'To clear cache, use the Node.js application cache endpoints',
        'cache_location': 'Node.js cacheManager'
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    logger.info(f"Starting HRVSTR Python Sentiment Service on port {port}")
    app.run(host='0.0.0.0', port=port, debug=debug)