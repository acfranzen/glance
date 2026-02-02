import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
            <span className="text-sm font-bold text-primary-foreground">G</span>
          </div>
          <span className="text-xl font-bold tracking-tight">Glance</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="#features"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </Link>
          <Link
            href="#how-it-works"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </Link>
          <Link
            href="#get-started"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Get Started
          </Link>
          <Link
            href="https://github.com/acfranzen/glance"
            target="_blank"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </Link>
        </nav>

        <Button asChild size="sm">
          <Link href="/dashboard">Open Dashboard</Link>
        </Button>
      </div>
    </header>
  );
}
