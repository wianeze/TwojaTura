import { createClient } from "@/lib/supabase/client";
import {
  compressImageFile,
  PhotoCompressionError,
  type CompressedPhoto,
} from "./photo-compression";
import { createPlayPhotoAction } from "./photo-actions";
import {
  MAX_CONCURRENT_PHOTO_UPLOADS,
  MAX_PLAY_PHOTOS,
  MAX_PLAY_PHOTOS_TOTAL_BYTES,
} from "./photo-limits";
import { randomId } from "./random-id";
import type { PlayPhoto } from "./types";

export {
  allDraftsUploaded,
  applyDraftUploadResult,
  selectDraftsToUpload,
  type PhotoDraft,
} from "./photo-draft-status.ts";

export type PhotoUploadStatus =
  | "pending"
  | "compressing"
  | "uploading"
  | "done"
  | "error";

export type PhotoUploadItem = {
  id: string;
  fileName: string;
  status: PhotoUploadStatus;
  progressLabel: string;
  error?: string;
  photo?: PlayPhoto;
};

const BUCKET = "play-photos";

// A phone on a flaky Wi-Fi/cellular connection can stall the Storage
// fetch() indefinitely — the browser sets no default timeout, and the
// Supabase storage-js client doesn't accept an AbortSignal either. Without
// this, a stalled request leaves uploadCompressedPhoto's promise pending
// forever, which cascades up through Promise.all in uploadPlayPhotos/
// uploadStagedPhotos and leaves the submit button stuck disabled on
// "Wysyłanie zdjęć 0/1…" with no way to recover. 35s is generous for a
// ~1.5MB compressed photo even on a poor connection, short enough that the
// user isn't left staring at a frozen button.
const UPLOAD_TIMEOUT_MS = 35_000;

type UploadResult =
  | { ok: true; photo: PlayPhoto }
  | { ok: false; message: string; timedOut?: boolean };

// Temporary diagnostic logging for the stuck-upload investigation — prefixed
// so it's easy to grep out later. Never logs tokens/keys, only ids/sizes/timing.
function logPhotoUploadEvent(
  event: string,
  meta: Record<string, string | number | undefined>,
) {
  console.info(`[photo-upload] ${event}`, meta);
}

class UploadTimeoutError extends Error {
  constructor() {
    super("upload timed out");
    this.name = "UploadTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new UploadTimeoutError());
    }, ms);

    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Uploads an already-compressed photo to Storage and records its metadata.
 * Shared by the immediate-upload edit-mode flow (uploadPlayPhotos) and the
 * stage-then-upload create-mode flow (uploadStagedPhotos).
 */
export async function uploadCompressedPhoto(params: {
  playId: string;
  photoId: string;
  compressed: CompressedPhoto;
}): Promise<UploadResult> {
  const supabase = createClient();
  const extension = params.compressed.mimeType === "image/webp" ? "webp" : "jpg";
  const storagePath = `${params.playId}/${params.photoId}.${extension}`;
  const logMeta = {
    playId: params.playId,
    photoId: params.photoId,
    bytes: params.compressed.blob.size,
  };

  logPhotoUploadEvent("upload:start", logMeta);
  const startedAt = Date.now();

  let uploadError: { message: string } | null;
  try {
    const result = await withTimeout(
      supabase.storage.from(BUCKET).upload(storagePath, params.compressed.blob, {
        contentType: params.compressed.mimeType,
        upsert: false,
      }),
      UPLOAD_TIMEOUT_MS,
    );
    uploadError = result.error;
  } catch (cause) {
    if (cause instanceof UploadTimeoutError) {
      logPhotoUploadEvent("upload:timeout", {
        ...logMeta,
        afterMs: Date.now() - startedAt,
      });
      return {
        ok: false,
        timedOut: true,
        message: `Wysyłanie zdjęcia trwało zbyt długo (${Math.round(UPLOAD_TIMEOUT_MS / 1000)} s). Sprawdź połączenie i spróbuj ponownie.`,
      };
    }

    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    logPhotoUploadEvent("upload:exception", {
      ...logMeta,
      error: causeMessage,
    });
    return {
      ok: false,
      message: `Nie udało się połączyć ze Storage: ${causeMessage}`,
    };
  }

  if (uploadError) {
    // A request that timed out client-side isn't necessarily dead — the
    // underlying fetch() has no AbortSignal to cancel it (storage-js
    // doesn't accept one), so on a flaky connection it can still land on
    // the server after we've already given up and shown a timeout error.
    // A retry then collides with itself on this exact path/upsert:false.
    // Treat that specific conflict as "the file's already there" and
    // continue to the metadata step instead of failing the retry.
    const isDuplicateConflict = /already exists/i.test(uploadError.message);

    if (!isDuplicateConflict) {
      logPhotoUploadEvent("upload:storage-error", {
        ...logMeta,
        error: uploadError.message,
      });
      return {
        ok: false,
        message: `Storage odrzucił plik: ${uploadError.message}`,
      };
    }

    logPhotoUploadEvent("upload:storage-already-exists", logMeta);
  }

  logPhotoUploadEvent("upload:storage-success", {
    ...logMeta,
    durationMs: Date.now() - startedAt,
  });

  logPhotoUploadEvent("upload:metadata-start", logMeta);
  try {
    const metadataResult = await withTimeout(
      createPlayPhotoAction({
        playId: params.playId,
        photoId: params.photoId,
        storagePath,
        byteSize: params.compressed.blob.size,
        width: params.compressed.width,
        height: params.compressed.height,
      }),
      UPLOAD_TIMEOUT_MS,
    );

    if (!metadataResult.ok) {
      logPhotoUploadEvent("upload:metadata-error", {
        ...logMeta,
        error: metadataResult.message,
      });
    } else {
      logPhotoUploadEvent("upload:metadata-success", logMeta);
    }

    return metadataResult;
  } catch (cause) {
    if (cause instanceof UploadTimeoutError) {
      logPhotoUploadEvent("upload:metadata-timeout", {
        ...logMeta,
        afterMs: Date.now() - startedAt,
      });
      return {
        ok: false,
        timedOut: true,
        message: `Zapisywanie zdjęcia trwało zbyt długo (${Math.round(UPLOAD_TIMEOUT_MS / 1000)} s). Sprawdź połączenie i spróbuj ponownie.`,
      };
    }
    throw cause;
  }
}

