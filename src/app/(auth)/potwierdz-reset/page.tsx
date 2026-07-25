import type { Metadata } from "next";
import { Panel } from "@/components/ui/panel";
import { ConfirmResetForm } from "@/features/auth/confirm-reset-form";
import { getSafeInternalPath } from "@/features/auth/safe-redirect";

export const metadata: Metadata = { title: "Potwierdź reset hasła" };

/**
 * Neutral landing page for the recovery email link. GET never calls
 * verifyOtp/creates a Supabase client — it only reads and displays the
 * token, so a mailbox link-prefetcher/scanner hitting this URL cannot
 * consume the one-time token. Only a deliberate click of the button in
 * ConfirmResetForm (a real POST to confirmPasswordRecoveryAction) does.
 */
export default async function ConfirmResetPage({
  searchParams,
}: {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    next?: string;
  }>;
}) {
  const params = await searchParams;
  const tokenHash = params.token_hash?.trim();
  const isRecoveryLink = params.type === "recovery";
  const next = getSafeInternalPath(params.next ?? null, "/ustaw-haslo");

  if (!tokenHash || !isRecoveryLink) {
    return (
      <Panel className="paper-wash p-6 sm:p-8">
        <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
          Odzyskiwanie dostępu
        </p>
        <h1 className="font-display mt-3 text-3xl font-semibold">
          Link jest nieprawidłowy
        </h1>
        <p className="text-muted mt-3 text-sm leading-6">
          Ten link resetowania hasła jest niekompletny lub uszkodzony. Poproś o
          nową wiadomość z ekranu logowania.
        </p>
      </Panel>
    );
  }

  return (
    <Panel className="paper-wash p-6 sm:p-8">
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
        Odzyskiwanie dostępu
      </p>
      <h1 className="font-display mt-3 text-3xl font-semibold">
        Ustaw nowe hasło
      </h1>
      <p className="text-muted mt-3 text-sm leading-6">
        Kliknij przycisk, aby potwierdzić link i przejść do ustawienia nowego
        hasła.
      </p>
      <ConfirmResetForm tokenHash={tokenHash} next={next} />
    </Panel>
  );
}
