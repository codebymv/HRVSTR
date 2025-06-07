console.log('🧪 Testing historical sentiment controller import...');

try {
  const controller = require('../src/controllers/historicalSentimentController');
  console.log('✅ Controller imported successfully');
  console.log('Exported functions:', Object.keys(controller));
  
  // Test if functions are actually functions
  Object.keys(controller).forEach(key => {
    const type = typeof controller[key];
    console.log(`   - ${key}: ${type}`);
  });
  
} catch(error) {
  console.error('❌ Import error:', error.message);
  console.error('Stack:', error.stack);
}

console.log('\n🧪 Testing historical sentiment service import...');

try {
  const service = require('../src/services/historicalSentimentService');
  console.log('✅ Service imported successfully');
  console.log('Exported functions:', Object.keys(service));
  
} catch(error) {
  console.error('❌ Service import error:', error.message);
  console.error('Stack:', error.stack);
}

console.log('\n🧪 Testing sentiment routes import...');

try {
  const routes = require('../src/routes/sentiment');
  console.log('✅ Sentiment routes imported successfully');
  
} catch(error) {
  console.error('❌ Routes import error:', error.message);
  console.error('Stack:', error.stack);
} 