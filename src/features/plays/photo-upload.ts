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

type UploadResult =
  | { ok: true; photo: PlayPhoto }
  | { ok: false; message: string };

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

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, params.compressed.blob, {
      contentType: params.compressed.mimeType,
      upsert: false,
    });

  if (uploadError) {
    return {
      ok: false,
      message: "Nie udało się wysłać zdjęcia. Spróbuj ponownie.",
    };
  }

  return createPlayPhotoAction({
    playId: params.playId,
    photoId: params.photoId,
    storagePath,
    byteSize: params.compressed.blob.size,
    width: params.compressed.width,
    height: params.compressed.height,
  });
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

  const queue: PhotoUploadItem[] = files.map((file) => ({
    id: crypto.randomUUID(),
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
      progressLabel: "Kompresowanie…",
    });

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
      progressLabel: "Wysyłanie…",
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
    onItemUpdate({
      ...item,
      status: "done",
      progressLabel: "Gotowe",
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
