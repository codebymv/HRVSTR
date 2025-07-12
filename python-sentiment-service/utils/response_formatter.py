#!/usr/bin/env python3
"""
Response Formatter for Python Sentiment Service
Standardizes and formats sentiment analysis results
"""

import numpy as np
from typing import Dict, List, Optional, Union
from datetime import datetime

class ResponseFormatter:
    """
    Formats sentiment analysis results into standardized response format
    """
    
    def __init__(self):
        # Confidence thresholds for different quality levels
        self.confidence_thresholds = {
            'high': 0.8,
            'medium': 0.6,
            'low': 0.4
        }
        
        # Source reliability weights
        self.source_weights = {
            'reddit': 0.7,
            'finviz': 0.9,
            'news': 0.85,
            'yahoo': 0.8,
            'twitter': 0.6,
            'unknown': 0.5
        }
    
    def format_single_result(self, analysis_result: Dict, original_text: str, 
                           ticker: Optional[str] = None, source: str = 'unknown') -> Dict:
        """
        Format a single sentiment analysis result
        
        Args:
            analysis_result: Raw analysis result from sentiment analyzer
            original_text: Original input text
            ticker: Associated ticker symbol
            source: Data source
        
        Returns:
            Formatted response dictionary
        """
        ensemble = analysis_result.get('ensemble', {})
        models = analysis_result.get('models', {})
        entities = analysis_result.get('entities', {})
        
        # Calculate enhanced confidence
        enhanced_confidence = self._calculate_enhanced_confidence(
            ensemble.get('confidence', 0.0),
            source,
            len(original_text),
            entities
        )
        
        # Determine sentiment strength
        sentiment_strength = self._calculate_sentiment_strength(ensemble.get('score', 0.0))
        
        # Format response
        response = {
            'sentiment': {
                'score': round(ensemble.get('score', 0.0), 3),
                'label': ensemble.get('label', 'neutral'),
                'confidence': round(enhanced_confidence, 3),
                'strength': sentiment_strength,
                'quality': self._get_confidence_quality(enhanced_confidence)
            },
            'analysis': {
                'text_length': len(original_text),
                'word_count': len(original_text.split()),
                'source': source,
                'source_reliability': self.source_weights.get(source, 0.5),
                'model_agreement': round(ensemble.get('model_agreement', 0.0), 3),
                'processing_timestamp': datetime.utcnow().isoformat()
            },
            'models': self._format_model_results(models),
            'entities': self._format_entities(entities),
            'metadata': {
                'ticker': ticker,
                'original_text_preview': original_text[:100] + '...' if len(original_text) > 100 else original_text,
                'analysis_version': '1.0.0',
                'enhanced_analysis': True
            }
        }
        
        return response
    
    def format_batch_results(self, analysis_results: List[Dict], original_texts: List[str],
                           tickers: Optional[List[str]] = None, source: str = 'unknown') -> Dict:
        """
        Format batch sentiment analysis results
        
        Args:
            analysis_results: List of raw analysis results
            original_texts: List of original input texts
            tickers: List of associated ticker symbols
            source: Data source
        
        Returns:
            Formatted batch response dictionary
        """
        formatted_results = []
        scores = []
        confidences = []
        
        for i, result in enumerate(analysis_results):
            ticker = tickers[i] if tickers and i < len(tickers) else None
            text = original_texts[i] if i < len(original_texts) else ""
            
            formatted_result = self.format_single_result(result, text, ticker, source)
            formatted_results.append(formatted_result)
            
            scores.append(formatted_result['sentiment']['score'])
            confidences.append(formatted_result['sentiment']['confidence'])
        
        # Calculate aggregate statistics
        aggregate_stats = self._calculate_aggregate_stats(scores, confidences)
        
        # Format batch response
        response = {
            'results': formatted_results,
            'summary': {
                'total_texts': len(analysis_results),
                'average_sentiment': {
                    'score': round(aggregate_stats['avg_score'], 3),
                    'label': self._score_to_label(aggregate_stats['avg_score']),
                    'confidence': round(aggregate_stats['avg_confidence'], 3)
                },
                'sentiment_distribution': aggregate_stats['distribution'],
                'quality_distribution': aggregate_stats['quality_dist'],
                'source': source,
                'processing_timestamp': datetime.utcnow().isoformat()
            },
            'metadata': {
                'batch_size': len(analysis_results),
                'analysis_version': '1.0.0',
                'enhanced_analysis': True,
                'source_reliability': self.source_weights.get(source, 0.5)
            }
        }
        
        return response
    
    def _format_model_results(self, models: Dict) -> Dict:
        """
        Format individual model results
        
        Args:
            models: Dictionary of model results
        
        Returns:
            Formatted model results
        """
        formatted_models = {}
        
        for model_name, result in models.items():
            if 'error' not in result:
                formatted_models[model_name] = {
                    'score': round(result.get('score', 0.0), 3),
                    'label': result.get('label', 'neutral'),
                    'confidence': round(result.get('confidence', 0.0), 3)
                }
                
                # Add model-specific details
                if model_name == 'vader' and 'breakdown' in result:
                    formatted_models[model_name]['breakdown'] = {
                        k: round(v, 3) for k, v in result['breakdown'].items()
                    }
                elif model_name == 'textblob' and 'subjectivity' in result:
                    formatted_models[model_name]['subjectivity'] = round(result['subjectivity'], 3)
                elif model_name == 'financial_lexicon' and 'matched_terms' in result:
                    formatted_models[model_name]['matched_terms'] = result['matched_terms'][:5]  # Top 5 terms
            else:
                formatted_models[model_name] = {
                    'error': result['error'],
                    'available': False
                }
        
        return formatted_models
    
    def _format_entities(self, entities: Dict) -> Dict:
        """
        Format extracted entities
        
        Args:
            entities: Dictionary of extracted entities
        
        Returns:
            Formatted entities
        """
        return {
            'tickers': entities.get('tickers', []),
            'financial_numbers': entities.get('prices', []),
            'organizations': entities.get('organizations', [])[:5],  # Limit to top 5
            'persons': entities.get('persons', [])[:5],  # Limit to top 5
            'entity_count': sum(len(v) if isinstance(v, list) else 0 for v in entities.values())
        }
    
    def _calculate_enhanced_confidence(self, base_confidence: float, source: str, 
                                     text_length: int, entities: Dict) -> float:
        """
        Calculate enhanced confidence score considering multiple factors
        
        Args:
            base_confidence: Base confidence from ensemble
            source: Data source
            text_length: Length of analyzed text
            entities: Extracted entities
        
        Returns:
            Enhanced confidence score
        """
        # Start with base confidence
        confidence = base_confidence
        
        # Source reliability adjustment
        source_weight = self.source_weights.get(source, 0.5)
        confidence *= (0.5 + source_weight * 0.5)  # Scale between 0.5 and 1.0
        
        # Text length adjustment (optimal range: 50-200 characters)
        if 50 <= text_length <= 200:
            length_factor = 1.0
        elif text_length < 50:
            length_factor = 0.7 + (text_length / 50) * 0.3
        else:
            length_factor = max(0.8, 1.0 - (text_length - 200) / 1000)
        
        confidence *= length_factor
        
        # Entity presence boost
        entity_count = sum(len(v) if isinstance(v, list) else 0 for v in entities.values())
        if entity_count > 0:
            entity_boost = min(1.2, 1.0 + entity_count * 0.05)
            confidence *= entity_boost
        
        return min(confidence, 1.0)
    
    def _calculate_sentiment_strength(self, score: float) -> str:
        """
        Calculate sentiment strength based on score magnitude
        
        Args:
            score: Sentiment score
        
        Returns:
            Strength label
        """
        abs_score = abs(score)
        
        if abs_score >= 0.7:
            return 'strong'
        elif abs_score >= 0.4:
            return 'moderate'
        elif abs_score >= 0.1:
            return 'weak'
        else:
            return 'neutral'
    
    def _get_confidence_quality(self, confidence: float) -> str:
        """
        Get quality label based on confidence score
        
        Args:
            confidence: Confidence score
        
        Returns:
            Quality label
        """
        if confidence >= self.confidence_thresholds['high']:
            return 'high'
        elif confidence >= self.confidence_thresholds['medium']:
            return 'medium'
        elif confidence >= self.confidence_thresholds['low']:
            return 'low'
        else:
            return 'very_low'
    
    def _calculate_aggregate_stats(self, scores: List[float], confidences: List[float]) -> Dict:
        """
        Calculate aggregate statistics for batch results
        
        Args:
            scores: List of sentiment scores
            confidences: List of confidence scores
        
        Returns:
            Aggregate statistics
        """
        if not scores:
            return {
                'avg_score': 0.0,
                'avg_confidence': 0.0,
                'distribution': {'bullish': 0, 'bearish': 0, 'neutral': 0},
                'quality_dist': {'high': 0, 'medium': 0, 'low': 0, 'very_low': 0}
            }
        
        # Calculate averages
        avg_score = np.mean(scores)
        avg_confidence = np.mean(confidences)
        
        # Calculate sentiment distribution
        distribution = {'bullish': 0, 'bearish': 0, 'neutral': 0}
        for score in scores:
            label = self._score_to_label(score)
            distribution[label] += 1
        
        # Calculate quality distribution
        quality_dist = {'high': 0, 'medium': 0, 'low': 0, 'very_low': 0}
        for confidence in confidences:
            quality = self._get_confidence_quality(confidence)
            quality_dist[quality] += 1
        
        return {
            'avg_score': avg_score,
            'avg_confidence': avg_confidence,
            'distribution': distribution,
            'quality_dist': quality_dist,
            'score_std': np.std(scores),
            'confidence_std': np.std(confidences)
        }
    
    def _score_to_label(self, score: float) -> str:
        """
        Convert numerical score to sentiment label
        
        Args:
            score: Sentiment score
        
        Returns:
            Sentiment label
        """
        if score > 0.1:
            return 'bullish'
        elif score < -0.1:
            return 'bearish'
        else:
            return 'neutral'