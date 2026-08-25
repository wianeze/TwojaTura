"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import type { ActionVariant } from "@/components/ui/action-button-styles";
import type { CurrentMember } from "@/features/auth/types";
import { fetchBggGameDetails } from "./actions";
import {
  BGG_AUTOFILL_FIELD_NAMES,
  cleanBggExpansionName,
  createBggExpansionDrafts,
  mergeBggAutofillValues,
  type BggAutofillValues,
  type BggExpansionSuggestion,
} from "./bgg";
import { GameSubmitButton } from "./game-submit-button";
import { INITIAL_GAME_FORM_STATE } from "./form-state";
import { GAME_STATUS_LABELS } from "./formatting";
import {
  GAME_ITEM_KINDS,
  GAME_ITEM_KIND_LABELS,
  isGameItemKind,
  type GameItemKind,
} from "./item-kind";
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
  // Domyślnie GameSubmitButton zostaje przy "shelf" (Bronze) — pasuje do
  // edycji istniejącego egzemplarza. Formularz tworzenia nowego egzemplarza
  // (gry/nowa) przekazuje "library" (Green): dodawanie do kolekcji ma inną
  // barwę niż edytowanie tego, co już tam jest.
  submitAction?: ActionVariant;
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

function mapInitialExpansions(
  expansions: GameExpansionFormValue[],
  baseGameTitle: string,
) {
  return expansions.map((expansion, index) => ({
    ...expansion,
    name: cleanBggExpansionName(expansion.name, baseGameTitle),
    clientKey: expansion.id ?? `seed-${index}`,
  }));
}

/**
 * `HTMLSelectElement` jest tu wymieniony obok inputa i textarei nie na zapas:
 * „Typ pozycji” to jedyne pole autofillu będące listą wyboru, a bez tej gałęzi
 * odczyt zwracałby pusty string i BGG kasowałoby wybór użytkownika.
 */
function readFormValue(form: HTMLFormElement, name: string) {
  const field = form.elements.namedItem(name);
  return field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement ||
    field instanceof HTMLSelectElement
    ? field.value
    : "";
}

function readGameItemKind(form: HTMLFormElement): GameItemKind {
  const raw = readFormValue(form, "itemKind");
  return isGameItemKind(raw) ? raw : "unknown";
}

function readBggAutofillValues(form: HTMLFormElement): BggAutofillValues {
  return {
    title: readFormValue(form, "title"),
    itemKind: readGameItemKind(form),
    gameType: readFormValue(form, "gameType"),
    coverUrl: readFormValue(form, "coverUrl"),
    bggRank: readFormValue(form, "bggRank"),
    minPlayers: readFormValue(form, "minPlayers"),
    maxPlayers: readFormValue(form, "maxPlayers"),
    playTimeMinutes: readFormValue(form, "playTimeMinutes"),
    releaseYear: readFormValue(form, "releaseYear"),
    mechanics: readFormValue(form, "mechanics"),
    categories: readFormValue(form, "categories"),
    bggWeight: readFormValue(form, "bggWeight"),
    minAge: readFormValue(form, "minAge"),
    designer: readFormValue(form, "designer"),
    publisher: readFormValue(form, "publisher"),
    description: readFormValue(form, "description"),
  };
}

function applyBggAutofillValues(
  form: HTMLFormElement,
  values: BggAutofillValues,
) {
  for (const name of BGG_AUTOFILL_FIELD_NAMES) {
    const field = form.elements.namedItem(name);
    if (
      field instanceof HTMLInputElement ||
      field instanceof HTMLTextAreaElement ||
      field instanceof HTMLSelectElement
    ) {
      field.value = values[name];
    }
  }
}

