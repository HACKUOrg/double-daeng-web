import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SidebarNavItem = {
  href: string;
  icon: LucideIcon;
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
  return (
    <aside className="group fixed inset-y-0 left-0 z-30 flex w-[4.75rem] flex-col border-r bg-card shadow-sm transition-[width] duration-200 ease-out hover:w-64">
      <div className="flex h-full flex-col overflow-hidden px-3 py-4">
        <Link
          href={brandHref}
          className="relative flex h-12 items-center rounded-md px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Double Daeng"
        >
          <BrandLogo
            variant="mark"
            priority
            className="h-8 max-w-12 shrink-0 transition-opacity duration-150 group-hover:opacity-0"
          />
          <BrandLogo
            variant="wordmark"
            priority
            className="absolute h-8 max-w-44 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          />
        </Link>

        {eyebrow ? (
          <div className="mt-3 h-6 overflow-hidden">
            <span className="inline-flex translate-x-1 rounded-full border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100">
              {eyebrow}
            </span>
          </div>
        ) : (
          <div className="mt-3 h-6" />
        )}

        <nav aria-label={ariaLabel} className="mt-3 grid gap-2">
          {items.map((item) => (
            <SidebarLink key={item.href} item={item} />
          ))}
        </nav>

        <div className="mt-auto grid gap-3 border-t pt-3">
          {userLabel ? (
            <div className="min-h-12 overflow-hidden rounded-md px-3 py-2">
              <p className="truncate text-sm font-medium opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {userLabel}
              </p>
              {userMeta ? (
                <p className="truncate text-xs text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100">
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
              <span className="truncate opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                Sign out
              </span>
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({ item }: { item: SidebarNavItem }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex h-11 items-center gap-3 overflow-hidden rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors",
        "hover:bg-secondary hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className="truncate opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {item.label}
      </span>
    </Link>
  );
}
