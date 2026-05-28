import { Trash2, Plus } from "lucide-react";
import { CurrencyInput } from "./CurrencyInput";
import type { PaymentLine, PaymentMethod } from "@/lib/payment-request";

type Props = {
  lines: PaymentLine[];
  onChange: (lines: PaymentLine[]) => void;
};

const newId = () => Math.random().toString(36).slice(2, 9);

export function PaymentLinesEditor({ lines, onChange }: Props) {
  const update = (id: string, patch: Partial<PaymentLine>) => {
    onChange(
      lines.map((l) => {
        if (l.id !== id) return l;
        const merged = { ...l, ...patch };
        if (merged.forma_pagamento === "Pix") merged.parcelas = 1;
        return merged;
      })
    );
  };

  const remove = (id: string) => onChange(lines.filter((l) => l.id !== id));

  const add = () =>
    onChange([
      ...lines,
      { id: newId(), forma_pagamento: "Pix", valor: 0, parcelas: 1 },
    ]);

  return (
    <div className="space-y-3">
      {lines.map((line, idx) => {
        const isPix = line.forma_pagamento === "Pix";
        return (
          <div
            key={line.id}
            className="rounded-xl border border-border bg-surface-elevated/60 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Pagamento {idx + 1}
              </span>
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(line.id)}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition"
                >
                  <Trash2 className="size-3.5" />
                  Remover
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_0.8fr] gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Forma de pagamento
                </label>
                <select
                  value={line.forma_pagamento}
                  onChange={(e) =>
                    update(line.id, {
                      forma_pagamento: e.target.value as PaymentMethod,
                    })
                  }
                  className="w-full rounded-lg bg-input border border-border px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary"
                >
                  <option value="Pix">Pix</option>
                  <option value="Cartão de crédito">Cartão de crédito</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Valor
                </label>
                <CurrencyInput
                  value={line.valor}
                  onChange={(n) => update(line.id, { valor: n })}
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  Parcelas
                </label>
                <select
                  disabled={isPix}
                  value={line.parcelas}
                  onChange={(e) =>
                    update(line.id, { parcelas: Number(e.target.value) })
                  }
                  className="w-full rounded-lg bg-input border border-border px-3 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {(isPix ? [1] : Array.from({ length: 18 }, (_, i) => i + 1)).map(
                    (n) => (
                      <option key={n} value={n}>
                        {n}x
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={add}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface/40 px-4 py-3 text-sm text-foreground hover:border-primary/60 hover:bg-surface transition"
      >
        <Plus className="size-4" />
        Adicionar forma de pagamento
      </button>
    </div>
  );
}
