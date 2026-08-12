import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import {
  activeRewards,
  achievementRewardNotice,
} from "@/features/legendarium/reward-guide";
import { LegendariumShowcase } from "@/features/legendarium/legendarium-showcase";
import { MobileRewardsSheet } from "@/features/legendarium/mobile-rewards-sheet";
import { getLegendariumData } from "@/features/legendarium/queries";
import { profileServerOperation } from "@/lib/server-performance";

export default async function LegendariumPage() {
  const memberState = await getCurrentMember();

  if (memberState.status !== "active-member") {
    return null;
  }

  const data = await profileServerOperation("/legendarium", () =>
    getLegendariumData(memberState.member),
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <header
        style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
        className="anim-rise-in-fast flex items-end justify-between gap-3"
      >
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-[#e3ae67] uppercase">
            Legendy przy ognisku
          </p>
          <h1 className="font-display text-cream mt-2 text-4xl font-semibold tracking-tight drop-shadow-[0_2px_12px_rgba(20,10,7,0.32)] sm:text-5xl">
            Legendarium
          </h1>
        </div>
        <div className="md:hidden">
          <MobileRewardsSheet
            rewards={activeRewards}
            achievementRewardNotice={achievementRewardNotice}
          />
        </div>
      </header>
      <LegendariumShowcase data={data} />
    </div>
  );
}
