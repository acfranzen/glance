'use client';

import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical, X, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WidgetContainerProps {
  title: string;
  children: ReactNode;
  isEditing?: boolean;
  onRemove?: () => void;
  onConfigure?: () => void;
  action?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  showHeader?: boolean;
}

export function WidgetContainer({
  title,
  children,
  isEditing,
  onRemove,
  onConfigure,
  action,
  className,
  headerClassName,
  contentClassName,
  showHeader = true,
}: WidgetContainerProps) {
  return (
    <Card className={cn('h-full flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-shadow', className)}>
      {showHeader && (
        <CardHeader className={cn('pb-2 pt-3 px-3 sm:px-4 flex-none', headerClassName)}>
          <div className="flex items-center justify-between min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {isEditing && (
                <div className="cursor-move p-1 -ml-1 rounded hover:bg-accent transition-colors flex-shrink-0">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <CardTitle className="text-sm font-medium truncate">{title}</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              {!isEditing && action}
              {isEditing && (
                <>
                  {onConfigure && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-accent/50"
                      onClick={onConfigure}
                      title="Configure widget"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                  {onRemove && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive opacity-70 hover:opacity-100 transition-opacity"
                      onClick={onRemove}
                      title="Delete widget"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className={cn('flex-1 px-3 sm:px-4 pb-3 sm:pb-4 overflow-auto', !showHeader && 'pt-3 sm:pt-4', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
