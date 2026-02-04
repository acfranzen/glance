"use client";

import { useState } from "react";
import { useWidgetStore } from "@/lib/store/widget-store";
import { AddWidgetModal } from "./AddWidgetModal";
import { ThemeImportModal } from "./ThemeImportModal";
import { WidgetImportModal } from "./WidgetImportModal";
import { DashboardExportModal } from "./DashboardExportModal";
import { DashboardImportModal } from "./DashboardImportModal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pencil,
  Check,
  Sun,
  Moon,
  Menu,
  X,
  Key,
  Palette,
  Upload,
  Download,
  FolderDown,
  FolderUp,
  MoreHorizontal,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { CredentialsModal } from "./CredentialsModal";

export function DashboardHeader() {
  const { isEditing, setEditing, refreshWidgets } = useWidgetStore();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dashboardExportOpen, setDashboardExportOpen] = useState(false);
  const [dashboardImportOpen, setDashboardImportOpen] = useState(false);

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        {/* Logo */}
        <div className="flex items-center gap-2 sm:gap-4">
          <h1 className="font-serif text-xl sm:text-2xl font-bold text-foreground">
            Glance
          </h1>
          <span className="hidden sm:inline text-xs text-muted-foreground">
            OpenClaw&apos;s visual command center.
          </span>
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2">
          <AddWidgetModal />

          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            title="Import Widget Package"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>

          <Button
            variant={isEditing ? "default" : "outline"}
            onClick={() => setEditing(!isEditing)}
          >
            {isEditing ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Done
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCredentialsOpen(true)}
            title="Manage API Keys"
          >
            <Key className="h-4 w-4" />
          </Button>

          <ThemeImportModal />

          {/* Dashboard Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" title="Dashboard Options">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDashboardExportOpen(true)}>
                <FolderDown className="h-4 w-4 mr-2" />
                Export Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDashboardImportOpen(true)}>
                <FolderUp className="h-4 w-4 mr-2" />
                Import Dashboard
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title="Toggle light/dark mode"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex md:hidden items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-300 ease-in-out",
          mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="px-4 py-4 space-y-3 border-t bg-card/80">
          <div className="space-y-2">
            <AddWidgetModal />

            <Button
              variant="outline"
              onClick={() => {
                setImportOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full justify-start"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Widget
            </Button>

            <Button
              variant={isEditing ? "default" : "outline"}
              onClick={() => {
                setEditing(!isEditing);
                setMobileMenuOpen(false);
              }}
              className="w-full justify-start"
            >
              {isEditing ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Done Editing
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Layout
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setCredentialsOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full justify-start"
            >
              <Key className="h-4 w-4 mr-2" />
              API Keys
            </Button>

            <ThemeImportModal
              trigger={
                <Button variant="outline" className="w-full justify-start">
                  <Palette className="h-4 w-4 mr-2" />
                  Theme Settings
                </Button>
              }
            />

            <div className="border-t pt-2 mt-2">
              <p className="text-xs text-muted-foreground mb-2 px-1">Dashboard</p>
              <Button
                variant="outline"
                onClick={() => {
                  setDashboardExportOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full justify-start"
              >
                <FolderDown className="h-4 w-4 mr-2" />
                Export Dashboard
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDashboardImportOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full justify-start mt-2"
              >
                <FolderUp className="h-4 w-4 mr-2" />
                Import Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>

      <CredentialsModal
        open={credentialsOpen}
        onOpenChange={setCredentialsOpen}
      />

      <WidgetImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImportComplete={() => {
          refreshWidgets();
        }}
      />

      <DashboardExportModal
        open={dashboardExportOpen}
        onOpenChange={setDashboardExportOpen}
      />

      <DashboardImportModal
        open={dashboardImportOpen}
        onOpenChange={setDashboardImportOpen}
        onImportComplete={() => {
          refreshWidgets();
        }}
      />
    </header>
  );
}
