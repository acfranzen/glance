'use client';

import { DashboardGrid } from '@/components/dashboard/DashboardGrid';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6">
        <DashboardGrid />
      </main>
    </div>
  );
}
