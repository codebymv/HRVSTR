#!/usr/bin/env python3
"""
Text Preprocessor for Financial Sentiment Analysis
Handles cleaning, normalization, and preparation of financial text data
"""

import re
import string
from typing import Dict, List, Optional
from urllib.parse import urlparse

class TextPreprocessor:
    """
    Advanced text preprocessor for financial content
    """
    
    def __init__(self):
        # Compile regex patterns for efficiency
        self.url_pattern = re.compile(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\(\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+')
        self.mention_pattern = re.compile(r'@[A-Za-z0-9_]+')
        self.hashtag_pattern = re.compile(r'#[A-Za-z0-9_]+')
        self.ticker_pattern = re.compile(r'\$[A-Z]{1,5}\b')
        self.emoji_pattern = re.compile(r'[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF]+')
        self.multiple_spaces = re.compile(r'\s+')
        self.number_pattern = re.compile(r'\b\d+(?:\.\d+)?[%]?\b')
        
        # Financial slang normalization
        self.slang_normalization = {
            'hodl': 'hold',
            'stonks': 'stocks',
            'tendies': 'profits',
            'diamond hands': 'strong hold',
            'paper hands': 'weak sell',
            'to the moon': 'very bullish',
            'ape': 'retail investor',
            'retard': 'trader',  # WSB context
            'autist': 'trader',  # WSB context
            'yolo': 'high risk bet',
            'fomo': 'fear of missing out',
            'dd': 'due diligence',
            'btfd': 'buy the dip',
            'rekt': 'lost money',
            'bag holder': 'losing position',
            'pump and dump': 'manipulation',
            'rug pull': 'scam exit'
        }
        
        # Financial stopwords (beyond standard stopwords)
        self.financial_stopwords = {
            'stock', 'share', 'market', 'trading', 'trader', 'invest', 'investment',
            'portfolio', 'position', 'option', 'call', 'put', 'strike', 'expiry',
            'volume', 'price', 'chart', 'technical', 'analysis', 'fundamental'
        }
        
        # Emoji sentiment mapping for financial context
        self.emoji_sentiment = {
            '🚀': 'very bullish rocket',
            '📈': 'bullish chart up',
            '📉': 'bearish chart down',
            '💎': 'diamond hands hold',
            '🙌': 'diamond hands',
            '📰': 'news',
            '💰': 'money profit',
            '💸': 'money loss',
            '🔥': 'hot trending',
            '⚡': 'fast movement',
            '🌙': 'to the moon bullish',
            '🐻': 'bearish',
            '🐂': 'bullish',
            '😭': 'sad loss',
            '😂': 'laughing',
            '🤡': 'clown bad decision',
            '💀': 'dead loss'
        }
    
    def preprocess(self, text: str, source: str = 'unknown') -> str:
        """
        Main preprocessing pipeline
        
        Args:
            text: Raw text to preprocess
            source: Source of the text (reddit, finviz, news, etc.)
        
        Returns:
            Cleaned and normalized text
        """
        if not text or not isinstance(text, str):
            return ""
        
        # Apply source-specific preprocessing
        if source.lower() == 'reddit':
            text = self._preprocess_reddit(text)
        elif source.lower() == 'finviz':
            text = self._preprocess_finviz(text)
        elif source.lower() in ['news', 'yahoo']:
            text = self._preprocess_news(text)
        else:
            text = self._preprocess_generic(text)
        
        return text.strip()
    
    def _preprocess_reddit(self, text: str) -> str:
        """
        Reddit-specific preprocessing
        """
        # Convert emojis to text
        text = self._convert_emojis_to_text(text)
        
        # Normalize financial slang
        text = self._normalize_slang(text)
        
        # Remove URLs but keep ticker mentions
        text = self.url_pattern.sub(' ', text)
        
        # Clean mentions but preserve context
        text = self.mention_pattern.sub(' user_mention ', text)
        
        # Process hashtags (remove # but keep content)
        text = self.hashtag_pattern.sub(lambda m: m.group(0)[1:], text)
        
        # Preserve ticker symbols
        tickers = self.ticker_pattern.findall(text)
        text = self.ticker_pattern.sub(' TICKER_SYMBOL ', text)
        
        # Basic cleaning
        text = self._basic_clean(text)
        
        # Restore tickers
        for ticker in tickers:
            text = text.replace('TICKER_SYMBOL', ticker, 1)
        
        return text
    
    def _preprocess_finviz(self, text: str) -> str:
        """
        FinViz-specific preprocessing
        """
        # Remove HTML tags if any
        text = re.sub(r'<[^>]+>', ' ', text)
        
        # Clean URLs
        text = self.url_pattern.sub(' ', text)
        
        # Preserve financial numbers and percentages
        numbers = self.number_pattern.findall(text)
        text = self.number_pattern.sub(' FINANCIAL_NUMBER ', text)
        
        # Basic cleaning
        text = self._basic_clean(text)
        
        # Restore numbers
        for number in numbers:
            text = text.replace('FINANCIAL_NUMBER', number, 1)
        
        return text
    
    def _preprocess_news(self, text: str) -> str:
        """
        News article preprocessing
        """
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', ' ', text)
        
        # Remove URLs
        text = self.url_pattern.sub(' ', text)
        
        # Remove excessive punctuation
        text = re.sub(r'[!]{2,}', '!', text)
        text = re.sub(r'[?]{2,}', '?', text)
        
        # Basic cleaning
        text = self._basic_clean(text)
        
        return text
    
    def _preprocess_generic(self, text: str) -> str:
        """
        Generic preprocessing for unknown sources
        """
        # Remove URLs
        text = self.url_pattern.sub(' ', text)
        
        # Basic cleaning
        text = self._basic_clean(text)
        
        return text
    
    def _basic_clean(self, text: str) -> str:
        """
        Basic text cleaning operations
        """
        # Convert to lowercase
        text = text.lower()
        
        # Remove extra whitespace
        text = self.multiple_spaces.sub(' ', text)
        
        # Remove leading/trailing whitespace
        text = text.strip()
        
        # Remove excessive punctuation but preserve some for sentiment
        text = re.sub(r'[.]{3,}', '...', text)
        text = re.sub(r'[-]{2,}', '--', text)
        
        return text
    
    def _convert_emojis_to_text(self, text: str) -> str:
        """
        Convert financial emojis to sentiment text
        """
        for emoji, sentiment_text in self.emoji_sentiment.items():
            text = text.replace(emoji, f' {sentiment_text} ')
        
        # Remove remaining emojis
        text = self.emoji_pattern.sub(' ', text)
        
        return text
    
    def _normalize_slang(self, text: str) -> str:
        """
        Normalize financial slang terms
        """
        text_lower = text.lower()
        
        for slang, normalized in self.slang_normalization.items():
            # Use word boundaries to avoid partial matches
            pattern = r'\b' + re.escape(slang) + r'\b'
            text_lower = re.sub(pattern, normalized, text_lower)
        
        return text_lower
    
    def extract_tickers(self, text: str) -> List[str]:
        """
        Extract ticker symbols from text
        
        Args:
            text: Text to extract tickers from
        
        Returns:
            List of unique ticker symbols
        """
        tickers = self.ticker_pattern.findall(text.upper())
        
        # Also look for potential tickers without $ prefix
        words = text.upper().split()
        potential_tickers = [word for word in words if len(word) <= 5 and word.isalpha()]
        
        # Filter out common words that aren't tickers
        common_words = {'THE', 'AND', 'OR', 'BUT', 'FOR', 'WITH', 'TO', 'FROM', 'BY', 'AT', 'IN', 'ON', 'UP', 'DOWN'}
        potential_tickers = [t for t in potential_tickers if t not in common_words]
        
        all_tickers = list(set(tickers + ['$' + t for t in potential_tickers]))
        
        return all_tickers
    
    def extract_financial_numbers(self, text: str) -> List[str]:
        """
        Extract financial numbers and percentages
        
        Args:
            text: Text to extract numbers from
        
        Returns:
            List of financial numbers found
        """
        return self.number_pattern.findall(text)
    
    def calculate_text_quality_score(self, text: str) -> float:
        """
        Calculate a quality score for the text (0-1)
        Higher scores indicate better quality for sentiment analysis
        
        Args:
            text: Text to evaluate
        
        Returns:
            Quality score between 0 and 1
        """
        if not text:
            return 0.0
        
        score = 0.0
        
        # Length factor (optimal around 50-200 characters)
        length = len(text)
        if 20 <= length <= 500:
            length_score = min(length / 200, 1.0)
        else:
            length_score = max(0.2, 1.0 - abs(length - 200) / 1000)
        score += length_score * 0.3
        
        # Word count factor
        word_count = len(text.split())
        if 5 <= word_count <= 100:
            word_score = min(word_count / 50, 1.0)
        else:
            word_score = max(0.2, 1.0 - abs(word_count - 50) / 200)
        score += word_score * 0.2
        
        # Financial content factor
        has_ticker = bool(self.ticker_pattern.search(text))
        has_numbers = bool(self.number_pattern.search(text))
        financial_terms = sum(1 for term in self.slang_normalization.keys() if term in text.lower())
        
        financial_score = (has_ticker * 0.4 + has_numbers * 0.3 + min(financial_terms / 3, 1.0) * 0.3)
        score += financial_score * 0.3
        
        # Readability factor (not too many special characters)
        special_char_ratio = sum(1 for c in text if c in string.punctuation) / len(text)
        readability_score = max(0, 1.0 - special_char_ratio * 2)
        score += readability_score * 0.2
        
        return min(score, 1.0)