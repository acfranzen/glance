import { redirect } from 'next/navigation';

export default function HomePage() {
  // Single-user dashboard - no auth needed, just go to dashboard
  redirect('/dashboard');
}
