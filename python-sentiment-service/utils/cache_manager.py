#!/usr/bin/env python3
"""
Cache Manager for Python Sentiment Service
Handles Redis caching for sentiment analysis results
"""

import json
import hashlib
import os
from typing import Any, Dict, List, Optional, Union
from datetime import datetime, timedelta

import redis
from loguru import logger

class CacheManager:
    """
    Redis-based cache manager for sentiment analysis results
    """
    
    def __init__(self):
        self.redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379')
        self.key_prefix = 'sentiment:'
        self.default_ttl = 1800  # 30 minutes
        
        # Initialize Redis connection
        try:
            self.redis_client = redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True
            )
            
            # Test connection
            self.redis_client.ping()
            logger.info(f"Connected to Redis at {self.redis_url}")
            
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}. Using in-memory fallback.")
            self.redis_client = None
            self._memory_cache = {}
            self._memory_cache_timestamps = {}
    
    def generate_cache_key(self, texts: List[str], tickers: List[str], 
                          source: str, options: Dict) -> str:
        """
        Generate a unique cache key for the given parameters
        
        Args:
            texts: List of texts to analyze
            tickers: List of ticker symbols
            source: Data source identifier
            options: Analysis options
        
        Returns:
            Unique cache key string
        """
        # Create a deterministic hash of the input parameters
        cache_data = {
            'texts': sorted(texts),  # Sort for consistency
            'tickers': sorted(tickers) if tickers else [],
            'source': source,
            'options': dict(sorted(options.items()))  # Sort options for consistency
        }
        
        # Convert to JSON string and hash
        cache_string = json.dumps(cache_data, sort_keys=True)
        cache_hash = hashlib.sha256(cache_string.encode()).hexdigest()[:16]
        
        return f"{self.key_prefix}{source}:{cache_hash}"
    
    def get(self, key: str) -> Optional[Dict]:
        """
        Retrieve cached sentiment analysis result
        
        Args:
            key: Cache key
        
        Returns:
            Cached result or None if not found/expired
        """
        try:
            if self.redis_client:
                cached_data = self.redis_client.get(key)
                if cached_data:
                    result = json.loads(cached_data)
                    logger.debug(f"Cache hit for key: {key[:50]}...")
                    return result
            else:
                # Fallback to memory cache
                if key in self._memory_cache:
                    # Check if expired
                    timestamp = self._memory_cache_timestamps.get(key)
                    if timestamp and datetime.now() - timestamp < timedelta(seconds=self.default_ttl):
                        logger.debug(f"Memory cache hit for key: {key[:50]}...")
                        return self._memory_cache[key]
                    else:
                        # Remove expired entry
                        del self._memory_cache[key]
                        del self._memory_cache_timestamps[key]
            
            logger.debug(f"Cache miss for key: {key[:50]}...")
            return None
            
        except Exception as e:
            logger.error(f"Error retrieving from cache: {e}")
            return None
    
    def set(self, key: str, value: Dict, ttl: Optional[int] = None) -> bool:
        """
        Store sentiment analysis result in cache
        
        Args:
            key: Cache key
            value: Data to cache
            ttl: Time to live in seconds (optional)
        
        Returns:
            True if successful, False otherwise
        """
        try:
            ttl = ttl or self.default_ttl
            
            # Add metadata to cached value
            cached_value = {
                'data': value,
                'cached_at': datetime.utcnow().isoformat(),
                'ttl': ttl
            }
            
            if self.redis_client:
                self.redis_client.setex(
                    key, 
                    ttl, 
                    json.dumps(cached_value, default=str)
                )
            else:
                # Fallback to memory cache
                self._memory_cache[key] = cached_value
                self._memory_cache_timestamps[key] = datetime.now()
                
                # Clean up old entries periodically
                self._cleanup_memory_cache()
            
            logger.debug(f"Cached result for key: {key[:50]}... (TTL: {ttl}s)")
            return True
            
        except Exception as e:
            logger.error(f"Error storing in cache: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """
        Delete a specific cache entry
        
        Args:
            key: Cache key to delete
        
        Returns:
            True if successful, False otherwise
        """
        try:
            if self.redis_client:
                result = self.redis_client.delete(key)
                return result > 0
            else:
                if key in self._memory_cache:
                    del self._memory_cache[key]
                    del self._memory_cache_timestamps[key]
                    return True
                return False
                
        except Exception as e:
            logger.error(f"Error deleting from cache: {e}")
            return False
    
    def clear_all(self) -> bool:
        """
        Clear all sentiment analysis cache entries
        
        Returns:
            True if successful, False otherwise
        """
        try:
            if self.redis_client:
                # Get all keys with our prefix
                keys = self.redis_client.keys(f"{self.key_prefix}*")
                if keys:
                    self.redis_client.delete(*keys)
                    logger.info(f"Cleared {len(keys)} cache entries")
                return True
            else:
                # Clear memory cache
                cleared_count = len(self._memory_cache)
                self._memory_cache.clear()
                self._memory_cache_timestamps.clear()
                logger.info(f"Cleared {cleared_count} memory cache entries")
                return True
                
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")
            return False
    
    def get_stats(self) -> Dict:
        """
        Get cache statistics
        
        Returns:
            Dictionary with cache statistics
        """
        stats = {
            'cache_type': 'redis' if self.redis_client else 'memory',
            'connected': self.redis_client is not None,
            'default_ttl': self.default_ttl,
            'key_prefix': self.key_prefix
        }
        
        try:
            if self.redis_client:
                # Redis-specific stats
                info = self.redis_client.info()
                keys = self.redis_client.keys(f"{self.key_prefix}*")
                
                stats.update({
                    'total_keys': len(keys),
                    'redis_version': info.get('redis_version'),
                    'used_memory': info.get('used_memory_human'),
                    'connected_clients': info.get('connected_clients'),
                    'keyspace_hits': info.get('keyspace_hits', 0),
                    'keyspace_misses': info.get('keyspace_misses', 0)
                })
                
                # Calculate hit rate
                hits = stats['keyspace_hits']
                misses = stats['keyspace_misses']
                if hits + misses > 0:
                    stats['hit_rate'] = hits / (hits + misses)
                else:
                    stats['hit_rate'] = 0.0
                    
            else:
                # Memory cache stats
                current_time = datetime.now()
                valid_entries = 0
                
                for key, timestamp in self._memory_cache_timestamps.items():
                    if current_time - timestamp < timedelta(seconds=self.default_ttl):
                        valid_entries += 1
                
                stats.update({
                    'total_keys': valid_entries,
                    'memory_entries': len(self._memory_cache),
                    'expired_entries': len(self._memory_cache) - valid_entries
                })
                
        except Exception as e:
            logger.error(f"Error getting cache stats: {e}")
            stats['error'] = str(e)
        
        return stats
    
    def _cleanup_memory_cache(self):
        """
        Clean up expired entries from memory cache
        """
        if not hasattr(self, '_last_cleanup'):
            self._last_cleanup = datetime.now()
        
        # Only cleanup every 5 minutes
        if datetime.now() - self._last_cleanup < timedelta(minutes=5):
            return
        
        current_time = datetime.now()
        expired_keys = []
        
        for key, timestamp in self._memory_cache_timestamps.items():
            if current_time - timestamp >= timedelta(seconds=self.default_ttl):
                expired_keys.append(key)
        
        for key in expired_keys:
            if key in self._memory_cache:
                del self._memory_cache[key]
            if key in self._memory_cache_timestamps:
                del self._memory_cache_timestamps[key]
        
        if expired_keys:
            logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")
        
        self._last_cleanup = current_time
    
    def health_check(self) -> Dict:
        """
        Perform a health check on the cache system
        
        Returns:
            Health check results
        """
        health = {
            'healthy': False,
            'cache_type': 'redis' if self.redis_client else 'memory',
            'timestamp': datetime.utcnow().isoformat()
        }
        
        try:
            if self.redis_client:
                # Test Redis connection
                self.redis_client.ping()
                
                # Test set/get operation
                test_key = f"{self.key_prefix}health_check"
                test_value = {'test': True, 'timestamp': datetime.utcnow().isoformat()}
                
                self.redis_client.setex(test_key, 60, json.dumps(test_value))
                retrieved = self.redis_client.get(test_key)
                
                if retrieved:
                    parsed = json.loads(retrieved)
                    if parsed.get('test') is True:
                        health['healthy'] = True
                        health['test_successful'] = True
                
                # Clean up test key
                self.redis_client.delete(test_key)
                
            else:
                # Memory cache is always "healthy" if we reach this point
                health['healthy'] = True
                health['test_successful'] = True
                
        except Exception as e:
            health['error'] = str(e)
            logger.error(f"Cache health check failed: {e}")
        
        return health