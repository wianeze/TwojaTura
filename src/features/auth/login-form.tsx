"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";
import { loginAction, requestPasswordResetAction } from "./actions";
import { AuthSubmitButton } from "./auth-submit-button";
import { INITIAL_FORM_STATE } from "./form-state";
import {
  formatAuthErrorMessage,
  getAuthHashSessionKind,
  getAuthHashTokens,
  getSafeAuthErrorInfo,
  getUrlHostname,
  parseAuthHashParams,
  type AuthHashSessionKind,
} from "./recovery-session";
import { validatePasswordChange } from "./validation";

const inputClass =
  "bg-background/80 focus:border-gold focus:ring-gold/20 mt-1.5 h-12 w-full rounded-xl border border-[#9a7657]/35 px-4 outline-none transition focus:ring-4";

type SessionViewMode = "idle" | "loading" | "ready" | "error";
type SessionHashKind = Exclude<AuthHashSessionKind, null | "error">;

/**
 * Reads window.location.hash synchronously so the initial render already
 * knows whether this is a recovery/invite link — avoids a flash of the
 * plain login form followed by a jump to the password form. Safe to call
 * during SSR (returns the inert default before hydration).
 */
function readInitialSessionHash(): {
  viewMode: SessionViewMode;
  kind: SessionHashKind | null;
} {
  if (typeof window === "undefined") {
    return { viewMode: "idle", kind: null };
  }

  const parsed = getAuthHashSessionKind(
    parseAuthHashParams(window.location.hash),
  );

  if (parsed.kind === "error") {
    return { viewMode: "error", kind: null };
  }
  if (parsed.kind === "recovery" || parsed.kind === "invite") {
    return { viewMode: "loading", kind: parsed.kind };
  }
  return { viewMode: "idle", kind: null };
}

const SESSION_COPY: Record<
  SessionHashKind,
  {
    eyebrow: string;
    heading: string;
    submitLabel: string;
    pendingLabel: string;
  }
> = {
  recovery: {
    eyebrow: "Odzyskiwanie dostępu",
    heading: "Ustaw nowe hasło",
    submitLabel: "Ustaw nowe hasło",
    pendingLabel: "Zapisujemy…",
  },
  invite: {
    eyebrow: "Zaproszenie",
    heading: "Ustaw hasło do konta",
    submitLabel: "Ustaw hasło",
    pendingLabel: "Zapisujemy…",
  },
};

/**
 * Handles Supabase's implicit/hash recovery+invite flow directly on
 * /logowanie, in addition to (not instead of) the existing server-side
 * token_hash flow through /auth/callback → /ustaw-haslo. Production mail
 * links land here with #access_token=...&type=recovery|invite in the
 * fragment — something only the browser ever sees — so this has to be a
 * client-side effect, not a Server Component/Action.
 */
