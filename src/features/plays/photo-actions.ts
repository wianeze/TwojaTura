"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMemberFromClient } from "@/features/auth/queries/get-current-member";
import type { PlayPhoto } from "./types";

const BUCKET = "play-photos";

type DatabaseErrorLike = {
  code?: string | null;
};

async function requireActiveMember() {
  const supabase = await createClient();
  const memberState = await getCurrentMemberFromClient(supabase);

  if (memberState.status !== "active-member") {
    return {
      ok: false as const,
      message: "Sesja wygasła albo nie masz dostępu do tej sekcji.",
    };
  }

  return {
    ok: true as const,
    supabase,
    member: memberState.member,
  };
}

function mapPhotoDatabaseError(error: DatabaseErrorLike | null) {
  switch (error?.code) {
    case "42501":
      return "Nie masz uprawnień do zarządzania zdjęciami tej partii.";
    case "23514":
      return "Przekroczono limit zdjęć (15) albo łączny rozmiar (15 MB) dla tej partii.";
    case "22023":
      return "Lista zdjęć do zmiany kolejności jest nieprawidłowa.";
    default:
      return "Nie udało się zapisać zdjęcia. Spróbuj ponownie.";
  }
}

function revalidatePlayPhotoSurfaces(playId: string) {
  revalidatePath(`/kronika/${playId}`);
  revalidatePath(`/kronika/${playId}/edytuj`);
}

export async function createPlayPhotoAction(input: {
  playId: string;
  photoId: string;
  storagePath: string;
  byteSize: number;
  width: number;
  height: number;
}): Promise<{ ok: true; photo: PlayPhoto } | { ok: false; message: string }> {
  const access = await requireActiveMember();
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  const { data, error } = await access.supabase
    .from("play_photos")
    .insert({
      id: input.photoId,
      play_id: input.playId,
      storage_path: input.storagePath,
      // Overwritten by the z_play_photos_prepare_insert trigger, which
      // assigns the real next position under a row lock — this value only
      // needs to satisfy the 1..15 check constraint.
      position: 1,
      byte_size: input.byteSize,
      width: input.width,
      height: input.height,
      created_by: access.member.id,
    })
    .select("id, storage_path, position, width, height, byte_size")
    .single();

  if (error || !data) {
    await access.supabase.storage.from(BUCKET).remove([input.storagePath]);
    return { ok: false, message: mapPhotoDatabaseError(error) };
  }

  const { data: signed } = await access.supabase.storage
    .from(BUCKET)
    .createSignedUrl(data.storage_path, 3600);

  revalidatePlayPhotoSurfaces(input.playId);

  return {
    ok: true,
    photo: {
      id: data.id,
      url: signed?.signedUrl ?? "",
      position: data.position,
      width: data.width,
      height: data.height,
      byteSize: data.byte_size,
    },
  };
}

export async function deletePlayPhotoAction(
  playId: string,
  photoId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const access = await requireActiveMember();
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  const { data: photo, error: fetchError } = await access.supabase
    .from("play_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("play_id", playId)
    .maybeSingle();

  if (fetchError || !photo) {
    return { ok: false, message: "Nie znaleziono zdjęcia do usunięcia." };
  }

  const { error: deleteError } = await access.supabase
    .from("play_photos")
    .delete()
    .eq("id", photoId);

  if (deleteError) {
    return { ok: false, message: mapPhotoDatabaseError(deleteError) };
  }

  const { error: storageError } = await access.supabase.storage
    .from(BUCKET)
    .remove([photo.storage_path]);

  if (storageError) {
    console.error("Nie udało się usunąć pliku ze Storage:", storageError);
  }

  revalidatePlayPhotoSurfaces(playId);

  return { ok: true };
}

export async function reorderPlayPhotosAction(
  playId: string,
  photoIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const access = await requireActiveMember();
  if (!access.ok) {
    return { ok: false, message: access.message };
  }

  const { error } = await access.supabase.rpc("reorder_play_photos", {
    p_play_id: playId,
    p_photo_ids: photoIds,
  });

  if (error) {
    return { ok: false, message: mapPhotoDatabaseError(error) };
  }

  revalidatePlayPhotoSurfaces(playId);

  return { ok: true };
}
