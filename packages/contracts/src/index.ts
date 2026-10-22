/**
 * Contrato de dados da API naPorta.
 *
 * Tipos compartilhados entre a API (`@naporta/api`) e o portal (`@naporta/web`).
 *
 * A **API é a fonte da verdade** da validação: os DTOs dela é que definem o que
 * é aceito. Aqui ficam os tipos do *contrato* — o formato das respostas e o
 * formato dos payloads de entrada — para que o portal e a API não possam
 * divergir sem que a compilação acuse.
 *
 * As classes de resposta da API implementam estes tipos (`implements`), o que
 * transform qualquer mudança de formato em erro de compilação.
 */

/* ------------------------------------------------------------------ enums -- */

/** Status de um pedido no fluxo de entrega. */
export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Papéis de usuário. */
export const USER_ROLES = ['USER', 'ADMIN'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Campos pelos quais a listagem de pedidos pode ser ordenada. */
export const ORDER_SORT_FIELDS = [
  'createdAt',
  'expectedDeliveryDate',
  'total',
  'number',
  'status',
] as const;

export type OrderSortField = (typeof ORDER_SORT_FIELDS)[number];

/** Direção da ordenação. */
export const ORDER_SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type OrderSortDirection = (typeof ORDER_SORT_DIRECTIONS)[number];

/**
 * Transições de status permitidas.
 *
 * O fluxo normal é PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED.
 * `CANCELLED` é alcançável a partir de qualquer etapa não terminal (um pedido
 * em trânsito pode ser cancelado).
 *
 * Vive no contrato para que a API (que valida) e o portal (que oferece as
 * ações) não discordem do fluxo.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

/**
 * A transição de status é permitida?
 *
 * Manter o mesmo status é permitido (a operação é um no-op idempotente).
 */
export function canTransitionTo(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) {
    return true;
  }

  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

/* -------------------------------------------------------------- respostas -- */

/** Item do pedido. */
export interface OrderItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** Endereço de entrega. */
export interface OrderAddress {
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

/** Cliente do pedido. */
export interface OrderCustomer {
  name: string;
  document: string;
}

/** Usuário que criou o pedido. */
export interface OrderOwner {
  id: string;
  name: string;
}

/** Pedido. */
export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  /** Data prevista de entrega (`YYYY-MM-DD`). */
  expectedDeliveryDate: string;
  customer: OrderCustomer;
  address: OrderAddress | null;
  items: OrderItem[];
  total: number;
  createdBy: OrderOwner;
  createdAt: string;
  updatedAt: string;
}

/** Metainformação de paginação. */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Página de resultados. */
export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Usuário retornado pela API. */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

/** Usuário da listagem administrativa. */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

/** Sessão emitida pela autenticação. */
export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Validade do access token, em segundos. */
  expiresIn: number;
}

/** Formato único de erro da API. */
export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  details?: unknown;
  path: string;
  timestamp: string;
  requestId?: string;
}

/* ----------------------------------------------------------------- entradas -- */

/** Item informado na criação/edição de um pedido. */
export interface OrderItemInput {
  description: string;
  quantity: number;
  /** Aceito como número ou string decimal. */
  unitPrice: string | number;
}

/** Endereço informado na criação/edição de um pedido. */
export interface AddressInput {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  /** Sigla da unidade federativa. */
  state: string;
  /** CEP com 8 dígitos. */
  zipCode: string;
  country?: string;
}

/** Payload de criação de um pedido. */
export interface CreateOrderInput {
  /** Data prevista de entrega (`YYYY-MM-DD`). */
  expectedDeliveryDate: string;
  customerName: string;
  /** CPF ou CNPJ (apenas dígitos). */
  customerDocument: string;
  address: AddressInput;
  items: OrderItemInput[];
}

/** Payload de edição de um pedido (todos os campos são opcionais). */
export interface UpdateOrderInput {
  expectedDeliveryDate?: string;
  customerName?: string;
  customerDocument?: string;
  address?: AddressInput;
  items?: OrderItemInput[];
  status?: OrderStatus;
}

/** Filtros da listagem de pedidos. */
export interface OrderFilters {
  number?: string;
  status?: OrderStatus;
  /** Início do período (data prevista de entrega). */
  startDate?: string;
  /** Fim do período (data prevista de entrega). */
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: OrderSortField;
  order?: OrderSortDirection;
}

/** Credenciais de login. */
export interface LoginInput {
  email: string;
  password: string;
}

/** Payload de cadastro. */
export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

/** Payload de renovação de sessão. */
export interface RefreshInput {
  refreshToken: string;
}
