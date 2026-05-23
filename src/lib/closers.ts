export type CloserOption = {
  id: string;
  userId: string;
  name: string;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const closersConfig = {
  schema: import.meta.env.VITE_SUPABASE_CLOSERS_SCHEMA || "dw_bitrix",
  table: import.meta.env.VITE_SUPABASE_CLOSERS_TABLE || "dim_usuario_bitrix",
  typeColumn: import.meta.env.VITE_SUPABASE_CLOSERS_TYPE_COLUMN || "tipo_usuario",
  nameColumn: import.meta.env.VITE_SUPABASE_CLOSERS_NAME_COLUMN || "nome_usuario",
  idColumn: import.meta.env.VITE_SUPABASE_CLOSERS_ID_COLUMN || "user_id",
  activeColumn: import.meta.env.VITE_SUPABASE_CLOSERS_ACTIVE_COLUMN || "is_active",
};

const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

const nameFallbackColumns = [
  "nome",
  "nome_completo",
  "name",
  "title",
  "nome_usuario",
  "user_name",
  "email",
];

function readText(row: Record<string, unknown>, preferred: string, fallbacks: string[]) {
  const columns = [preferred, ...fallbacks.filter((column) => column !== preferred)];
  for (const column of columns) {
    const value = row[column];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

export async function fetchClosers(): Promise<CloserOption[]> {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase não está configurado.");
  }

  const url = new URL(`/rest/v1/${closersConfig.table}`, supabaseUrl);
  url.searchParams.set("select", "*");
  url.searchParams.set(closersConfig.typeColumn, "ilike.*Closer*");
  url.searchParams.set(closersConfig.activeColumn, "eq.true");
  url.searchParams.set("limit", "1000");

  const response = await fetch(url, {
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${supabasePublishableKey}`,
      "Accept-Profile": closersConfig.schema,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || "Não foi possível carregar os closers.");
  }

  const data = (await response.json()) as unknown[];

  const options = (data ?? [])
    .map((row) => {
      const record = row as Record<string, unknown>;
      const name = readText(record, closersConfig.nameColumn, nameFallbackColumns);
      const userId = readText(record, closersConfig.idColumn, ["uuid", "user_id", "bitrix_id"]);
      return name && userId ? { id: userId, userId, name } : null;
    })
    .filter((option): option is CloserOption => option !== null);

  return Array.from(new Map(options.map((option) => [option.userId, option])).values()).sort(
    (a, b) => a.name.localeCompare(b.name, "pt-BR"),
  );
}
