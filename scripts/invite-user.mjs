import { createClient } from "@supabase/supabase-js";
import {
  formatInviteError,
  formatInviteOutcome,
  getInviteAdminConfig,
  getProvisioningState,
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
      'Uzycie: pnpm invite:user -- --email osoba@example.com --name "Imie"',
    );
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

  const provisioningReady = getProvisioningState(profile, membership);
  const output = formatInviteOutcome({
    email,
    inviteSucceeded: true,
    provisioningReady,
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
