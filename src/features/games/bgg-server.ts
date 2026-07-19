import { extractBggGameId, parseBggThingXml } from "./bgg.ts";

const BGG_ENDPOINT = "https://api.geekdo.com/xmlapi2/thing";
const BGG_USER_AGENT = "TwojaTura-BGG-Autofill/1.0";
const RETRYABLE_STATUSES = new Set([202, 429]);

type BggFetchOptions = {
  token?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  retryDelaysMs?: number[];
};

function wait(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function fetchBggGameDetailsFromApi(
  url: string,
  options: BggFetchOptions = {},
) {
  const gameId = extractBggGameId(url);
  if (!gameId) {
    throw new Error("Wklej poprawny link do gry w BoardGameGeek.");
  }

  const token = options.token ?? process.env.BGG_TOKEN;
  if (!token?.trim()) {
    throw new Error("Brakuje konfiguracji BGG_TOKEN po stronie serwera.");
  }

  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 9_000;
  const retryDelaysMs = options.retryDelaysMs ?? [350, 800];
  const endpoint = `${BGG_ENDPOINT}?id=${encodeURIComponent(gameId)}&stats=1`;

  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetcher(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": BGG_USER_AGENT,
        },
        cache: "no-store",
        signal: controller.signal,
      });

      if (
        RETRYABLE_STATUSES.has(response.status) &&
        attempt < retryDelaysMs.length
      ) {
        await wait(retryDelaysMs[attempt]);
        continue;
      }

      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? "BGG chwilowo ogranicza liczbę zapytań. Spróbuj ponownie za moment."
            : `BGG zwróciło błąd ${response.status}. Spróbuj ponownie.`,
        );
      }

      return parseBggThingXml(await response.text());
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("BGG nie odpowiedziało na czas. Spróbuj ponownie.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Nie udało się pobrać danych z BGG.");
}
