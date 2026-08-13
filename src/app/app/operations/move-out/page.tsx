import { LogOut, Users } from "lucide-react";
import { moveOutRoom } from "@/app/app/operations/actions";
import {
  AccessDeniedState,
  EmptyState,
  HiddenOperationFields,
  ListPanel,
  ModuleHeader,
  RoomLink,
  StatusBanner,
  StatusPill,
  TextField,
  formatDate,
  roomLabel
} from "@/app/app/operations/_components/operation-ui";
import {
  canUseModule,
  getOperationState,
  type OperationSearchParams
} from "@/app/app/operations/_lib/data";
import { Button } from "@/components/ui/button";

type MoveOutPageProps = {
  searchParams: OperationSearchParams;
};

const returnPath = "/app/operations/move-out";

export default async function MoveOutPage({ searchParams }: MoveOutPageProps) {
  const { activeOrganization, data, query, role } =
    await getOperationState(searchParams);

  if (!activeOrganization || !data) {
    return (
      <div className="grid gap-8">
        <ModuleHeader
          title="Move-out"
          description="Close active stays and return occupied rooms to vacant."
        />
        <StatusBanner error={query.error} updated={query.updated} />
        <EmptyState label="Choose an active organization from the sidebar." />
      </div>
    );
  }

  if (!canUseModule(role, ["customers.manage", "rooms.manage"])) {
    return (
      <div className="grid gap-8">
        <ModuleHeader
          title="Move-out"
          description="Close active stays and return occupied rooms to vacant."
        />
        <AccessDeniedState />
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <ModuleHeader
        title="Move-out"
        description="Move a resident out, suspend their room login, and make the room vacant again."
      />
      <StatusBanner error={query.error} updated={query.updated} />

      <ListPanel
        icon={<Users className="size-5" aria-hidden="true" />}
        title="Residents and active stays"
      >
        {data.activeAssignments.length ? (
          data.activeAssignments.map((assignment) => (
            <article
              key={assignment.id}
              className="grid gap-3 border-b py-4 last:border-b-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{assignment.residentFullName}</h3>
                <StatusPill label={assignment.residentCode} />
                <StatusPill label={assignment.status} muted />
              </div>
              <p className="text-sm text-muted-foreground">
                {assignment.residentPhone || "No phone"} -{" "}
                {assignment.loginUser?.username || "No active room login"}
              </p>
              <p className="text-sm text-muted-foreground">
                Active stay: {roomLabel(assignment.room)} since{" "}
                {formatDate(assignment.moveInDate)}
                {assignment.contract
                  ? ` - Contract ${assignment.contract.contractNumber}`
                  : ""}
              </p>
              <form
                action={moveOutRoom}
                className="grid gap-2 md:grid-cols-[180px_auto_auto]"
              >
                <HiddenOperationFields
                  organizationId={activeOrganization.id}
                  returnPath={returnPath}
                />
                <input type="hidden" name="assignmentId" value={assignment.id} />
                <TextField
                  name="moveOutDate"
                  label="Move-out date"
                  type="date"
                  required
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="self-end justify-self-start"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  Move out
                </Button>
                <div className="self-end">
                  <RoomLink
                    organizationId={activeOrganization.id}
                    roomId={assignment.roomId}
                  >
                    View room
                  </RoomLink>
                </div>
              </form>
            </article>
          ))
        ) : (
          <EmptyState label="No active stays yet." />
        )}
      </ListPanel>
    </div>
  );
}
