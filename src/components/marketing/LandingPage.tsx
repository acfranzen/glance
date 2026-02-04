'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  Clock, Cloud, FileText, Bookmark, Calendar, CheckSquare, 
  Target, Timer, Quote, Sun, Moon, Sparkles, ArrowRight,
  LayoutGrid, Palette, Smartphone, Shield, Copy, Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

function InstallCommand() {
  const [copied, setCopied] = useState(false);
  const installCommand = "curl -fsSL https://raw.githubusercontent.com/acfranzen/glance/main/scripts/install.sh | bash";

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
    <div className="w-full">
      <p className="text-sm text-muted-foreground mb-3">Quick Install (macOS & Linux):</p>
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-primary/20 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-300" />
        <div className="relative flex items-center gap-2 rounded-lg border border-primary/20 bg-card/95 backdrop-blur-sm p-3 sm:p-4">
          <code className="flex-1 text-left overflow-x-auto whitespace-nowrap text-xs sm:text-sm font-mono text-foreground">
            {installCommand}
          </code>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="shrink-0 gap-2 hover:bg-primary/10"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                <span className="hidden sm:inline text-xs">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                <span className="hidden sm:inline text-xs">Copy</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

const features = [
  {
    icon: LayoutGrid,
    title: 'Drag & Drop Widgets',
    description: 'Arrange your dashboard exactly how you want. Resize, reposition, and customize every widget.',
  },
  {
    icon: Palette,
    title: 'Beautiful Themes',
    description: 'Light and dark modes with a calming sage green palette that\'s easy on the eyes.',
  },
  {
    icon: Smartphone,
    title: 'Mobile Ready',
    description: 'Your dashboard adapts perfectly to any screen size, from desktop to mobile.',
  },
  {
    icon: Shield,
    title: 'Secure by Default',
    description: 'Your data is encrypted and stored securely. We never sell your information.',
  },
];

const widgets = [
  { icon: Clock, name: 'Clock', description: 'Current time & date' },
  { icon: Cloud, name: 'Weather', description: 'Local conditions' },
  { icon: FileText, name: 'Notes', description: 'Quick thoughts' },
  { icon: Bookmark, name: 'Bookmarks', description: 'Favorite links' },
  { icon: Calendar, name: 'Calendar', description: 'Upcoming events' },
  { icon: CheckSquare, name: 'Tasks', description: 'To-do list' },
  { icon: Target, name: 'Habits', description: 'Daily tracking' },
  { icon: Timer, name: 'Focus Timer', description: 'Pomodoro' },
  { icon: Quote, name: 'Quote', description: 'Daily inspiration' },
];

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);

  return (
    <div className={cn(
      'min-h-screen transition-colors duration-300',
      isDark ? 'dark bg-background' : 'bg-background'
    )}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-serif text-2xl font-bold text-foreground">
            Glance
          </Link>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark(!isDark)}
              className="rounded-full"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/login">
              <Button className="rounded-full">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-8',
            'opacity-0 animate-[fadeInUp_0.6s_ease-out_forwards]'
          )}>
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">Your Personal Command Center</span>
          </div>
          
          <h1 className={cn(
            'font-serif text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight',
            'opacity-0 animate-[fadeInUp_0.6s_ease-out_0.1s_forwards]'
          )}>
            One Glance at
            <br />
            <span className="text-primary">Your Entire Day</span>
          </h1>
          
          <p className={cn(
            'text-xl text-muted-foreground max-w-2xl mx-auto mb-10',
            'opacity-0 animate-[fadeInUp_0.6s_ease-out_0.2s_forwards]'
          )}>
            A beautiful, minimalist dashboard that brings together everything you need. 
            Weather, tasks, calendar, notes — all in one calm, focused space.
          </p>
          
          <div className={cn(
            'flex flex-col sm:flex-row items-center justify-center gap-4 mb-8',
            'opacity-0 animate-[fadeInUp_0.6s_ease-out_0.3s_forwards]'
          )}>
            <Link href="/login">
              <Button size="lg" className="rounded-full px-8 text-lg h-14">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="rounded-full px-8 text-lg h-14">
              View Demo
            </Button>
          </div>

          {/* Install Command */}
          <div className={cn(
            'mt-8 max-w-3xl mx-auto',
            'opacity-0 animate-[fadeInUp_0.6s_ease-out_0.4s_forwards]'
          )}>
            <InstallCommand />
          </div>
        </div>
      </section>

      {/* Dashboard Preview */}
      <section className="px-6 pb-20">
        <div className={cn(
          'max-w-6xl mx-auto rounded-2xl overflow-hidden shadow-2xl border',
          'opacity-0 animate-[fadeInUp_0.8s_ease-out_0.4s_forwards]'
        )}>
          <div className="bg-card p-1">
            {/* Browser Chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 bg-muted rounded-md text-sm text-muted-foreground">
                  glance.app/dashboard
                </div>
              </div>
            </div>
            {/* Dashboard Mock */}
            <div className="p-6 bg-background min-h-[400px]">
              <div className="grid grid-cols-12 gap-4">
                {/* Clock Widget */}
                <div className="col-span-4 bg-card rounded-xl p-6 border">
                  <div className="text-center">
                    <div className="font-serif text-4xl font-light text-foreground">
                      {mounted ? new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '9:41 AM'}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {mounted ? new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : 'Friday, January 31'}
                    </div>
                  </div>
                </div>
                {/* Weather Widget */}
                <div className="col-span-4 bg-card rounded-xl p-6 border">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl font-light">72°</div>
                      <div className="text-sm text-muted-foreground">Partly Cloudy</div>
                    </div>
                    <Cloud className="h-12 w-12 text-muted-foreground/50" />
                  </div>
                </div>
                {/* Tasks Preview */}
                <div className="col-span-4 bg-card rounded-xl p-4 border">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Tasks</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full border-2 border-primary" />
                      <span>Review pull requests</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-3 h-3 rounded-full bg-primary/30" />
                      <span className="line-through">Morning standup</span>
                    </div>
                  </div>
                </div>
                {/* Notes Widget */}
                <div className="col-span-6 bg-card rounded-xl p-4 border">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Quick Notes</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Remember to pick up groceries. Call mom about weekend plans...
                  </div>
                </div>
                {/* Calendar Mini */}
                <div className="col-span-6 bg-card rounded-xl p-4 border">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Today</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-6 rounded-full bg-blue-500" />
                      <div>
                        <div className="text-sm">Team Standup</div>
                        <div className="text-xs text-muted-foreground">9:00 AM</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Widgets Section */}
      <section className="py-20 px-6 bg-card/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl font-bold text-foreground mb-4">
              All Your Widgets, One Place
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose from a growing collection of widgets to build your perfect dashboard.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {widgets.map((widget, i) => (
              <div
                key={widget.name}
                className={cn(
                  'group p-6 rounded-xl bg-card border hover:border-primary/50 transition-all hover:shadow-lg cursor-default',
                  'opacity-0 animate-[fadeInUp_0.4s_ease-out_forwards]'
                )}
                style={{ animationDelay: `${0.1 * i}s` }}
              >
                <widget.icon className="h-8 w-8 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-medium text-foreground mb-1">{widget.name}</h3>
                <p className="text-sm text-muted-foreground">{widget.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl font-bold text-foreground mb-4">
              Built for Focus
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every detail is designed to help you stay calm and productive.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, i) => (
              <div 
                key={feature.title}
                className={cn(
                  'text-center p-6',
                  'opacity-0 animate-[fadeInUp_0.4s_ease-out_forwards]'
                )}
                style={{ animationDelay: `${0.1 * i}s` }}
              >
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary mb-4">
                  <feature.icon className="h-7 w-7" />
                </div>
                <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-primary/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-4xl font-bold text-foreground mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-muted-foreground mb-10">
            Join thousands who start their day with a glance. Free forever for personal use.
          </p>
          <Link href="/login">
            <Button size="lg" className="rounded-full px-10 text-lg h-14">
              Create Your Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t bg-card/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="font-serif text-xl font-bold text-foreground">
            Glance
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Glance. Built with care.
          </p>
          <div className="flex items-center gap-6">
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
              Privacy
            </Link>
            <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
              Terms
            </Link>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
