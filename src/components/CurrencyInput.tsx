import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/payment-request";

type Props = {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  id?: string;
  invalid?: boolean;
};

export function CurrencyInput({ value, onChange, placeholder, id, invalid }: Props) {
  const [text, setText] = useState<string>(value ? formatBRL(value) : "");

  useEffect(() => {
    if (!value) setText("");
    else setText(formatBRL(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      setText("");
      onChange(0);
      return;
    }
    const cents = parseInt(digits, 10);
    const n = cents / 100;
    setText(formatBRL(n));
    onChange(n);
  };

  return (
    <input
      id={id}
      inputMode="numeric"
      value={text}
      placeholder={placeholder ?? "R$ 0,00"}
      onChange={(e) => handleChange(e.target.value)}
      className={`w-full rounded-lg bg-input border ${
        invalid ? "border-destructive" : "border-border"
      } px-4 py-2.5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary transition`}
    />
  );
}
