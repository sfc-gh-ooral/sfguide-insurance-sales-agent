import type { Metadata } from 'next';
import './globals.css';
import { AppStateProvider } from '@/components/AppState';
import Shell from '@/components/Shell';

export const metadata: Metadata = {
  title: 'Insurance Sales Performance Agent',
  description: 'Explain loss ratios, dealer performance, and market share in plain English (synthetic data example).',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppStateProvider>
          <Shell>{children}</Shell>
        </AppStateProvider>
      </body>
    </html>
  );
}
