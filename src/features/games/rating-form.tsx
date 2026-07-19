"use client";

import { useActionState, useState } from "react";
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
    "paper-wash focus:border-gold focus:ring-gold/20 mt-1 h-10 w-full rounded-xl border border-[#9a7657]/35 bg-[#fff9ee] px-3 text-sm font-bold text-[#503828] outline-none transition focus:ring-4";

  return (
    <label className="block text-xs font-semibold text-[#503828]">
      {label}
      <select
        className={inputClass}
        name={name}
        defaultValue={defaultValue?.toString() ?? ""}
      >
        <option value="" className="text-[#6f5640]">
          Wybierz
        </option>
        {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
          <option key={value} value={value} className="text-[#503828]">
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
  const [wantsToPlayAgain, setWantsToPlayAgain] = useState(
    ownRating ? String(ownRating.wantsToPlayAgain) : "true",
  );
  const textareaClass =
    "paper-wash focus:border-gold focus:ring-gold/20 mt-1 min-h-20 w-full rounded-xl border border-[#9a7657]/35 px-3 py-2.5 text-sm text-[#503828] outline-none transition focus:ring-4 sm:min-h-24";

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-2.5 min-[380px]:grid-cols-2 md:grid-cols-3">
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
        <legend className="text-xs font-semibold text-[#503828]">
          Chęć zagrania ponownie
        </legend>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {[
            {
              value: "true",
              label: "TAK",
              selectedClass:
                "border-[#3f704d] bg-[#3f704d] text-[#fff9ed] ring-[#3f704d]/25",
            },
            {
              value: "false",
              label: "NIE",
              selectedClass:
                "border-[#963f35] bg-[#963f35] text-[#fff9ed] ring-[#963f35]/25",
            },
          ].map((option) => (
            <label key={option.value} className="cursor-pointer">
              <input
                type="radio"
                name="wantsToPlayAgain"
                value={option.value}
                checked={wantsToPlayAgain === option.value}
                onChange={() => setWantsToPlayAgain(option.value)}
                className="sr-only"
              />
              <span
                className={`inline-flex w-full items-center justify-center rounded-xl border px-3 py-2 text-xs font-bold tracking-[0.12em] transition-colors ${
                  wantsToPlayAgain === option.value
                    ? `${option.selectedClass} ring-2`
                    : "paper-wash border-[#9a7657]/28 bg-[#fff9ee] text-[#6d5037]"
                }`}
              >
                {option.label}
              </span>
            </label>
          ))}
        </div>
        <RatingFieldError error={state.fieldErrors?.wantsToPlayAgain} />
      </fieldset>

      <label className="block text-xs font-semibold text-[#503828]">
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
