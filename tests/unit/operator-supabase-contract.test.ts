import assert from "node:assert/strict";
import test from "node:test";
import {
  describeKeyKind,
  describeOperatorConnection,
  readOperatorSupabaseConfig,
} from "../../scripts/operator-supabase.mts";

/** Atrapa JWT — tylko payload ma znaczenie, podpis nie jest weryfikowany. */
function fakeJwt(role: string) {
  const payload = Buffer.from(JSON.stringify({ role }), "utf8").toString(
    "base64url",
  );

  return `header.${payload}.signature`;
}

const SERVICE_ROLE_JWT = fakeJwt("service_role");
const ANON_JWT = fakeJwt("anon");

test("klucz service_role i sb_secret są akceptowane", () => {
  assert.equal(describeKeyKind(SERVICE_ROLE_JWT).ok, true);
  assert.equal(describeKeyKind("sb_secret_abc123").ok, true);
});

test("klucze publiczne są odrzucane z wyjaśnieniem permission denied", () => {
  const anon = describeKeyKind(ANON_JWT);
  assert.equal(anon.ok, false);
  if (!anon.ok) {
    assert.match(anon.message, /ANON/);
    assert.match(anon.message, /public\.games/);
  }

  const publishable = describeKeyKind("sb_publishable_abc123");
  assert.equal(publishable.ok, false);
  if (!publishable.ok) {
    assert.match(publishable.message, /PUBLISHABLE/);
  }
});

test("nierozpoznany format klucza jest odrzucany", () => {
  for (const value of ["", "cokolwiek", "abc.def"]) {
    assert.equal(
      describeKeyKind(value).ok,
      false,
      `„${value}” nie powinno przejść`,
    );
  }
});

test("brak SUPABASE_SERVICE_ROLE_KEY kończy się czytelnym błędem", () => {
  assert.throws(
    () =>
      readOperatorSupabaseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }),
    /SUPABASE_SERVICE_ROLE_KEY/,
  );
});

test("brak adresu Supabase kończy się czytelnym błędem", () => {
  assert.throws(
    () =>
      readOperatorSupabaseConfig({
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_JWT,
      }),
    /SUPABASE_URL/,
  );
});

test("SUPABASE_URL ma pierwszeństwo nad NEXT_PUBLIC_SUPABASE_URL", () => {
  const config = readOperatorSupabaseConfig({
    SUPABASE_URL: "https://prod.supabase.co",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_JWT,
  });

  assert.equal(config.url, "https://prod.supabase.co");
  assert.equal(config.urlSource, "SUPABASE_URL");
});

test("bez SUPABASE_URL narzędzie spada na adres publiczny", () => {
  const config = readOperatorSupabaseConfig({
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_local",
  });

  assert.equal(config.url, "http://127.0.0.1:54321");
  assert.equal(config.urlSource, "NEXT_PUBLIC_SUPABASE_URL");
});

test("opis połączenia nigdy nie zawiera wartości klucza", () => {
  const config = readOperatorSupabaseConfig({
    SUPABASE_URL: "https://prod.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_JWT,
  });

  const description = describeOperatorConnection(config);

  assert.ok(!description.includes(SERVICE_ROLE_JWT));
  assert.match(description, /service_role \(JWT\)/);
  assert.match(description, /prod\.supabase\.co/);
});

test("komunikat o złym kluczu nie ujawnia jego wartości", () => {
  const publishable = "sb_publishable_bardzo_tajne_abcdef";
  const result = describeKeyKind(publishable);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(!result.message.includes(publishable));
    assert.ok(!result.kind.includes("bardzo_tajne"));
  }
});
