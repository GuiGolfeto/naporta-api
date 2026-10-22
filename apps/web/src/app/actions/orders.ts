'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import type { CreateOrderInput, Order, OrderStatus, UpdateOrderInput } from '@naporta/contracts';

import { apiRequest, extractMessage } from '@/lib/api-client';
import { ACCESS_TOKEN_COOKIE } from '@/lib/session';

/** Estado devolvido por uma Server Action de formulário. */
export interface OrderActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** Token da sessão atual (lido dos cookies `httpOnly`). */
async function currentToken(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    redirect('/login');
  }

  return token;
}

/** Converte o erro da API em um estado de formulário. */
function toState(error: unknown): OrderActionState {
  const body = (error as { body?: { message?: string | string[] } }).body;
  const message = extractMessage((body as never) ?? null);

  return { error: message ?? 'Não foi possível concluir a operação. Tente novamente.' };
}

/** Cria um pedido. */
export async function createOrderAction(
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const token = await currentToken();

  const payload: CreateOrderInput = {
    expectedDeliveryDate: String(formData.get('expectedDeliveryDate') ?? ''),
    customerName: String(formData.get('customerName') ?? ''),
    customerDocument: String(formData.get('customerDocument') ?? '').replace(/\D/g, ''),
    address: {
      street: String(formData.get('street') ?? ''),
      number: String(formData.get('number') ?? ''),
      neighborhood: String(formData.get('neighborhood') ?? ''),
      city: String(formData.get('city') ?? ''),
      state: String(formData.get('state') ?? '').toUpperCase(),
      zipCode: String(formData.get('zipCode') ?? '').replace(/\D/g, ''),
      ...(formData.get('complement') ? { complement: String(formData.get('complement')) } : {}),
    },
    items: parseItems(formData),
  };

  try {
    const order = await apiRequest<Order>('/orders', {
      method: 'POST',
      json: payload,
      token,
    });

    revalidatePath('/');

    redirect(`/orders/${order.id}`);
  } catch (error) {
    if (isRedirect(error)) {
      throw error;
    }

    return toState(error);
  }
}

/** Altera o status de um pedido. */
export async function changeOrderStatusAction(orderId: string, status: OrderStatus): Promise<void> {
  const token = await currentToken();

  await apiRequest<Order>(`/orders/${orderId}`, {
    method: 'PATCH',
    json: { status },
    token,
  });

  revalidatePath('/');
  revalidatePath(`/orders/${orderId}`);
}

/** Atualiza os dados de um pedido. */
export async function updateOrderAction(
  orderId: string,
  _previous: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const token = await currentToken();

  const payload: UpdateOrderInput = {
    customerName: String(formData.get('customerName') ?? ''),
    customerDocument: String(formData.get('customerDocument') ?? '').replace(/\D/g, ''),
    expectedDeliveryDate: String(formData.get('expectedDeliveryDate') ?? ''),
    items: parseItems(formData),
  };

  try {
    await apiRequest<Order>(`/orders/${orderId}`, {
      method: 'PATCH',
      json: payload,
      token,
    });

    revalidatePath('/');
    revalidatePath(`/orders/${orderId}`);

    return {};
  } catch (error) {
    return toState(error);
  }
}

/** Exclui um pedido (exclusão lógica). */
export async function deleteOrderAction(orderId: string): Promise<void> {
  const token = await currentToken();

  await apiRequest<null>(`/orders/${orderId}`, { method: 'DELETE', token });

  revalidatePath('/');

  redirect('/');
}

/** Lê os itens do formulário (`items[]` com campos paralelos). */
function parseItems(formData: FormData): CreateOrderInput['items'] {
  const descriptions = formData.getAll('itemDescription').map(String);
  const quantities = formData.getAll('itemQuantity').map(String);
  const prices = formData.getAll('itemUnitPrice').map(String);

  const items: CreateOrderInput['items'] = [];

  for (let index = 0; index < descriptions.length; index += 1) {
    const description = descriptions[index]?.trim() ?? '';
    const quantity = Number(quantities[index] ?? '0');
    const unitPrice = prices[index]?.trim() ?? '';

    if (!description) {
      continue;
    }

    items.push({ description, quantity, unitPrice });
  }

  return items;
}

/** O `redirect()` do Next lança um erro especial — não deve ser tratado. */
function isRedirect(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}
