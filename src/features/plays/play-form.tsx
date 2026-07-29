"use client";

import { useActionState, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useCanWrite } from "@/features/auth/member-role-context";
import { MeetingDateField } from "@/features/meetings/meeting-date-field";
import { getMeetingOptionDisplayLabel } from "./formatting";
import { INITIAL_PLAY_FORM_STATE } from "./form-state";
import { PlayParticipantsField } from "./play-participants-field";
import { PlayPicker, type CompactPickerOption } from "./play-picker";
import { PlayPhotoDraftsField } from "./play-photo-drafts-field";
import { PlayPhotosField } from "./play-photos-field";
import { PlaySubmitButton } from "./play-submit-button";
import { reorderPlayPhotosAction } from "./photo-actions";
import {
  allDraftsUploaded,
  applyDraftUploadResult,
  selectDraftsToUpload,
  uploadStagedPhotos,
  type PhotoDraft,
} from "./photo-upload";
import type { CreatePlayActionResult } from "./actions";
import type {
  PlayFormData,
  PlayFormState,
  PlayFormValues,
  PlayMode,
  PlayPhoto,
  PlayStatus,
  PlayTeamResult,
} from "./types";

type PlayFormProps = {
  initialValues: PlayFormValues;
  games: PlayFormData["games"];
  meetings: PlayFormData["meetings"];
  members: PlayFormData["members"];
  submitLabel: string;
  pendingLabel: string;
} & (
  | {
      mode: "edit";
      action: (
        state: PlayFormState,
        formData: FormData,
      ) => Promise<PlayFormState>;
      playId: string;
      initialPhotos: PlayPhoto[];
    }
  | {
      mode: "create";
      action: (formData: FormData) => Promise<CreatePlayActionResult>;
    }
);

type SubmitPhase = "idle" | "saving-play" | "uploading-photos";

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1.5 text-xs font-semibold text-[#8f3528]">{error}</p>;
}

