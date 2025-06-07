const { sessionCleanupScheduler } = require('./src/utils/sessionCleanupScheduler');

async function restartScheduler() {
  try {
    console.log('🔄 Restarting session cleanup scheduler...');
    
    // Stop existing scheduler if running
    sessionCleanupScheduler.stop();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Start with enhanced logging
    sessionCleanupScheduler.start({
      sessionCleanupInterval: 2 * 60 * 1000,      // 2 minutes for testing (normally 15 minutes)
      cacheCleanupInterval: 5 * 60 * 1000,       // 5 minutes for testing (normally 30 minutes)
      longRunningCheckInterval: 3 * 60 * 1000,   // 3 minutes for testing (normally 1 hour)
      enabled: true
    });
    
    console.log('✅ Scheduler restarted with test intervals');
    console.log('📋 Test intervals:');
    console.log('   Session cleanup: every 2 minutes');
    console.log('   Cache cleanup: every 5 minutes');
    console.log('   Long-running check: every 3 minutes');
    
    // Run manual cleanup to test immediately
    console.log('\n🧪 Running manual cleanup test...');
    const result = await sessionCleanupScheduler.runManualCleanup();
    
    console.log('\n📊 Manual cleanup results:');
    console.log('Sessions:', result.sessions);
    console.log('Cache:', result.cache);
    console.log('Long Running:', result.longRunning);
    
    // Keep the script running to see scheduled cleanups
    console.log('\n⏰ Scheduler is now running. Press Ctrl+C to stop.');
    console.log('Watch for scheduled cleanup messages every 2-3 minutes...');
    
    // Keep alive
    setInterval(() => {
      const now = new Date();
      console.log(`💓 [${now.toLocaleTimeString()}] Scheduler heartbeat - still running`);
    }, 60 * 1000); // Every minute
    
  } catch (error) {
    console.error('❌ Error restarting scheduler:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping scheduler...');
  sessionCleanupScheduler.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping scheduler...');
  sessionCleanupScheduler.stop();
  process.exit(0);
});

restartScheduler(); 