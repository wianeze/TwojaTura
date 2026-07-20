import { SectionHeading } from "@/components/ui/section-heading";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { LegendariumShowcase } from "@/features/legendarium/legendarium-showcase";
import { getLegendariumData } from "@/features/legendarium/queries";

export default async function LegendariumPage() {
  const memberState = await getCurrentMember();

  if (memberState.status !== "active-member") {
    return null;
  }

  const data = await getLegendariumData(memberState.member);

  return (
    <div className="space-y-7">
      <SectionHeading
        eyebrow="Klubowe opowieści"
        title="Legendarium"
        description="Twoje realne punkty, ranking grupy i historia zdobytych nagród przy wspólnym stole."
        action={
          <span className="bg-moss-soft text-moss w-fit rounded-full px-4 py-2 text-xs font-bold">
            żywe punkty
          </span>
        }
      />
      <LegendariumShowcase data={data} />
    </div>
  );
}
