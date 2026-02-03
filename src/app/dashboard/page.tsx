'use client';

import { DashboardGrid } from '@/components/dashboard/DashboardGrid';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Terminal, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// NEXT_PUBLIC_VERCEL_ENV is set automatically by Vercel (production, preview, or development)
const isProduction = !!process.env.NEXT_PUBLIC_VERCEL_ENV;

function ProductionMessage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Terminal className="h-8 w-8 text-primary" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">
            Glance runs locally
          </h1>
          <p className="text-muted-foreground">
            Glance is a local-first dashboard that stores your data securely on your machine. 
            To use Glance, run it locally with Docker or npm.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 text-left">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Quick start with Docker:</p>
          <pre className="overflow-x-auto text-sm">
            <code className="text-foreground">git clone https://github.com/acfranzen/glance.git && cd glance && docker compose up</code>
          </pre>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild variant="outline">
            <Link href="/" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </Button>
          <Button asChild>
            <Link href="https://github.com/acfranzen/glance" target="_blank">
              View on GitHub
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  if (isProduction) {
    return <ProductionMessage />;
  }

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      <DashboardHeader />
      <main className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 pb-16">
        <DashboardGrid />
      </main>
    </div>
  );
}
