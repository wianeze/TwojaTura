import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const appRoot = new URL("../../src/app/(app)/", import.meta.url);

const mainRoutes = [
  { name: "Stół", page: "page.tsx", loading: null },
  { name: "Półka", page: "gry/page.tsx", loading: "gry/loading.tsx" },
  {
    name: "Legendarium",
    page: "legendarium/page.tsx",
    loading: "legendarium/loading.tsx",
  },
  {
    name: "Kalendarium",
    page: "kalendarium/page.tsx",
    loading: "kalendarium/loading.tsx",
  },
  {
    name: "Kronika",
    page: "kronika/page.tsx",
    loading: "kronika/loading.tsx",
  },
  { name: "Profil", page: "profil/page.tsx", loading: "profil/loading.tsx" },
] as const;

test("all main routes stream a layout-shaped fallback instead of blocking navigation", () => {
  for (const route of mainRoutes) {
    const source = readFileSync(new URL(route.page, appRoot), "utf8");

    assert.match(source, /<Suspense\s+fallback=/, route.name);
    assert.match(source, /RouteLoading/, route.name);

    if (route.loading) {
      assert.equal(
        existsSync(new URL(route.loading, appRoot)),
        true,
        route.name,
      );
    }
  }
});

test("keyboard navigation warms the same client-side routes as hover and touch", () => {
  const source = readFileSync(
    new URL("../../src/components/layout/warm-link.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /<Link/);
  assert.match(source, /router\.prefetch\(href\)/);
  assert.match(source, /onFocus=/);
  assert.match(source, /onPointerEnter=/);
  assert.match(source, /onTouchStart=/);
});
