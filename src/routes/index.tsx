import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { CheckCircle2, Chrome, Copy, ExternalLink, Loader2, Lock, LogOut, Send, ShieldCheck } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

import {
  formatBRL,
  isValidPhone,
  maskPhoneBR,
  onlyDigits,
  submitPaymentLinkRequest,
  sumPayments,
  type PaymentLine,
  type PaymentLinkPayload,
  type PaymentLinkWebhookResponse,
  type RequestStatus,
} from "@/lib/payment-request";
import { getSupabaseClient } from "@/lib/supabase";
import {
  allowedEmailDomain,
  getGoogleOAuthUrl,
  isAllowedQuartaviaSession,
  signOut,
} from "@/lib/auth";
import { fetchClosers, type CloserOption } from "@/lib/closers";
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

type SubmittedPaymentRequest = {
  payload: PaymentLinkPayload;
  response: PaymentLinkWebhookResponse;
};

function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [googleLoginUrl, setGoogleLoginUrl] = useState<string | null>(null);

  const [estrategista, setEstrategista] = useState("");
  const [valorTotal, setValorTotal] = useState(0);
  const [telefone, setTelefone] = useState("");
  const [pagamentos, setPagamentos] = useState<PaymentLine[]>(initialLines());
  const [status, setStatus] = useState<RequestStatus>("rascunho");
  const [closers, setClosers] = useState<CloserOption[]>([]);
  const [closersLoading, setClosersLoading] = useState(true);
  const [closersError, setClosersError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedPaymentRequest | null>(null);
  const [touched, setTouched] = useState(false);

  const authorized = isAllowedQuartaviaSession(session);
  const userEmail = session?.user.email ?? "";
  const soma = useMemo(() => sumPayments(pagamentos), [pagamentos]);
  const sumOk = valorTotal > 0 && Math.abs(valorTotal - soma) < 0.005;
  const selectedCloser = useMemo(
    () => closers.find((closer) => closer.name === estrategista) ?? null,
    [closers, estrategista],
  );

  useEffect(() => {
    let supabase: ReturnType<typeof getSupabaseClient>;
    try {
      supabase = getSupabaseClient();
      setGoogleLoginUrl(getGoogleOAuthUrl(window.location.origin));
    } catch (error) {
      console.error(error);
      setAuthError("Supabase não está configurado para iniciar o login.");
      setAuthLoading(false);
      return;
    }

    const applySession = (nextSession: Session | null) => {
      if (nextSession && !isAllowedQuartaviaSession(nextSession)) {
        setSession(null);
        setAuthError(`Use um e-mail @${allowedEmailDomain} para acessar.`);
        void supabase.auth.signOut({ scope: "local" });
      } else {
        setSession(nextSession);
        setAuthError(null);
      }
      setAuthLoading(false);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session))
      .catch((error) => {
        console.error(error);
        setAuthError("Não foi possível verificar seu login.");
        setAuthLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authorized) {
      setClosers([]);
      setClosersLoading(false);
      setClosersError(null);
      return;
    }

    let active = true;
    setClosersLoading(true);

    fetchClosers()
      .then((data) => {
        if (!active) return;
        setClosers(data);
        setClosersError(null);
      })
      .catch((error) => {
        if (!active) return;
        console.error(error);
        setClosers([]);
        setClosersError("Não foi possível carregar os closers da base.");
        toast.error("Não foi possível carregar os closers da base.");
      })
      .finally(() => {
        if (active) setClosersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authorized]);

  const payload: PaymentLinkPayload = useMemo(
    () => ({
      produto: "Pharus",
      estrategista,
      user_id: selectedCloser?.userId ?? "",
      solicitante_email: userEmail || undefined,
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
    [estrategista, pagamentos, selectedCloser?.userId, status, telefone, userEmail, valorTotal]
  );

  const errors = {
    estrategista: !estrategista || !selectedCloser?.userId || closersLoading || Boolean(closersError),
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
    const processingPayload: PaymentLinkPayload = { ...payload, status: "em_processamento" };
    setConfirmOpen(false);
    setSubmitting(true);
    setStatus("em_processamento");
    const res = await submitPaymentLinkRequest(processingPayload);
    setSubmitting(false);

    if (res.ok) {
      const completedPayload: PaymentLinkPayload = { ...processingPayload, status: "link_gerado" };
      setStatus("link_gerado");
      setSubmitted({ payload: completedPayload, response: res.data });
      toast.success("Links de pagamento gerados com sucesso.");
    } else {
      setStatus("erro");
      toast.error(res.error);
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

  const handleSignOut = async () => {
    await signOut();
    setSession(null);
    reset();
  };

  if (authLoading || !authorized) {
    return (
      <LoginScreen
        loading={authLoading}
        loginUrl={googleLoginUrl}
        error={authError}
      />
    );
  }

  if (submitted) {
    return (
      <SuccessScreen
        payload={submitted.payload}
        response={submitted.response}
        onNew={reset}
        userEmail={userEmail}
        onSignOut={handleSignOut}
      />
    );
  }

  if (submitting) {
    return <ProcessingScreen payload={payload} userEmail={userEmail} onSignOut={handleSignOut} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster theme="dark" position="top-right" richColors />
      <Header userEmail={userEmail} onSignOut={handleSignOut} />

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
                label="Closer"
                hint="Também conhecido como vendedor responsável"
                error={
                  closersError ??
                  (touched && errors.estrategista ? "Selecione um closer." : undefined)
                }
              >
                <select
                  value={estrategista}
                  onChange={(e) => setEstrategista(e.target.value)}
                  disabled={closersLoading || Boolean(closersError)}
                  className={`w-full rounded-lg bg-input border px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary ${
                    touched && errors.estrategista ? "border-destructive" : "border-border"
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  <option value="">
                    {closersLoading
                      ? "Carregando closers..."
                      : closers.length
                      ? "Selecione um closer"
                      : "Nenhum closer encontrado"}
                  </option>
                  {closers.map((closer) => (
                    <option key={closer.id} value={closer.name}>
                      {closer.name}
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

            <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

function ProcessingScreen({
  payload,
  userEmail,
  onSignOut,
}: {
  payload: PaymentLinkPayload;
  userEmail: string;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Toaster theme="dark" position="top-right" richColors />
      <Header userEmail={userEmail} onSignOut={onSignOut} />
      <main className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8 py-16">
        <section className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto size-14 rounded-full bg-primary/15 border border-primary/30 grid place-items-center">
            <Loader2 className="size-7 text-primary animate-spin" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-foreground">
            Gerando links de pagamento
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Aguardando a resposta do webhook do n8n. Esta tela será atualizada assim que os links chegarem.
          </p>
          <div className="mt-6 text-left rounded-xl border border-border bg-surface-elevated/60 p-5 space-y-2 text-sm">
            <Row k="Produto" v={payload.produto} />
            <Row k="Closer" v={payload.estrategista} />
            <Row k="User ID" v={payload.user_id} />
            <Row k="Telefone" v={payload.telefone_cliente} />
            <Row k="Valor total" v={formatBRL(payload.valor_total)} highlight />
          </div>
        </section>
      </main>
    </div>
  );
}

function LoginScreen({
  loading,
  loginUrl,
  error,
}: {
  loading: boolean;
  loginUrl: string | null;
  error: string | null;
}) {
  const loginDisabled = loading || !loginUrl;

  return (
    <div className="min-h-screen bg-background">
      <Toaster theme="dark" position="top-right" richColors />
      <main className="min-h-screen grid place-items-center px-4">
        <section className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-surface-elevated border border-border grid place-items-center overflow-hidden">
              <img src="https://app.quartavia.com.br/favicon.ico" alt="QuartaVia" className="size-6" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">QuartaVia</h1>
              <p className="text-xs text-muted-foreground">Solicitação de Link de Pagamento</p>
            </div>
          </div>

          <a
            href={loginUrl ?? undefined}
            aria-disabled={loginDisabled}
            onClick={(event) => {
              if (loginDisabled) {
                event.preventDefault();
              }
            }}
            className={`mt-7 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 transition ${
              loginDisabled ? "opacity-60 cursor-not-allowed" : ""
            }`}
          >
            <Chrome className="size-4" />
            {loading
              ? "Verificando login..."
              : !loginUrl
              ? "Preparando Google..."
              : "Entrar com Google"}
          </a>

          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

          <p className="mt-5 text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" />
            Acesso liberado apenas para e-mails @{allowedEmailDomain}.
          </p>
        </section>
      </main>
    </div>
  );
}

function Header({ userEmail, onSignOut }: { userEmail: string; onSignOut: () => void }) {
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
        <div className="flex items-center gap-3">
          <span className="hidden md:inline text-xs text-muted-foreground">{userEmail}</span>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-elevated transition"
          >
            <LogOut className="size-3.5" />
            Sair
          </button>
        </div>
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
  response,
  onNew,
  userEmail,
  onSignOut,
}: {
  payload: PaymentLinkPayload;
  response: PaymentLinkWebhookResponse;
  onNew: () => void;
  userEmail: string;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Toaster theme="dark" position="top-right" richColors />
      <Header userEmail={userEmail} onSignOut={onSignOut} />
      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <div className="mx-auto size-14 rounded-full bg-success/15 border border-success/30 grid place-items-center">
            <CheckCircle2 className="size-7 text-success" />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-foreground">Links de pagamento gerados</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            O webhook respondeu com {response.links.length}{" "}
            {response.links.length === 1 ? "link de pagamento." : "links de pagamento."}
          </p>

          {response.mensagem && (
            <p className="mt-3 text-sm text-foreground">{response.mensagem}</p>
          )}

          <PaymentLinksList response={response} />

          <div className="mt-6 text-left rounded-xl border border-border bg-surface-elevated/60 p-5 space-y-2 text-sm">
            <Row k="Produto" v={payload.produto} />
            <Row k="Closer" v={payload.estrategista} />
            <Row k="User ID" v={payload.user_id} />
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
            <Row k="Status" v="Links gerados" />
          </div>

          <div className="mt-6">
            <PayloadInspector payload={{ payload_enviado: payload, resposta_webhook: response.raw }} />
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

function PaymentLinksList({ response }: { response: PaymentLinkWebhookResponse }) {
  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <div className="mt-7 space-y-3 text-left">
      {response.links.map((link, index) => (
        <div key={`${link.url}-${index}`} className="rounded-lg border border-border bg-surface-elevated/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {link.descricao || link.forma_pagamento || `Link ${index + 1}`}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {link.forma_pagamento && <span>{link.forma_pagamento}</span>}
                {link.valor != null && <span>{formatBRL(link.valor)}</span>}
                {link.parcelas != null && <span>{link.parcelas}x</span>}
                {link.vencimento && <span>Vencimento: {link.vencimento}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copyLink(link.url)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground hover:bg-surface transition"
              >
                <Copy className="size-3.5" />
                Copiar
              </button>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110 transition"
              >
                <ExternalLink className="size-3.5" />
                Abrir
              </a>
            </div>
          </div>
          <p className="mt-3 break-all rounded-lg border border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground">
            {link.url}
          </p>
          {link.codigo_pix && (
            <p className="mt-2 break-all text-xs text-muted-foreground">
              Pix copia e cola: {link.codigo_pix}
            </p>
          )}
          {link.linha_digitavel && (
            <p className="mt-2 break-all text-xs text-muted-foreground">
              Linha digitável: {link.linha_digitavel}
            </p>
          )}
        </div>
      ))}
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
