import { formatBRL } from "@/lib/payment-request";
import type { PaymentLinkPayload } from "@/lib/payment-request";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  payload: PaymentLinkPayload | null;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({ open, payload, loading, onCancel, onConfirm }: Props) {
  if (!open || !payload) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition"
        >
          <X className="size-4" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">Confirmar solicitação?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Revise os dados antes de enviar a solicitação para criação dos links de pagamento.
        </p>

        <div className="mt-5 space-y-2 text-sm rounded-xl border border-border bg-surface-elevated/60 p-4">
          <Row k="Produto" v={payload.produto} />
          <Row k="Estrategista" v={payload.estrategista} />
          <Row k="Telefone" v={payload.telefone_cliente} />
          <Row k="Valor total" v={formatBRL(payload.valor_total)} highlight />
          <div className="pt-2 mt-2 border-t border-border">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Pagamentos
            </p>
            <ul className="space-y-1.5">
              {payload.pagamentos.map((p, i) => (
                <li key={i} className="flex justify-between text-foreground/90">
                  <span>
                    {p.forma_pagamento} · {p.parcelas}x
                  </span>
                  <span className="font-medium">{formatBRL(p.valor)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm text-foreground hover:bg-surface-elevated transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 transition disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Confirmar envio"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className={highlight ? "text-primary font-semibold" : "text-foreground font-medium"}>{v}</span>
    </div>
  );
}
