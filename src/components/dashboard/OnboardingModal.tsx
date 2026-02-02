'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  LayoutGrid, Palette, Target, Sparkles, ArrowRight, Check,
  Clock, CheckSquare, Calendar, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWidgetStore } from '@/lib/store/widget-store';
import type { WidgetType } from '@/types/widget';

interface OnboardingStep {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

// Widget types that will be available in future (cast for now)
const suggestedWidgets: { type: string; name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'clock', name: 'Clock', icon: Clock },
  { type: 'tasks', name: 'Tasks', icon: CheckSquare },
  { type: 'calendar', name: 'Calendar', icon: Calendar },
  { type: 'notes', name: 'Notes', icon: FileText },
];

export function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>(['clock', 'tasks']);
  const { widgets, addWidget } = useWidgetStore();

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem('glance-onboarding-complete');
    // Only show if no widgets and hasn't seen onboarding
    if (!hasSeenOnboarding && widgets.length === 0) {
      // Small delay so the page loads first
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [widgets.length]);

  const completeOnboarding = async () => {
    // Add selected widgets (cast to WidgetType for future compatibility)
    for (const widgetType of selectedWidgets) {
      await addWidget(widgetType as WidgetType);
    }
    
    localStorage.setItem('glance-onboarding-complete', 'true');
    setIsOpen(false);
  };

  const skipOnboarding = () => {
    localStorage.setItem('glance-onboarding-complete', 'true');
    setIsOpen(false);
  };

  const toggleWidget = (type: string) => {
    setSelectedWidgets(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const steps: OnboardingStep[] = [
    {
      title: 'Welcome to Glance',
      description: 'Your personal productivity dashboard',
      icon: Sparkles,
      content: (
        <div className="space-y-6 py-4">
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 blur-3xl bg-primary/20 rounded-full" />
              <Sparkles className="relative h-20 w-20 text-primary" />
            </div>
          </div>
          <p className="text-center text-muted-foreground">
            A calm, focused space where everything you need is just a glance away.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="text-center p-3 rounded-lg bg-accent/50">
              <LayoutGrid className="h-6 w-6 mx-auto mb-2 text-primary" />
              <span className="text-xs">Customizable</span>
            </div>
            <div className="text-center p-3 rounded-lg bg-accent/50">
              <Palette className="h-6 w-6 mx-auto mb-2 text-primary" />
              <span className="text-xs">Beautiful</span>
            </div>
            <div className="text-center p-3 rounded-lg bg-accent/50">
              <Target className="h-6 w-6 mx-auto mb-2 text-primary" />
              <span className="text-xs">Focused</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Choose Your Widgets',
      description: 'Start with a few essentials',
      icon: LayoutGrid,
      content: (
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground text-center">
            Select the widgets you&apos;d like to start with. You can always add more later.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {suggestedWidgets.map((widget) => {
              const isSelected = selectedWidgets.includes(widget.type);
              return (
                <button
                  key={widget.type}
                  onClick={() => toggleWidget(widget.type)}
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left',
                    isSelected 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  <div className={cn(
                    'p-2 rounded-full transition-colors',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}>
                    {isSelected ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <widget.icon className="h-4 w-4" />
                    )}
                  </div>
                  <span className="font-medium">{widget.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ),
    },
    {
      title: "You're All Set!",
      description: 'Your dashboard is ready',
      icon: Check,
      content: (
        <div className="space-y-6 py-4">
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 blur-2xl bg-green-500/20 rounded-full animate-pulse" />
              <div className="relative p-4 rounded-full bg-green-500/10">
                <Check className="h-12 w-12 text-green-500" />
              </div>
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Your personalized dashboard is ready to go.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Tip:</strong> Click &quot;Edit&quot; to rearrange your widgets anytime.
            </p>
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/10">
              <currentStep.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="font-serif">{currentStep.title}</DialogTitle>
              <DialogDescription>{currentStep.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {currentStep.content}

        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                i === step ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              className="flex-1"
            >
              Back
            </Button>
          )}
          {step === 0 && (
            <Button
              variant="ghost"
              onClick={skipOnboarding}
              className="flex-1"
            >
              Skip
            </Button>
          )}
          {isLastStep ? (
            <Button onClick={completeOnboarding} className="flex-1">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={() => setStep(step + 1)} className="flex-1">
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
