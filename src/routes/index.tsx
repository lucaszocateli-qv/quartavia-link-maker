import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { CheckCircle2, Lock, Send, ShieldCheck } from "lucide-react";

import {
  ESTRATEGISTAS,
  formatBRL,
  isValidPhone,
  maskPhoneBR,
  onlyDigits,
  submitPaymentLinkRequest,
  sumPayments,
  type PaymentLine,
  type PaymentLinkPayload,
  type RequestStatus,
} from "@/lib/payment-request";
import { CurrencyInput } from "@/components/CurrencyInput";
import { PaymentLinesEditor } from "@/components/PaymentLinesEditor";
import { SummaryCard } from "@/components/SummaryCard";
import { PayloadInspector } from "@/components/PayloadInspector";
import { ConfirmModal } from "@/components/ConfirmModal";

export const Route = createFileRoute("/")({
  component: Index,
});

const newId = () => Math.random().toString(36).slice(2, 9);

const initialLines = (): PaymentLine[] => [
  { id: newId(), forma_pagamento: "Pix", valor: 0, parcelas: 1 },
];

function Index() {
  const [estrategista, setEstrategista] = useState("");
  const [valorTotal, setValorTotal] = useState(0);
  const [telefone, setTelefone] = useState("");
  const [pagamentos, setPagamentos] = useState<PaymentLine[]>(initialLines());
  const [status, setStatus] = useState<RequestStatus>("rascunho");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<PaymentLinkPayload | null>(null);
  const [touched, setTouched] = useState(false);

  const soma = useMemo(() => sumPayments(pagamentos), [pagamentos]);
  const sumOk = valorTotal > 0 && Math.abs(valorTotal - soma) < 0.005;

  const payload: PaymentLinkPayload = useMemo(
    () => ({
      produto: "Pharus",
      estrategista,
      valor_total: valorTotal,
      telefone_cliente: onlyDigits(telefone),
      pagamentos: pagamentos.map((p) => ({
        forma_pagamento: p.forma_pagamento,
        valor: p.valor,
        parcelas: p.parcelas,
      })),
      status,
      origem: "app_interno_quartavia",
      created_at: new Date().toISOString(),
    }),
    [estrategista, valorTotal, telefone, pagamentos, status]
  );

  const errors = {
    estrategista: !estrategista,
    valorTotal: !(valorTotal > 0),
    telefone: !isValidPhone(telefone),
    pagamentos:
      pagamentos.length === 0 ||
      pagamentos.some((p) => !(p.valor > 0)) ||
      !sumOk,
  };
  const isValid = !Object.values(errors).some(Boolean);

  const handleSubmitClick = () => {
    setTouched(true);
    if (!isValid) {
      toast.error("Revise os campos destacados antes de enviar.");
      return;
    }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    const res = await submitPaymentLinkRequest(payload);
    setSubmitting(false);
    if (res.ok) {
      setStatus("solicitado");
      setSubmitted({ ...payload, status: "solicitado" });
      setConfirmOpen(false);
      toast.success("Solicitação enviada com sucesso.");
    } else {
      toast.error("Falha ao enviar. Tente novamente.");
    }
  };

  const reset = () => {
    setEstrategista("");
    setValorTotal(0);
    setTelefone("");
    setPagamentos(initialLines());
    setStatus("rascunho");
    setSubmitted(null);
    setTouched(false);
  };

  if (submitted) {
    return <SuccessScreen payload={submitted} onNew={reset} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster theme="dark" position="top-right" richColors />
      <Header />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-foreground">Dados da solicitação</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Informe os dados do cliente e a divisão de pagamento.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Produto">
                <div className="relative">
                  <input
                    readOnly
                    value="Pharus"
                    className="w-full rounded-lg bg-input/60 border border-border px-4 py-2.5 text-foreground cursor-not-allowed pr-10"
                  />
                  <Lock className="size-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </Field>

              <Field
                label="Estrategista"
                hint="Também conhecido como vendedor responsável"
                error={touched && errors.estrategista ? "Selecione um estrategista." : undefined}
              >
                <select
                  value={estrategista}
                  onChange={(e) => setEstrategista(e.target.value)}
                  className={`w-full rounded-lg bg-input border px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary ${
                    touched && errors.estrategista ? "border-destructive" : "border-border"
                  }`}
                >
                  <option value="">Selecione um estrategista</option>
                  {ESTRATEGISTAS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Valor total"
                error={touched && errors.valorTotal ? "Informe um valor maior que zero." : undefined}
              >
                <CurrencyInput
                  value={valorTotal}
                  onChange={setValorTotal}
                  placeholder="Ex: R$ 20.000,00"
                  invalid={touched && errors.valorTotal}
                />
              </Field>

              <Field
                label="Telefone do cliente"
                error={
                  touched && errors.telefone ? "Informe um telefone válido com DDD." : undefined
                }
              >
                <input
                  inputMode="tel"
                  value={telefone}
                  placeholder="(11) 99999-9999"
                  onChange={(e) => setTelefone(maskPhoneBR(e.target.value))}
                  className={`w-full rounded-lg bg-input border px-4 py-2.5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary ${
                    touched && errors.telefone ? "border-destructive" : "border-border"
                  }`}
                />
              </Field>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Divisão do pagamento</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A soma das formas precisa ser igual ao valor total.
                  </p>
                </div>
                <span className="hidden sm:inline-block text-xs text-muted-foreground">
                  Soma atual:{" "}
                  <span className={sumOk ? "text-success" : "text-foreground"}>
                    {formatBRL(soma)}
                  </span>
                </span>
              </div>

              <PaymentLinesEditor lines={pagamentos} onChange={setPagamentos} />

              {touched && errors.pagamentos && (
                <p className="mt-3 text-xs text-destructive">
                  {valorTotal > 0 && soma < valorTotal
                    ? "A soma das formas de pagamento está menor que o valor total."
                    : valorTotal > 0 && soma > valorTotal
                    ? "A soma das formas de pagamento está maior que o valor total."
                    : "Verifique os valores informados em cada forma de pagamento."}
                </p>
              )}
            </div>

            <div className="mt-8">
              <PayloadInspector payload={payload} />
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" />
                Uso interno QuartaVia · dados não são compartilhados externamente.
              </p>
              <button
                type="button"
                onClick={handleSubmitClick}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_8px_30px_-10px_oklch(0.74_0.176_55/0.6)] hover:brightness-110 transition"
              >
                <Send className="size-4" />
                Enviar solicitação
              </button>
            </div>
          </section>

          <SummaryCard
            estrategista={estrategista}
            telefone={telefone}
            valorTotal={valorTotal}
            pagamentos={pagamentos}
          />
        </div>
      </main>

      <ConfirmModal
        open={confirmOpen}
        payload={payload}
        loading={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

function Header() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-surface-elevated border border-border grid place-items-center overflow-hidden">
            <img
              src="https://app.quartavia.com.br/favicon.ico"
              alt="QuartaVia"
              className="size-6"
            />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-foreground leading-tight">
              Solicitação de Link de Pagamento
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Preencha os dados abaixo para solicitar a geração dos links de pagamento do cliente.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary uppercase tracking-wider">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          Uso interno
        </span>
      </div>
    </header>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function SuccessScreen({
  payload,
  onNew,
}: {
  payload: PaymentLinkPayload;
  onNew: () => void;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Toaster theme="dark" position="top-right" richColors />
      <Header />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto size-14 rounded-full bg-success/15 border border-success/30 grid place-items-center">
            <CheckCircle2 className="size-7 text-success" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-foreground">Solicitação registrada</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            A solicitação para criação dos links de pagamento foi registrada com sucesso.
          </p>

          <div className="mt-6 text-left rounded-xl border border-border bg-surface-elevated/60 p-5 space-y-2 text-sm">
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
                      {i + 1}. {p.forma_pagamento} · {p.parcelas}x
                    </span>
                    <span className="font-medium">{formatBRL(p.valor)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Row k="Status" v="Solicitado" />
          </div>

          <div className="mt-6">
            <PayloadInspector payload={payload} />
          </div>

          <button
            type="button"
            onClick={onNew}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 transition"
          >
            Nova solicitação
          </button>
        </div>
      </main>
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className={highlight ? "text-primary font-semibold" : "text-foreground font-medium"}>
        {v}
      </span>
    </div>
  );
}
