"use client";

import { useActionState, useState } from "react";
import type { CurrentMember } from "@/features/auth/types";
import { GameSubmitButton } from "./game-submit-button";
import { INITIAL_GAME_FORM_STATE } from "./form-state";
import { GAME_STATUS_LABELS } from "./formatting";
import type {
  GameExpansionFormValue,
  GameFormState,
  GameFormValues,
  MemberOption,
} from "./types";

type GameFormProps = {
  action: (state: GameFormState, formData: FormData) => Promise<GameFormState>;
  initialValues: GameFormValues;
  members: MemberOption[];
  actor: CurrentMember;
  submitLabel: string;
  pendingLabel: string;
  canTransferOwner: boolean;
};

type LocalExpansion = GameExpansionFormValue & {
  clientKey: string;
};

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1.5 text-xs font-semibold text-[#8f3528]">{error}</p>;
}

function createClientKey() {
  return `exp-${Math.random().toString(36).slice(2, 10)}`;
}

function mapInitialExpansions(expansions: GameExpansionFormValue[]) {
  return expansions.map((expansion, index) => ({
    ...expansion,
    clientKey: expansion.id ?? `seed-${index}`,
  }));
}

function GameExpansionsEditor({
  initialValue,
  error,
}: {
  initialValue: GameExpansionFormValue[];
  error?: string;
}) {
  const [items, setItems] = useState<LocalExpansion[]>(() =>
    mapInitialExpansions(initialValue),
  );

  const updateItem = (
    clientKey: string,
    patch: Partial<GameExpansionFormValue>,
  ) => {
    setItems((current) =>
      current.map((item) =>
        item.clientKey === clientKey ? { ...item, ...patch } : item,
      ),
    );
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      { clientKey: createClientKey(), name: "", isOwned: false },
    ]);
  };

  const removeItem = (clientKey: string) => {
    setItems((current) =>
      current.filter((item) => item.clientKey !== clientKey),
    );
  };

  const serializedValue = JSON.stringify(
    items.map((item) => ({
      id: item.id,
      name: item.name,
      isOwned: item.isOwned,
    })),
  );

  return (
    <div className="block text-sm font-semibold text-[#503828]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p>Dodatki</p>
          <p className="text-muted mt-1 text-xs leading-5 font-normal">
            Dodaj dodatki dla tego konkretnego egzemplarza i zaznacz, czy grupa
            faktycznie je posiada.
          </p>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="wood-grain text-cream rounded-full px-3.5 py-2 text-xs font-bold"
        >
          + Dodaj kolejny dodatek
        </button>
      </div>

      <input type="hidden" name="expansions" value={serializedValue} />

      <div className="mt-4 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.clientKey}
              className="paper-wash grid gap-3 rounded-[1.3rem] p-3 md:grid-cols-[minmax(0,1fr)_auto_auto]"
            >
              <label className="block text-sm font-semibold text-[#503828]">
                Nazwa dodatku
                <input
                  className="paper-wash focus:border-gold focus:ring-gold/20 mt-1.5 h-11 w-full rounded-xl border border-[#9a7657]/35 px-3.5 text-sm text-[#503828] transition outline-none focus:ring-4"
                  value={item.name}
                  onChange={(event) =>
                    updateItem(item.clientKey, { name: event.target.value })
                  }
                  placeholder="np. Lodowe Kry"
                />
              </label>

              <label className="paper-wash flex h-11 items-center gap-2 rounded-xl border border-[#9a7657]/22 px-3.5 text-sm font-semibold text-[#6b5038]">
                <input
                  type="checkbox"
                  checked={item.isOwned}
                  onChange={(event) =>
                    updateItem(item.clientKey, {
                      isOwned: event.target.checked,
                    })
                  }
                  className="accent-[#b86c39]"
                />
                Posiadamy
              </label>

              <button
                type="button"
                onClick={() => removeItem(item.clientKey)}
                className="rounded-xl border border-[#8f3528]/20 px-3.5 py-3 text-sm font-semibold text-[#8f3528] transition hover:bg-[#8f3528]/6"
              >
                Usuń
              </button>
            </div>
          ))
        ) : (
          <div className="paper-wash rounded-[1.3rem] px-4 py-4 text-sm font-normal text-[#6d5440]">
            Ta gra nie ma jeszcze zapisanych dodatków.
          </div>
        )}
      </div>

      <FieldError error={error} />
    </div>
  );
}

