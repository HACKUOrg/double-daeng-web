export function UserStatusPill({ status }: { status: string }) {
  const className =
    status === "ACTIVE"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-muted bg-secondary text-muted-foreground";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
      {status}
    </span>
  );
}

export function UserStatusBanner({
  params
}: {
  params: {
    created?: string;
    updated?: string;
    error?: string;
  };
}) {
  if (params.error) {
    return (
      <p
        className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        role="alert"
      >
        The submitted user data could not be saved.
      </p>
    );
  }

  if (params.created || params.updated) {
    return (
      <p
        className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"
        role="status"
      >
        User changes saved.
      </p>
    );
  }

  return null;
}
