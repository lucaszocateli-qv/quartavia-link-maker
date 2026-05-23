import { formatBRL } from "@/lib/payment-request";
import type { PaymentLine } from "@/lib/payment-request";
import { CheckCircle2, AlertCircle } from "lucide-react";

type Props = {
  estrategista: string;
  telefone: string;
  valorTotal: number;
  pagamentos: PaymentLine[];
};

export function SummaryCard({ estrategista, telefone, valorTotal, pagamentos }: Props) {
  const soma = pagamentos.reduce((a, p) => a + (p.valor || 0), 0);
  const diff = +(valorTotal - soma).toFixed(2);
  const ok = valorTotal > 0 && Math.abs(diff) < 0.005;

  return (
    <aside className="rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-6 h-fit">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-foreground">Resumo da solicitação</h3>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 rounded-md bg-surface-elevated border border-border">
          Rascunho
        </span>
      </div>

      <dl className="space-y-3 text-sm">
        <Row label="Produto" value="Pharus" />
        <Row label="Closer" value={estrategista || "—"} />
        <Row label="Telefone" value={telefone || "—"} />
        <Row label="Valor total" value={formatBRL(valorTotal)} highlight />
      </dl>

      <div className="my-5 h-px bg-border" />

      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
        Pagamentos
      </p>
      {pagamentos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum pagamento adicionado.</p>
      ) : (
        <ol className="space-y-2 text-sm">
          {pagamentos.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-lg bg-surface-elevated/60 px-3 py-2 border border-border"
            >
              <span className="text-muted-foreground">
                {i + 1}. {p.forma_pagamento}
                <span className="text-foreground/60"> · {p.parcelas}x</span>
              </span>
              <span className="font-medium text-foreground">{formatBRL(p.valor)}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-5 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Soma dos pagamentos</span>
          <span className="font-medium text-foreground">{formatBRL(soma)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Diferença</span>
          <span
            className={`font-medium ${
              ok ? "text-success" : diff !== 0 ? "text-destructive" : "text-foreground"
            }`}
          >
            {formatBRL(diff)}
          </span>
        </div>
      </div>

      <div className="mt-5">
        {valorTotal === 0 || pagamentos.length === 0 ? null : ok ? (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-success text-xs">
            <CheckCircle2 className="size-4" />
            Divisão de pagamento validada.
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-xs">
            <AlertCircle className="size-4" />
            {diff > 0
              ? "A soma das formas de pagamento está menor que o valor total."
              : "A soma das formas de pagamento está maior que o valor total."}
          </div>
        )}
      </div>
    </aside>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-medium ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </dd>
    </div>
  );
}
