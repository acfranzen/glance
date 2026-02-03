"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Link, Code, Trash2, Loader2 } from "lucide-react";
import { useCustomTheme } from "@/components/ThemeManager";

interface ParsedTheme {
  name: string;
  lightCss: string;
  darkCss: string;
}

// Extract CSS variables for :root and .dark from CSS text
function parseCssTheme(cssText: string): { lightCss: string; darkCss: string } {
  // Extract :root block
  const rootMatch = cssText.match(/:root\s*\{([^}]+)\}/);
  const lightCss = rootMatch ? `:root { ${rootMatch[1].trim()} }` : "";

  // Extract .dark block
  const darkMatch = cssText.match(/\.dark\s*\{([^}]+)\}/);
  const darkCss = darkMatch ? `.dark { ${darkMatch[1].trim()} }` : "";

  return { lightCss, darkCss };
}

// Extract URL from npx command
function extractUrlFromCommand(command: string): string | null {
  const urlMatch = command.match(/https?:\/\/[^\s]+\.json/);
  return urlMatch ? urlMatch[0] : null;
}

// Fetch theme from tweakcn URL
async function fetchTweakcnTheme(url: string): Promise<ParsedTheme> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch theme: ${response.statusText}`);
  }

  const data = await response.json();

  // tweakcn JSON format has cssVars with light and dark keys
  if (data.cssVars) {
    const lightVars = data.cssVars.light || {};
    const darkVars = data.cssVars.dark || {};

    const lightCss =
      Object.keys(lightVars).length > 0
        ? `:root { ${Object.entries(lightVars)
            .map(([k, v]) => `--${k}: ${v};`)
            .join(" ")} }`
        : "";

    const darkCss =
      Object.keys(darkVars).length > 0
        ? `.dark { ${Object.entries(darkVars)
            .map(([k, v]) => `--${k}: ${v};`)
            .join(" ")} }`
        : "";

    return {
      name: data.name || "Imported Theme",
      lightCss,
      darkCss,
    };
  }

  throw new Error("Invalid theme format");
}

interface ThemeImportModalProps {
  trigger?: React.ReactNode;
}

export function ThemeImportModal({ trigger }: ThemeImportModalProps) {
  const [open, setOpen] = useState(false);
  const [themeName, setThemeName] = useState("");
  const [urlOrCommand, setUrlOrCommand] = useState("");
  const [cssInput, setCssInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { saveTheme, clearTheme } = useCustomTheme();

  const handleImportFromUrl = useCallback(async () => {
    if (!urlOrCommand.trim()) {
      toast.error("Please enter a URL or npx command");
      return;
    }

    setLoading(true);
    try {
      let url = urlOrCommand.trim();

      // Check if it's an npx command
      if (url.startsWith("npx")) {
        const extractedUrl = extractUrlFromCommand(url);
        if (!extractedUrl) {
          toast.error("Could not extract URL from command");
          return;
        }
        url = extractedUrl;
      }

      const theme = await fetchTweakcnTheme(url);
      await saveTheme(
        themeName.trim() || theme.name,
        theme.lightCss,
        theme.darkCss,
      );

      toast.success(
        `Theme "${themeName.trim() || theme.name}" imported successfully`,
      );
      setOpen(false);
      resetForm();
    } catch (error) {
      console.error("Failed to import theme:", error);
      toast.error(
        "Failed to import theme. Please check the URL and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [urlOrCommand, themeName, saveTheme]);

  const handleImportFromCss = useCallback(async () => {
    if (!cssInput.trim()) {
      toast.error("Please paste your CSS theme");
      return;
    }

    if (!themeName.trim()) {
      toast.error("Please enter a theme name");
      return;
    }

    setLoading(true);
    try {
      const { lightCss, darkCss } = parseCssTheme(cssInput);

      if (!lightCss && !darkCss) {
        toast.error(
          "Could not parse CSS. Make sure it contains :root and/or .dark blocks.",
        );
        return;
      }

      await saveTheme(themeName.trim(), lightCss, darkCss);
      toast.success(`Theme "${themeName.trim()}" imported successfully`);
      setOpen(false);
      resetForm();
    } catch (error) {
      console.error("Failed to import theme:", error);
      toast.error("Failed to import theme. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [cssInput, themeName, saveTheme]);

  const handleClearTheme = useCallback(async () => {
    setLoading(true);
    try {
      await clearTheme();
      toast.success("Theme cleared successfully");
      setOpen(false);
    } catch (error) {
      console.error("Failed to clear theme:", error);
      toast.error("Failed to clear theme");
    } finally {
      setLoading(false);
    }
  }, [clearTheme]);

  const resetForm = () => {
    setThemeName("");
    setUrlOrCommand("");
    setCssInput("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" title="Theme Settings">
            <Palette className="h-4 w-4" />
            <span className="sr-only">Theme Settings</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Theme</DialogTitle>
          <DialogDescription>
            Import a custom theme from tweakcn.com or paste CSS directly.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="url" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              URL / Command
            </TabsTrigger>
            <TabsTrigger value="css" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              Paste CSS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="theme-name-url">Theme Name (optional)</Label>
              <Input
                id="theme-name-url"
                placeholder="My Custom Theme"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url-input">URL or npx command</Label>
              <Input
                id="url-input"
                placeholder="npx shadcn@latest add https://tweakcn.com/r/themes/..."
                value={urlOrCommand}
                onChange={(e) => setUrlOrCommand(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Paste the full npx command or just the JSON URL from tweakcn.com
              </p>
            </div>
            <Button
              onClick={handleImportFromUrl}
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import Theme"
              )}
            </Button>
          </TabsContent>

          <TabsContent value="css" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="theme-name-css">Theme Name</Label>
              <Input
                id="theme-name-css"
                placeholder="My Custom Theme"
                value={themeName}
                onChange={(e) => setThemeName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="css-input">CSS Theme</Label>
              <textarea
                id="css-input"
                className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                placeholder={`:root {
  --background: oklch(0.985 0 0);
  --foreground: oklch(0.145 0 0);
  ...
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  ...
}`}
                value={cssInput}
                onChange={(e) => setCssInput(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Paste the CSS with :root and .dark blocks from tweakcn.com
              </p>
            </div>
            <Button
              onClick={handleImportFromCss}
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import Theme"
              )}
            </Button>
          </TabsContent>
        </Tabs>

        <div className="border-t pt-4 mt-4">
          <Button
            variant="outline"
            onClick={handleClearTheme}
            className="w-full text-destructive hover:text-destructive"
            disabled={loading}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Reset to Default Theme
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
