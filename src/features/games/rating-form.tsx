"use client";

import { useActionState } from "react";
import { GameSubmitButton } from "./game-submit-button";
import { INITIAL_RATING_FORM_STATE } from "./form-state";
import type { OwnGameRating, RatingFormState } from "./types";

type RatingFormProps = {
  ownRating: OwnGameRating | null;
  action: (
    state: RatingFormState,
    formData: FormData,
  ) => Promise<RatingFormState>;
};

function RatingFieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1.5 text-xs font-semibold text-[#8f3528]">{error}</p>;
}

function RatingSelect({
  name,
  label,
  defaultValue,
  error,
}: {
  name: "overall" | "replayability" | "theme";
  label: string;
  defaultValue?: number;
  error?: string;
}) {
  const inputClass =
    "paper-wash focus:border-gold focus:ring-gold/20 mt-1.5 h-11 w-full rounded-xl border border-[#9a7657]/35 px-3.5 text-sm text-[#503828] outline-none transition focus:ring-4";

  return (
    <label className="block text-sm font-semibold text-[#503828]">
      {label}
      <select
        className={inputClass}
        name={name}
        defaultValue={defaultValue?.toString() ?? ""}
      >
        <option value="">Wybierz</option>
        {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <RatingFieldError error={error} />
    </label>
  );
}

export function RatingForm({ ownRating, action }: RatingFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_RATING_FORM_STATE);
  const textareaClass =
    "paper-wash focus:border-gold focus:ring-gold/20 mt-1.5 min-h-28 w-full rounded-xl border border-[#9a7657]/35 px-3.5 py-3 text-sm text-[#503828] outline-none transition focus:ring-4";

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <RatingSelect
          name="overall"
          label="Ocena ogólna"
          defaultValue={ownRating?.overall}
          error={state.fieldErrors?.overall}
        />
        <RatingSelect
          name="replayability"
          label="Regrywalność"
          defaultValue={ownRating?.replayability}
          error={state.fieldErrors?.replayability}
        />
        <RatingSelect
          name="theme"
          label="Klimat"
          defaultValue={ownRating?.theme}
          error={state.fieldErrors?.theme}
        />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-[#503828]">
          Chęć zagrania ponownie
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[
            { value: "true", label: "TAK" },
            { value: "false", label: "NIE" },
          ].map((option) => (
            <label key={option.value} className="cursor-pointer">
              <input
                type="radio"
                name="wantsToPlayAgain"
                value={option.value}
                defaultChecked={
                  ownRating
                    ? String(ownRating.wantsToPlayAgain) === option.value
                    : option.value === "true"
                }
                className="peer sr-only"
              />
              <span className="paper-wash peer-checked:bg-brand peer-checked:text-cream peer-checked:ring-brand/20 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold tracking-[0.12em] text-[#6d5037] transition-colors peer-checked:ring-2">
                {option.label}
              </span>
            </label>
          ))}
        </div>
        <RatingFieldError error={state.fieldErrors?.wantsToPlayAgain} />
      </fieldset>

      <label className="block text-sm font-semibold text-[#503828]">
        Komentarz
        <textarea
          className={textareaClass}
          name="comment"
          defaultValue={ownRating?.comment ?? ""}
          placeholder="Co najbardziej zadziałało przy stole?"
        />
        <RatingFieldError error={state.fieldErrors?.comment} />
      </label>

      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`rounded-xl px-4 py-3 text-sm ${
            state.status === "error"
              ? "bg-[#8f3528]/10 text-[#8f3528]"
              : "bg-moss/12 text-moss"
          }`}
        >
          {state.message}
        </p>
      )}

      <GameSubmitButton pendingLabel="Zapisujemy ocenę…">
        {ownRating ? "Zapisz zmiany oceny" : "Oceń tę grę"}
      </GameSubmitButton>
    </form>
  );
}
