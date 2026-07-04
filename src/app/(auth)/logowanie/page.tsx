import type { Metadata } from "next";
import { Panel } from "@/components/ui/panel";
import { LoginForm } from "@/features/auth/login-form";

export const metadata: Metadata = { title: "Wejście do Chaty" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string }>;
}) {
  const { authError } = await searchParams;
  return (
    <Panel className="paper-wash p-6 sm:p-8">
      <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
        Tylko dla zaproszonych
      </p>
      <h1 className="font-display mt-3 text-3xl font-semibold">
        Wejście do Chaty
      </h1>
      <p className="text-muted mt-3 text-sm leading-6">
        Dostęp do klubu jest możliwy wyłącznie z zaproszenia.
      </p>
      <LoginForm
        initialError={
          authError
            ? "Link logowania wygasł lub jest nieprawidłowy. Spróbuj ponownie."
            : undefined
        }
      />
    </Panel>
  );
}
