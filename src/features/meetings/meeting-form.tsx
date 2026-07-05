"use client";

import { useActionState } from "react";
import { INITIAL_MEETING_FORM_STATE } from "./form-state";
import { MeetingDateField } from "./meeting-date-field";
import { MeetingSubmitButton } from "./meeting-submit-button";
import type { MeetingFormState, MeetingFormValues } from "./types";

type MeetingFormProps = {
  action: (
    state: MeetingFormState,
    formData: FormData,
  ) => Promise<MeetingFormState>;
  initialValues: MeetingFormValues;
  locationSuggestions: string[];
  submitLabel: string;
  pendingLabel: string;
};

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1.5 text-xs font-semibold text-[#8f3528]">{error}</p>;
}

export function MeetingForm({
  action,
  initialValues,
  locationSuggestions,
  submitLabel,
  pendingLabel,
}: MeetingFormProps) {
  const [state, formAction] = useActionState(
    action,
    INITIAL_MEETING_FORM_STATE,
  );
  const values = state.submittedValues ?? initialValues;
  const inputClass =
    "paper-wash focus:border-gold focus:ring-gold/20 mt-1.5 h-11 w-full rounded-xl border border-[#9a7657]/35 px-3.5 text-sm text-[#503828] outline-none transition focus:ring-4";
  const textareaClass = `${inputClass} h-auto min-h-28 py-3`;

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <label className="block text-sm font-semibold text-[#503828]">
          Nazwa spotkania
          <input
            className={inputClass}
            name="title"
            defaultValue={values.title}
            required
            maxLength={180}
          />
          <FieldError error={state.fieldErrors?.title} />
        </label>

        <label className="block text-sm font-semibold text-[#503828]">
          Lokalizacja
          <input
            className={inputClass}
            name="location"
            defaultValue={values.location}
            placeholder="np. Górska Chata u Michała"
            list="meeting-location-suggestions"
          />
          <datalist id="meeting-location-suggestions">
            {locationSuggestions.map((location) => (
              <option key={location} value={location} />
            ))}
          </datalist>
          <FieldError error={state.fieldErrors?.location} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MeetingDateField
          key={`start-${values.startDate}`}
          name="startDate"
          label="Data od"
          defaultValue={values.startDate}
          error={state.fieldErrors?.startDate}
          inputClassName={inputClass}
        />

        <MeetingDateField
          key={`end-${values.endDate}`}
          name="endDate"
          label="Data do"
          defaultValue={values.endDate}
          error={state.fieldErrors?.endDate}
          inputClassName={inputClass}
        />

        <label className="block text-sm font-semibold text-[#503828]">
          Od
          <input
            className={inputClass}
            name="startTime"
            defaultValue={values.startTime}
            placeholder="HH:mm"
            inputMode="numeric"
          />
          <FieldError error={state.fieldErrors?.startTime} />
        </label>

        <label className="block text-sm font-semibold text-[#503828]">
          Do
          <input
            className={inputClass}
            name="endTime"
            defaultValue={values.endTime}
            placeholder="HH:mm"
            inputMode="numeric"
          />
          <FieldError error={state.fieldErrors?.endTime} />
        </label>
      </div>

      <label className="block text-sm font-semibold text-[#503828]">
        Opis
        <textarea
          className={textareaClass}
          name="description"
          defaultValue={values.description}
          placeholder="Co planujemy na ten wieczór?"
        />
        <FieldError error={state.fieldErrors?.description} />
      </label>

      {state.message && state.status === "error" ? (
        <div className="rounded-xl border border-[#8f3528]/18 bg-[#fff2ef] px-4 py-3 text-sm text-[#7b3428]">
          {state.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <MeetingSubmitButton label={submitLabel} pendingLabel={pendingLabel} />
      </div>
    </form>
  );
}
