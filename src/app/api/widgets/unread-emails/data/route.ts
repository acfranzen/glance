import { NextRequest, NextResponse } from 'next/server';
import { validateAuthOrInternal } from '@/lib/auth';
import { getCredential } from '@/lib/credentials';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

const CACHE_FILE = '/tmp/unread-emails-cache.json';
const SUMMARY_CACHE_FILE = '/tmp/unread-emails-summaries.json';
const CACHE_MAX_AGE_MS = 2 * 60 * 1000; // 2 minutes

export interface EmailItem {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  date: string;
  labels: string[];
  url: string;
  summary?: string;
}

export interface UnreadEmailsData {
  emails: EmailItem[];
  fetchedAt: string;
  fromCache?: boolean;
  error?: string;
}

interface GogThread {
  id: string;
  date: string;
  from: string;
  subject: string;
  labels: string[];
  messageCount: number;
}

interface GogResponse {
  threads: GogThread[];
  nextPageToken?: string;
}

interface SummaryCache {
  [messageId: string]: {
    summary: string;
    cachedAt: number;
  };
}

/**
 * Parse the "from" field to extract name and email
 */
function parseFrom(from: string): { name: string; email: string } {
  // Format: "Name" <email@example.com> or just email@example.com
  const match = from.match(/^"?([^"<]+)"?\s*<(.+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  return { name: from, email: from };
}

/**
 * Load summary cache from disk
 */
