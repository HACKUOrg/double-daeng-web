import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import {
  createAdminManagedUser
} from "@/app/users/actions";
import { ManagedUserForm } from "../_components/managed-user-form";
import { UserStatusBanner } from "../_components/user-ui";

type NewUserPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewUserPage({
  searchParams
}: NewUserPageProps) {
  await requirePermission("users.manage.all");
  const query = await searchParams;

  return (
    <div className="grid gap-6">
      <section className="grid gap-4">
        <Button asChild variant="ghost" size="sm" className="w-fit px-2">
          <Link href="/admin/users">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to users
          </Link>
        </Button>
        <div>
          <p className="text-sm font-medium text-primary">Users</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Create user
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Create a Manager or Operation profile. Assign organization access
            later from memberships.
          </p>
        </div>
      </section>

      <UserStatusBanner params={query} />

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-5 flex items-center gap-2">
          <UserPlus className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold">User details</h2>
        </div>
        <ManagedUserForm mode="create" action={createAdminManagedUser} />
      </section>
    </div>
  );
}
