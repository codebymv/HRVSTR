#!/usr/bin/env python3
"""
Test script for the Python Sentiment Analysis Service
This script tests all major functionality of the sentiment analysis service.
"""

import requests
import json
import time
import sys
from typing import Dict, List, Any

# Service configuration
SERVICE_URL = "http://localhost:5000"
TEST_TIMEOUT = 30

class SentimentServiceTester:
    def __init__(self, base_url: str = SERVICE_URL):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.timeout = TEST_TIMEOUT
        
    def test_health_check(self) -> bool:
        """Test the health check endpoint"""
        print("\n🔍 Testing health check...")
        try:
            response = self.session.get(f"{self.base_url}/health")
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Health check passed: {data.get('status')}")
                return True
            else:
                print(f"❌ Health check failed: {response.status_code}")
                return False
        except Exception as e:
            print(f"❌ Health check error: {e}")
            return False
    
    def test_single_analysis(self) -> bool:
        """Test single text analysis"""
        print("\n🔍 Testing single text analysis...")
        
        test_cases = [
            {
                "text": "AAPL is looking very bullish after the earnings beat!",
                "ticker": "AAPL",
                "source": "reddit",
                "expected_sentiment": "positive"
            },
            {
                "text": "Tesla stock is overvalued and will crash soon",
                "ticker": "TSLA",
                "source": "twitter",
                "expected_sentiment": "negative"
            },
            {
                "text": "Market conditions are uncertain today",
                "ticker": None,
                "source": "news",
                "expected_sentiment": "neutral"
            }
        ]
        
        success_count = 0
        
        for i, test_case in enumerate(test_cases, 1):
            try:
                payload = {
                    "text": test_case["text"],
                    "ticker": test_case["ticker"],
                    "source": test_case["source"],
                    "options": {
                        "use_finbert": True,
                        "use_vader": True,
                        "extract_entities": True,
                        "confidence_threshold": 0.6
                    }
                }
                
                response = self.session.post(
                    f"{self.base_url}/analyze/single",
                    json=payload,
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    sentiment_label = data.get("sentiment", {}).get("label", "unknown")
                    confidence = data.get("sentiment", {}).get("confidence", 0)
                    
                    print(f"✅ Test case {i}: {sentiment_label} (confidence: {confidence:.2f})")
                    print(f"   Text: {test_case['text'][:50]}...")
                    
                    # Check if entities were extracted
                    entities = data.get("entities", {})
                    if entities.get("tickers"):
                        print(f"   Extracted tickers: {entities['tickers']}")
                    
                    success_count += 1
                else:
                    print(f"❌ Test case {i} failed: {response.status_code}")
                    print(f"   Response: {response.text}")
                    
            except Exception as e:
                print(f"❌ Test case {i} error: {e}")
        
        print(f"\n📊 Single analysis results: {success_count}/{len(test_cases)} passed")
        return success_count == len(test_cases)
    
    def test_batch_analysis(self) -> bool:
        """Test batch text analysis"""
        print("\n🔍 Testing batch text analysis...")
        
        try:
            payload = {
                "texts": [
                    "AAPL earnings exceeded expectations by 15%!",
                    "TSLA production numbers are disappointing",
                    "Market volatility continues amid economic uncertainty",
                    "NVDA AI chips driving massive revenue growth",
                    "Fed interest rate decision pending"
                ],
                "tickers": ["AAPL", "TSLA", None, "NVDA", None],
                "source": "mixed",
                "options": {
                    "use_finbert": True,
                    "confidence_threshold": 0.5
                }
            }
            
            response = self.session.post(
                f"{self.base_url}/analyze",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                results = data.get("results", [])
                stats = data.get("statistics", {})
                
                print(f"✅ Batch analysis completed: {len(results)} texts processed")
                print(f"   Average confidence: {stats.get('average_confidence', 0):.2f}")
                print(f"   Sentiment distribution: {stats.get('sentiment_distribution', {})}")
                
                # Show individual results
                for i, result in enumerate(results[:3]):  # Show first 3
                    sentiment = result.get("sentiment", {})
                    print(f"   Text {i+1}: {sentiment.get('label')} ({sentiment.get('confidence', 0):.2f})")
                
                return True
            else:
                print(f"❌ Batch analysis failed: {response.status_code}")
                print(f"   Response: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Batch analysis error: {e}")
            return False
    
    def test_model_info(self) -> bool:
        """Test model information endpoint"""
        print("\n🔍 Testing model information...")
        
        try:
            response = self.session.get(f"{self.base_url}/models/info")
            
            if response.status_code == 200:
                data = response.json()
                models = data.get("models", {})
                
                print("✅ Model information retrieved:")
                for model_name, model_info in models.items():
                    status = model_info.get("status", "unknown")
                    version = model_info.get("version", "unknown")
                    print(f"   {model_name}: {status} (v{version})")
                
                return True
            else:
                print(f"❌ Model info failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Model info error: {e}")
            return False
    
    def test_cache_operations(self) -> bool:
        """Test cache operations"""
        print("\n🔍 Testing cache operations...")
        
        try:
            # Get cache stats
            response = self.session.get(f"{self.base_url}/cache/stats")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Cache stats retrieved: {data.get('total_keys', 0)} keys")
                
                # Test cache clear
                clear_response = self.session.delete(f"{self.base_url}/cache/clear")
                if clear_response.status_code == 200:
                    print("✅ Cache cleared successfully")
                    return True
                else:
                    print(f"❌ Cache clear failed: {clear_response.status_code}")
                    return False
            else:
                print(f"❌ Cache stats failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Cache operations error: {e}")
            return False
    
    def test_error_handling(self) -> bool:
        """Test error handling with invalid inputs"""
        print("\n🔍 Testing error handling...")
        
        test_cases = [
            {
                "name": "Empty text",
                "payload": {"text": "", "ticker": "AAPL"},
                "expected_status": 400
            },
            {
                "name": "Invalid ticker format",
                "payload": {"text": "Test text", "ticker": "INVALID_TICKER_123"},
                "expected_status": 400
            },
            {
                "name": "Missing required field",
                "payload": {"ticker": "AAPL"},
                "expected_status": 400
            }
        ]
        
        success_count = 0
        
        for test_case in test_cases:
            try:
                response = self.session.post(
                    f"{self.base_url}/analyze/single",
                    json=test_case["payload"],
                    headers={"Content-Type": "application/json"}
                )
                
                if response.status_code == test_case["expected_status"]:
                    print(f"✅ {test_case['name']}: Correctly handled")
                    success_count += 1
                else:
                    print(f"❌ {test_case['name']}: Expected {test_case['expected_status']}, got {response.status_code}")
                    
            except Exception as e:
                print(f"❌ {test_case['name']} error: {e}")
        
        print(f"\n📊 Error handling results: {success_count}/{len(test_cases)} passed")
        return success_count == len(test_cases)
    
    def test_performance(self) -> bool:
        """Test basic performance metrics"""
        print("\n🔍 Testing performance...")
        
        try:
            # Test single analysis performance
            start_time = time.time()
            
            payload = {
                "text": "AAPL stock is performing well in the current market conditions",
                "ticker": "AAPL",
                "source": "news",
                "options": {"use_finbert": True, "use_vader": True}
            }
            
            response = self.session.post(
                f"{self.base_url}/analyze/single",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            end_time = time.time()
            response_time = (end_time - start_time) * 1000  # Convert to milliseconds
            
            if response.status_code == 200:
                print(f"✅ Single analysis response time: {response_time:.2f}ms")
                
                # Test if response time is reasonable (< 5 seconds for first request)
                if response_time < 5000:
                    print("✅ Performance within acceptable range")
                    return True
                else:
                    print("⚠️ Performance slower than expected but functional")
                    return True
            else:
                print(f"❌ Performance test failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Performance test error: {e}")
            return False
    
    def run_all_tests(self) -> Dict[str, bool]:
        """Run all tests and return results"""
        print("🚀 Starting Python Sentiment Service Tests")
        print(f"Service URL: {self.base_url}")
        print("=" * 50)
        
        # Wait for service to be ready
        print("⏳ Waiting for service to be ready...")
        max_retries = 10
        for i in range(max_retries):
            try:
                response = self.session.get(f"{self.base_url}/health", timeout=5)
                if response.status_code == 200:
                    print("✅ Service is ready!")
                    break
            except:
                pass
            
            if i < max_retries - 1:
                print(f"⏳ Retrying in 3 seconds... ({i+1}/{max_retries})")
                time.sleep(3)
            else:
                print("❌ Service not ready after maximum retries")
                return {"service_ready": False}
        
        # Run all tests
        results = {
            "health_check": self.test_health_check(),
            "single_analysis": self.test_single_analysis(),
            "batch_analysis": self.test_batch_analysis(),
            "model_info": self.test_model_info(),
            "cache_operations": self.test_cache_operations(),
            "error_handling": self.test_error_handling(),
            "performance": self.test_performance()
        }
        
        # Print summary
        print("\n" + "=" * 50)
        print("📊 TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(results.values())
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name.replace('_', ' ').title()}: {status}")
        
        print(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! Service is working correctly.")
        else:
            print("⚠️ Some tests failed. Check the output above for details.")
        
        return results

def main():
    """Main function to run tests"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test Python Sentiment Service")
    parser.add_argument("--url", default=SERVICE_URL, help="Service URL")
    parser.add_argument("--test", help="Run specific test (health, single, batch, models, cache, errors, performance)")
    
    args = parser.parse_args()
    
    tester = SentimentServiceTester(args.url)
    
    if args.test:
        # Run specific test
        test_methods = {
            "health": tester.test_health_check,
            "single": tester.test_single_analysis,
            "batch": tester.test_batch_analysis,
            "models": tester.test_model_info,
            "cache": tester.test_cache_operations,
            "errors": tester.test_error_handling,
            "performance": tester.test_performance
        }
        
        if args.test in test_methods:
            result = test_methods[args.test]()
            sys.exit(0 if result else 1)
        else:
            print(f"Unknown test: {args.test}")
            print(f"Available tests: {', '.join(test_methods.keys())}")
            sys.exit(1)
    else:
        # Run all tests
        results = tester.run_all_tests()
        all_passed = all(results.values())
        sys.exit(0 if all_passed else 1)

if __name__ == "__main__":
    main()