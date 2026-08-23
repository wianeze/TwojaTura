"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { mapPathnameToRouteKey } from "@/lib/analytics/catalog";
import { trackUsage } from "@/lib/analytics/client";

export function RouteViewTracker() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    const routeKey = mapPathnameToRouteKey(pathname);
    if (!routeKey || lastTrackedPath.current === pathname) return;
    lastTrackedPath.current = pathname;
    trackUsage({
      eventName: "route.viewed",
      routeKey,
      componentKey: "app.route",
      action: "viewed",
    });
  }, [pathname]);

  return null;
}
