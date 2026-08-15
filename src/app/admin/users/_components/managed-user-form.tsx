import { Save, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { roleLabels } from "@/lib/rbac";

type ManagedUserAction = (formData: FormData) => void | Promise<void>;
type ManagedRole = "MANAGER" | "OPERATION";
type ManagedStatus = "ACTIVE" | "SUSPENDED";

const creatableRoles: ManagedRole[] = ["MANAGER", "OPERATION"];
const statuses: ManagedStatus[] = ["ACTIVE", "SUSPENDED"];

export function ManagedUserForm({
  action,
  mode,
  user
}: {
  action: ManagedUserAction;
  mode: "create" | "edit";
  user?: {
    id: string;
    email: string;
    displayName: string;
    role: ManagedRole;
    status: ManagedStatus;
  };
}) {
  const isEdit = mode === "edit";

  return (
    <form
      action={action}
      className="grid min-w-0 gap-4 md:grid-cols-2 md:items-end"
    >
      {isEdit ? (
        <input type="hidden" name="userId" value={user?.id} />
      ) : null}
      <label className="grid min-w-0 gap-2 text-sm font-medium">
        Email
        <Input
          name="email"
          type="email"
          defaultValue={user?.email}
          placeholder="manager@example.com"
          readOnly={isEdit}
          required={!isEdit}
          className={isEdit ? "bg-secondary/50" : undefined}
        />
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-medium">
        Display name
        <Input
          name="displayName"
          defaultValue={user?.displayName}
          placeholder="Building Manager"
          required
        />
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-medium">
        Role
        <select
          name="role"
          defaultValue={user?.role ?? "MANAGER"}
          className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {creatableRoles.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-medium">
        Status
        <select
          name="status"
          defaultValue={user?.status ?? "ACTIVE"}
          disabled={!isEdit}
          className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-medium">
        Password
        <Input
          name="password"
          type="password"
          minLength={8}
          maxLength={128}
          autoComplete={isEdit ? "new-password" : "new-password"}
          placeholder={isEdit ? "Leave blank to keep current" : undefined}
          required={!isEdit}
        />
      </label>
      <Button
        type="submit"
        className="w-full md:w-auto md:min-w-32 md:justify-self-end"
      >
        {isEdit ? (
          <Save className="size-4" aria-hidden="true" />
        ) : (
          <UserPlus className="size-4" aria-hidden="true" />
        )}
        {isEdit ? "Save changes" : "Create user"}
      </Button>
    </form>
  );
}