function loadSummaryCache(): SummaryCache {
  try {
    if (fs.existsSync(SUMMARY_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(SUMMARY_CACHE_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Summary cache read error:', err);
  }
  return {};
}

/**
 * Save summary cache to disk
 */
function saveSummaryCache(cache: SummaryCache): void {
  try {
    fs.writeFileSync(SUMMARY_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.error('Summary cache write error:', err);
  }
}

/**
 * Fetch email body using gog CLI
 */
async function fetchEmailBody(messageId: string): Promise<string> {
  const gogPath = process.env.GOG_PATH || '/opt/homebrew/bin/gog';
  const account = 'zeuskingclaw@gmail.com';
  
  try {
    const { stdout, stderr } = await execAsync(
      `"${gogPath}" gmail read "${messageId}" --format plain --account="${account}"`,
      {
        timeout: 15000,
        env: process.env as NodeJS.ProcessEnv,
        maxBuffer: 1024 * 1024, // 1MB buffer for long emails
      }
    );

    if (stderr && !stdout) {
      console.warn(`gog read warning for ${messageId}: ${stderr}`);
    }

    // Truncate to first 2000 chars to keep API calls efficient
    return stdout.slice(0, 2000);
  } catch (err) {
    console.error(`Failed to fetch email body ${messageId}:`, err);
    return '';
  }
}

/**
 * Get Anthropic API key from env or credentials
 */
function getAnthropicApiKey(): string | null {
  // Try dedicated API key env first
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }
  // Try admin key (which also works for API calls)
  if (process.env.ANTHROPIC_ADMIN_KEY) {
    return process.env.ANTHROPIC_ADMIN_KEY;
  }
  // Fallback to credentials system
  try {
    return getCredential('anthropic');
  } catch {
    return null;
  }
}

/**
 * Generate summary using Claude Haiku 4.5
 */
async function generateSummary(emailBody: string, subject: string): Promise<string> {
  const apiKey = getAnthropicApiKey();
  
  if (!apiKey) {
    console.warn('No Anthropic API key configured, skipping summary generation');
    return '';
  }

  if (!emailBody.trim()) {
    return '';
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251022',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: `Summarize this email in one short line (max 80 chars). If there's an action needed, start with the action. Be concise.\n\nSubject: ${subject}\n\nEmail:\n${emailBody}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Anthropic API error: ${response.status} ${errorText}`);
      return '';
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';
    
    // Clean up and truncate summary
    return content.trim().slice(0, 120);
  } catch (err) {
    console.error('Summary generation error:', err);
    return '';
  }
}

/**
 * Get or generate summaries for emails
 */
async function getSummariesForEmails(emails: EmailItem[]): Promise<Map<string, string>> {
  const summaryCache = loadSummaryCache();
  const summaries = new Map<string, string>();
  const emailsNeedingSummary: EmailItem[] = [];

  // Check cache for existing summaries
  for (const email of emails) {
    const cached = summaryCache[email.id];
    if (cached) {
      summaries.set(email.id, cached.summary);
    } else {
      emailsNeedingSummary.push(email);
    }
  }

  // Generate summaries for uncached emails in parallel
  if (emailsNeedingSummary.length > 0) {
    const summaryPromises = emailsNeedingSummary.map(async (email) => {
      const body = await fetchEmailBody(email.id);
      const summary = await generateSummary(body, email.subject);
      return { id: email.id, summary };
    });

    const results = await Promise.all(summaryPromises);

    // Update cache with new summaries
    for (const { id, summary } of results) {
      if (summary) {
        summaries.set(id, summary);
        summaryCache[id] = {
          summary,
          cachedAt: Date.now(),
        };
      }
    }

    // Clean old entries (keep last 50)
    const entries = Object.entries(summaryCache);
    if (entries.length > 50) {
      const sorted = entries.sort((a, b) => b[1].cachedAt - a[1].cachedAt);
      const newCache: SummaryCache = {};
      for (const [key, value] of sorted.slice(0, 50)) {
        newCache[key] = value;
      }
      saveSummaryCache(newCache);
    } else {
      saveSummaryCache(summaryCache);
    }
  }

  return summaries;
}

/**
 * Fetch emails using gog CLI
 */
async function fetchEmails(): Promise<UnreadEmailsData> {
  try {
    // Search for inbox emails not from myself
    const gogPath = process.env.GOG_PATH || '/opt/homebrew/bin/gog';
    const account = 'zeuskingclaw@gmail.com';
    
    const { stdout, stderr } = await execAsync(
      `"${gogPath}" gmail search "in:inbox -from:${account}" --max 5 --json --account="${account}"`,
      {
        timeout: 30000,
        env: {
          ...process.env,
        } as NodeJS.ProcessEnv,
      }
    );

    if (stderr && !stdout) {
      throw new Error(`gog error: ${stderr}`);
    }

    const response: GogResponse = JSON.parse(stdout);
    const fetchedAt = new Date().toISOString();

    const emails: EmailItem[] = response.threads.map((thread) => {
      const parsed = parseFrom(thread.from);
      return {
        id: thread.id,
        from: parsed.email,
        fromName: parsed.name,
        subject: thread.subject,
        date: thread.date,
        labels: thread.labels,
        url: `https://mail.google.com/mail/u/0/#inbox/${thread.id}`,
      };
    });

    // Fetch summaries for all emails
    const summaries = await getSummariesForEmails(emails);
    
    // Add summaries to email items
    for (const email of emails) {
      const summary = summaries.get(email.id);
      if (summary) {
        email.summary = summary;
      }
    }

    const data: UnreadEmailsData = {
      emails,
      fetchedAt,
    };

    // Cache the result
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');

    return data;
  } catch (err) {
    throw new Error(`Failed to fetch emails: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get cached email data
 */
function getCachedEmails(): UnreadEmailsData | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const stat = fs.statSync(CACHE_FILE);
      const age = Date.now() - stat.mtimeMs;

      if (age < CACHE_MAX_AGE_MS) {
        const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as UnreadEmailsData;
        return { ...cached, fromCache: true };
      }
    }
  } catch (err) {
    console.error('Cache read error:', err);
  }
  return null;
}

// GET /api/widgets/unread-emails/data - Fetch unread emails
export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

  // Try cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = getCachedEmails();
    if (cached) {
      return NextResponse.json(cached);
    }
  }

  // Fetch fresh data
  try {
    const data = await fetchEmails();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Email fetch error:', err);
    
    // Try to return stale cache on error
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const staleCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as UnreadEmailsData;
        return NextResponse.json({
          ...staleCache,
          fromCache: true,
          error: `Refresh failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } catch {
      // Ignore cache read error
    }

    return NextResponse.json({
      emails: [],
      fetchedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
    } satisfies UnreadEmailsData);
  }
}
