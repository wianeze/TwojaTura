import type { Metadata } from "next";
import { Panel } from "@/components/ui/panel";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Wejście do Chaty" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string; passwordUpdated?: string }>;
}) {
  const { authError, passwordUpdated } = await searchParams;
  return (
    <Panel className="paper-wash p-4 sm:p-8">
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
        Tylko dla zaproszonych
      </p>
      <h1 className="font-display mt-2 text-3xl font-semibold sm:mt-3">
        Wejście do Chaty
      </h1>
      <p className="text-muted mt-2 text-sm leading-5 sm:mt-3 sm:leading-6">
        Dostęp do klubu jest możliwy wyłącznie z zaproszenia.
      </p>
      <LoginForm
        initialError={
          authError
            ? "Link logowania wygasł lub jest nieprawidłowy. Spróbuj ponownie."
            : undefined
        }
        initialSuccessMessage={
          passwordUpdated
            ? "Hasło zostało ustawione. Możesz się zalogować."
            : undefined
        }
      />
    </Panel>
  );
}
