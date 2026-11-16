import type { Metadata } from 'next';
import './globals.css';
import { AppStateProvider } from '@/components/AppState';
import Shell from '@/components/Shell';

export const metadata: Metadata = {
  title: 'Insurance Sales Performance Agent',
  description: 'Explain loss ratios, dealer performance, and market share in plain English (synthetic data example).',
  icons: { icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%231a6ce7'/%3E%3Cpath d='M8 24V14M14 24V8M20 24v-7M26 24H6' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E" },
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
