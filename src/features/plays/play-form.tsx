"use client";

import { useActionState, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useCanWrite } from "@/features/auth/member-role-context";
import { MeetingDateField } from "@/features/meetings/meeting-date-field";
import { TimeInput } from "@/components/ui/time-input";
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
  /**
   * Dokąd wrócić po zapisie. Jedyna dopuszczalna wartość to "stol" — używa jej
   * zakończenie partii granej przy stole, żeby po zapisie wyniku wylądować na
   * Stole z podsumowaniem, a nie w Kronice. Brak wartości = zachowanie
   * dotychczasowe (przejście do wpisu partii).
   */
  returnTo?: "stol";
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

/*
  Wspólny segmented control dla trzech przełączników formularza. Odkąd „Zapisz
  jako” i „Wynik partii” stoją obok siebie, każdy z nich dostaje tylko połowę
  szerokości karty — na telefonie to ok. 118px, w czym dwa poziome segmenty z
  etykietą „Zakończona” nie mieszczą się w żadnym rozsądnym stopniu pisma.
  Dlatego kontrolka układa segmenty w pionie i przechodzi na klasyczny poziomy
  pasek dopiero od 30rem, gdy kolumna ma na to miejsce. Segmenty są pełnej
  szerokości kolumny, więc cel dotknięcia rośnie zamiast maleć.
*/
function SegmentedControl<Value extends string>({
  name,
  value,
  options,
  onChange,
  disabled = false,
}: {
  name: string;
  value: Value | "";
  options: ReadonlyArray<{ value: Value; label: string }>;
  onChange: (value: Value) => void;
  disabled?: boolean;
}) {
  return (
    // auto-rows-fr wyrównuje segmenty, gdy dłuższa etykieta łamie się na dwie
    // linie — bez tego jeden segment jest wyraźnie wyższy od drugiego.
    <div className="grid auto-rows-fr grid-cols-1 gap-1 rounded-[1.1rem] border border-[#9a7657]/35 bg-white/60 p-1 min-[30rem]:grid-cols-2 min-[30rem]:rounded-full">
      <input type="hidden" name={name} value={value} />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={`min-w-0 rounded-full px-2 py-1.5 text-center text-[0.7rem] leading-4 font-bold text-balance transition disabled:opacity-45 sm:px-3.5 sm:text-xs ${
            value === option.value
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

const PLAY_STATUS_OPTIONS = [
  { value: "completed", label: "Zakończona" },
  { value: "in_progress", label: "W toku" },
] as const satisfies ReadonlyArray<{ value: PlayStatus; label: string }>;

const PLAY_MODE_OPTIONS = [
  { value: "competitive", label: "Rywalizacja" },
  { value: "cooperative", label: "Kooperacja" },
] as const satisfies ReadonlyArray<{ value: PlayMode; label: string }>;

// Kontekst drużynowy niesie już wybrany tryb „Kooperacja” obok, więc etykiety
// zostają krótkie — dzięki temu mieszczą się w jednej linii nawet na 320px.
const TEAM_RESULT_OPTIONS = [
  { value: "win", label: "Wygrana" },
  { value: "loss", label: "Porażka" },
] as const satisfies ReadonlyArray<{ value: PlayTeamResult; label: string }>;

function FormColumnHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-accent text-[0.55rem] font-bold tracking-[0.16em] uppercase sm:text-[0.58rem] sm:tracking-[0.18em]">
        {eyebrow}
      </p>
      <h2 className="font-display mt-0.5 text-[1.05rem] leading-tight font-bold text-[#4c3528] sm:mt-1 sm:text-[1.3rem]">
        {title}
      </h2>
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
      {props.returnTo ? (
        <input type="hidden" name="returnTo" value={props.returnTo} />
      ) : null}

      <fieldset disabled={nonPhotoFieldsDisabled} className="space-y-5">
        {/* Szersza kolumna należy się spotkaniu, nie grze: tytuł gry to jeden
            człon, a spotkanie niesie nazwę razem z datą i godziną. Rząd schodzi
            w pion poniżej lg, gdzie na dwie kolumny po prostu nie ma
            szerokości. */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
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
          Data i Godzina dzielą jeden wiersz na każdej szerokości — jawna liczba
          kolumn sprawia, że Godzina nie ma jak zjechać pod Datę. Data dostaje
          więcej miejsca, bo „dd/MM/rrrr” jest dłuższe od „HH:mm”. Czas gry
          dołącza do rzędu od sm, a poniżej idzie pełną szerokością pod spodem.

          items-start: błąd walidacji pod jednym polem nie rozciąga sąsiadów.
        */}
        <div className="grid grid-cols-[55fr_45fr] items-start gap-3 sm:grid-cols-3 sm:gap-4">
          <MeetingDateField
            key={`played-${values.playedOnDate}`}
            name="playedOnDate"
            label="Data"
            defaultValue={values.playedOnDate}
            error={formState.fieldErrors?.playedOnDate}
            inputClassName={inputClass}
          />

          {/*
            Ten sam szkielet co w MeetingDateField: etykieta, potem input
            zamknięty we WŁASNYM blokowym divie. To nie jest kosmetyka — input
            postawiony wprost obok tekstowego węzła etykiety jest pudełkiem
            liniowym i siada na linii bazowej tekstu, przez co był przesunięty
            o 6px względem Daty. Wyrównanie bierze się z identycznej struktury,
            nie z korekt per breakpoint, więc trzyma się na każdej szerokości.
          */}
          <label className="block text-sm font-semibold text-[#503828]">
            Godzina
            <div className="relative mt-1.5">
              <TimeInput
                className={`${inputClass} mt-0`}
                name="playedOnTime"
                defaultValue={values.playedOnTime}
              />
            </div>
            <FieldError error={formState.fieldErrors?.playedOnTime} />
          </label>

          <label className="col-span-2 block text-sm font-semibold text-[#503828] sm:col-span-1">
            Czas gry
            <div className="relative mt-1.5">
              <input
                className={`${inputClass} mt-0`}
                name="durationMinutes"
                defaultValue={values.durationMinutes}
                placeholder="np. 90"
                inputMode="numeric"
              />
            </div>
            <FieldError error={formState.fieldErrors?.durationMinutes} />
          </label>
        </div>

        <section className="space-y-2.5">
          {/*
            Dwie decyzje o charakterze partii stoją obok siebie w jednym rzędzie
            — także na telefonie. 1fr 1fr plus min-w-0 na kolumnach gwarantuje,
            że żadna nie rozepchnie siatki, a węższy gap na mobile odzyskuje
            miejsce dla samych kontrolek.
          */}
          <div className="grid grid-cols-2 items-start gap-x-2.5 gap-y-3 sm:gap-x-4">
            <div className="min-w-0 space-y-2">
              <FormColumnHeading eyebrow="Stan gry" title="Zapisz jako" />
              <SegmentedControl
                name="status"
                value={status}
                options={PLAY_STATUS_OPTIONS}
                onChange={setStatus}
              />
            </div>

            <div className="min-w-0 space-y-2">
              <FormColumnHeading eyebrow="Gracze" title="Wynik partii" />
              <SegmentedControl
                name="mode"
                value={mode}
                options={PLAY_MODE_OPTIONS}
                onChange={(nextMode) => {
                  setMode(nextMode);
                  // Wynik drużyny istnieje tylko w kooperacji — przy powrocie do
                  // rywalizacji musi zniknąć, inaczej zapis zostałby odrzucony.
                  if (nextMode === "competitive") setTeamResult("");
                }}
              />

              {mode === "cooperative" ? (
                <SegmentedControl
                  name="teamResult"
                  value={teamResult}
                  options={TEAM_RESULT_OPTIONS}
                  onChange={setTeamResult}
                  disabled={status !== "completed"}
                />
              ) : null}
            </div>
          </div>

          {/* Treść zależna od wyborów wraca na pełną szerokość — w połówce
              kolumny textarea i lista graczy byłyby nie do użycia. */}
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
