import { MessageCircle, Cpu, LayoutDashboard } from "lucide-react";

const steps = [
  {
    icon: MessageCircle,
    step: "01",
    title: "You ask",
    description:
      "Tell OpenClaw what you want to see in plain English. No syntax to learn.",
  },
  {
    icon: Cpu,
    step: "02",
    title: "OpenClaw builds",
    description:
      "The agent interprets your request and constructs the widget automatically.",
  },
  {
    icon: LayoutDashboard,
    step: "03",
    title: "Widget appears",
    description: "Your dashboard updates instantly with the new visualization.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-y border-border bg-card/50 px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From question to dashboard in seconds.
          </p>
        </div>

        <div className="relative grid gap-12 md:grid-cols-3 md:gap-8">
          {/* Connection line */}
          <div className="absolute left-0 right-0 top-20 hidden h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent md:block" />

          {steps.map((step, index) => (
            <div key={step.title} className="relative text-center">
              <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 shadow-sm">
                <step.icon className="h-12 w-12 text-primary" />
              </div>
              <div className="mb-3 inline-flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-muted-foreground">
                  Step {step.step}
                </span>
              </div>
              <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