function PlayStatusToggle({
  status,
  onChange,
}: {
  status: PlayStatus;
  onChange: (status: PlayStatus) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-[#9a7657]/35 bg-white/60 p-1">
      <input type="hidden" name="status" value={status} />
      {(
        [
          { value: "completed" as const, label: "Zakończona" },
          { value: "in_progress" as const, label: "W toku" },
        ] satisfies Array<{ value: PlayStatus; label: string }>
      ).map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={status === option.value}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
            status === option.value
              ? "bg-[#7d2f3d] text-[#fff3ec]"
              : "text-[#6b5140] hover:bg-[#f4e5cf]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PlayModeToggle({
  mode,
  onChange,
}: {
  mode: PlayMode;
  onChange: (mode: PlayMode) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-[#9a7657]/35 bg-white/60 p-1">
      <input type="hidden" name="mode" value={mode} />
      {(
        [
          { value: "competitive" as const, label: "Rywalizacja" },
          { value: "cooperative" as const, label: "Kooperacja" },
        ] satisfies Array<{ value: PlayMode; label: string }>
      ).map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={mode === option.value}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
            mode === option.value
              ? "bg-[#7d2f3d] text-[#fff3ec]"
              : "text-[#6b5140] hover:bg-[#f4e5cf]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TeamResultToggle({
  teamResult,
  onChange,
  disabled,
}: {
  teamResult: PlayTeamResult | "";
  onChange: (teamResult: PlayTeamResult) => void;
  disabled: boolean;
}) {
  return (
    <div className="inline-flex rounded-full border border-[#9a7657]/35 bg-white/60 p-1">
      <input type="hidden" name="teamResult" value={teamResult} />
      {(
        [
          { value: "win" as const, label: "Drużyna wygrała" },
          { value: "loss" as const, label: "Drużyna przegrała" },
        ] satisfies Array<{ value: PlayTeamResult; label: string }>
      ).map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          aria-pressed={teamResult === option.value}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition disabled:opacity-45 ${
            teamResult === option.value
              ? "bg-[#7d2f3d] text-[#fff3ec]"
              : "text-[#6b5140] hover:bg-[#f4e5cf]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
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

async function noopEditAction(state: PlayFormState): Promise<PlayFormState> {
  return state;
}

export function PlayForm(props: PlayFormProps) {
  const { initialValues, games, meetings, members, submitLabel, pendingLabel } =
    props;
  const isCreateMode = props.mode === "create";
  const router = useRouter();

  // Edit mode's existing action/redirect flow is untouched — it's driven by
  // useActionState. In create mode this hook call is a required no-op
  // (rules of hooks: it must run every render regardless of mode) since the
  // create <form> below uses onSubmit instead, so it can upload staged
  // photos and navigate only after the play is created.
  const [editState, editFormAction] = useActionState(
    props.mode === "edit" ? props.action : noopEditAction,
    INITIAL_PLAY_FORM_STATE,
  );

  const [createFormState, setCreateFormState] = useState<PlayFormState>(
    INITIAL_PLAY_FORM_STATE,
  );
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("idle");
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [createdPlayId, setCreatedPlayId] = useState<string | null>(null);
  const [photoDrafts, setPhotoDrafts] = useState<PhotoDraft[]>([]);
  const hasPhotoUploadError = photoDrafts.some(
    (draft) => draft.status === "error",
  );
  const photosFullyUploaded = allDraftsUploaded(photoDrafts);

  const formState = isCreateMode ? createFormState : editState;
  const values = formState.submittedValues ?? initialValues;
  const [status, setStatus] = useState<PlayStatus>(values.status);
  const [mode, setMode] = useState<PlayMode>(values.mode);
  const [teamResult, setTeamResult] = useState<PlayTeamResult | "">(
    values.teamResult,
  );

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

  // Shared by the initial submit and the standalone retry button — always
  // called with a playId that already exists, so it only ever (re)uploads
  // drafts that haven't succeeded yet (selectDraftsToUpload skips "done"
  // ones) and never creates a second play.
  async function uploadStagedDraftsAndFinish(playId: string) {
    const draftsToUpload = selectDraftsToUpload(photoDrafts);
    let allSucceeded = true;

    if (draftsToUpload.length > 0) {
      setSubmitPhase("uploading-photos");
      let doneCount = photoDrafts.length - draftsToUpload.length;
      setUploadProgress({ done: doneCount, total: photoDrafts.length });

      const uploadingIds = new Set(draftsToUpload.map((draft) => draft.id));
      setPhotoDrafts((current) =>
        current.map((draft) =>
          uploadingIds.has(draft.id)
            ? { ...draft, status: "uploading" as const }
            : draft,
        ),
      );

      await uploadStagedPhotos({
        playId,
        items: draftsToUpload.map((draft) => ({
          id: draft.id,
          compressed: draft.compressed!,
        })),
        onItemResult: (draftId, result) => {
          setPhotoDrafts((current) =>
            applyDraftUploadResult(current, draftId, result),
          );

          if (result.ok) {
            doneCount += 1;
            setUploadProgress((current) => ({ ...current, done: doneCount }));
          } else {
            allSucceeded = false;
          }
        },
      });
    }

    setIsCreateSubmitting(false);
    setSubmitPhase("idle");

    if (!allSucceeded) return;

    if (draftsToUpload.length > 0) {
      // Concurrent uploads can finish out of order, and a photo's position
      // is auto-assigned by insertion order — this locks the final order
      // back to what the user staged.
      await reorderPlayPhotosAction(
        playId,
        photoDrafts.map((draft) => draft.id),
      );
    }

    router.push(`/kronika/${playId}`);
  }

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (props.mode !== "create") return;
    if (isCreateSubmitting) return;

    setIsCreateSubmitting(true);

    let playId = createdPlayId;

    if (!playId) {
      setSubmitPhase("saving-play");
      setCreateFormState(INITIAL_PLAY_FORM_STATE);

      const formData = new FormData(event.currentTarget);
      const result = await props.action(formData);

      if (!result.ok) {
        setCreateFormState(result.formState);
        setIsCreateSubmitting(false);
        setSubmitPhase("idle");
        return;
      }

      playId = result.playId;
      setCreatedPlayId(playId);
    }

    await uploadStagedDraftsAndFinish(playId);
  }

  async function handleRetryUpload() {
    if (!createdPlayId || isCreateSubmitting) return;
    setIsCreateSubmitting(true);
    await uploadStagedDraftsAndFinish(createdPlayId);
  }

  const canWrite = useCanWrite();
  const nonPhotoFieldsDisabled =
    !canWrite ||
    (isCreateMode && (isCreateSubmitting || Boolean(createdPlayId)));
  const baseLabel =
    status === "in_progress" ? "Zapisz grę w toku" : submitLabel;
  const submitButtonLabel =
    isCreateMode && createdPlayId ? "Wyślij zdjęcia ponownie" : baseLabel;
  const submitButtonPendingLabel = isCreateMode
    ? submitPhase === "saving-play"
      ? "Zapisywanie partii…"
      : submitPhase === "uploading-photos"
        ? `Wysyłanie zdjęć ${uploadProgress.done}/${uploadProgress.total}…`
        : pendingLabel
    : pendingLabel;

  const formFields = (
    <>
      <fieldset disabled={nonPhotoFieldsDisabled} className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <PlayPicker
            key={`game-${values.gameId || "empty"}`}
            name="gameId"
            label="Gra"
            placeholder="Szukaj gry..."
            emptyLabel="Brak pasujących gier."
            options={gameOptions}
            defaultValue={values.gameId}
            error={formState.fieldErrors?.gameId}
            required
          />

          <PlayPicker
            key={`meeting-${values.meetingId || "empty"}`}
            name="meetingId"
            label="Wybór spotkania"
            placeholder="Spotkanie albo partia spontaniczna"
            emptyLabel="Brak pasujących spotkań."
            options={meetingOptions}
            defaultValue={values.meetingId}
            error={formState.fieldErrors?.meetingId}
            allowClear
          />
        </div>

        {/*
         * grid-cols-[55fr_45fr] (mobile only — sm:grid-cols-3 for
         * tablet/desktop is untouched) gives Data ~55% and Godzina ~45%
         * of the row, matching the requested ratio without affecting
         * desktop's 3-column layout.
         */}
        <div className="grid grid-cols-[55fr_45fr] gap-3 sm:grid-cols-3 sm:gap-4">
          <MeetingDateField
            key={`played-${values.playedOnDate}`}
            name="playedOnDate"
            label="Data"
            defaultValue={values.playedOnDate}
            error={formState.fieldErrors?.playedOnDate}
            inputClassName={inputClass}
          />

          {/*
           * Godzina's <input> sits directly next to the "Godzina" text
           * node inside the <label>, unlike Data's (wrapped in its own
           * block div by MeetingDateField). Measured with Playwright:
           * both inputs are h-11 (44px) but were offset by 6px top/
           * bottom — and forcing `display:block` on the input alone
           * did NOT fix it (still exactly -6px), so the gap isn't just
           * inline-vs-block display, it's the text/input arrangement
           * itself. Mirroring Data's own block-div wrapper exactly is
           * what actually fixes it (verified below).
           *
           * Kept mobile-only via `sm:contents` on the wrapper: at sm:+
           * a `display:contents` element generates no box of its own
           * (its margin is void) and its child renders as if it were a
           * direct child of the <label> again — i.e. pixel-identical to
           * the original structure, so this field stays exactly where
           * it was next to "Czas gry" on tablet/desktop. `sm:mt-1.5` on
           * the input restores its own original margin for that case
           * (the div's mt-1.5 does nothing once it's `contents`).
           */}
          <label className="block text-sm font-semibold text-[#503828]">
            Godzina
            <div className="relative mt-1.5 sm:contents">
              <input
                className={`${inputClass} mt-0 sm:mt-1.5`}
                name="playedOnTime"
                defaultValue={values.playedOnTime}
                placeholder="HH:mm"
                inputMode="numeric"
              />
            </div>
            <FieldError error={formState.fieldErrors?.playedOnTime} />
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
            <FieldError error={formState.fieldErrors?.durationMinutes} />
          </label>
        </div>

        <section className="space-y-2.5">
          <div>
            <p className="text-accent text-[0.58rem] font-bold tracking-[0.18em] uppercase">
              Stan gry
            </p>
            <h2 className="font-display mt-1 text-[1.3rem] font-semibold text-[#4c3528]">
              Zapisz jako
            </h2>
          </div>

          <PlayStatusToggle status={status} onChange={setStatus} />

          {status === "in_progress" ? (
            <label className="block text-sm font-semibold text-[#503828]">
              Notatka o stanie gry
              <textarea
                className={textareaClass}
                name="stateNote"
                defaultValue={values.stateNote}
                placeholder="np. Runda 3 z 5, wracamy do gry jutro wieczorem"
                required
              />
              <FieldError error={formState.fieldErrors?.stateNote} />
            </label>
          ) : null}
        </section>

        <section className="space-y-2.5">
          <div>
            <p className="text-accent text-[0.58rem] font-bold tracking-[0.18em] uppercase">
              Gracze
            </p>
            <h2 className="font-display mt-1 text-[1.3rem] font-semibold text-[#4c3528]">
              Wynik partii
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PlayModeToggle
              mode={mode}
              onChange={(nextMode) => {
                setMode(nextMode);
                // Wynik drużyny istnieje tylko w kooperacji — przy powrocie do
                // rywalizacji musi zniknąć, inaczej zapis zostałby odrzucony.
                if (nextMode === "competitive") setTeamResult("");
              }}
            />

            {mode === "cooperative" ? (
              <TeamResultToggle
                teamResult={teamResult}
                onChange={setTeamResult}
                disabled={status !== "completed"}
              />
            ) : null}
          </div>

          {mode === "cooperative" ? (
            <p className="text-xs text-[#6b5140]">
              W grze kooperacyjnej wynik dotyczy całej drużyny — nie ma miejsc
              ani indywidualnego zwycięzcy.
            </p>
          ) : null}

          <FieldError error={formState.fieldErrors?.teamResult} />

          <PlayParticipantsField
            key={`participants-${JSON.stringify(values.participants)}`}
            members={members}
            defaultValue={values.participants}
            status={status}
            mode={mode}
            teamResult={teamResult}
            error={formState.fieldErrors?.participants}
            participantErrors={formState.participantFieldErrors}
          />
        </section>

        <section className="space-y-2">
          <ProgressiveCommentField
            key={`comment-${values.comment}`}
            defaultValue={values.comment}
            error={formState.fieldErrors?.comment}
            textareaClass={textareaClass}
          />
        </section>
      </fieldset>

      {isCreateMode ? (
        <section>
          {createdPlayId ? (
            hasPhotoUploadError && !isCreateSubmitting ? (
              <div className="mb-2.5 space-y-2 rounded-xl bg-[#fff2ef] px-3 py-2 text-xs font-semibold text-[#7b3428]">
                <p>
                  Partia została zapisana, ale nie wszystkie zdjęcia się
                  wysłały.
                </p>
                <button
                  type="button"
                  onClick={handleRetryUpload}
                  className="rounded-full bg-[#7b3428] px-3 py-1.5 text-[0.7rem] font-bold text-white"
                >
                  Spróbuj ponownie
                </button>
              </div>
            ) : photosFullyUploaded ? (
              <p className="bg-moss-soft text-moss mb-2.5 rounded-xl px-3 py-2 text-xs font-semibold">
                Partia została zapisana. Zdjęcia zostały wysłane.
              </p>
            ) : (
              <p className="mb-2.5 rounded-xl bg-[#f7e7b8] px-3 py-2 text-xs font-semibold text-[#6d5319]">
                Partia została zapisana. Trwa wysyłanie zdjęć.
              </p>
            )
          ) : null}
          <PlayPhotoDraftsField
            drafts={photoDrafts}
            onDraftsChange={setPhotoDrafts}
            disabled={isCreateSubmitting || !canWrite}
            uploadProgress={uploadProgress}
          />
        </section>
      ) : props.mode === "edit" ? (
        <section>
          <PlayPhotosField
            playId={props.playId}
            initialPhotos={props.initialPhotos}
          />
        </section>
      ) : null}

      {formState.message && formState.status === "error" ? (
        <div className="rounded-xl border border-[#8f3528]/18 bg-[#fff2ef] px-4 py-3 text-sm text-[#7b3428]">
          {formState.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <PlaySubmitButton
          label={submitButtonLabel}
          pendingLabel={submitButtonPendingLabel}
          pendingOverride={isCreateMode ? isCreateSubmitting : undefined}
        />
      </div>
    </>
  );

  if (isCreateMode) {
    return (
      <form onSubmit={handleCreateSubmit} className="space-y-5">
        {formFields}
      </form>
    );
  }

  return (
    <form action={editFormAction} className="space-y-5">
      {formFields}
    </form>
  );
}
