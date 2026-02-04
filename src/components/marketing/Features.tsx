import { MessageSquare, Shield, Sparkles, RefreshCw } from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "Natural Language Widgets",
    description:
      "OpenClaw builds widgets via natural language — no coding, no config files.",
  },
  {
    icon: Shield,
    title: "Encrypted Credentials",
    description:
      "OpenClaw manages credentials in encrypted SQLite — no .env files to edit.",
  },
  {
    icon: Sparkles,
    title: "AI-Summarized Insights",
    description: "OpenClaw reads your dashboard and summarizes what matters.",
  },
  {
    icon: RefreshCw,
    title: "Automatic Updates",
    description:
      "OpenClaw updates widgets on heartbeats — your dashboard stays fresh automatically.",
  },
];

export function Features() {
  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            See all of your data, in any form you can imagine
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Powerful features that let you focus on insights, not configuration.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative rounded-2xl border border-border bg-card p-8 transition-all hover:border-primary/30 hover:shadow-lg"
            >
              <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                <feature.icon className="h-7 w-7 text-primary" />
              </div>
              <h3 className="mb-3 text-lg font-semibold">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
