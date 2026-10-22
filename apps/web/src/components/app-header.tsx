'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { logoutAction } from '@/app/actions/auth';
import type { AuthUser } from '@naporta/contracts';

/** Link da navegação principal. */
function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {label}
    </Link>
  );
}

/** Cabeçalho do portal: marca, navegação e ações do usuário. */
export function AppHeader({ user }: { user: AuthUser | null }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-800 bg-slate-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-sm font-bold text-slate-900">
            nP
          </span>
          <span className="text-lg font-semibold text-white">naPorta</span>
        </Link>

        {user ? (
          <>
            <nav className="flex items-center gap-1">
              <NavLink href="/" label="Pedidos" active={pathname === '/'} />
              <NavLink href="/orders/new" label="Novo pedido" active={pathname === '/orders/new'} />
            </nav>

            <div className="ml-auto flex items-center gap-3">
              <div className="text-right leading-tight">
                <p className="text-sm font-medium text-white">{user.name}</p>
                <p className="text-xs text-slate-400">{user.role}</p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                >
                  Sair
                </button>
              </form>
            </div>
          </>
        ) : (
          <Link
            href="/login"
            className="ml-auto rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-emerald-400"
          >
            Entrar
          </Link>
        )}
      </div>
    </header>
  );
}
