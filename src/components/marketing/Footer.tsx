import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="border-t border-border px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2.5">
            <Image
              src="/icon.svg"
              alt="Glance"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="text-xl font-bold tracking-tight">Glance</span>
          </div>

          <p className="text-sm text-muted-foreground">
            The Dashboard Skill for OpenClaw
          </p>

          <nav className="flex gap-6">
            <Link
              href="/dashboard"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="https://github.com/acfranzen/glance"
              target="_blank"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              GitHub
            </Link>
            <Link
              href="https://clawhub.com"
              target="_blank"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              ClawHub
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
