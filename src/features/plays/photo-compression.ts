import {
  MAX_PLAY_PHOTO_BYTES,
  MAX_PLAY_PHOTO_DIMENSION,
} from "./photo-limits.ts";

const QUALITY_STEPS = [0.8, 0.6, 0.4] as const;
const DIMENSION_STEPS = [MAX_PLAY_PHOTO_DIMENSION, 1200] as const;

export type CompressedPhoto = {
  blob: Blob;
  mimeType: "image/webp" | "image/jpeg";
  width: number;
  height: number;
};

export type PhotoCompressionErrorReason =
  "decode-failed" | "too-large" | "unsupported-type";

export class PhotoCompressionError extends Error {
  readonly reason: PhotoCompressionErrorReason;

  constructor(message: string, reason: PhotoCompressionErrorReason) {
    super(message);
    this.name = "PhotoCompressionError";
    this.reason = reason;
  }
}

function isLikelyHeic(file: File) {
  return /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name.trim());
}

export function computeTargetSize(
  width: number,
  height: number,
  maxDimension: number,
) {
  const longerSide = Math.max(width, height);
  if (longerSide <= maxDimension) {
    return { width, height };
  }

  const scale = maxDimension / longerSide;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function encodeCanvas(
  canvas: HTMLCanvasElement,
  mimeType: "image/webp" | "image/jpeg",
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

/**
 * Decodes (with EXIF orientation applied), downsizes to at most
 * MAX_PLAY_PHOTO_DIMENSION on the longer side, and encodes to WebP —
 * falling back to JPEG when the browser can't actually encode WebP (some
 * canvas.toBlob("image/webp") calls silently return a different type).
 * Retries at lower quality/dimension until the result fits
 * MAX_PLAY_PHOTO_BYTES, or throws PhotoCompressionError.
 */
export async function compressImageFile(file: File): Promise<CompressedPhoto> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    if (isLikelyHeic(file)) {
      throw new PhotoCompressionError(
        "Ten telefon zapisuje zdjęcia w formacie HEIC, którego ta przeglądarka nie odczyta. Zmień w Ustawieniach aparatu na „Najbardziej kompatybilne” albo dodaj zdjęcie z Safari.",
        "unsupported-type",
      );
    }

    throw new PhotoCompressionError(
      "Nie udało się odczytać tego zdjęcia. Sprawdź, czy to prawidłowy plik obrazu.",
      "decode-failed",
    );
  }

  try {
    for (const maxDimension of DIMENSION_STEPS) {
      const { width, height } = computeTargetSize(
        bitmap.width,
        bitmap.height,
        maxDimension,
      );

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new PhotoCompressionError(
          "Ta przeglądarka nie obsługuje przetwarzania zdjęć.",
          "decode-failed",
        );
      }
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of QUALITY_STEPS) {
        const webpBlob = await encodeCanvas(canvas, "image/webp", quality);
        const usesWebp = Boolean(webpBlob) && webpBlob!.type === "image/webp";
        const blob = usesWebp
          ? webpBlob!
          : await encodeCanvas(canvas, "image/jpeg", quality);

        if (blob && blob.size <= MAX_PLAY_PHOTO_BYTES) {
          return {
            blob,
            mimeType: usesWebp ? "image/webp" : "image/jpeg",
            width,
            height,
          };
        }
      }
    }

    throw new PhotoCompressionError(
      "Nie udało się skompresować zdjęcia poniżej 1,5 MB. Spróbuj mniejszego zdjęcia.",
      "too-large",
    );
  } finally {
    bitmap.close();
  }
}
