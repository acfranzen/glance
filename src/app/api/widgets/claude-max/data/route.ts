import { NextRequest, NextResponse } from 'next/server';
import { validateAuthOrInternal } from '@/lib/auth';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const CACHE_FILE = '/tmp/claude-usage-cache.json';
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

export interface ClaudeMaxUsageData {
  session: {
    percentUsed: number;
    resetsAt: string;
  };
  weekAll: {
    percentUsed: number;
    resetsAt: string;
  };
  weekOpus: {
    percentUsed: number;
    resetsAt: string;
  };
  extra?: {
    spent: number;
    limit: number;
    percentUsed: number;
    resetsAt: string;
  };
  capturedAt: string; // ISO timestamp of when PTY capture happened
  lastUpdated: string;
  error?: string;
  fromCache?: boolean;
  isDemo?: boolean;
}

interface CachedData extends ClaudeMaxUsageData {
  capturedAt: string;
}

/**
 * Parse Claude CLI output to extract usage data
 */
function parseClaudeOutput(output: string): Omit<ClaudeMaxUsageData, 'lastUpdated' | 'capturedAt'> {
  const lines = output.split('\n');
  
  const data: Omit<ClaudeMaxUsageData, 'lastUpdated' | 'capturedAt'> = {
    session: { percentUsed: 0, resetsAt: 'Unknown' },
    weekAll: { percentUsed: 0, resetsAt: 'Unknown' },
    weekOpus: { percentUsed: 0, resetsAt: 'Unknown' },
  };

  // Parse session usage
  // Expected format: "Current session   ████░░░░░░  42% · Resets at 5:00 PM EST"
  const sessionMatch = output.match(/Current session\s+[█░]+\s+(\d+)%\s+·\s+Resets at (.+?)(?:\n|$)/i);
  if (sessionMatch) {
    data.session.percentUsed = parseInt(sessionMatch[1], 10);
    data.session.resetsAt = sessionMatch[2].trim();
  }

  // Parse weekly all models usage
  // Expected format: "Week (all models) ████░░░░░░  38% · Resets Monday 2/3"
  const weekAllMatch = output.match(/Week \(all models\)\s+[█░]+\s+(\d+)%\s+·\s+Resets (.+?)(?:\n|$)/i);
  if (weekAllMatch) {
    data.weekAll.percentUsed = parseInt(weekAllMatch[1], 10);
    data.weekAll.resetsAt = weekAllMatch[2].trim();
  }

  // Parse weekly Opus usage
  // Expected format: "Week (Opus)       ████░░░░░░  12% · Resets Thursday 2/6"
  const weekOpusMatch = output.match(/Week \(Opus\)\s+[█░]+\s+(\d+)%\s+·\s+Resets (.+?)(?:\n|$)/i);
  if (weekOpusMatch) {
    data.weekOpus.percentUsed = parseInt(weekOpusMatch[1], 10);
    data.weekOpus.resetsAt = weekOpusMatch[2].trim();
  }

  // Parse Extra usage (NEW!)
  // Expected format:
  // Extra usage
  // ████░░░░░░  10%
  // $10.54 / $100.00 spent · Resets Mar 1 (America/New_York)
  const extraMatch = output.match(/Extra usage[\s\S]+?(\d+)%[\s\S]+?\$?([\d.]+)\s*\/\s*\$?([\d.]+)\s+spent\s+·\s+Resets (.+?)(?:\n|$)/i);
  if (extraMatch) {
    data.extra = {
      percentUsed: parseInt(extraMatch[1], 10),
      spent: parseFloat(extraMatch[2]),
      limit: parseFloat(extraMatch[3]),
      resetsAt: extraMatch[4].trim(),
    };
  }

  return data;
}

/**
 * Capture Claude usage via exec
 */
async function captureClaudeUsage(): Promise<Omit<ClaudeMaxUsageData, 'lastUpdated'>> {
  try {
    const claudePath = process.env.CLAUDE_PATH || '/opt/homebrew/bin/claude';
    
    // Execute claude CLI with timeout
    const { stdout, stderr } = await execAsync(
      `"${claudePath}" --dangerously-skip-permissions`,
      {
        timeout: 15000,
        cwd: process.env.HOME,
        env: {
          ...process.env,
          FORCE_COLOR: '0', // Disable ANSI colors
          NO_COLOR: '1',
        } as NodeJS.ProcessEnv,
      }
    );

    const output = stdout || '';
    
    if (!output) {
      throw new Error(`No output from Claude CLI. stderr: ${stderr}`);
    }

    const parsed = parseClaudeOutput(output);
    const capturedAt = new Date().toISOString();
    
    // Save to cache
    const cacheData: CachedData = {
      ...parsed,
      capturedAt,
      lastUpdated: capturedAt,
    };
    
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf8');
    
    return { ...parsed, capturedAt };
  } catch (err) {
    throw new Error(`Failed to capture Claude usage: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get cached usage data
 */
function getCachedUsage(): CachedData | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const stat = fs.statSync(CACHE_FILE);
      const age = Date.now() - stat.mtimeMs;
      
      if (age < CACHE_MAX_AGE_MS) {
        const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as CachedData;
        return cached;
      }
    }
  } catch (err) {
    console.error('Cache read error:', err);
  }
  return null;
}

// GET /api/widgets/claude-max/data - Fetch Claude Max usage data
export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const demoMode = request.nextUrl.searchParams.get('demo') === 'true';
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

  if (demoMode) {
    return NextResponse.json({
      session: { percentUsed: 32, resetsAt: '2:30 PM EST' },
      weekAll: { percentUsed: 48, resetsAt: 'Monday 2/3' },
      weekOpus: { percentUsed: 0, resetsAt: 'Thursday 2/6' },
      extra: { spent: 10.54, limit: 100, percentUsed: 11, resetsAt: 'Mar 1 (America/New_York)' },
      capturedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      isDemo: true,
    } satisfies ClaudeMaxUsageData);
  }

  // Always read from cache - OpenClaw handles PTY capture via heartbeats
  // Glance should NEVER try to capture directly (exec doesn't allocate TTY)
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as CachedData;
      const cacheAge = Date.now() - new Date(cached.capturedAt).getTime();
      const isStale = cacheAge > CACHE_MAX_AGE_MS;
      
      return NextResponse.json({
        ...cached,
        fromCache: true,
        staleCache: isStale,
        lastUpdated: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('Cache read error:', e);
  }

  // No cache available - tell user to ask OpenClaw to capture
  return NextResponse.json({
    session: { percentUsed: 0, resetsAt: 'No data' },
    weekAll: { percentUsed: 0, resetsAt: 'No data' },
    weekOpus: { percentUsed: 0, resetsAt: 'No data' },
    capturedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    error: 'No usage data. Ask OpenClaw to capture Claude usage.',
  } satisfies ClaudeMaxUsageData);
}
