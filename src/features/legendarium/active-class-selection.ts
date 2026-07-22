export type ActiveClassRpcResult = {
  error: { message?: string } | null;
};

export function normalizeActiveClassKey(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    throw new Error("Nieprawidłowy wybór klasy.");
  }

  return value.trim() || null;
}

export async function persistActiveClassSelection(
  invoke: (classKey: string | null) => PromiseLike<ActiveClassRpcResult>,
  classKey: string | null,
) {
  const { error } = await invoke(classKey);

  if (error) {
    throw new Error("Nie udało się ustawić aktywnej klasy.");
  }
}
