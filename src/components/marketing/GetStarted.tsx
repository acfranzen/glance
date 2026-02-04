'use client';

import { useState } from "react";
import { Terminal, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// NEXT_PUBLIC_VERCEL_ENV is set automatically by Vercel (production, preview, or development)
const isProduction = !!process.env.NEXT_PUBLIC_VERCEL_ENV;

const installCommand = `curl -fsSL https://openglance.dev/install.sh | bash`;

const dockerCommand = `git clone https://github.com/acfranzen/glance.git && cd glance && docker compose up`;

const manualCommands = `git clone https://github.com/acfranzen/glance.git
cd glance
pnpm install
pnpm dev`;

const openClawConfig = `### Glance Dashboard

- URL: http://localhost:3333
- Auth: Bearer <your-token>
- API: POST /api/widgets to create widgets
- API: POST /api/credentials to store API keys`;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleCopy}
      className="absolute right-2 top-2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}

export function GetStarted() {
  return (
    <section id="get-started" className="px-4 py-24">
      <div className="mx-auto max-w-4xl">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Get started in minutes
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Three steps to your AI-powered dashboard.
          </p>
        </div>

        <div className="space-y-12">
          {/* Step 1: Install */}
          <div className="relative">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                1
              </span>
              <h3 className="text-xl font-semibold">Install Glance</h3>
            </div>

            <div className="ml-11 space-y-4">
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Terminal className="h-4 w-4" />
                  Option A: One-liner (Recommended)
                </div>
                <div className="group relative">
                  <pre className="overflow-x-auto rounded-lg border border-primary/30 bg-card p-4 text-sm">
                    <code className="text-foreground">{installCommand}</code>
                  </pre>
                  <CopyButton text={installCommand} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Installs dependencies, sets up as a background service (launchd on macOS, systemd on Linux), and opens the dashboard.
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Terminal className="h-4 w-4" />
                  Option B: Docker
                </div>
                <div className="group relative">
                  <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 text-sm">
                    <code className="text-foreground">{dockerCommand}</code>
                  </pre>
                  <CopyButton text={dockerCommand} />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Terminal className="h-4 w-4" />
                  Option C: Manual
                </div>
                <div className="group relative">
                  <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 text-sm">
                    <code className="text-foreground whitespace-pre">
                      {manualCommands}
                    </code>
                  </pre>
                  <CopyButton text={manualCommands} />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Open{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                  http://localhost:3333
                </code>
                . On first run, Glance auto-generates a secure encryption key.
                Your data is stored locally.
              </p>
            </div>
          </div>

          {/* Step 2: Configure OpenClaw */}
          <div className="relative">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                2
              </span>
              <h3 className="text-xl font-semibold">Tell OpenClaw About It</h3>
            </div>

            <div className="ml-11">
              <p className="mb-3 text-sm text-muted-foreground">
                Add to your OpenClaw workspace (TOOLS.md or memory):
              </p>
              <div className="group relative">
                <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 text-sm">
                  <code className="text-foreground whitespace-pre">
                    {openClawConfig}
                  </code>
                </pre>
                <CopyButton text={openClawConfig} />
              </div>
            </div>
          </div>

          {/* Step 3: Use It */}
          <div className="relative">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                3
              </span>
              <h3 className="text-xl font-semibold">Start Using It</h3>
            </div>

            <div className="ml-11 space-y-4">
              <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex gap-3">
                  <span className="shrink-0 font-medium text-primary">
                    You:
                  </span>
                  <span className="text-muted-foreground">
                    &quot;OpenClaw, add a widget showing my GitHub PRs&quot;
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="shrink-0 font-medium text-foreground">
                    OpenClaw:
                  </span>
                  <span className="italic text-muted-foreground">
                    *creates the widget, stores your GitHub token, adds it to
                    the dashboard*
                  </span>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex gap-3">
                  <span className="shrink-0 font-medium text-primary">
                    You:
                  </span>
                  <span className="text-muted-foreground">
                    &quot;What needs my attention?&quot;
                  </span>
                </div>
                <div className="flex gap-3">
                  <span className="shrink-0 font-medium text-foreground">
                    OpenClaw:
                  </span>
                  <span className="text-muted-foreground">
                    &quot;You have 3 PRs waiting for review. One has failing
                    CI.&quot;
                  </span>
                </div>
              </div>

              <p className="text-center text-sm font-medium text-muted-foreground">
                That&apos;s it. OpenClaw handles the rest.
              </p>
            </div>
          </div>
        </div>

        {/* CTA after steps */}
        <div className="mt-16 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {!isProduction && (
            <Button
              asChild
              size="lg"
              className="gap-2 shadow-lg shadow-primary/20"
            >
              <Link href="/dashboard">Open Dashboard</Link>
            </Button>
          )}
          <Button asChild variant={isProduction ? "default" : "outline"} size="lg" className={isProduction ? "shadow-lg shadow-primary/20" : ""}>
            <Link href="https://github.com/acfranzen/glance" target="_blank">
              {isProduction ? "Clone on GitHub" : "View on GitHub"}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
