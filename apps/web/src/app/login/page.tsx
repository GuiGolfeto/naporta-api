import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/login-form';
import { readSession } from '@/lib/session';

export const metadata = {
  title: 'Entrar — naPorta',
};

/** Tela de login. */
export default async function LoginPage() {
  const session = await readSession();

  if (session) {
    redirect('/');
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Entrar na naPorta</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">
          Use as credenciais da sua conta para gerenciar os pedidos.
        </p>

        <LoginForm />
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        Ambiente de demonstração: <code>admin@naporta.local</code> / <code>Admin@1234</code>
      </p>
    </div>
  );
}
