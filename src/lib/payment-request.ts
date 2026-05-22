export type PaymentMethod = "Pix" | "Cartão de crédito";

export type PaymentLine = {
  id: string;
  forma_pagamento: PaymentMethod;
  valor: number;
  parcelas: number;
};

export type RequestStatus =
  | "rascunho"
  | "solicitado"
  | "em_processamento"
  | "link_gerado"
  | "erro";

export type PaymentLinkPayload = {
  produto: "Pharus";
  estrategista: string;
  valor_total: number;
  telefone_cliente: string;
  pagamentos: Array<{
    forma_pagamento: PaymentMethod;
    valor: number;
    parcelas: number;
  }>;
  status: RequestStatus;
  origem: "app_interno_quartavia";
  created_at: string;
};

export const ESTRATEGISTAS = [
  "Estrategista 1",
  "Estrategista 2",
  "Estrategista 3",
  "Estrategista 4",
];

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(isFinite(value) ? value : 0);

export const onlyDigits = (s: string) => s.replace(/\D/g, "");

export const maskPhoneBR = (raw: string) => {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export const isValidPhone = (raw: string) => {
  const d = onlyDigits(raw);
  return d.length === 10 || d.length === 11;
};

export const sumPayments = (lines: PaymentLine[]) =>
  lines.reduce((acc, l) => acc + (Number.isFinite(l.valor) ? l.valor : 0), 0);

// Mocked backend call — replace with real API/n8n integration later.
export async function submitPaymentLinkRequest(
  _payload: PaymentLinkPayload
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await new Promise((r) => setTimeout(r, 900));
  return { ok: true, id: `req_${Date.now()}` };
}
