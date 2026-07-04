const PUBLIC_ENV_ERROR =
  "Brakuje konfiguracji Supabase. Uzupełnij NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.";

export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(PUBLIC_ENV_ERROR);
  }

  return { url, publishableKey };
}