export function GameForm({
  action,
  initialValues,
  members,
  actor,
  submitLabel,
  pendingLabel,
  canTransferOwner,
}: GameFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_GAME_FORM_STATE);
  const inputClass =
    "paper-wash focus:border-gold focus:ring-gold/20 mt-1.5 h-11 w-full rounded-xl border border-[#9a7657]/35 px-3.5 text-sm text-[#503828] outline-none transition focus:ring-4";
  const textareaClass = `${inputClass} h-auto min-h-28 py-3`;

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-2">
        <label className="block text-sm font-semibold text-[#503828]">
          Nazwa gry
          <input
            className={inputClass}
            name="title"
            defaultValue={initialValues.title}
            required
            maxLength={180}
          />
          <FieldError error={state.fieldErrors?.title} />
        </label>

        <label className="block text-sm font-semibold text-[#503828]">
          Okładka URL lub ścieżka
          <input
            className={inputClass}
            name="coverUrl"
            defaultValue={initialValues.coverUrl}
            placeholder="/games/nemezis.webp lub https://…"
          />
          <FieldError error={state.fieldErrors?.coverUrl} />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm font-semibold text-[#503828]">
          Link BGG
          <input
            className={inputClass}
            name="bggUrl"
            defaultValue={initialValues.bggUrl}
            placeholder="https://boardgamegeek.com/…"
          />
          <FieldError error={state.fieldErrors?.bggUrl} />
        </label>

        <label className="block text-sm font-semibold text-[#503828]">
          BGG Rank
          <input
            className={inputClass}
            name="bggRank"
            defaultValue={initialValues.bggRank}
            inputMode="numeric"
          />
          <FieldError error={state.fieldErrors?.bggRank} />
        </label>

        <label className="block text-sm font-semibold text-[#503828]">
          Typ gry
          <input
            className={inputClass}
            name="gameType"
            defaultValue={initialValues.gameType}
            placeholder="np. Kooperacyjna"
          />
          <FieldError error={state.fieldErrors?.gameType} />
        </label>

        <label className="block text-sm font-semibold text-[#503828]">
          Status
          <select
            className={inputClass}
            name="status"
            defaultValue={initialValues.status}
          >
            {Object.entries(GAME_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <FieldError error={state.fieldErrors?.status} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm font-semibold text-[#503828]">
          Minimum graczy
          <input
            className={inputClass}
            name="minPlayers"
            defaultValue={initialValues.minPlayers}
            inputMode="numeric"
          />
          <FieldError error={state.fieldErrors?.minPlayers} />
        </label>

        <label className="block text-sm font-semibold text-[#503828]">
          Maksimum graczy
          <input
            className={inputClass}
            name="maxPlayers"
            defaultValue={initialValues.maxPlayers}
            inputMode="numeric"
          />
          <FieldError error={state.fieldErrors?.maxPlayers} />
        </label>

        <label className="block text-sm font-semibold text-[#503828]">
          Czas gry (min)
          <input
            className={inputClass}
            name="playTimeMinutes"
            defaultValue={initialValues.playTimeMinutes}
            inputMode="numeric"
          />
          <FieldError error={state.fieldErrors?.playTimeMinutes} />
        </label>

        <label className="block text-sm font-semibold text-[#503828]">
          Rok wydania
          <input
            className={inputClass}
            name="releaseYear"
            defaultValue={initialValues.releaseYear}
            inputMode="numeric"
          />
          <FieldError error={state.fieldErrors?.releaseYear} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm font-semibold text-[#503828]">
          Trudność BGG
          <input
            className={inputClass}
            name="bggWeight"
            defaultValue={initialValues.bggWeight}
            placeholder="np. 3,42"
          />
          <FieldError error={state.fieldErrors?.bggWeight} />
        </label>

        <label className="block text-sm font-semibold text-[#503828]">
          Minimalny wiek
          <input
            className={inputClass}
            name="minAge"
            defaultValue={initialValues.minAge}
            inputMode="numeric"
          />
          <FieldError error={state.fieldErrors?.minAge} />
        </label>

        <label className="block text-sm font-semibold text-[#503828]">
          Autor / projektant
          <input
            className={inputClass}
            name="designer"
            defaultValue={initialValues.designer}
          />
          <FieldError error={state.fieldErrors?.designer} />
        </label>

        <label className="block text-sm font-semibold text-[#503828]">
          Wydawca
          <input
            className={inputClass}
            name="publisher"
            defaultValue={initialValues.publisher}
          />
          <FieldError error={state.fieldErrors?.publisher} />
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <label className="block text-sm font-semibold text-[#503828]">
          Mechaniki
          <textarea
            className={textareaClass}
            name="mechanics"
            defaultValue={initialValues.mechanics}
            placeholder="Oddziel mechaniki przecinkami"
          />
          <FieldError error={state.fieldErrors?.mechanics} />
        </label>

        <label className="block text-sm font-semibold text-[#503828]">
          Kategorie
          <textarea
            className={textareaClass}
            name="categories"
            defaultValue={initialValues.categories}
            placeholder="Oddziel kategorie przecinkami"
          />
          <FieldError error={state.fieldErrors?.categories} />
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GameExpansionsEditor
          initialValue={initialValues.expansions}
          error={state.fieldErrors?.expansions}
        />

        <label className="block text-sm font-semibold text-[#503828]">
          Opis
          <textarea
            className={textareaClass}
            name="description"
            defaultValue={initialValues.description}
            placeholder="Krótki opis gry lub notatka dla grupy"
          />
          <FieldError error={state.fieldErrors?.description} />
        </label>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {canTransferOwner ? (
          <label className="block text-sm font-semibold text-[#503828]">
            Właściciel egzemplarza
            <select
              className={inputClass}
              name="ownerId"
              defaultValue={initialValues.ownerId}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                  {member.role === "admin" ? " · admin" : ""}
                </option>
              ))}
            </select>
            <FieldError error={state.fieldErrors?.ownerId} />
          </label>
        ) : (
          <div className="paper-wash rounded-xl p-4">
            <p className="text-muted text-[0.62rem] font-bold tracking-[0.16em] uppercase">
              Właściciel egzemplarza
            </p>
            <p className="mt-2 text-sm font-semibold text-[#503828]">
              {actor.displayName}
            </p>
            <p className="text-muted mt-1 text-xs">
              W Etapie 4 właściciela może zmienić tylko administrator.
            </p>
          </div>
        )}

        <label className="block text-sm font-semibold text-[#503828]">
          Aktualny posiadacz
          <select
            className={inputClass}
            name="currentHolderId"
            defaultValue={initialValues.currentHolderId}
          >
            <option value="">Nie ustawiono</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
          <FieldError error={state.fieldErrors?.currentHolderId} />
        </label>
      </div>

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

      <div className="flex flex-wrap gap-3">
        <GameSubmitButton pendingLabel={pendingLabel}>
          {submitLabel}
        </GameSubmitButton>
      </div>
    </form>
  );
}
