import { createClient } from "@supabase/supabase-js";
import {
  formatInviteError,
  formatInviteOutcome,
  getInviteAdminConfig,
  getProvisioningState,
  parseRole,
} from "./invite-user-lib.mjs";

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
}

async function main() {
  const email = argument("email");
  const displayName = argument("name");

  if (!email || !displayName) {
    console.error(
      'Uzycie: pnpm invite:user -- --email osoba@example.com --name "Imie" [--role member|admin|observer]',
    );
    return 1;
  }

  let role;
  try {
    role = parseRole(argument("role"));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  let inviteConfig;
  try {
    inviteConfig = getInviteAdminConfig();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const supabase = createClient(inviteConfig.url, inviteConfig.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      display_name: displayName,
      twoja_tura_invite: true,
    },
    redirectTo: inviteConfig.redirectTo,
  });

  if (error || !data.user) {
    console.error(formatInviteError(error));
    return 1;
  }

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("id").eq("id", data.user.id).maybeSingle(),
    supabase
      .from("app_members")
      .select("user_id, role, is_active")
      .eq("user_id", data.user.id)
      .maybeSingle(),
  ]);

  // The auth.users trigger always provisions new members with role
  // "member" — apply the requested role afterwards with the service-role
  // client rather than teaching the trigger about non-default roles.
  let finalMembership = membership;
  if (membership && role !== "member") {
    const { data: updatedMembership, error: roleUpdateError } = await supabase
      .from("app_members")
      .update({ role })
      .eq("user_id", data.user.id)
      .select("user_id, role, is_active")
      .maybeSingle();

    if (roleUpdateError) {
      console.error(
        `Zaproszenie wyslane, ale nie udalo sie ustawic roli "${role}": ${roleUpdateError.message}`,
      );
      return 1;
    }

    finalMembership = updatedMembership;
  }

  const provisioningReady = getProvisioningState(
    profile,
    finalMembership,
    role,
  );
  const output = formatInviteOutcome({
    email,
    inviteSucceeded: true,
    provisioningReady,
    role,
  });

  if (provisioningReady) {
    console.log(output);
  } else {
    console.warn(output);
  }

  return 0;
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
