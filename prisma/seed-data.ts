/**
 * Dados fictícios usados pela seed.
 *
 * Tudo aqui é **inventado**: nomes, CPFs/CNPJs (com dígitos verificadores
 * válidos, mas inexistentes), endereços e produtos de uma transportadora
 * fictícia. Nenhum dado real de pessoa ou empresa.
 */

export interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: 'USER' | 'ADMIN';
}

export interface SeedCustomer {
  name: string;
  document: string;
}

export interface SeedAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface SeedProduct {
  description: string;
  unitPrice: string;
}

/** Usuários de acesso à API. */
export const SEED_USERS: SeedUser[] = [
  {
    name: 'Administradora naPorta',
    email: 'admin@naporta.local',
    password: 'Admin@1234',
    role: 'ADMIN',
  },
  {
    name: 'Carlos Operador',
    email: 'operador@naporta.local',
    password: 'Operador@1234',
    role: 'USER',
  },
  {
    name: 'Ana Cliente',
    email: 'ana@naporta.local',
    password: 'Cliente@1234',
    role: 'USER',
  },
];

/** Clientes dos pedidos fictícios. */
export const SEED_CUSTOMERS: SeedCustomer[] = [
  { name: 'Maria Silva', document: '10020030088' },
  { name: 'João Oliveira', document: '10721331726' },
  { name: 'Ana Paula Souza', document: '11422633470' },
  { name: 'Pedro Henrique Lima', document: '12123935115' },
  { name: 'Carla Beatriz Reis', document: '12825236861' },
  { name: 'Lucas Almeida', document: '13526538506' },
  { name: 'Fernanda Costa', document: '14227840295' },
  { name: 'Rafael Martins', document: '14929141931' },
  { name: 'Juliana Ferreira', document: '15630443666' },
  { name: 'Bruno Carvalho', document: '16331745300' },
  { name: 'Patrícia Gomes', document: '17033047053' },
  { name: 'Thiago Rodrigues', document: '17734348700' },
  { name: 'Mercado Aurora Ltda', document: '11222333000181' },
  { name: 'Café&Bistrô São Jorge', document: '12223333000169' },
  { name: 'TechAcessórios Distribuidora', document: '13224333000146' },
  { name: 'Editora Panorama', document: '14225333000123' },
];

/** Endereços de entrega fictícios. */
export const SEED_ADDRESSES: SeedAddress[] = [
  {
    street: 'Rua das Flores',
    number: '123',
    complement: 'Apto 42',
    neighborhood: 'Centro',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01001000',
    country: 'BR',
  },
  {
    street: 'Avenida Paulista',
    number: '1578',
    complement: 'Conj. 91',
    neighborhood: 'Bela Vista',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01310200',
    country: 'BR',
  },
  {
    street: 'Rua Oswaldo Cruz',
    number: '405',
    neighborhood: 'Santa Cecília',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '04034000',
    country: 'BR',
  },
  {
    street: 'Rua do Terminal',
    number: '77',
    complement: 'Galpão 3',
    neighborhood: 'Porto',
    city: 'Santos',
    state: 'SP',
    zipCode: '11010000',
    country: 'BR',
  },
  {
    street: 'Avenida Brasil',
    number: '3500',
    neighborhood: 'Centro',
    city: 'Rio de Janeiro',
    state: 'RJ',
    zipCode: '20040000',
    country: 'BR',
  },
  {
    street: 'Rua Sete de Setembro',
    number: '890',
    complement: 'Loja 2',
    neighborhood: 'Centro',
    city: 'Belo Horizonte',
    state: 'MG',
    zipCode: '30080000',
    country: 'BR',
  },
  {
    street: 'Avenida Beira Mar',
    number: '1200',
    neighborhood: 'Boa Viagem',
    city: 'Recife',
    state: 'PE',
    zipCode: '51010000',
    country: 'BR',
  },
  {
    street: 'Rua das Palmeiras',
    number: '64',
    complement: 'Casa 2',
    neighborhood: 'Higienópolis',
    city: 'Curitiba',
    state: 'PR',
    zipCode: '80230000',
    country: 'BR',
  },
  {
    street: 'Avenida Amazonas',
    number: '980',
    neighborhood: 'Manaus',
    city: 'Manaus',
    state: 'AM',
    zipCode: '69000000',
    country: 'BR',
  },
  {
    street: 'Rua da Praia',
    number: '12',
    neighborhood: 'Centro Histórico',
    city: 'Florianópolis',
    state: 'SC',
    zipCode: '88010000',
    country: 'BR',
  },
];

/** Catálogo de itens fictícios. */
export const SEED_PRODUCTS: SeedProduct[] = [
  { description: 'Caixa de papelão reforçado', unitPrice: '49.90' },
  { description: 'Envelope acolchoado A4', unitPrice: '8.50' },
  { description: 'Fita adesiva transparente', unitPrice: '12.00' },
  { description: 'Etiquetas térmicas (rolo 100)', unitPrice: '39.90' },
  { description: 'Sacola kraft 20x25cm', unitPrice: '3.20' },
  { description: 'Embalagem frágil — isopor', unitPrice: '18.75' },
  { description: 'Plástico bolha 1m', unitPrice: '27.00' },
  { description: 'Guarda-chuva oficial', unitPrice: '45.00' },
  { description: 'Kit caneca naPorta', unitPrice: '59.90' },
  { description: 'Saco de lixo 100L (pacote 10)', unitPrice: '32.40' },
  { description: 'Brindes personalizados (unidade)', unitPrice: '7.35' },
  { description: 'Serviço adicional — expressa', unitPrice: '15.00' },
];

/** Semente fixa do gerador pseudoaleatório: a seed é reproduzível. */
export const SEED_RANDOM_SEED = 20260101;
