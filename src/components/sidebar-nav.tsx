"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Banknote,
  BedDouble,
  Building2,
  CalendarCheck,
  CalendarX,
  ClipboardList,
  DoorOpen,
  Gauge,
  LayoutDashboard,
  LifeBuoy,
  LogIn,
  LogOut,
  Menu,
  ReceiptText,
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
  banknote: Banknote,
  bed: BedDouble,
  calendarCheck: CalendarCheck,
  calendarX: CalendarX,
  dashboard: LayoutDashboard,
  doorOpen: DoorOpen,
  gauge: Gauge,
  iam: ShieldCheck,
  lifeBuoy: LifeBuoy,
  logIn: LogIn,
  logOut: LogOut,
  organizations: Building2,
  receipt: ReceiptText,
  users: Users,
  wrench: Wrench
};

export type SidebarIconName = keyof typeof sidebarIcons;

export type SidebarNavItem = {
  group?: string;
  href: string;
  icon: SidebarIconName;
  label: string;
};

type SidebarOrganization = {
  activeOrganizationId: string;
  memberships: {
    organization: {
      id: string;
      name: string;
      status: string;
    };
  }[];
};

type SidebarNavProps = {
  ariaLabel: string;
  brandHref: string;
  eyebrow?: string;
  items: SidebarNavItem[];
  organization?: SidebarOrganization;
  userLabel?: string;
  userMeta?: string;
};

export function SidebarNav({
  ariaLabel,
  brandHref,
  eyebrow,
  items,
  organization,
  userLabel,
  userMeta
}: SidebarNavProps) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const requestedOrganizationId = searchParams.get("organizationId") ?? undefined;
  const activeOrganizationId =
    organization?.memberships.some(
      (membership) => membership.organization.id === requestedOrganizationId
    )
      ? requestedOrganizationId
      : organization?.activeOrganizationId;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileRendered, setMobileRendered] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desktopSidebarRef = useRef<HTMLElement | null>(null);

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

  function blurActiveSidebarControl() {
    const activeElement = document.activeElement;

    if (
      activeElement instanceof HTMLElement &&
      desktopSidebarRef.current?.contains(activeElement)
    ) {
      activeElement.blur();
    }
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
              organization={organization}
              activeOrganizationId={activeOrganizationId}
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

      <aside
        ref={desktopSidebarRef}
        onMouseLeave={blurActiveSidebarControl}
        className="group fixed inset-y-0 left-0 z-30 hidden w-[4.75rem] flex-col border-r bg-card shadow-sm transition-[width] duration-200 ease-out hover:w-64 lg:flex"
      >
        <SidebarContent
          ariaLabel={ariaLabel}
          brandHref={brandHref}
          eyebrow={eyebrow}
          items={items}
          organization={organization}
          activeOrganizationId={activeOrganizationId}
          pathname={pathname}
          userLabel={userLabel}
          userMeta={userMeta}
        />
      </aside>
    </>
  );
}

type SidebarContentProps = SidebarNavProps & {
  activeOrganizationId?: string;
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
  organization,
  activeOrganizationId,
  pathname,
  trailingAction,
  userLabel,
  userMeta
}: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden overflow-x-hidden px-3 py-4">
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

      {organization && activeOrganizationId ? (
        <SidebarOrganizationSwitcher
          activeOrganizationId={activeOrganizationId}
          expanded={expanded}
          memberships={organization.memberships}
          pathname={pathname}
        />
      ) : null}

      <nav
        aria-label={ariaLabel}
        className="mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden pr-1"
      >
        {items.map((item, index) => {
          const previousGroup = items[index - 1]?.group;
          const showGroup = item.group && item.group !== previousGroup;

          return (
            <div
              key={item.href}
              className={cn(
                "min-w-0 shrink-0",
                showGroup ? "mt-2 first:mt-0" : undefined
              )}
            >
              {showGroup ? (
                <p
                  className={cn(
                    "mb-1 h-5 truncate px-3 text-xs font-semibold uppercase text-muted-foreground transition-opacity duration-150",
                    expanded
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  )}
                >
                  {item.group}
                </p>
              ) : null}
              <SidebarLink
                activeOrganizationId={activeOrganizationId}
                expanded={expanded}
                isActive={isItemActive(pathname, item.href)}
                item={item}
                onNavigate={onNavigate}
              />
            </div>
          );
        })}
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
  activeOrganizationId,
  expanded,
  isActive,
  item,
  onNavigate
}: {
  activeOrganizationId?: string;
  expanded: boolean;
  isActive: boolean;
  item: SidebarNavItem;
  onNavigate?: () => void;
}) {
  const Icon = sidebarIcons[item.icon];

  return (
    <Link
      href={withOrganization(item.href, activeOrganizationId)}
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

function SidebarOrganizationSwitcher({
  activeOrganizationId,
  expanded,
  memberships,
  pathname
}: {
  activeOrganizationId: string;
  expanded: boolean;
  memberships: SidebarOrganization["memberships"];
  pathname: string;
}) {
  return (
    <form
      method="get"
      action={organizationSwitcherAction(pathname)}
      className="mt-2 flex min-w-0 items-end gap-2"
    >
      <label
        className={cn(
          "grid min-w-0 flex-1 gap-1 text-xs font-medium text-muted-foreground transition-opacity duration-150",
          expanded
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
        )}
      >
        <span
          className={cn(
            "truncate transition-opacity duration-150",
            expanded
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100"
          )}
        >
          Organization
        </span>
        <select
          name="organizationId"
          defaultValue={activeOrganizationId}
          aria-label="Organization"
          className="h-10 w-full min-w-0 rounded-md border bg-card px-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        >
          {memberships.map((membership) => (
            <option
              key={membership.organization.id}
              value={membership.organization.id}
            >
              {membership.organization.name}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        className={cn(
          "size-10 shrink-0 overflow-hidden transition-opacity duration-150",
          expanded
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100"
        )}
        title="Switch organization"
      >
        <Building2 className="size-4 shrink-0" aria-hidden="true" />
        <span className="sr-only">Switch organization</span>
      </Button>
    </form>
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

function withOrganization(href: string, organizationId?: string) {
  if (!organizationId || !href.startsWith("/app")) {
    return href;
  }

  const url = new URL(href, "http://double-daeng.local");
  url.searchParams.set("organizationId", organizationId);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function organizationSwitcherAction(pathname: string) {
  if (pathname.startsWith("/app/rooms/")) {
    return "/app/rooms";
  }

  return pathname.startsWith("/app") ? pathname : "/app";
}
