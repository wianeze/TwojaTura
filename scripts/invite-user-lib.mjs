export function getAppOrigin() {
  const configuredOrigin =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

  try {
    const parsed = new URL(configuredOrigin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Unsupported app origin protocol");
    }

    return parsed.origin;
  } catch {
    return "http://localhost:3000";
  }
}

export function buildAuthCallbackUrl(nextPath) {
  const callbackUrl = new URL("/auth/callback", getAppOrigin());
  callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl.toString();
}

function looksLikeJwt(value) {
  return typeof value === "string" && value.split(".").length === 3;
}

export function getInviteAdminConfig(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    throw new Error("Brakuje NEXT_PUBLIC_SUPABASE_URL.");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "Brakuje SUPABASE_SERVICE_ROLE_KEY wymaganej przez lokalny Auth Admin invite flow.",
    );
  }

  if (serviceRoleKey.startsWith("sb_secret_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY musi byc legacy JWT service_role, nie sb_secret_....",
    );
  }

  if (!looksLikeJwt(serviceRoleKey)) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ma nieprawidlowy format. Oczekiwany jest JWT service_role.",
    );
  }

  return {
    url,
    serviceRoleKey,
    redirectTo: buildAuthCallbackUrl("/ustaw-haslo"),
  };
}

export function formatInviteError(error) {
  const lines = ["Nie udalo sie wyslac zaproszenia."];

  if (typeof error?.status === "number") {
    lines.push(`Status: ${error.status}`);
  }

  if (typeof error?.code === "string" && error.code) {
    lines.push(`Kod: ${error.code}`);
  }

  if (typeof error?.message === "string" && error.message) {
    lines.push(`Powod: ${error.message}`);
  }

  return lines.join("\n");
}

export const VALID_MEMBER_ROLES = ["member", "admin", "observer"];

export function parseRole(value) {
  const role = value?.trim() || "member";

  if (!VALID_MEMBER_ROLES.includes(role)) {
    throw new Error(
      `Nieprawidlowa rola "${role}". Dozwolone wartosci: ${VALID_MEMBER_ROLES.join(", ")}.`,
    );
  }

  return role;
}

export function getProvisioningState(
  profile,
  membership,
  expectedRole = "member",
) {
  return (
    Boolean(profile) &&
    Boolean(membership) &&
    membership.role === expectedRole &&
    membership.is_active === true
  );
}

export function formatInviteOutcome({
  email,
  inviteSucceeded,
  provisioningReady,
  role = "member",
}) {
  if (!inviteSucceeded) {
    return "Nie udalo sie wyslac zaproszenia.";
  }

  if (provisioningReady) {
    return [
      "Zaproszenie wyslane.",
      `Uzytkownik: ${email}`,
      `Rola: ${role}.`,
      "Profil i czlonkostwo: gotowe.",
    ].join("\n");
  }

  return [
    "Zaproszenie wyslane.",
    `Uzytkownik: ${email}`,
    `Rola: ${role}.`,
    "Nie udalo sie potwierdzic provisioningu czlonkostwa. Sprawdz profiles i app_members.",
  ].join("\n");
}
