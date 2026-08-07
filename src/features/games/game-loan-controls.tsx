"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ActionButton } from "@/components/ui/action-button";
import type {
  ActiveGameLoan,
  GameLoanActionState,
  MemberOption,
} from "./types";

const INITIAL_STATE: GameLoanActionState = { status: "idle" };

function getInitial(name: string) {
  return name.trim().charAt(0).toLocaleUpperCase("pl-PL") || "?";
}

function MemberAvatar({ member }: { member: MemberOption }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#dfb96e] bg-[#4a2b20] text-xs font-bold text-[#fff3d7] shadow-sm">
      {member.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatars may use external profile URLs
        <img src={member.avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        getInitial(member.displayName)
      )}
    </span>
  );
}

function formatLoanDate(value: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function ReturnGameForm({
  action,
}: {
  action: (state: GameLoanActionState) => Promise<GameLoanActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-2">
      <ActionButton
        type="submit"
        action="neutral"
        size="compact"
        emphasis="secondary"
        loading={pending}
        loadingLabel="Zapisujemy zwrot…"
        disabled={pending}
      >
        Zapisz zwrot
      </ActionButton>
      {state.message ? (
        <p
          role="status"
          className={`text-xs font-semibold ${
            state.status === "error" ? "text-[#9a3e31]" : "text-[#3f7049]"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function LoanGameModal({
  members,
  action,
  onClose,
}: {
  members: MemberOption[];
  action: (
    state: GameLoanActionState,
    formData: FormData,
  ) => Promise<GameLoanActionState>;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [onClose, state.status]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-[#1c110c]/76 p-3 pb-[calc(env(safe-area-inset-bottom)+5.75rem)] backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loan-game-title"
      onClick={onClose}
    >
      <form
        action={formAction}
        className="parchment-card premium-edge relative w-full max-w-lg rounded-[1.75rem] p-4 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="wood-grain text-cream absolute top-3 right-3 grid size-8 place-items-center rounded-full text-base"
          aria-label="Zamknij formularz wypożyczenia"
        >
          ×
        </button>
        <p className="text-accent text-[0.6rem] font-bold tracking-[0.18em] uppercase">
          Historia egzemplarza
        </p>
        <h2
          id="loan-game-title"
          className="font-display mt-1 pr-10 text-2xl font-semibold text-[#4b3427]"
        >
          Pożycz grę
        </h2>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-semibold text-[#503828]">
            Osoba
            <select
              name="borrowerUserId"
              required
              defaultValue=""
              className="paper-wash focus:border-gold focus:ring-gold/20 mt-1.5 h-11 w-full rounded-xl border border-[#9a7657]/35 px-3 text-sm outline-none focus:ring-4"
            >
              <option value="" disabled>
                Wybierz osobę
              </option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-[#503828]">
            Notatka{" "}
            <span className="font-normal text-[#8a725f]">(opcjonalnie)</span>
            <textarea
              name="note"
              maxLength={500}
              rows={3}
              className="paper-wash focus:border-gold focus:ring-gold/20 mt-1.5 w-full resize-none rounded-xl border border-[#9a7657]/35 px-3 py-2.5 text-sm outline-none focus:ring-4"
              placeholder="Np. do następnego spotkania"
            />
          </label>
        </div>

        {state.status === "error" && state.message ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-[#9a3e31]">
            {state.message}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton
            type="submit"
            action="shelf"
            size="compact"
            loading={pending}
            loadingLabel="Zapisujemy wypożyczenie…"
            disabled={pending}
          >
            Zapisz wypożyczenie
          </ActionButton>
          <ActionButton
            type="button"
            action="neutral"
            size="compact"
            emphasis="secondary"
            onClick={onClose}
          >
            Anuluj
          </ActionButton>
        </div>
      </form>
    </div>,
    document.body,
  );
}

export function GameLoanControls({
  activeLoan,
  canManage,
  members,
  loanAction,
  returnAction,
}: {
  activeLoan: ActiveGameLoan | null;
  canManage: boolean;
  members: MemberOption[];
  loanAction: (
    state: GameLoanActionState,
    formData: FormData,
  ) => Promise<GameLoanActionState>;
  returnAction: (state: GameLoanActionState) => Promise<GameLoanActionState>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (activeLoan) {
    return (
      <section className="rounded-[1.1rem] border border-[#bb7650]/35 bg-[#f2dfc4]/70 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <MemberAvatar member={activeLoan.borrower} />
          <div className="min-w-0 flex-1">
            <p className="text-[0.58rem] font-bold tracking-[0.15em] text-[#a15d3f] uppercase">
              Aktywne wypożyczenie
            </p>
            <p className="truncate text-sm font-bold text-[#4d3528]">
              u {activeLoan.borrower.displayName}
            </p>
            <p className="text-[0.68rem] text-[#7a624e]">
              od {formatLoanDate(activeLoan.loanedAt)}
            </p>
          </div>
          {canManage ? <ReturnGameForm action={returnAction} /> : null}
        </div>
        {activeLoan.note ? (
          <p className="mt-2 border-t border-[#b99d72]/35 pt-2 text-xs leading-5 text-[#6c503c]">
            {activeLoan.note}
          </p>
        ) : null}
      </section>
    );
  }

  if (!canManage) return null;

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-[1.1rem] border border-dashed border-[#b99d72]/65 px-3 py-2.5">
        <p className="text-xs leading-5 text-[#715844]">
          Gra jest u właściciela i można ją komuś pożyczyć.
        </p>
        <ActionButton
          type="button"
          action="shelf"
          size="compact"
          onClick={() => setIsOpen(true)}
          disabled={members.length === 0}
        >
          Pożycz grę
        </ActionButton>
      </div>
      {isOpen ? (
        <LoanGameModal
          members={members}
          action={loanAction}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}
