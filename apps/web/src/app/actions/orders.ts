'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import type { CreateOrderInput, Order, OrderStatus, UpdateOrderInput } from '@naporta/contracts';

import { apiRequest, extractMessage } from '@/lib/api-client';
import { ACCESS_TOKEN_COOKIE } from '@/lib/session';

/** Resultado de uma ação de pedido. */
export interface OrderActionResult {
  error?: string;
  /** Id do pedido criado (quando a ação é de criação). */
  orderId?: string;
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

/** Converte o erro da API em um resultado de ação. */
function toResult(error: unknown): OrderActionResult {
  const body = (error as { body?: { message?: string | string[] } }).body;
  const message = extractMessage((body as never) ?? null);

  return { error: message ?? 'Não foi possível concluir a operação. Tente novamente.' };
}

/** Cria um pedido. */
export async function createOrderAction(payload: CreateOrderInput): Promise<OrderActionResult> {
  const token = await currentToken();

  try {
    const order = await apiRequest<Order>('/orders', {
      method: 'POST',
      json: payload,
      token,
    });

    revalidatePath('/');

    return { orderId: order.id };
  } catch (error) {
    return toResult(error);
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
  payload: UpdateOrderInput,
): Promise<OrderActionResult> {
  const token = await currentToken();

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
    return toResult(error);
  }
}

/** Exclui um pedido (exclusão lógica). */
export async function deleteOrderAction(orderId: string): Promise<void> {
  const token = await currentToken();

  await apiRequest<null>(`/orders/${orderId}`, { method: 'DELETE', token });

  revalidatePath('/');

  redirect('/');
}
