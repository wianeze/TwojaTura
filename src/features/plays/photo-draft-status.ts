import type { CompressedPhoto } from "./photo-compression.ts";
import type { PlayPhoto } from "./types.ts";

/**
 * A photo picked before a play_id exists (Kronika create form): already
 * compressed locally and staged in memory, uploaded only once the play has
 * been created. `previewUrl` is an object URL owned by the caller.
 */
export type PhotoDraft = {
  id: string;
  fileName: string;
  status: "compressing" | "ready" | "uploading" | "done" | "error";
  error?: string;
  previewUrl?: string;
  compressed?: CompressedPhoto;
};

export type DraftUploadResult =
  | { ok: true; photo: PlayPhoto }
  | { ok: false; message: string };

/** Drafts still needing an upload attempt — excludes ones already done. */
export function selectDraftsToUpload(drafts: PhotoDraft[]) {
  return drafts.filter(
    (draft) => draft.status !== "done" && Boolean(draft.compressed),
  );
}

/** Applies one upload outcome to the matching draft, leaving others as-is. */
export function applyDraftUploadResult(
  drafts: PhotoDraft[],
  draftId: string,
  result: DraftUploadResult,
): PhotoDraft[] {
  return drafts.map((draft) => {
    if (draft.id !== draftId) return draft;

    return result.ok
      ? { ...draft, status: "done" as const, error: undefined }
      : { ...draft, status: "error" as const, error: result.message };
  });
}

/** Whether every draft that has a compressed photo finished uploading. */
export function allDraftsUploaded(drafts: PhotoDraft[]) {
  return drafts
    .filter((draft) => Boolean(draft.compressed))
    .every((draft) => draft.status === "done");
}
