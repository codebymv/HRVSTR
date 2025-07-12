#!/usr/bin/env python3
"""
Startup script for the Python Sentiment Analysis Service
Handles initialization, dependency checking, and graceful startup
"""

import os
import sys
import subprocess
import logging
import signal
import time
from pathlib import Path

# Fix Windows UTF-8 output issues before configuring logging
if sys.platform.startswith('win'):
    import codecs
    # Only set encoding if not already set
    if hasattr(sys.stdout, 'encoding') and sys.stdout.encoding.lower() != 'utf-8':
        try:
            # Try to reconfigure without detaching
            sys.stdout.reconfigure(encoding='utf-8')
            sys.stderr.reconfigure(encoding='utf-8')
        except (AttributeError, OSError):
            # Fallback for older Python versions or if reconfigure fails
            pass

# Configure logging with UTF-8 encoding
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('sentiment_service.log', encoding='utf-8')
    ]
)
logger = logging.getLogger('sentiment-startup')

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 8):
        logger.error(f"Python 3.8+ required, but {sys.version} is installed")
        return False
    logger.info(f"Python version check passed: {sys.version}")
    return True

def check_requirements():
    """Check if all required packages are installed"""
    requirements_file = Path(__file__).parent / 'requirements.txt'
    
    if not requirements_file.exists():
        logger.error("requirements.txt not found")
        return False
    
    try:
        # Read requirements
        with open(requirements_file, 'r') as f:
            requirements = [line.strip() for line in f if line.strip() and not line.startswith('#')]
        
        logger.info(f"Checking {len(requirements)} requirements...")
        
        # Check each requirement
        missing_packages = []
        for requirement in requirements:
            package_name = requirement.split('==')[0].split('>=')[0].split('<=')[0]
            try:
                __import__(package_name.replace('-', '_'))
                logger.debug(f"✓ {package_name} is installed")
            except ImportError:
                missing_packages.append(requirement)
                logger.warning(f"✗ {package_name} is missing")
        
        if missing_packages:
            logger.error(f"Missing packages: {missing_packages}")
            logger.info("Installing missing packages...")
            
            # Install missing packages
            for package in missing_packages:
                try:
                    subprocess.check_call([sys.executable, '-m', 'pip', 'install', package])
                    logger.info(f"[OK] Installed {package}")
                except subprocess.CalledProcessError as e:
                    logger.error(f"Failed to install {package}: {e}")
                    return False
        
        logger.info("All requirements satisfied")
        return True
        
    except Exception as e:
        logger.error(f"Error checking requirements: {e}")
        return False

def download_models():
    """Download required ML models if not present"""
    logger.info("Checking for required ML models...")
    
    try:
        # Check for spaCy model
        try:
            import spacy
            nlp = spacy.load('en_core_web_sm')
            logger.info("[OK] spaCy model 'en_core_web_sm' is available")
        except OSError:
            logger.info("Downloading spaCy model 'en_core_web_sm'...")
            subprocess.check_call([sys.executable, '-m', 'spacy', 'download', 'en_core_web_sm'])
            logger.info("[OK] spaCy model downloaded successfully")
        
        # Check for transformers models (they will be downloaded automatically on first use)
        try:
            from transformers import AutoTokenizer, AutoModelForSequenceClassification
            logger.info("[OK] Transformers library is available")
            
            # Pre-download FinBERT model
            model_name = "ProsusAI/finbert"
            logger.info(f"Checking FinBERT model: {model_name}")
            try:
                tokenizer = AutoTokenizer.from_pretrained(model_name)
                model = AutoModelForSequenceClassification.from_pretrained(model_name)
                logger.info("[OK] FinBERT model is available")
            except Exception as e:
                logger.warning(f"FinBERT model not cached, will download on first use: {e}")
                
        except ImportError as e:
            logger.error(f"Transformers library not available: {e}")
            return False
            
        return True
        
    except Exception as e:
        logger.error(f"Error downloading models: {e}")
        return False

def setup_environment():
    """Setup environment variables and configuration"""
    logger.info("Setting up environment...")
    
    # Set default environment variables
    env_defaults = {
        'FLASK_ENV': os.getenv('NODE_ENV', 'development'),
        'PYTHONPATH': str(Path(__file__).parent),
        'TOKENIZERS_PARALLELISM': 'false',  # Avoid tokenizer warnings
        'TRANSFORMERS_CACHE': str(Path(__file__).parent / '.cache' / 'transformers'),
        'HF_HOME': str(Path(__file__).parent / '.cache' / 'huggingface')
    }
    
    for key, value in env_defaults.items():
        if key not in os.environ:
            os.environ[key] = value
            logger.debug(f"Set {key}={value}")
    
    # Create cache directories
    cache_dirs = [
        Path(__file__).parent / '.cache',
        Path(__file__).parent / '.cache' / 'transformers',
        Path(__file__).parent / '.cache' / 'huggingface'
    ]
    
    for cache_dir in cache_dirs:
        cache_dir.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Created cache directory: {cache_dir}")
    
    logger.info("Environment setup complete")
    return True

def start_flask_app():
    """Start the Flask application"""
    logger.info("Starting Flask sentiment analysis service...")
    
    try:
        # Import and run the Flask app
        from app import app
        
        # Get configuration
        host = os.getenv('HOST', '0.0.0.0')
        port = int(os.getenv('PORT', 5000))
        debug = os.getenv('FLASK_ENV') == 'development'
        
        logger.info(f"Starting server on {host}:{port} (debug={debug})")
        
        # Start the Flask app
        app.run(
            host=host,
            port=port,
            debug=debug,
            threaded=True,
            use_reloader=False  # Disable reloader to avoid issues with subprocess
        )
        
    except Exception as e:
        logger.error(f"Failed to start Flask app: {e}")
        sys.exit(1)

def signal_handler(signum, frame):
    """Handle shutdown signals gracefully"""
    logger.info(f"Received signal {signum}, shutting down gracefully...")
    sys.exit(0)

def main():
    """Main startup function"""
    logger.info("Starting Python Sentiment Analysis Service...")
    logger.info(f"Working directory: {os.getcwd()}")
    logger.info(f"Script location: {Path(__file__).parent}")
    
    # Setup signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    # Change to script directory
    os.chdir(Path(__file__).parent)
    
    # Run startup checks
    startup_checks = [
        ("Python version", check_python_version),
        ("Environment setup", setup_environment),
        ("Requirements", check_requirements),
        ("ML models", download_models)
    ]
    
    for check_name, check_func in startup_checks:
        logger.info(f"Running {check_name} check...")
        if not check_func():
            logger.error(f"{check_name} check failed, aborting startup")
            sys.exit(1)
        logger.info(f"[OK] {check_name} check passed")
    
    logger.info("All startup checks passed, starting service...")
    
    # Start the Flask application
    start_flask_app()

if __name__ == '__main__':
    main()