/**
 * Czysta logika stanu pickera "Kogo zapraszasz?" — bez React, żeby dało się
 * ją przetestować przez node --test niezależnie od komponentu. Prawdziwa
 * walidacja identyfikatorów (aktywny member, nie organizator, bez duplikatów)
 * i tak żyje w RPC (private.filter_invitable_user_ids) — to tutaj jest tylko
 * wygoda UI: przełączanie chipów, "zaznacz wszystkich", wyszukiwanie.
 */

export type InvitableMember = {
  id: string;
  displayName: string;
};

export function toggleInvitedUserId(
  current: string[],
  userId: string,
): string[] {
  return current.includes(userId)
    ? current.filter((id) => id !== userId)
    : [...current, userId];
}

export function selectAllInvitableIds(members: InvitableMember[]): string[] {
  return members.map((member) => member.id);
}

export function clearInvitedIds(): string[] {
  return [];
}

export function filterInvitableMembers<T extends InvitableMember>(
  members: T[],
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("pl-PL");
  if (!normalizedQuery) return members;

  return members.filter((member) =>
    member.displayName.toLocaleLowerCase("pl-PL").includes(normalizedQuery),
  );
}
