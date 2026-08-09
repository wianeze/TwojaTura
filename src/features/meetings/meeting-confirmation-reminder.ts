type ReminderRpcError = {
  code?: string | null;
  message?: string | null;
};

type ReminderRpcResponse = {
  data: boolean | null;
  error: ReminderRpcError | null;
};

type ReminderLog = (message: string, details: Record<string, unknown>) => void;

/**
 * Powiadomienie jest dodatkiem do zapisu RSVP: awaria kolejki nie może zmienić
 * poprawnie zapisanej odpowiedzi użytkownika w błąd całej operacji.
 */
export async function enqueueMeetingConfirmationReminderAfterRsvp(
  requestReminder: () => PromiseLike<ReminderRpcResponse>,
  logError: ReminderLog = (message, details) => console.error(message, details),
) {
  try {
    const { data, error } = await requestReminder();

    if (error) {
      logError("[meetings] Nie udało się zakolejkować przypomnienia.", {
        code: error.code ?? null,
        message: error.message ?? null,
      });
      return { ok: false as const, queued: false as const };
    }

    return { ok: true as const, queued: data === true };
  } catch (error) {
    logError("[meetings] Nie udało się zakolejkować przypomnienia.", {
      code: null,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return { ok: false as const, queued: false as const };
  }
}
