import type { Metadata } from 'next';

import { AppHeader } from '@/components/app-header';
import { SessionProvider } from '@/components/session-provider';

import { readSession } from '@/lib/session';

import './globals.css';

export const metadata: Metadata = {
  title: 'naPorta — portal de pedidos',
  description: 'Gestão de pedidos de entrega da naPorta',
};

/**
 * Layout raiz.
 *
 * É um Server Component: lê a sessão nos cookies `httpOnly` e entrega o
 * access token ao provedor de sessão do cliente (que o mantém em memória).
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();

  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <SessionProvider accessToken={session?.accessToken ?? null}>
          <AppHeader user={session?.user ?? null} />
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
        </SessionProvider>
      </body>
    </html>
  );
}
