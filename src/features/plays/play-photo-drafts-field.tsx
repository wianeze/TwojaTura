"use client";

import { useRef } from "react";
import { compressImageFile, PhotoCompressionError } from "./photo-compression";
import { MAX_PLAY_PHOTOS, MAX_PLAY_PHOTOS_TOTAL_BYTES } from "./photo-limits";
import { randomId } from "./random-id";
import type { PhotoDraft } from "./photo-upload";

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Photo picker for the Kronika create form, used before a play_id exists.
 * Files are compressed immediately and kept in memory as PhotoDraft entries
 * — nothing is uploaded here. PlayForm owns `drafts` and uploads them after
 * the play is created.
 */
export function PlayPhotoDraftsField({
  drafts,
  onDraftsChange,
  disabled = false,
}: {
  drafts: PhotoDraft[];
  onDraftsChange: (updater: (current: PhotoDraft[]) => PhotoDraft[]) => void;
  disabled?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const countedDrafts = drafts.filter((draft) => draft.status !== "error");
  const totalBytes = countedDrafts.reduce(
    (sum, draft) => sum + (draft.compressed?.blob.size ?? 0),
    0,
  );
  const remainingSlots = MAX_PLAY_PHOTOS - countedDrafts.length;

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, Math.max(remainingSlots, 0));

    const pendingDrafts: PhotoDraft[] = files.map((file) => ({
      id: randomId(),
      fileName: file.name,
      status: "compressing",
    }));

    onDraftsChange((current) => [...current, ...pendingDrafts]);

    let runningBytes = totalBytes;

    for (let index = 0; index < files.length; index += 1) {
      const draft = pendingDrafts[index]!;
      const file = files[index]!;

      try {
        const compressed = await compressImageFile(file);

        if (runningBytes + compressed.blob.size > MAX_PLAY_PHOTOS_TOTAL_BYTES) {
          onDraftsChange((current) =>
            current.map((item) =>
              item.id === draft.id
                ? {
                    ...item,
                    status: "error",
                    error: "Przekroczono łączny limit 15 MB zdjęć na tę partię.",
                  }
                : item,
            ),
          );
          continue;
        }

        runningBytes += compressed.blob.size;

        onDraftsChange((current) =>
          current.map((item) =>
            item.id === draft.id
              ? {
                  ...item,
                  status: "ready",
                  previewUrl: URL.createObjectURL(compressed.blob),
                  compressed,
                }
              : item,
          ),
        );
      } catch (cause) {
        const message =
          cause instanceof PhotoCompressionError
            ? cause.message
            : "Nie udało się przetworzyć zdjęcia.";

        onDraftsChange((current) =>
          current.map((item) =>
            item.id === draft.id
              ? { ...item, status: "error", error: message }
              : item,
          ),
        );
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRemove(draftId: string) {
    onDraftsChange((current) => {
      const target = current.find((item) => item.id === draftId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((item) => item.id !== draftId);
    });
  }

  function handleMove(draftId: string, direction: -1 | 1) {
    onDraftsChange((current) => {
      const index = current.findIndex((item) => item.id === draftId);
      const targetIndex = index + direction;
      if (index === -1 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const reordered = [...current];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, moved!);
      return reordered;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-accent text-[0.58rem] font-bold tracking-[0.18em] uppercase">
            Zdjęcia
          </p>
          <h2 className="font-display mt-1 text-[1.3rem] font-semibold text-[#4c3528]">
            Dodaj zdjęcia
          </h2>
        </div>
        <p className="text-muted text-xs">
          {countedDrafts.length}/{MAX_PLAY_PHOTOS} zdjęć ·{" "}
          {formatMegabytes(totalBytes)}/
          {formatMegabytes(MAX_PLAY_PHOTOS_TOTAL_BYTES)}
        </p>
      </div>

      {drafts.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {drafts.map((draft, index) => (
            <div
              key={draft.id}
              className="paper-wash relative overflow-hidden rounded-[1.05rem] p-1.5"
            >
              {draft.previewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview, not a static asset */}
                  <img
                    src={draft.previewUrl}
                    alt=""
                    className="aspect-square w-full rounded-[0.8rem] object-cover"
                  />
                  {draft.status === "uploading" ? (
                    <div className="absolute inset-1.5 grid place-items-center rounded-[0.8rem] bg-black/45 text-[0.68rem] font-bold text-white">
                      Wysyłanie…
                    </div>
                  ) : null}
                  {draft.status === "error" ? (
                    <div className="absolute inset-1.5 grid place-items-center rounded-[0.8rem] bg-[#3a1210]/85 p-1 text-center text-[0.62rem] leading-4 font-bold text-white">
                      {draft.error}
                    </div>
                  ) : null}
                  <div className="mt-1.5 flex items-center justify-between gap-1">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={disabled || index === 0}
                        onClick={() => handleMove(draft.id, -1)}
                        className="rounded-full bg-white/80 px-2 py-1 text-xs font-bold text-[#6b5140] disabled:opacity-35"
                        aria-label="Przesuń wcześniej"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={disabled || index === drafts.length - 1}
                        onClick={() => handleMove(draft.id, 1)}
                        className="rounded-full bg-white/80 px-2 py-1 text-xs font-bold text-[#6b5140] disabled:opacity-35"
                        aria-label="Przesuń później"
                      >
                        ↓
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleRemove(draft.id)}
                      className="rounded-full bg-white/80 px-2 py-1 text-xs font-bold text-[#8f3528] disabled:opacity-35"
                    >
                      Usuń
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex min-h-[6rem] flex-col items-center justify-center gap-1.5 p-2 text-center">
                  {draft.status === "compressing" ? (
                    <span
                      aria-hidden="true"
                      className="size-5 animate-spin rounded-full border-2 border-[#c9b48c] border-t-[#6b5140]"
                    />
                  ) : null}
                  <span className="text-[0.68rem] leading-4 font-semibold text-[#6b5140]">
                    {draft.status === "compressing"
                      ? "Przetwarzanie zdjęcia…"
                      : draft.error}
                  </span>
                  {draft.status === "error" ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleRemove(draft.id)}
                      className="text-[0.62rem] font-bold text-[#8f3528] underline disabled:opacity-35"
                    >
                      Usuń
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {remainingSlots > 0 ? (
        <label
          className={`wood-grain text-cream inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${
            disabled ? "pointer-events-none opacity-50" : "cursor-pointer"
          }`}
        >
          + Dodaj zdjęcia
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={disabled}
            className="hidden"
            onChange={(event) => handleFilesSelected(event.target.files)}
          />
        </label>
      ) : (
        <p className="text-muted text-xs">
          Osiągnięto limit {MAX_PLAY_PHOTOS} zdjęć na tę partię.
        </p>
      )}
    </div>
  );
}
