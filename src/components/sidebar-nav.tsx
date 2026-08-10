"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  Wrench,
  X
} from "lucide-react";
import { signOut } from "@/app/login/actions";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const sidebarIcons = {
  audit: ClipboardList,
  dashboard: LayoutDashboard,
  iam: ShieldCheck,
  organizations: Building2,
  users: Users,
  wrench: Wrench
};

export type SidebarIconName = keyof typeof sidebarIcons;

export type SidebarNavItem = {
  href: string;
  icon: SidebarIconName;
  label: string;
};

type SidebarNavProps = {
  ariaLabel: string;
  brandHref: string;
  eyebrow?: string;
  items: SidebarNavItem[];
  userLabel?: string;
  userMeta?: string;
};

export function SidebarNav({
  ariaLabel,
  brandHref,
  eyebrow,
  items,
  userLabel,
  userMeta
}: SidebarNavProps) {
  const pathname = usePathname() ?? "/";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileRendered, setMobileRendered] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function openMobileNav() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }

    setMobileRendered(true);
    window.requestAnimationFrame(() => {
      setMobileOpen(true);
    });
  }

  function closeMobileNav() {
    setMobileOpen(false);
    closeTimerRef.current = setTimeout(() => {
      setMobileRendered(false);
    }, 220);
  }

  return (
    <>
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-card px-4 shadow-sm lg:hidden">
        <Link
          href={brandHref}
          className="flex h-11 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Double Daeng"
        >
          <BrandLogo variant="mark" priority className="h-8 max-w-12" />
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={openMobileNav}
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </div>

      {mobileRendered ? (
        <div
          className={cn(
            "fixed inset-0 z-50 lg:hidden",
            mobileOpen ? "pointer-events-auto" : "pointer-events-none"
          )}
        >
          <button
            type="button"
            className={cn(
              "absolute inset-0 bg-foreground/35 transition-opacity duration-200 ease-out",
              mobileOpen ? "opacity-100" : "opacity-0"
            )}
            onClick={closeMobileNav}
            aria-label="Close navigation"
          />
          <aside
            className={cn(
              "relative flex h-full w-[min(20rem,calc(100vw-2rem))] flex-col border-r bg-card shadow-xl transition-transform duration-200 ease-out",
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <SidebarContent
              ariaLabel={ariaLabel}
              brandHref={brandHref}
              eyebrow={eyebrow}
              expanded
              items={items}
              onNavigate={closeMobileNav}
              pathname={pathname}
              userLabel={userLabel}
              userMeta={userMeta}
              trailingAction={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={closeMobileNav}
                  aria-label="Close navigation"
                >
                  <X className="size-5" aria-hidden="true" />
                </Button>
              }
            />
          </aside>
        </div>
      ) : null}

      <aside className="group fixed inset-y-0 left-0 z-30 hidden w-[4.75rem] flex-col border-r bg-card shadow-sm transition-[width] duration-200 ease-out hover:w-64 lg:flex">
        <SidebarContent
          ariaLabel={ariaLabel}
          brandHref={brandHref}
          eyebrow={eyebrow}
          items={items}
          pathname={pathname}
          userLabel={userLabel}
          userMeta={userMeta}
        />
      </aside>
    </>
  );
}

type SidebarContentProps = SidebarNavProps & {
  expanded?: boolean;
  onNavigate?: () => void;
  pathname: string;
  trailingAction?: ReactNode;
};

function SidebarContent({
  ariaLabel,
  brandHref,
  eyebrow,
  expanded = false,
  items,
  onNavigate,
  pathname,
  trailingAction,
  userLabel,
  userMeta
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden px-3 py-4">
      <div className="flex h-12 items-center gap-2">
        <Link
          href={brandHref}
          onClick={onNavigate}
          className="relative flex h-12 min-w-0 flex-1 items-center rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Double Daeng"
        >
          <BrandLogo
            variant="mark"
            priority
            className={cn(
              "h-8 max-w-12 shrink-0 transition-opacity duration-150",
              expanded ? "opacity-0" : "group-hover:opacity-0"
            )}
          />
          <BrandLogo
            variant="wordmark"
            priority
            className={cn(
              "absolute h-8 max-w-44 transition-opacity duration-150",
              expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          />
        </Link>
        {trailingAction}
      </div>

      {eyebrow ? (
        <div className="mt-3 h-6 overflow-hidden">
          <span
            className={cn(
              "inline-flex rounded-full border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground transition-all duration-150",
              expanded
                ? "translate-x-0 opacity-100"
                : "translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
            )}
          >
            {eyebrow}
          </span>
        </div>
      ) : (
        <div className="mt-3 h-6" />
      )}

      <nav aria-label={ariaLabel} className="mt-3 grid gap-2">
        {items.map((item) => (
          <SidebarLink
            key={item.href}
            expanded={expanded}
            isActive={isItemActive(pathname, item.href)}
            item={item}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="mt-auto grid gap-3 border-t pt-3">
        {userLabel ? (
          <div className="min-h-12 overflow-hidden rounded-md px-3 py-2">
            <p
              className={cn(
                "truncate text-sm font-medium transition-opacity duration-150",
                expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              {userLabel}
            </p>
            {userMeta ? (
              <p
                className={cn(
                  "truncate text-xs text-muted-foreground transition-opacity duration-150",
                  expanded
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                )}
              >
                {userMeta}
              </p>
            ) : null}
          </div>
        ) : null}
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            className="h-11 w-full justify-start gap-3 overflow-hidden px-3 text-muted-foreground hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="size-5 shrink-0" aria-hidden="true" />
            <span
              className={cn(
                "truncate transition-opacity duration-150",
                expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              Sign out
            </span>
          </Button>
        </form>
      </div>
    </div>
  );
}

function SidebarLink({
  expanded,
  isActive,
  item,
  onNavigate
}: {
  expanded: boolean;
  isActive: boolean;
  item: SidebarNavItem;
  onNavigate?: () => void;
}) {
  const Icon = sidebarIcons[item.icon];

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex h-11 items-center gap-3 overflow-hidden rounded-md px-3 text-sm font-medium transition-colors",
        "hover:bg-secondary hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive
          ? "bg-primary/10 font-semibold text-primary"
          : "text-muted-foreground"
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span
        className={cn(
          "truncate transition-opacity duration-150",
          expanded ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}

function isItemActive(pathname: string, href: string) {
  const itemPathname = getPathname(href);

  if (itemPathname === "/app" || itemPathname === "/admin") {
    return pathname === itemPathname;
  }

  return pathname === itemPathname || pathname.startsWith(`${itemPathname}/`);
}

function getPathname(href: string) {
  return new URL(href, "http://double-daeng.local").pathname;
}
