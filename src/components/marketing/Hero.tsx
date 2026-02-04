'use client';

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Copy } from "lucide-react";

export function Hero() {
  const [copied, setCopied] = useState(false);
  const installCommand = "curl -fsSL https://openglance.dev/install.sh | bash";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(installCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  return (
    <section className="relative flex flex-col items-center justify-center px-4 py-24 text-center">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.6171_0.1375_39.0427_/_0.12),transparent)]" />

      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm text-foreground">
        <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
        Introducing Glance for OpenClaw
      </div>

      <h1 className="max-w-4xl text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
        The Dashboard Skill for <span className="text-primary">OpenClaw</span>
      </h1>

      <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
        Stop configuring dashboards. Just tell OpenClaw what you want to see.
      </p>

      <p className="mt-4 max-w-xl text-balance text-muted-foreground">
        Glance gives your OpenClaw agent a canvas to build, update, and read
        widgets — so you never have to configure a dashboard again.
      </p>

      {/* Install Command */}
      <div className="mt-10">
        <div className="relative group inline-block">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-primary/30 rounded-lg blur opacity-30 group-hover:opacity-100 transition duration-300" />
          <div className="relative flex items-center gap-3 rounded-lg border border-primary/20 bg-card/95 backdrop-blur-sm px-4 py-3 font-mono text-sm">
            <code className="text-foreground">
              {installCommand}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopy}
              className="shrink-0 gap-2 hover:bg-primary/10 -mr-1"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          One command to install. Works on macOS and Linux.
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-4 sm:flex-row">
        <Button asChild size="lg" className="gap-2 shadow-lg shadow-primary/20">
          <Link href="#get-started">
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="https://github.com/acfranzen/glance" target="_blank">
            View on GitHub
          </Link>
        </Button>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        100% open source · MIT License
      </p>

      {/* Dashboard Preview */}
      <div className="mt-16 w-full max-w-5xl px-4">
        <div className="relative rounded-xl border border-border/50 bg-card/50 p-2 shadow-2xl">
          <div className="overflow-hidden rounded-lg">
            <Image
              src="/glance.png?v=2"
              alt="Glance Dashboard"
              width={2560}
              height={1440}
              className="w-full h-auto"
              priority
              unoptimized
            />
          </div>
        </div>
      </div>
    </section>
  );
}
