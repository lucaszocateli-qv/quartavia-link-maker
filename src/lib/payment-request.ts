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
  user_id: string;
  solicitante_email?: string;
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

export type PaymentLink = {
  id?: string;
  forma_pagamento?: string;
  descricao?: string;
  url: string;
  valor?: number;
  parcelas?: number;
  codigo_pix?: string;
  linha_digitavel?: string;
  vencimento?: string;
};

export type PaymentLinkWebhookResponse = {
  id?: string;
  status: RequestStatus;
  mensagem?: string;
  links: PaymentLink[];
  raw: unknown;
};

export type PaymentLinkSubmitResult =
  | { ok: true; data: PaymentLinkWebhookResponse }
  | { ok: false; error: string; raw?: unknown };

const paymentWebhookUrl =
  import.meta.env.VITE_PAYMENT_WEBHOOK_URL ||
  "https://n8n-n8n.orsh7l.easypanel.host/webhook/dados-pagamento";

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const firstString = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
};

const firstNumber = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const hasHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());

const normalizeLink = (value: unknown, index: number): PaymentLink | null => {
  if (typeof value === "string" && hasHttpUrl(value)) {
    return {
      descricao: `Link ${index + 1}`,
      url: value.trim(),
    };
  }

  if (!isRecord(value)) return null;

  const source = isRecord(value.json) ? value.json : value;
  const url = firstString(source, [
    "url",
    "link",
    "payment_link",
    "paymentLink",
    "checkout_url",
    "checkoutUrl",
    "pix_link",
    "boleto_url",
  ]);

  if (!url || !hasHttpUrl(url)) return null;

  return {
    id: firstString(source, ["id", "link_id", "payment_id", "request_id"]),
    forma_pagamento: firstString(source, [
      "forma_pagamento",
      "formaPagamento",
      "payment_method",
      "metodo",
      "method",
      "tipo",
    ]),
    descricao: firstString(source, ["descricao", "description", "label", "titulo", "title"]),
    url,
    valor: firstNumber(source, ["valor", "amount", "valor_total"]),
    parcelas: firstNumber(source, ["parcelas", "installments"]),
    codigo_pix: firstString(source, ["codigo_pix", "pix_copia_cola", "pixCopyPaste", "brcode"]),
    linha_digitavel: firstString(source, ["linha_digitavel", "digitable_line", "boleto_barcode"]),
    vencimento: firstString(source, ["vencimento", "expires_at", "expiresAt", "due_date"]),
  };
};

const collectLinks = (value: unknown): PaymentLink[] => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const directLink = normalizeLink(item, index);
      if (directLink) return [directLink];

      if (isRecord(item)) {
        return collectLinks(item.links ?? item.payment_links ?? item.paymentLinks ?? item.data);
      }

      return [];
    });
  }

  const directLink = normalizeLink(value, 0);
  if (directLink) return [directLink];

  if (!isRecord(value)) return [];

  for (const key of ["links", "payment_links", "paymentLinks", "dados", "data", "result", "response"]) {
    const nestedLinks = collectLinks(value[key]);
    if (nestedLinks.length > 0) return nestedLinks;
  }

  return [];
};

const pickResponseId = (value: unknown): string | undefined => {
  if (isRecord(value)) {
    return firstString(value, ["id", "request_id", "solicitacao_id", "execution_id"]);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const id = pickResponseId(isRecord(item) && isRecord(item.json) ? item.json : item);
      if (id) return id;
    }
  }

  return undefined;
};

const pickMessage = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  return firstString(value, ["mensagem", "message", "msg", "status_message"]);
};

async function parseWebhookResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<unknown>;
  }

  const text = await response.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function submitPaymentLinkRequest(
  payload: PaymentLinkPayload
): Promise<PaymentLinkSubmitResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(paymentWebhookUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const raw = await parseWebhookResponse(response);

    if (!response.ok) {
      return {
        ok: false,
        error: `Webhook retornou erro ${response.status}.`,
        raw,
      };
    }

    const links = collectLinks(raw);

    if (links.length === 0) {
      return {
        ok: false,
        error: "O webhook respondeu, mas não enviou nenhum link de pagamento.",
        raw,
      };
    }

    return {
      ok: true,
      data: {
        id: pickResponseId(raw),
        status: "link_gerado",
        mensagem: pickMessage(raw),
        links,
        raw,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof DOMException && error.name === "AbortError"
          ? "O webhook demorou demais para responder."
          : "Não foi possível chamar o webhook de pagamento.",
    };
  } finally {
    window.clearTimeout(timeout);
  }
}
