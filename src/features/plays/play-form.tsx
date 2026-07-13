"use client";

import { useActionState, useMemo, useState } from "react";
import { MeetingDateField } from "@/features/meetings/meeting-date-field";
import { getMeetingOptionDisplayLabel } from "./formatting";
import { INITIAL_PLAY_FORM_STATE } from "./form-state";
import { PlayParticipantsField } from "./play-participants-field";
import { PlayPicker, type CompactPickerOption } from "./play-picker";
import { PlaySubmitButton } from "./play-submit-button";
import type { PlayFormData, PlayFormState, PlayFormValues } from "./types";

type PlayFormProps = {
  action: (state: PlayFormState, formData: FormData) => Promise<PlayFormState>;
  initialValues: PlayFormValues;
  games: PlayFormData["games"];
  meetings: PlayFormData["meetings"];
  members: PlayFormData["members"];
  submitLabel: string;
  pendingLabel: string;
};

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1.5 text-xs font-semibold text-[#8f3528]">{error}</p>;
}

function ProgressiveCommentField({
  defaultValue,
  error,
  textareaClass,
}: {
  defaultValue: string;
  error?: string;
  textareaClass: string;
}) {
  const [isOpen, setIsOpen] = useState(Boolean(defaultValue));

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-accent rounded-full px-3 py-1.5 text-xs font-bold transition hover:bg-[#f5e7d2]"
      >
        + Dodaj komentarz
      </button>
    );
  }

  return (
    <label className="block text-sm font-semibold text-[#503828]">
      Komentarz
      <textarea
        className={textareaClass}
        name="comment"
        defaultValue={defaultValue}
        placeholder="Krótka notatka z partii"
      />
      <FieldError error={error} />
    </label>
  );
}

export function PlayForm({
  action,
  initialValues,
  games,
  meetings,
  members,
  submitLabel,
  pendingLabel,
}: PlayFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_PLAY_FORM_STATE);
  const values = state.submittedValues ?? initialValues;

  const inputClass =
    "paper-wash focus:border-gold focus:ring-gold/20 mt-1.5 h-11 w-full rounded-xl border border-[#9a7657]/35 px-3.5 text-sm text-[#503828] outline-none transition focus:ring-4";
  const textareaClass = `${inputClass} h-auto min-h-24 py-3`;

  const gameOptions = useMemo(
    () =>
      games.map(
        (game) =>
          ({
            id: game.id,
            title: game.title,
            subtitle: `Właściciel: ${game.ownerName}`,
            coverUrl: game.coverUrl,
          }) satisfies CompactPickerOption,
      ),
    [games],
  );

  const meetingOptions = useMemo(
    () =>
      meetings.map(
        (meeting) =>
          ({
            id: meeting.id,
            title: meeting.title,
            subtitle: getMeetingOptionDisplayLabel(meeting),
          }) satisfies CompactPickerOption,
      ),
    [meetings],
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <PlayPicker
          key={`game-${values.gameId || "empty"}`}
          name="gameId"
          label="Gra"
          placeholder="Szukaj gry..."
          emptyLabel="Brak pasujących gier."
          options={gameOptions}
          defaultValue={values.gameId}
          error={state.fieldErrors?.gameId}
          required
        />

        <PlayPicker
          key={`meeting-${values.meetingId || "empty"}`}
          name="meetingId"
          label="Spotkanie opcjonalne"
          placeholder="Spotkanie albo partia spontaniczna"
          emptyLabel="Brak pasujących spotkań."
          options={meetingOptions}
          defaultValue={values.meetingId}
          error={state.fieldErrors?.meetingId}
          allowClear
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <MeetingDateField
          key={`played-${values.playedOnDate}`}
          name="playedOnDate"
          label="Data"
          defaultValue={values.playedOnDate}
          error={state.fieldErrors?.playedOnDate}
          inputClassName={inputClass}
        />

        <label className="block text-sm font-semibold text-[#503828]">
          Godzina
          <input
            className={inputClass}
            name="playedOnTime"
            defaultValue={values.playedOnTime}
            placeholder="HH:mm"
            inputMode="numeric"
          />
          <FieldError error={state.fieldErrors?.playedOnTime} />
        </label>

        <label className="col-span-2 block text-sm font-semibold text-[#503828] sm:col-span-1">
          Czas gry
          <input
            className={inputClass}
            name="durationMinutes"
            defaultValue={values.durationMinutes}
            placeholder="np. 90"
            inputMode="numeric"
          />
          <FieldError error={state.fieldErrors?.durationMinutes} />
        </label>
      </div>

      <section className="space-y-2.5">
        <div>
          <p className="text-accent text-[0.58rem] font-bold tracking-[0.18em] uppercase">
            Gracze
          </p>
          <h2 className="font-display mt-1 text-[1.3rem] font-semibold text-[#4c3528]">
            Wynik partii
          </h2>
        </div>

        <PlayParticipantsField
          key={`participants-${JSON.stringify(values.participants)}`}
          members={members}
          defaultValue={values.participants}
          error={state.fieldErrors?.participants}
          participantErrors={state.participantFieldErrors}
        />
      </section>

      <section className="space-y-2">
        <ProgressiveCommentField
          key={`comment-${values.comment}`}
          defaultValue={values.comment}
          error={state.fieldErrors?.comment}
          textareaClass={textareaClass}
        />
      </section>

      {state.message && state.status === "error" ? (
        <div className="rounded-xl border border-[#8f3528]/18 bg-[#fff2ef] px-4 py-3 text-sm text-[#7b3428]">
          {state.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <PlaySubmitButton label={submitLabel} pendingLabel={pendingLabel} />
      </div>
    </form>
  );
}
