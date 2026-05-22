import { useState } from "react";
import { Copy, Check, ChevronDown } from "lucide-react";

export function PayloadInspector({ payload }: { payload: unknown }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(payload, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-surface-elevated transition"
      >
        <span className="font-medium">Payload da solicitação</span>
        <ChevronDown
          className={`size-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between px-4 py-2 bg-background/40">
            <span className="text-xs text-muted-foreground">JSON para integração</span>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1.5 text-xs text-foreground hover:text-primary transition"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copiado" : "Copiar payload"}
            </button>
          </div>
          <pre className="px-4 py-3 text-xs leading-relaxed text-foreground/90 overflow-x-auto max-h-80">
            {json}
          </pre>
        </div>
      )}
    </div>
  );
}
