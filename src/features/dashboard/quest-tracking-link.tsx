"use client";

import Link from "next/link";
import { useEffect, type CSSProperties, type ReactNode } from "react";
import { trackUsage } from "@/lib/analytics/client";
import type { AnalyticsMetadata } from "@/lib/analytics/catalog";

type QuestTrackingLinkProps = {
  questId: string;
  expiresAt?: string;
  href: string;
  className: string;
  style?: CSSProperties;
  questKind?: string;
  children: ReactNode;
};

function questMetadata(
  questId: string,
  expiresAt?: string,
): AnalyticsMetadata {
  const [questType, firstId, secondId] = questId.split(":");
  const metadata: Record<string, string> = { quest_type: questType };
  if (expiresAt) metadata.expires_at = expiresAt;
  if (questType === "rate-game") {
    if (firstId) metadata.play_id = firstId;
    if (secondId) metadata.game_id = secondId;
  } else if (firstId) {
    metadata.meeting_id = firstId;
  }
  return metadata as AnalyticsMetadata;
}

export function QuestTrackingLink({
  questId,
  expiresAt,
  href,
  className,
  style,
  questKind,
  children,
}: QuestTrackingLinkProps) {
  useEffect(() => {
    trackUsage({
      eventName: "quest.presented",
      componentKey: "dashboard.quest",
      action: "presented",
      entityType: "quest",
      correlationKey: questId,
      metadata: questMetadata(questId, expiresAt),
    });
  }, [expiresAt, questId]);

  return (
    <Link
      href={href}
      data-quest-kind={questKind}
      className={className}
      style={style}
      onClick={() =>
        trackUsage({
          eventName: "quest.clicked",
          componentKey: "dashboard.quest",
          action: "clicked",
          entityType: "quest",
          correlationKey: questId,
          metadata: questMetadata(questId, expiresAt),
        })
      }
    >
      {children}
    </Link>
  );
}
