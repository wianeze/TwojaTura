"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

type WarmLinkProps = ComponentProps<typeof Link>;

export function WarmLink({
  href,
  onPointerEnter,
  onTouchStart,
  ...props
}: WarmLinkProps) {
  const router = useRouter();
  const warmRoute = () => {
    if (typeof href === "string") router.prefetch(href);
  };

  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onPointerEnter={(event) => {
        warmRoute();
        onPointerEnter?.(event);
      }}
      onTouchStart={(event) => {
        warmRoute();
        onTouchStart?.(event);
      }}
    />
  );
}
