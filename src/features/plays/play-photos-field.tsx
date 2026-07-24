"use client";

import { useRef, useState } from "react";
import {
  deletePlayPhotoAction,
  reorderPlayPhotosAction,
} from "./photo-actions";
import { uploadPlayPhotos, type PhotoUploadItem } from "./photo-upload";
import { MAX_PLAY_PHOTOS, MAX_PLAY_PHOTOS_TOTAL_BYTES } from "./photo-limits";
import { randomId } from "./random-id";
import type { PlayPhoto } from "./types";

function formatMegabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PlayPhotosField({
  playId,
  initialPhotos,
}: {
  playId: string;
  initialPhotos: PlayPhoto[];
}) {
  const [photos, setPhotos] = useState<PlayPhoto[]>(() =>
    [...initialPhotos].sort((a, b) => a.position - b.position),
  );
  const [uploads, setUploads] = useState<PhotoUploadItem[]>([]);
  const [movingId, setMovingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalBytes = photos.reduce((sum, photo) => sum + photo.byteSize, 0);
  const remainingSlots = MAX_PLAY_PHOTOS - photos.length;

  function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, Math.max(remainingSlots, 0));

    uploadPlayPhotos({
      playId,
      files,
      currentCount: photos.length,
      currentTotalBytes: totalBytes,
      onItemUpdate: (item) => {
        setUploads((current) => {
          const existingIndex = current.findIndex(
            (upload) => upload.id === item.id,
          );
          if (existingIndex === -1) return [...current, item];
          const next = [...current];
          next[existingIndex] = item;
          return next;
        });

        if (item.status === "done" && item.photo) {
          setPhotos((current) => [...current, item.photo!]);
        }
      },
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete(photoId: string) {
    const previous = photos;
    setPhotos((current) => current.filter((photo) => photo.id !== photoId));

    const result = await deletePlayPhotoAction(playId, photoId);
    if (!result.ok) {
      setPhotos(previous);
      setUploads((current) => [
        ...current,
        {
          id: randomId(),
          fileName: "",
          status: "error",
          progressLabel: "",
          error: result.message,
        },
      ]);
    }
  }

  async function handleMove(photoId: string, direction: -1 | 1) {
    const index = photos.findIndex((photo) => photo.id === photoId);
    const targetIndex = index + direction;
    if (index === -1 || targetIndex < 0 || targetIndex >= photos.length) {
      return;
    }

    const reordered = [...photos];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved!);

    const previous = photos;
    setPhotos(reordered);
    setMovingId(photoId);

    const result = await reorderPlayPhotosAction(
      playId,
      reordered.map((photo) => photo.id),
    );

    setMovingId(null);
    if (!result.ok) {
      setPhotos(previous);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-accent text-[0.58rem] font-bold tracking-[0.18em] uppercase">
            Zdjęcia
          </p>
          <h2 className="font-display mt-1 text-[1.3rem] font-semibold text-[#4c3528]">
            Galeria partii
          </h2>
        </div>
        <p className="text-muted text-xs">
          {photos.length}/{MAX_PLAY_PHOTOS} zdjęć ·{" "}
          {formatMegabytes(totalBytes)}/
          {formatMegabytes(MAX_PLAY_PHOTOS_TOTAL_BYTES)}
        </p>
      </div>

      {photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="paper-wash relative overflow-hidden rounded-[1.05rem] p-1.5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not a static asset */}
              <img
                src={photo.url}
                alt=""
                className="aspect-square w-full rounded-[0.8rem] object-cover"
              />
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  <button
                    type="button"
                    disabled={index === 0 || movingId === photo.id}
                    onClick={() => handleMove(photo.id, -1)}
                    className="rounded-full bg-white/80 px-2 py-1 text-xs font-bold text-[#6b5140] disabled:opacity-35"
                    aria-label="Przesuń wcześniej"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={
                      index === photos.length - 1 || movingId === photo.id
                    }
                    onClick={() => handleMove(photo.id, 1)}
                    className="rounded-full bg-white/80 px-2 py-1 text-xs font-bold text-[#6b5140] disabled:opacity-35"
                    aria-label="Przesuń później"
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(photo.id)}
                  className="rounded-full bg-white/80 px-2 py-1 text-xs font-bold text-[#8f3528]"
                >
                  Usuń
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {uploads.length > 0 ? (
        <div className="space-y-1.5">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
                upload.status === "error"
                  ? "bg-[#fff2ef] text-[#8f3528]"
                  : upload.status === "done"
                    ? "bg-moss-soft text-moss"
                    : "paper-wash text-[#6b5140]"
              }`}
            >
              <span className="min-w-0 truncate">
                {upload.fileName || "Zdjęcie"}
              </span>
              <span className="shrink-0">
                {upload.status === "error"
                  ? upload.error
                  : upload.progressLabel}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {remainingSlots > 0 ? (
        <label className="wood-grain text-cream inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold">
          + Dodaj zdjęcia
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
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