function GameExpansionsEditor({
  initialValue,
  error,
  bggSuggestions,
  gameTitle,
}: {
  initialValue: GameExpansionFormValue[];
  error?: string;
  bggSuggestions: BggExpansionSuggestion[];
  gameTitle: string;
}) {
  const [items, setItems] = useState<LocalExpansion[]>(() =>
    mapInitialExpansions(initialValue, gameTitle),
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

  const bggDrafts = createBggExpansionDrafts(
    items.map((item) => item.name),
    bggSuggestions,
  );

  const addBggSuggestions = () => {
    setItems((current) => [
      ...current,
      ...createBggExpansionDrafts(
        current.map((item) => item.name),
        bggSuggestions,
      ).map((item) => ({ ...item, clientKey: createClientKey() })),
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

      {bggSuggestions.length > 0 ? (
        <div className="mt-3 rounded-[1.15rem] border border-[#b98a56]/30 bg-[#f8edda]/72 p-3">
          <p className="text-sm font-semibold text-[#684529]">
            BGG znalazło dodatki. Dodaj je jako listę sugestii i zaznacz
            posiadane.
          </p>
          {bggDrafts.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addBggSuggestions}
                className="rounded-full bg-[#9b493b] px-3 py-1.5 text-xs font-bold text-[#fff5e7] transition hover:bg-[#84382f] focus-visible:ring-4 focus-visible:ring-[#9b493b]/25 focus-visible:outline-none"
              >
                Dodaj dodatki z BGG ({bggDrafts.length})
              </button>
              <details className="text-xs font-medium text-[#775436]">
                <summary className="cursor-pointer">Pokaż sugestie</summary>
                <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto pr-2">
                  {bggDrafts.map((item) => (
                    <li key={item.name}>{item.name}</li>
                  ))}
                </ul>
              </details>
            </div>
          ) : (
            <p className="mt-1 text-xs font-medium text-[#775436]">
              Wszystkie znalezione dodatki są już na liście formularza.
            </p>
          )}
        </div>
      ) : null}

      <div className="mt-3 grid max-h-[28rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.clientKey}
              className="paper-wash grid gap-2 rounded-[1.1rem] p-2.5"
            >
              <label className="block text-xs font-semibold text-[#503828]">
                Nazwa dodatku
                <input
                  className="paper-wash focus:border-gold focus:ring-gold/20 mt-1 h-10 w-full rounded-xl border border-[#9a7657]/35 px-3 text-sm text-[#503828] transition outline-none focus:ring-4"
                  value={item.name}
                  onChange={(event) =>
                    updateItem(item.clientKey, { name: event.target.value })
                  }
                  placeholder="np. Lodowe Kry"
                />
              </label>

              <div className="flex items-center justify-between gap-2">
                <label className="paper-wash flex h-9 items-center gap-2 rounded-xl border border-[#9a7657]/22 px-2.5 text-xs font-semibold text-[#6b5038]">
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
                  className="h-9 rounded-xl border border-[#8f3528]/20 px-2.5 text-xs font-semibold text-[#8f3528] transition hover:bg-[#8f3528]/6"
                >
                  Usuń
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="paper-wash rounded-[1.3rem] px-4 py-4 text-sm font-normal text-[#6d5440]">
            Nie dodano jeszcze dodatków do tego egzemplarza.
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
  submitAction,
}: GameFormProps) {
  const [state, formAction] = useActionState(action, INITIAL_GAME_FORM_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const bggUrlRef = useRef<HTMLInputElement>(null);
  const [overwriteBggFields, setOverwriteBggFields] = useState(false);
  const [bggFeedback, setBggFeedback] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);
  const [bggExpansionSuggestions, setBggExpansionSuggestions] = useState<
    BggExpansionSuggestion[]
  >([]);
  const [isBggPending, startBggTransition] = useTransition();
  const inputClass =
    "paper-wash focus:border-gold focus:ring-gold/20 mt-1.5 h-11 w-full rounded-xl border border-[#9a7657]/35 px-3.5 text-sm text-[#503828] outline-none transition focus:ring-4";
  const textareaClass = `${inputClass} h-auto min-h-28 py-3`;

  const handleBggAutofill = () => {
    const form = formRef.current;
    const bggUrl = bggUrlRef.current?.value.trim() ?? "";
    if (!form || !bggUrl) {
      setBggFeedback({
        status: "error",
        message: "Najpierw wklej link do gry w BoardGameGeek.",
      });
      return;
    }

    setBggFeedback(null);
    startBggTransition(async () => {
      const result = await fetchBggGameDetails(bggUrl);
      if (result.status === "error") {
        setBggFeedback(result);
        return;
      }

      const merged = mergeBggAutofillValues(
        readBggAutofillValues(form),
        result.data,
        overwriteBggFields,
      );
      applyBggAutofillValues(form, merged);
      setBggExpansionSuggestions(result.data.expansionSuggestions);
      setBggFeedback({
        status: "success",
        message: "Dane z BGG uzupełnione. Sprawdź i zapisz grę.",
      });
    });
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 xl:grid-cols-4">
        <label className="block text-sm font-semibold text-[#503828] md:order-[1] md:col-span-2">
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

        <div className="text-sm font-semibold text-[#503828] md:order-[3]">
          <label htmlFor="bggUrl">Link BGG</label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={bggUrlRef}
              id="bggUrl"
              className={`${inputClass} min-w-0 flex-1`}
              name="bggUrl"
              defaultValue={initialValues.bggUrl}
              placeholder="https://boardgamegeek.com/…"
            />
            <button
              type="button"
              disabled={isBggPending}
              onClick={handleBggAutofill}
              className="mt-1.5 h-11 shrink-0 rounded-xl bg-[#9b493b] px-3 text-xs font-bold text-[#fff5e7] shadow-[0_8px_18px_rgba(111,44,34,0.24)] transition hover:bg-[#84382f] focus-visible:ring-4 focus-visible:ring-[#9b493b]/30 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
            >
              {isBggPending ? "Pobieranie…" : "Uzupełnij z BGG"}
            </button>
          </div>
          <label className="mt-2 flex w-fit items-center gap-2 text-xs font-medium text-[#6b5038]">
            <input
              type="checkbox"
              checked={overwriteBggFields}
              onChange={(event) => setOverwriteBggFields(event.target.checked)}
              className="accent-[#b86c39]"
            />
            Nadpisz istniejące pola
          </label>
          <FieldError error={state.fieldErrors?.bggUrl} />
          {bggFeedback ? (
            <p
              role={bggFeedback.status === "error" ? "alert" : "status"}
              className={`mt-2 text-xs font-semibold ${
                bggFeedback.status === "error" ? "text-[#8f3528]" : "text-moss"
              }`}
            >
              {bggFeedback.message}
            </p>
          ) : null}
        </div>

        <label className="block text-sm font-semibold text-[#503828] md:order-[2] md:col-span-2">
          Okładka URL lub ścieżka
          <input
            className={inputClass}
            name="coverUrl"
            defaultValue={initialValues.coverUrl}
            placeholder="/games/nemezis.webp lub https://…"
          />
          <FieldError error={state.fieldErrors?.coverUrl} />
        </label>

        <div className="grid grid-cols-3 gap-2 md:contents">
          <label className="block text-sm font-semibold text-[#503828] md:order-[4]">
            BGG Rank
            <input
              className={inputClass}
              name="bggRank"
              defaultValue={initialValues.bggRank}
              inputMode="numeric"
            />
            <FieldError error={state.fieldErrors?.bggRank} />
          </label>

          <label className="block text-sm font-semibold text-[#503828] md:order-[7]">
            Minimum graczy
            <input
              className={inputClass}
              name="minPlayers"
              defaultValue={initialValues.minPlayers}
              inputMode="numeric"
            />
            <FieldError error={state.fieldErrors?.minPlayers} />
          </label>

          <label className="block text-sm font-semibold text-[#503828] md:order-[8]">
            Maksimum graczy
            <input
              className={inputClass}
              name="maxPlayers"
              defaultValue={initialValues.maxPlayers}
              inputMode="numeric"
            />
            <FieldError error={state.fieldErrors?.maxPlayers} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 md:contents">
          <label className="block text-sm font-semibold text-[#503828] md:order-[5]">
            Typ gry
            <input
              className={inputClass}
              name="gameType"
              defaultValue={initialValues.gameType}
              placeholder="np. Kooperacyjna"
            />
            <FieldError error={state.fieldErrors?.gameType} />
          </label>

          {/*
            Typ pozycji jest listą wyboru, a nie checkboxem, bo pole ma TRZY
            stany: gra samodzielna, dodatek i „nierozstrzygnięte”. Ten trzeci to
            realna wartość domenową (patrz item-kind.ts), a nie brak danych do
            ukrycia — dopóki tam stoi, pozycja nie generuje Misji „Pierwszy
            Rozdział”. Przy dodawaniu nowej gry walidacja wymaga świadomego
            wyboru; przy edycji starego wpisu „nierozstrzygnięte” może zostać.
          */}
          <label className="block text-sm font-semibold text-[#503828] md:order-[6]">
            Typ pozycji
            <select
              className={inputClass}
              name="itemKind"
              defaultValue={initialValues.itemKind}
            >
              {GAME_ITEM_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {GAME_ITEM_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
            <FieldError error={state.fieldErrors?.itemKind} />
          </label>

          <label className="block text-sm font-semibold text-[#503828] md:order-[6]">
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

        <div className="grid grid-cols-3 gap-2 md:contents">
          <label className="block text-sm font-semibold text-[#503828] md:order-[9]">
            Czas gry (min)
            <input
              className={inputClass}
              name="playTimeMinutes"
              defaultValue={initialValues.playTimeMinutes}
              inputMode="numeric"
            />
            <FieldError error={state.fieldErrors?.playTimeMinutes} />
          </label>

          <label className="block text-sm font-semibold text-[#503828] md:order-[12]">
            Minimalny wiek
            <input
              className={inputClass}
              name="minAge"
              defaultValue={initialValues.minAge}
              inputMode="numeric"
            />
            <FieldError error={state.fieldErrors?.minAge} />
          </label>

          <label className="block text-sm font-semibold text-[#503828] md:order-[10]">
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

        <div className="grid grid-cols-2 gap-2 md:contents">
          <label className="block text-sm font-semibold text-[#503828] md:order-[14]">
            Wydawca
            <input
              className={inputClass}
              name="publisher"
              defaultValue={initialValues.publisher}
            />
            <FieldError error={state.fieldErrors?.publisher} />
          </label>

          <label className="block text-sm font-semibold text-[#503828] md:order-[11]">
            Trudność BGG
            <input
              className={inputClass}
              name="bggWeight"
              defaultValue={initialValues.bggWeight}
              placeholder="np. 3,42"
            />
            <FieldError error={state.fieldErrors?.bggWeight} />
          </label>
        </div>

        <label className="block text-sm font-semibold text-[#503828] md:order-[13]">
          Autor / projektant
          <input
            className={inputClass}
            name="designer"
            defaultValue={initialValues.designer}
          />
          <FieldError error={state.fieldErrors?.designer} />
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
          bggSuggestions={bggExpansionSuggestions}
          gameTitle={initialValues.title}
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

      <div className="flex flex-wrap gap-3 md:justify-end">
        <GameSubmitButton pendingLabel={pendingLabel} action={submitAction}>
          {submitLabel}
        </GameSubmitButton>
      </div>
    </form>
  );
}
