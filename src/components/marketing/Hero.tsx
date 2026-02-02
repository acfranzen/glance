import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative flex min-h-[80vh] flex-col items-center justify-center px-4 py-24 text-center">
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
    </section>
  );
}
