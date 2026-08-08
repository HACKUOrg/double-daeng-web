import { requirePermission } from "@/lib/auth/session";
import { permissionLabels, permissionsByRole, roleLabels } from "@/lib/rbac";

export default async function IamPage() {
  await requirePermission("iam.view");

  return (
    <div className="grid gap-6">
      <section>
        <p className="text-sm font-medium text-primary">IAM / RBAC</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
          Fixed permissions
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          MVP permissions are fixed in code. Editable permission matrices can
          wait until the product needs tenant-specific policy customization.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {Object.entries(permissionsByRole).map(([role, permissions]) => (
          <section key={role} className="rounded-lg border bg-card p-5">
            <h2 className="text-lg font-semibold">
              {roleLabels[role as keyof typeof roleLabels]}
            </h2>
            <ul className="mt-4 grid gap-2 text-sm text-muted-foreground">
              {permissions.map((permission) => (
                <li key={permission} className="rounded-md bg-secondary px-3 py-2">
                  <code className="font-mono text-xs text-foreground">
                    {permission}
                  </code>
                  <p className="mt-1">{permissionLabels[permission]}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