export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [recoveryMode, setRecoveryMode] = useState(false);

  const [initialSessionHash] = useState(readInitialSessionHash);
  const [sessionViewMode, setSessionViewMode] = useState<SessionViewMode>(
    initialSessionHash.viewMode,
  );
  // Fixed for the component's lifetime once read from the hash — only
  // sessionViewMode transitions (loading → ready/error) after mount.
  const sessionKind = initialSessionHash.kind;
  const [sessionErrorMessage, setSessionErrorMessage] = useState<string | null>(
    null,
  );
  const hashClearedRef = useRef(false);

  const [loginState, loginFormAction] = useActionState(
    loginAction,
    INITIAL_FORM_STATE,
  );
  const [recoveryState, recoveryFormAction] = useActionState(
    requestPasswordResetAction,
    INITIAL_FORM_STATE,
  );

  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSucceeded, setUpdateSucceeded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = parseAuthHashParams(window.location.hash);
    const initialKind = getAuthHashSessionKind(params).kind;
    if (initialKind !== "recovery" && initialKind !== "invite") return;

    // Temporary diagnostic: which Supabase project this build is actually
    // talking to (hostname only — never the full URL, never the key).
    // Production is expected to log brahsmioddvhkozoilgs.supabase.co here.
    try {
      const { url } = getPublicSupabaseEnv();
      console.info("[auth/recovery] Supabase host:", getUrlHostname(url));
    } catch {
      // getPublicSupabaseEnv() throws if env vars are missing entirely —
      // that's its own visible failure mode already, nothing to add here.
    }

    const supabase = createClient();
    let settled = false;

    function confirmSessionReady() {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      setSessionViewMode("ready");
      // Only strip the fragment once Supabase has actually confirmed the
      // session — never speculatively, so a still-loading or failed
      // exchange leaves the tokens in place for the SDK to keep trying.
      if (!hashClearedRef.current) {
        hashClearedRef.current = true;
        window.history.replaceState(null, "", window.location.pathname);
      }
    }

    // message is only set for a concrete, reported error (setSession /
    // getSession) — a bare timeout with no error from anywhere leaves it
    // unset, and the UI falls back to its generic copy.
    function failSession(message?: string) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      setSessionErrorMessage(message ?? null);
      setSessionViewMode("error");
    }

    // Never pass the raw error to console/UI — only the four whitelisted
    // fields (name/code/status/message). No token, hash, session or email
    // is ever part of this.
    function reportAuthError(source: string, error: unknown) {
      const info = getSafeAuthErrorInfo(error);
      console.error(`[auth/recovery] ${source} failed`, info);
      failSession(formatAuthErrorMessage(info));
    }

    // Final backstop: only reached if neither setSession nor the fallback
    // below ever resolves with either a session or a reported error at all
    // (e.g. the request never completes) — surfaces after ~9s instead of
    // leaving "Sprawdzanie linku…" up forever.
    const timeoutId = window.setTimeout(() => failSession(), 9000);

    // Fallback path — kept, but not relied on alone: the SDK's own implicit
    // detectSessionInUrl handling may establish the session on its own,
    // possibly before this effect even subscribes.
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        confirmSessionReady();
      }
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        reportAuthError("getSession", error);
        return;
      }
      if (data.session) confirmSessionReady();
    });

    // Primary path: explicitly exchange the fragment's tokens for a
    // session instead of only waiting on the fallback above to notice
    // them. Tokens are read once here and handed straight to the SDK —
    // never logged, never stored by this code.
    const { accessToken, refreshToken } = getAuthHashTokens(params);
    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data, error }) => {
          if (error) {
            reportAuthError("setSession", error);
            return;
          }
          if (data.session) confirmSessionReady();
        });
    }

    return () => {
      settled = true;
      window.clearTimeout(timeoutId);
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handlePasswordUpdateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUpdateError(null);

    const validation = validatePasswordChange(
      newPassword,
      newPasswordConfirmation,
    );
    if (!validation.ok) {
      setUpdateError(validation.error);
      return;
    }

    setIsUpdating(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: validation.data.password,
    });
    setIsUpdating(false);

    if (error) {
      setUpdateError(
        "Nie udało się ustawić hasła. Link mógł wygasnąć — spróbuj ponownie.",
      );
      return;
    }

    setUpdateSucceeded(true);
  }

  if (sessionViewMode === "loading") {
    return (
      <p className="mt-7 rounded-xl bg-black/5 px-4 py-3 text-sm text-[#5f4738]">
        Sprawdzanie linku…
      </p>
    );
  }

  if (sessionViewMode === "error") {
    return (
      <div className="mt-7 space-y-4">
        <p
          role="alert"
          className="rounded-xl bg-[#8f3528]/10 px-4 py-3 text-sm text-[#8f3528]"
        >
          {sessionErrorMessage ??
            "Link wygasł lub jest nieprawidłowy. Poproś o nową wiadomość albo skontaktuj się z administratorem, jeśli to zaproszenie."}
        </p>
        <button
          type="button"
          onClick={() => {
            setSessionViewMode("idle");
            setRecoveryMode(true);
          }}
          className="text-accent focus-visible:outline-gold mx-auto block text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2"
        >
          Poproś o nowy link do resetowania hasła
        </button>
      </div>
    );
  }

  if (sessionViewMode === "ready" && sessionKind) {
    const copy = SESSION_COPY[sessionKind];

    if (updateSucceeded) {
      return (
        <div className="mt-7 space-y-4">
          <p className="bg-moss/12 text-moss rounded-xl px-4 py-3 text-sm">
            Hasło zostało ustawione. Możesz teraz korzystać z aplikacji.
          </p>
          <button
            type="button"
            onClick={() => {
              router.push("/");
              router.refresh();
            }}
            className="bg-brand hover:bg-brand-strong focus-visible:outline-gold w-full rounded-xl px-4 py-3 font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Przejdź do aplikacji →
          </button>
        </div>
      );
    }

    return (
      <>
        <p className="text-accent mt-6 text-xs font-bold tracking-[0.16em] uppercase">
          {copy.eyebrow}
        </p>
        <form onSubmit={handlePasswordUpdateSubmit} className="mt-3 space-y-4">
          <label className="block text-sm font-semibold">
            {copy.heading}
            <input
              className={inputClass}
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold">
            Powtórz hasło
            <input
              className={inputClass}
              type="password"
              name="passwordConfirmation"
              autoComplete="new-password"
              minLength={8}
              required
              value={newPasswordConfirmation}
              onChange={(event) =>
                setNewPasswordConfirmation(event.target.value)
              }
            />
          </label>
          {updateError && (
            <p
              role="alert"
              className="rounded-xl bg-[#8f3528]/10 px-4 py-3 text-sm text-[#8f3528]"
            >
              {updateError}
            </p>
          )}
          <button
            type="submit"
            disabled={isUpdating}
            className="bg-brand hover:bg-brand-strong focus-visible:outline-gold w-full rounded-xl px-4 py-3 font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-65"
          >
            {isUpdating ? copy.pendingLabel : copy.submitLabel}
          </button>
        </form>
      </>
    );
  }

  const state = recoveryMode ? recoveryState : loginState;
  const message = state.message ?? (!recoveryMode ? initialError : undefined);

  return (
    <>
      <form
        action={recoveryMode ? recoveryFormAction : loginFormAction}
        className="mt-7 space-y-4"
      >
        <label className="block text-sm font-semibold">
          Email
          <input
            className={inputClass}
            type="email"
            name="email"
            autoComplete="email"
            required
          />
        </label>
        {!recoveryMode && (
          <label className="block text-sm font-semibold">
            Hasło
            <input
              className={inputClass}
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
        )}
        {message && (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={`rounded-xl px-4 py-3 text-sm ${state.status === "error" ? "bg-[#8f3528]/10 text-[#8f3528]" : "bg-moss/12 text-moss"}`}
          >
            {message}
          </p>
        )}
        <AuthSubmitButton
          pendingLabel={recoveryMode ? "Wysyłamy…" : "Wchodzisz do Chaty…"}
        >
          {recoveryMode ? "Wyślij instrukcje" : "Zaloguj się"}
        </AuthSubmitButton>
      </form>
      <button
        type="button"
        onClick={() => setRecoveryMode((current) => !current)}
        className="text-accent focus-visible:outline-gold mx-auto mt-5 block text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-2"
      >
        {recoveryMode ? "Wróć do logowania" : "Nie pamiętasz hasła?"}
      </button>
    </>
  );
}
