import { NextRequest, NextResponse } from 'next/server';
import { validateAuthOrInternal } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

const CACHE_FILE = '/tmp/unread-emails-cache.json';
const CACHE_MAX_AGE_MS = 2 * 60 * 1000; // 2 minutes

export interface EmailItem {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  date: string;
  labels: string[];
  url: string;
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
 * Fetch emails using gog CLI
 */
async function fetchEmails(): Promise<UnreadEmailsData> {
  try {
    // Search for inbox emails not from myself
    // This gets threads where the latest message is from someone else
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
