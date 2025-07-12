#!/usr/bin/env python3
"""
Advanced Sentiment Analyzer for Financial Text
Implements FinBERT, VADER, and custom financial sentiment models
"""

import re
import torch
import numpy as np
from typing import Dict, List, Optional, Tuple, Union
from datetime import datetime

from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import spacy
from textblob import TextBlob
from loguru import logger

class AdvancedSentimentAnalyzer:
    """
    Advanced sentiment analyzer combining multiple models for financial text analysis
    """
    
    def __init__(self):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        logger.info(f"Initializing sentiment analyzer on device: {self.device}")
        
        # Initialize models
        self._load_finbert()
        self._load_vader()
        self._load_spacy()
        self._load_financial_lexicon()
        
        # Model weights for ensemble
        self.model_weights = {
            'finbert': 0.4,
            'vader': 0.3,
            'textblob': 0.2,
            'financial_lexicon': 0.1
        }
        
        logger.info("Sentiment analyzer initialized successfully")
    
    def _load_finbert(self):
        """Load FinBERT model for financial sentiment analysis"""
        try:
            model_name = "ProsusAI/finbert"
            self.finbert_tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.finbert_model = AutoModelForSequenceClassification.from_pretrained(model_name)
            self.finbert_model.to(self.device)
            self.finbert_pipeline = pipeline(
                "sentiment-analysis",
                model=self.finbert_model,
                tokenizer=self.finbert_tokenizer,
                device=0 if self.device.type == 'cuda' else -1
            )
            logger.info("FinBERT model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load FinBERT: {e}")
            self.finbert_pipeline = None
    
    def _load_vader(self):
        """Load VADER sentiment analyzer"""
        try:
            self.vader_analyzer = SentimentIntensityAnalyzer()
            logger.info("VADER analyzer loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load VADER: {e}")
            self.vader_analyzer = None
    
    def _load_spacy(self):
        """Load spaCy model for NER and preprocessing"""
        try:
            self.nlp = spacy.load("en_core_web_sm")
            logger.info("spaCy model loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load spaCy model: {e}")
            self.nlp = None
    
    def _load_financial_lexicon(self):
        """Load custom financial sentiment lexicon"""
        self.financial_lexicon = {
            # Bullish terms
            'bullish': 2.0, 'moon': 1.8, 'rocket': 1.5, 'pump': 1.3, 'surge': 1.4,
            'rally': 1.3, 'breakout': 1.2, 'uptrend': 1.1, 'gains': 1.0, 'profit': 1.0,
            'buy': 0.8, 'long': 0.7, 'hold': 0.5, 'diamond hands': 1.5, 'hodl': 1.2,
            'to the moon': 2.0, 'stonks': 1.0, 'tendies': 1.3, 'lambo': 1.8,
            
            # Bearish terms
            'bearish': -2.0, 'crash': -1.8, 'dump': -1.5, 'tank': -1.4, 'plummet': -1.6,
            'collapse': -1.7, 'sell': -0.8, 'short': -0.9, 'puts': -0.7, 'bear': -1.0,
            'recession': -1.5, 'bubble': -1.2, 'overvalued': -1.0, 'correction': -0.8,
            'paper hands': -1.3, 'bag holder': -1.1, 'rekt': -1.5, 'rug pull': -2.0,
            
            # Neutral/Context terms
            'sideways': 0.0, 'flat': 0.0, 'consolidation': 0.0, 'range': 0.0,
            'volatility': 0.0, 'earnings': 0.0, 'dividend': 0.2, 'split': 0.1
        }
        
        # Financial entity patterns
        self.ticker_pattern = re.compile(r'\$[A-Z]{1,5}\b|\b[A-Z]{1,5}\b')
        self.price_pattern = re.compile(r'\$\d+(?:\.\d{2})?|\d+(?:\.\d{2})?%')
        
        logger.info("Financial lexicon loaded successfully")
    
    def analyze_single(self, text: str, ticker: Optional[str] = None, 
                      source: str = 'unknown', **options) -> Dict:
        """Analyze sentiment for a single text"""
        results = {
            'text': text,
            'ticker': ticker,
            'source': source,
            'timestamp': datetime.utcnow().isoformat(),
            'models': {},
            'ensemble': {},
            'entities': {},
            'confidence': 0.0
        }
        
        # FinBERT analysis
        if self.finbert_pipeline and options.get('use_finbert', True):
            results['models']['finbert'] = self._analyze_with_finbert(text)
        
        # VADER analysis
        if self.vader_analyzer and options.get('use_vader', True):
            results['models']['vader'] = self._analyze_with_vader(text)
        
        # TextBlob analysis
        results['models']['textblob'] = self._analyze_with_textblob(text)
        
        # Financial lexicon analysis
        results['models']['financial_lexicon'] = self._analyze_with_financial_lexicon(text)
        
        # Entity extraction
        if options.get('extract_entities', True):
            results['entities'] = self._extract_entities(text)
        
        # Ensemble prediction
        results['ensemble'] = self._calculate_ensemble_sentiment(results['models'])
        results['confidence'] = self._calculate_confidence(results['models'], text)
        
        return results
    
    def analyze_batch(self, texts: List[str], tickers: Optional[List[str]] = None,
                     source: str = 'unknown', **options) -> List[Dict]:
        """Analyze sentiment for multiple texts"""
        results = []
        
        for i, text in enumerate(texts):
            ticker = tickers[i] if tickers and i < len(tickers) else None
            result = self.analyze_single(text, ticker, source, **options)
            results.append(result)
        
        return results
    
    def _analyze_with_finbert(self, text: str) -> Dict:
        """Analyze sentiment using FinBERT"""
        try:
            # Truncate text to model's max length
            max_length = 512
            if len(text) > max_length:
                text = text[:max_length]
            
            result = self.finbert_pipeline(text)[0]
            
            # Convert to standardized format
            label_map = {'positive': 1, 'negative': -1, 'neutral': 0}
            score = label_map.get(result['label'].lower(), 0) * result['score']
            
            return {
                'score': score,
                'label': result['label'].lower(),
                'confidence': result['score'],
                'raw_output': result
            }
        except Exception as e:
            logger.error(f"FinBERT analysis failed: {e}")
            return {'score': 0.0, 'label': 'neutral', 'confidence': 0.0, 'error': str(e)}
    
    def _analyze_with_vader(self, text: str) -> Dict:
        """Analyze sentiment using VADER"""
        try:
            scores = self.vader_analyzer.polarity_scores(text)
            
            return {
                'score': scores['compound'],
                'label': self._score_to_label(scores['compound']),
                'confidence': abs(scores['compound']),
                'breakdown': {
                    'positive': scores['pos'],
                    'negative': scores['neg'],
                    'neutral': scores['neu']
                }
            }
        except Exception as e:
            logger.error(f"VADER analysis failed: {e}")
            return {'score': 0.0, 'label': 'neutral', 'confidence': 0.0, 'error': str(e)}
    
    def _analyze_with_textblob(self, text: str) -> Dict:
        """Analyze sentiment using TextBlob"""
        try:
            blob = TextBlob(text)
            polarity = blob.sentiment.polarity
            subjectivity = blob.sentiment.subjectivity
            
            return {
                'score': polarity,
                'label': self._score_to_label(polarity),
                'confidence': abs(polarity),
                'subjectivity': subjectivity
            }
        except Exception as e:
            logger.error(f"TextBlob analysis failed: {e}")
            return {'score': 0.0, 'label': 'neutral', 'confidence': 0.0, 'error': str(e)}
    
    def _analyze_with_financial_lexicon(self, text: str) -> Dict:
        """Analyze sentiment using custom financial lexicon"""
        try:
            text_lower = text.lower()
            total_score = 0.0
            matched_terms = []
            
            for term, score in self.financial_lexicon.items():
                if term in text_lower:
                    count = text_lower.count(term)
                    total_score += score * count
                    matched_terms.append({'term': term, 'score': score, 'count': count})
            
            # Normalize score
            word_count = len(text.split())
            normalized_score = total_score / max(word_count, 1) if word_count > 0 else 0
            normalized_score = max(-1, min(1, normalized_score))  # Clamp to [-1, 1]
            
            return {
                'score': normalized_score,
                'label': self._score_to_label(normalized_score),
                'confidence': min(abs(normalized_score) * 2, 1.0),
                'matched_terms': matched_terms,
                'total_raw_score': total_score
            }
        except Exception as e:
            logger.error(f"Financial lexicon analysis failed: {e}")
            return {'score': 0.0, 'label': 'neutral', 'confidence': 0.0, 'error': str(e)}
    
    def _extract_entities(self, text: str) -> Dict:
        """Extract financial entities from text"""
        entities = {
            'tickers': [],
            'prices': [],
            'organizations': [],
            'persons': []
        }
        
        try:
            # Extract ticker symbols
            tickers = self.ticker_pattern.findall(text)
            entities['tickers'] = list(set(tickers))
            
            # Extract prices and percentages
            prices = self.price_pattern.findall(text)
            entities['prices'] = list(set(prices))
            
            # Use spaCy for NER if available
            if self.nlp:
                doc = self.nlp(text)
                for ent in doc.ents:
                    if ent.label_ == 'ORG':
                        entities['organizations'].append(ent.text)
                    elif ent.label_ == 'PERSON':
                        entities['persons'].append(ent.text)
        
        except Exception as e:
            logger.error(f"Entity extraction failed: {e}")
        
        return entities
    
    def _calculate_ensemble_sentiment(self, model_results: Dict) -> Dict:
        """Calculate ensemble sentiment from multiple models"""
        weighted_score = 0.0
        total_weight = 0.0
        confidence_scores = []
        
        for model_name, result in model_results.items():
            if 'error' not in result and model_name in self.model_weights:
                weight = self.model_weights[model_name]
                weighted_score += result['score'] * weight
                total_weight += weight
                confidence_scores.append(result['confidence'])
        
        if total_weight > 0:
            final_score = weighted_score / total_weight
        else:
            final_score = 0.0
        
        avg_confidence = np.mean(confidence_scores) if confidence_scores else 0.0
        
        return {
            'score': final_score,
            'label': self._score_to_label(final_score),
            'confidence': avg_confidence,
            'model_agreement': self._calculate_model_agreement(model_results)
        }
    
    def _calculate_confidence(self, model_results: Dict, text: str) -> float:
        """Calculate overall confidence score"""
        # Base confidence from model agreement
        agreement = self._calculate_model_agreement(model_results)
        
        # Adjust for text length (longer texts generally more reliable)
        text_length_factor = min(len(text.split()) / 50, 1.0)
        
        # Adjust for entity presence (financial entities increase confidence)
        entity_factor = 1.0
        if self.ticker_pattern.search(text) or self.price_pattern.search(text):
            entity_factor = 1.2
        
        confidence = agreement * text_length_factor * entity_factor
        return min(confidence, 1.0)
    
    def _calculate_model_agreement(self, model_results: Dict) -> float:
        """Calculate agreement between different models"""
        scores = []
        for result in model_results.values():
            if 'error' not in result:
                scores.append(result['score'])
        
        if len(scores) < 2:
            return 0.5  # Default confidence for single model
        
        # Calculate standard deviation of scores
        std_dev = np.std(scores)
        # Convert to agreement score (lower std_dev = higher agreement)
        agreement = max(0, 1 - (std_dev / 2))  # Normalize assuming max std_dev of 2
        
        return agreement
    
    def _score_to_label(self, score: float) -> str:
        """Convert numerical score to sentiment label"""
        if score > 0.1:
            return 'bullish'
        elif score < -0.1:
            return 'bearish'
        else:
            return 'neutral'
    
    def get_model_info(self) -> Dict:
        """Get information about loaded models"""
        return {
            'finbert_available': self.finbert_pipeline is not None,
            'vader_available': self.vader_analyzer is not None,
            'spacy_available': self.nlp is not None,
            'device': str(self.device),
            'model_weights': self.model_weights,
            'financial_lexicon_size': len(self.financial_lexicon)
        }