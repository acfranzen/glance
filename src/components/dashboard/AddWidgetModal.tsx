'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useWidgetStore } from '@/lib/store/widget-store';
import { WIDGET_DEFINITIONS, type WidgetType } from '@/types/widget';
import { Plus, Zap, Code2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CustomWidgetDefinition {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  default_size: { w: number; h: number };
}

const iconMap: Record<string, React.ReactNode> = {
  Zap: <Zap className="h-6 w-6" />,
  Code2: <Code2 className="h-6 w-6" />,
};

export function AddWidgetModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [customWidgets, setCustomWidgets] = useState<CustomWidgetDefinition[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const { addWidget, addCustomWidget } = useWidgetStore();

  // Fetch custom widgets when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoadingCustom(true);
      fetch('/api/widgets')
        .then(res => res.json())
        .then(data => {
          setCustomWidgets(data.custom_widgets || []);
        })
        .catch(err => {
          console.error('Failed to fetch custom widgets:', err);
        })
        .finally(() => {
          setLoadingCustom(false);
        });
    }
  }, [isOpen]);

  const handleAddWidget = async (type: WidgetType) => {
    try {
      await addWidget(type);
      setIsOpen(false);
      toast.success('Widget added to dashboard');
    } catch (error) {
      console.error('Failed to add widget:', error);
      toast.error('Failed to add widget');
    }
  };

  const handleAddCustomWidget = async (customWidget: CustomWidgetDefinition) => {
    try {
      await addCustomWidget(customWidget.id, customWidget.name, customWidget.default_size);
      setIsOpen(false);
      toast.success(`${customWidget.name} added to dashboard`);
    } catch (error) {
      console.error('Failed to add custom widget:', error);
      toast.error('Failed to add widget');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          Add Widget
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Add Widget</DialogTitle>
          <DialogDescription>
            Choose a widget to add to your dashboard
          </DialogDescription>
        </DialogHeader>
        
        {/* Built-in Widgets */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Built-in Widgets</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {WIDGET_DEFINITIONS.map((widget) => (
              <button
                key={widget.type}
                onClick={() => handleAddWidget(widget.type)}
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border',
                  'hover:bg-accent hover:border-primary/50 transition-colors',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2'
                )}
              >
                <div className="text-primary">
                  {iconMap[widget.icon] || <Zap className="h-6 w-6" />}
                </div>
                <div className="text-sm font-medium">{widget.name}</div>
                <div className="text-xs text-muted-foreground text-center">
                  {widget.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Widgets */}
        <div className="space-y-3 pt-4 border-t">
          <h3 className="text-sm font-medium text-muted-foreground">Custom Widgets</h3>
          {loadingCustom ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : customWidgets.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {customWidgets.map((widget) => (
                <button
                  key={widget.id}
                  onClick={() => handleAddCustomWidget(widget)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-lg border',
                    'hover:bg-accent hover:border-primary/50 transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                    'border-dashed'
                  )}
                >
                  <div className="text-primary">
                    <Code2 className="h-6 w-6" />
                  </div>
                  <div className="text-sm font-medium">{widget.name}</div>
                  <div className="text-xs text-muted-foreground text-center line-clamp-2">
                    {widget.description || 'Custom widget'}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No custom widgets available.
              <br />
              <span className="text-xs">
                Create one via the API or ask your AI assistant.
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