/**
 * Compresses and uploads each file, respecting the play's remaining photo
 * count and total-byte budget, at most MAX_CONCURRENT_PHOTO_UPLOADS at a
 * time. Calls onItemUpdate with the latest state of each item as it
 * progresses — the caller (PlayPhotosField, edit mode) owns the visible
 * list.
 */
export async function uploadPlayPhotos(params: {
  playId: string;
  files: File[];
  currentCount: number;
  currentTotalBytes: number;
  onItemUpdate: (item: PhotoUploadItem) => void;
}): Promise<void> {
  const { playId, files, onItemUpdate } = params;

  let remainingSlots = MAX_PLAY_PHOTOS - params.currentCount;
  let remainingBytes = MAX_PLAY_PHOTOS_TOTAL_BYTES - params.currentTotalBytes;
  const total = files.length;
  let doneCount = 0;

  const queue: PhotoUploadItem[] = files.map((file) => ({
    id: randomId(),
    fileName: file.name,
    status: "pending",
    progressLabel: "Oczekuje…",
  }));

  async function processOne(item: PhotoUploadItem, file: File) {
    if (remainingSlots <= 0) {
      onItemUpdate({
        ...item,
        status: "error",
        error: "Osiągnięto limit 15 zdjęć na tę partię.",
      });
      return;
    }

    onItemUpdate({
      ...item,
      status: "compressing",
      progressLabel: "Przetwarzanie zdjęcia…",
    });
    logPhotoUploadEvent("compress:start", { playId, fileName: file.name });

    let compressed;
    try {
      compressed = await compressImageFile(file);
    } catch (cause) {
      const message =
        cause instanceof PhotoCompressionError
          ? cause.message
          : "Nie udało się przetworzyć zdjęcia.";
      onItemUpdate({ ...item, status: "error", error: message });
      return;
    }

    if (compressed.blob.size > remainingBytes) {
      onItemUpdate({
        ...item,
        status: "error",
        error: "Przekroczono łączny limit 15 MB zdjęć na tę partię.",
      });
      return;
    }

    onItemUpdate({
      ...item,
      status: "uploading",
      progressLabel: `Wysyłanie ${doneCount + 1}/${total}…`,
    });

    const result = await uploadCompressedPhoto({
      playId,
      photoId: item.id,
      compressed,
    });

    if (!result.ok) {
      onItemUpdate({ ...item, status: "error", error: result.message });
      return;
    }

    remainingSlots -= 1;
    remainingBytes -= compressed.blob.size;
    doneCount += 1;
    onItemUpdate({
      ...item,
      status: "done",
      progressLabel: "Zdjęcie zapisane",
      photo: result.photo,
    });
  }

  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const index = cursor;
      cursor += 1;
      onItemUpdate(queue[index]!);
      await processOne(queue[index]!, files[index]!);
    }
  }

  const workerCount = Math.min(MAX_CONCURRENT_PHOTO_UPLOADS, queue.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
}

/**
 * Uploads photos that were already compressed and staged before the play
 * existed (Kronika create form), now that a play_id is available. Only
 * ever called with drafts that still need uploading — selectDraftsToUpload
 * decides that — so retrying after a partial failure never re-uploads a
 * draft that already succeeded.
 */
export async function uploadStagedPhotos(params: {
  playId: string;
  items: Array<{ id: string; compressed: CompressedPhoto }>;
  onItemResult: (photoId: string, result: UploadResult) => void;
}): Promise<void> {
  let cursor = 0;
  async function worker() {
    while (cursor < params.items.length) {
      const index = cursor;
      cursor += 1;
      const item = params.items[index]!;
      const result = await uploadCompressedPhoto({
        playId: params.playId,
        photoId: item.id,
        compressed: item.compressed,
      });
      params.onItemResult(item.id, result);
    }
  }

  const workerCount = Math.min(MAX_CONCURRENT_PHOTO_UPLOADS, params.items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
}
