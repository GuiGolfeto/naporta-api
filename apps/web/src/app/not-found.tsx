import Link from 'next/link';

/** Página de "não encontrado" do portal. */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-medium text-emerald-700">404</p>
      <h1 className="mt-1 text-lg font-semibold text-slate-900">Pedido não encontrado</h1>
      <p className="mt-2 text-sm text-slate-600">
        O pedido pode ter sido excluído ou o endereço está incorreto.
      </p>

      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
      >
        Voltar para os pedidos
      </Link>
    </div>
  );
}
