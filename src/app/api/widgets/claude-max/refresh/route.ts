import { NextRequest, NextResponse } from 'next/server';
import { validateAuthOrInternal } from '@/lib/auth';
import fs from 'fs';

const REFRESH_REQUEST_FILE = '/tmp/claude-usage-refresh-requested';

// POST /api/widgets/claude-max/refresh - Request OpenClaw to capture fresh usage data
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    // Write refresh request file with timestamp
    // OpenClaw checks for this file and triggers PTY capture
    const requestData = {
      requestedAt: new Date().toISOString(),
      source: 'dashboard-refresh-button'
    };
    
    fs.writeFileSync(REFRESH_REQUEST_FILE, JSON.stringify(requestData), 'utf8');
    
    return NextResponse.json({
      success: true,
      message: 'Refresh requested. OpenClaw will capture fresh data shortly.',
      requestedAt: requestData.requestedAt
    });
  } catch (err) {
    console.error('Failed to request refresh:', err);
    return NextResponse.json({
      error: 'Failed to request refresh',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET /api/widgets/claude-max/refresh - Check if refresh was requested
export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    if (fs.existsSync(REFRESH_REQUEST_FILE)) {
      const data = JSON.parse(fs.readFileSync(REFRESH_REQUEST_FILE, 'utf8'));
      return NextResponse.json({
        pending: true,
        ...data
      });
    }
    return NextResponse.json({ pending: false });
  } catch {
    return NextResponse.json({ pending: false });
  }
}

// DELETE /api/widgets/claude-max/refresh - Clear refresh request (called by OpenClaw after capture)
export async function DELETE(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    if (fs.existsSync(REFRESH_REQUEST_FILE)) {
      fs.unlinkSync(REFRESH_REQUEST_FILE);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({
      error: 'Failed to clear refresh request',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
