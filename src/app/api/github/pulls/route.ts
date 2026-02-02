import { NextRequest, NextResponse } from "next/server";
import { validateAuthOrInternal } from "@/lib/auth";
import { getCredential } from "@/lib/credentials";

// Server-side proxy for GitHub API - keeps token secure
export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const repos = request.nextUrl.searchParams.get("repos")?.split(",") || [];

  if (repos.length === 0) {
    return NextResponse.json(
      { error: "repos parameter required" },
      { status: 400 },
    );
  }

  // Get token from credential store (falls back to env var)
  const token = getCredential("github");

  if (!token) {
    return NextResponse.json(
      {
        error: "GitHub token not configured. Add it in Settings > Credentials.",
      },
      { status: 500 },
    );
  }

  try {
    interface GitHubPR {
      updated_at: string;
      [key: string]: unknown;
    }

    const results = await Promise.all(
      repos.map(async (repo) => {
        const res = await fetch(
          `https://api.github.com/repos/${repo}/pulls?state=open`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "Glance-Dashboard",
            },
          },
        );
        const data = await res.json();
        if (!Array.isArray(data)) return [] as (GitHubPR & { repo: string })[];
        return data.map((pr: GitHubPR) => ({ ...pr, repo }));
      }),
    );

    const allPRs = results
      .flat()
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );

    return NextResponse.json({ pulls: allPRs });
  } catch (error) {
    console.error("GitHub API error:", error);
    return NextResponse.json({ error: "Failed to fetch PRs" }, { status: 500 });
  }
}
