"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type MembershipAction = (formData: FormData) => void | Promise<void>;

export function MembershipRemoveDialog({
  action,
  membershipId,
  organizationName,
  userEmail
}: {
  action: MembershipAction;
  membershipId: string;
  organizationName: string;
  userEmail: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const triggerId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (isOpen && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => {
        dialog
          .querySelector<HTMLButtonElement>("[data-dialog-cancel]")
          ?.focus();
      });
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    function handleClose() {
      setIsOpen(false);
      requestAnimationFrame(() =>
        document.getElementById(triggerId)?.focus()
      );
    }

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [triggerId]);

  return (
    <>
      <Button
        id={triggerId}
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setIsOpen(true)}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        Remove
      </Button>
      <dialog
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
        className="organization-confirm-dialog w-[calc(100%-2rem)] max-w-md rounded-lg border bg-card p-0 text-card-foreground shadow-2xl outline-none"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <form action={action} className="grid gap-5 p-5">
          <input type="hidden" name="membershipId" value={membershipId} />
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-destructive/10 p-2 text-destructive">
              <TriangleAlert className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold">
                Remove membership?
              </h2>
              <p id={descriptionId} className="mt-2 text-sm leading-6 text-muted-foreground">
                Remove {userEmail} from {organizationName}? They will lose access
                to this organization.
              </p>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              data-dialog-cancel
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive">
              <Trash2 className="size-4" aria-hidden="true" />
              Remove membership
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
