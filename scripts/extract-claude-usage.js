const fs = require('fs');

const CACHE_FILE = '/tmp/claude-usage-cache.json';
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get usage data from cache
 */
function getCachedUsage() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const stat = fs.statSync(CACHE_FILE);
      const age = Date.now() - stat.mtimeMs;
      
      if (age < CACHE_MAX_AGE_MS) {
        const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        cached.fromCache = true;
        cached.cacheAge = Math.round(age / 1000);
        return cached;
      }
    }
  } catch (err) {
    console.error('Cache read error:', err.message);
  }
  return null;
}

/**
 * Extract Claude usage - reads from cache
 * Cache is populated by PTY capture (run manually or via refresh endpoint)
 */
async function extractClaudeUsage() {
  // Check cache first
  const cached = getCachedUsage();
  if (cached) {
    return cached;
  }

  // Try to read stale cache as fallback
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      cached.staleCache = true;
      return cached;
    }
  } catch (e) {
    // ignore
  }

  // No cache available - return placeholder
  return {
    session: { percentUsed: 0, resetsAt: 'No data' },
    weekAll: { percentUsed: 0, resetsAt: 'No data' },
    weekOpus: { percentUsed: 0, resetsAt: 'No data' },
    error: 'No cached data available.',
    needsRefresh: true,
  };
}

// CLI usage
if (require.main === module) {
  extractClaudeUsage().then((data) => {
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  }).catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
}

module.exports = { extractClaudeUsage };
