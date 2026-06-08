"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode, Ref } from "react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Chat" },
  { href: "/skills", label: "Skills" },
] as const;

/**
 * Shared, route-aware app header. Renders the brand, a Chat ↔ Skills segmented
 * control (active state derived from the current route), an optional left-side
 * `status` slot and an optional right-side `actions` slot. Pages decide which
 * route-specific controls to pass — e.g. the chat page passes the Tasks/Token
 * controls as `actions` so they only appear on `/`.
 *
 * The header is fixed-positioned; pass `ref` to measure its height for the
 * content offset (see `useMeasuredHeight`).
 */
export function AppHeader({
  ref,
  status,
  actions,
}: {
  ref?: Ref<HTMLElement>;
  status?: ReactNode;
  actions?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <header
      className="fixed inset-x-0 top-0 z-30 bg-background/95 px-4 py-3 backdrop-blur sm:px-8 sm:py-4 lg:px-10"
      ref={ref}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">OpenRouter Chat</p>
            {status ? (
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                {status}
              </div>
            ) : null}
          </div>
          <nav
            aria-label="Primary"
            className="flex shrink-0 items-center gap-0.5 rounded-lg bg-muted p-0.5"
          >
            {NAV_ITEMS.map((item) => {
              const active = isActiveRoute(pathname, item.href);

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-background text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
