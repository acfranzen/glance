import { NextRequest, NextResponse } from 'next/server';
import { getCredential } from '@/lib/credentials';

const VERCEL_API = 'https://api.vercel.com';

interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  created: number;
  meta?: {
    githubCommitRef?: string;
    githubCommitMessage?: string;
    githubCommitAuthorName?: string;
  };
  creator?: {
    username: string;
  };
  inspectorUrl?: string;
}

interface VercelResponse {
  deployments: VercelDeployment[];
  pagination?: {
    count: number;
    next: number | null;
    prev: number | null;
  };
}

export async function GET(request: NextRequest) {
  const token = getCredential('vercel');
  
  if (!token) {
    return NextResponse.json(
      { error: 'Vercel token not configured. Add it in Settings → Credentials.' },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const teamId = searchParams.get('teamId');
  const limit = searchParams.get('limit') || '10';
  const state = searchParams.get('state'); // BUILDING,READY,ERROR etc.

  try {
    // Build query params
    const params = new URLSearchParams();
    params.set('limit', limit);
    if (projectId) params.set('projectId', projectId);
    if (teamId) params.set('teamId', teamId);
    if (state) params.set('state', state);

    const response = await fetch(`${VERCEL_API}/v6/deployments?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vercel API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Vercel API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data: VercelResponse = await response.json();

    // Transform to a cleaner format for the widget
    const deployments = data.deployments.map((d) => ({
      id: d.uid,
      project: d.name,
      url: `https://${d.url}`,
      status: d.state.toLowerCase() as 'building' | 'error' | 'ready' | 'queued' | 'canceled' | 'initializing',
      createdAt: new Date(d.created).toISOString(),
      branch: d.meta?.githubCommitRef,
      commitMessage: d.meta?.githubCommitMessage,
      author: d.meta?.githubCommitAuthorName || d.creator?.username,
      inspectorUrl: d.inspectorUrl,
    }));

    return NextResponse.json({
      deployments,
      count: deployments.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to fetch Vercel deployments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deployments' },
      { status: 500 }
    );
  }
}
