import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Panel } from "@/components/ui/panel";
import { getMemberInitial } from "@/features/auth/current-member";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { ProfileForm } from "@/features/auth/profile-form";
import { signOutAction } from "@/features/auth/actions";

export const metadata: Metadata = { title: "Karta Gracza" };

export default async function ProfilePage() {
  const state = await getCurrentMember();
  if (state.status !== "active-member") redirect("/brak-dostepu");
  const { member } = state;

  return (
    <Panel className="paper-wash mx-auto max-w-2xl p-6 sm:p-8">
      <div className="flex items-center gap-4">
        {member.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external user-provided URL
          <img
            src={member.avatarUrl}
            alt=""
            className="size-20 rounded-full object-cover shadow-lg"
          />
        ) : (
          <span className="bg-brand text-cream grid size-20 place-items-center rounded-full text-2xl font-bold shadow-lg">
            {getMemberInitial(member.displayName)}
          </span>
        )}
        <div>
          <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
            Twoje konto
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold">
            Karta Gracza
          </h1>
        </div>
      </div>
      <ProfileForm member={member} />
      <form action={signOutAction} className="mt-4 text-center">
        <button
          type="submit"
          className="text-accent text-sm font-semibold underline-offset-4 hover:underline"
        >
          Wyloguj się
        </button>
      </form>
    </Panel>
  );
}
