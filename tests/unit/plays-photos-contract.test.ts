import assert from "node:assert/strict";
import test from "node:test";
import {
  compressImageFile,
  computeTargetSize,
  PhotoCompressionError,
} from "../../src/features/plays/photo-compression.ts";
import {
  MAX_CONCURRENT_PHOTO_UPLOADS,
  MAX_PLAY_PHOTO_BYTES,
  MAX_PLAY_PHOTO_DIMENSION,
  MAX_PLAY_PHOTOS,
  MAX_PLAY_PHOTOS_TOTAL_BYTES,
} from "../../src/features/plays/photo-limits.ts";
import {
  allDraftsUploaded,
  applyDraftUploadResult,
  selectDraftsToUpload,
  type PhotoDraft,
} from "../../src/features/plays/photo-draft-status.ts";
import type { PlayPhoto } from "../../src/features/plays/types.ts";

function fakeCompressed() {
  return {
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/webp" }),
    mimeType: "image/webp" as const,
    width: 800,
    height: 600,
  };
}

function fakePlayPhoto(id: string): PlayPhoto {
  return { id, url: `https://example.test/${id}`, position: 1, width: 800, height: 600, byteSize: 3 };
}

function readyDraft(id: string): PhotoDraft {
  return {
    id,
    fileName: `${id}.webp`,
    status: "ready",
    previewUrl: `blob:${id}`,
    compressed: fakeCompressed(),
  };
}

test("computeTargetSize keeps an image already within the limit unchanged", () => {
  assert.deepEqual(computeTargetSize(1200, 800, 1600), {
    width: 1200,
    height: 800,
  });
});

test("computeTargetSize scales a landscape image down to the longer-side limit", () => {
  assert.deepEqual(computeTargetSize(3200, 1600, 1600), {
    width: 1600,
    height: 800,
  });
});

test("computeTargetSize scales a portrait image down to the longer-side limit", () => {
  assert.deepEqual(computeTargetSize(1600, 3200, 1600), {
    width: 800,
    height: 1600,
  });
});

test("computeTargetSize treats a square image at exactly the limit as unchanged", () => {
  assert.deepEqual(computeTargetSize(1600, 1600, 1600), {
    width: 1600,
    height: 1600,
  });
});

test("PhotoCompressionError carries a machine-readable reason alongside the message", () => {
  const error = new PhotoCompressionError("too big", "too-large");

  assert.equal(error.message, "too big");
  assert.equal(error.reason, "too-large");
  assert.ok(error instanceof Error);
});

test("compressImageFile rejects a HEIC file with format-specific guidance when decoding fails", async () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async () => {
    throw new Error("no HEIC decoder in this environment");
  };

  try {
    const file = new File([new Uint8Array([1, 2, 3])], "wieczor.heic", {
      type: "image/heic",
    });

    await assert.rejects(
      () => compressImageFile(file),
      (error: unknown) => {
        assert.ok(error instanceof PhotoCompressionError);
        assert.equal(error.reason, "unsupported-type");
        assert.match(error.message, /HEIC/);
        return true;
      },
    );
  } finally {
    globalThis.createImageBitmap = originalCreateImageBitmap;
  }
});

test("compressImageFile reports a generic decode failure for a non-HEIC file it cannot read", async () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  globalThis.createImageBitmap = async () => {
    throw new Error("corrupt image data");
  };

  try {
    const file = new File([new Uint8Array([1, 2, 3])], "zdjecie.jpg", {
      type: "image/jpeg",
    });

    await assert.rejects(
      () => compressImageFile(file),
      (error: unknown) => {
        assert.ok(error instanceof PhotoCompressionError);
        assert.equal(error.reason, "decode-failed");
        return true;
      },
    );
  } finally {
    globalThis.createImageBitmap = originalCreateImageBitmap;
  }
});

test("photo limit constants match the approved Etap C decisions", () => {
  assert.equal(MAX_PLAY_PHOTOS, 15);
  assert.equal(MAX_PLAY_PHOTOS_TOTAL_BYTES, 15 * 1024 * 1024);
  assert.equal(MAX_PLAY_PHOTO_BYTES, 1.5 * 1024 * 1024);
  assert.equal(MAX_PLAY_PHOTO_DIMENSION, 1600);
  assert.equal(MAX_CONCURRENT_PHOTO_UPLOADS, 3);
});

test("selectDraftsToUpload includes ready and error drafts but skips done ones", () => {
  const drafts: PhotoDraft[] = [
    readyDraft("a"),
    { ...readyDraft("b"), status: "done" },
    { ...readyDraft("c"), status: "error", error: "Nie udało się wysłać zdjęcia." },
    { id: "d", fileName: "d.webp", status: "compressing" },
  ];

  const toUpload = selectDraftsToUpload(drafts);

  assert.deepEqual(
    toUpload.map((draft) => draft.id),
    ["a", "c"],
  );
});

test("selectDraftsToUpload returns nothing once every compressed draft is done (retry is a no-op)", () => {
  const drafts: PhotoDraft[] = [
    { ...readyDraft("a"), status: "done" },
    { ...readyDraft("b"), status: "done" },
  ];

  assert.deepEqual(selectDraftsToUpload(drafts), []);
});

test("applyDraftUploadResult marks a successful upload as done and clears any prior error", () => {
  const drafts: PhotoDraft[] = [
    { ...readyDraft("a"), status: "error", error: "Nie udało się wysłać zdjęcia." },
    readyDraft("b"),
  ];

  const next = applyDraftUploadResult(drafts, "a", {
    ok: true,
    photo: fakePlayPhoto("a"),
  });

  assert.equal(next.find((draft) => draft.id === "a")?.status, "done");
  assert.equal(next.find((draft) => draft.id === "a")?.error, undefined);
  assert.equal(next.find((draft) => draft.id === "b")?.status, "ready");
});

test("applyDraftUploadResult marks a failed upload as error without touching other drafts", () => {
  const drafts: PhotoDraft[] = [readyDraft("a"), readyDraft("b")];

  const next = applyDraftUploadResult(drafts, "a", {
    ok: false,
    message: "Nie udało się wysłać zdjęcia. Spróbuj ponownie.",
  });

  assert.equal(next.find((draft) => draft.id === "a")?.status, "error");
  assert.equal(
    next.find((draft) => draft.id === "a")?.error,
    "Nie udało się wysłać zdjęcia. Spróbuj ponownie.",
  );
  assert.equal(next.find((draft) => draft.id === "b")?.status, "ready");
});

test("allDraftsUploaded is false while any compressed draft has not finished", () => {
  const drafts: PhotoDraft[] = [
    { ...readyDraft("a"), status: "done" },
    { ...readyDraft("b"), status: "error", error: "boom" },
  ];

  assert.equal(allDraftsUploaded(drafts), false);
});

test("allDraftsUploaded is true once every compressed draft succeeded, ignoring drafts still compressing", () => {
  const drafts: PhotoDraft[] = [
    { ...readyDraft("a"), status: "done" },
    { ...readyDraft("b"), status: "done" },
    { id: "c", fileName: "c.webp", status: "compressing" },
  ];

  assert.equal(allDraftsUploaded(drafts), true);
});
