import { FileText, LifeBuoy, Wrench } from "lucide-react";
import {
  createMaintenanceRequest,
  updateMaintenanceStatus
} from "@/app/app/operations/actions";
import {
  AccessDeniedState,
  EmptyState,
  HiddenOperationFields,
  ListPanel,
  ModuleHeader,
  Panel,
  RoomLink,
  SelectField,
  StatusBanner,
  StatusPill,
  TextField,
  formatDate,
  maintenancePriorities,
  maintenanceStatuses,
  roomLabel
} from "@/app/app/operations/_components/operation-ui";
import {
  getOperationState,
  type OperationSearchParams
} from "@/app/app/operations/_lib/data";
import { Button } from "@/components/ui/button";
import { roleLabels } from "@/lib/rbac";

type MaintenancePageProps = {
  searchParams: OperationSearchParams;
};

const returnPath = "/app/operations/maintenance";

export default async function MaintenancePage({
  searchParams
}: MaintenancePageProps) {
  const {
    activeOrganization,
    canCreateMaintenance,
    canManageMaintenance,
    data,
    query,
    role
  } = await getOperationState(searchParams);

  if (!activeOrganization || !data) {
    return (
      <div className="grid gap-8">
        <ModuleHeader
          title="Maintenance"
          description="Create, assign, and close maintenance work by room."
        />
        <StatusBanner error={query.error} updated={query.updated} />
        <EmptyState label="Choose an active organization from the sidebar." />
      </div>
    );
  }

  if (!canCreateMaintenance && !canManageMaintenance) {
    return (
      <div className="grid gap-8">
        <ModuleHeader
          title="Maintenance"
          description="Create, assign, and close maintenance work by room."
        />
        <AccessDeniedState />
      </div>
    );
  }

  if (role === "RESIDENT") {
    return (
      <ResidentMaintenance
        activeAssignment={data.ownAssignment}
        canCreateMaintenance={canCreateMaintenance}
        maintenanceRequests={data.maintenanceRequests}
        organizationId={activeOrganization.id}
        rooms={data.rooms}
        query={query}
      />
    );
  }

  const maintenanceRooms = data.rooms.filter(
    (room) => room.status === "VACANT" || room.status === "OCCUPIED"
  );

  return (
    <div className="grid gap-8">
      <ModuleHeader
        title="Maintenance"
        description="Open room maintenance, assign staff, and restore room status when work is closed."
      />
      <StatusBanner error={query.error} updated={query.updated} />

      <Panel
        icon={<LifeBuoy className="size-5" aria-hidden="true" />}
        title="Create maintenance request"
        description="Opening a ticket moves a Vacant or Occupied room into Maintenance."
      >
        {maintenanceRooms.length ? (
          <form action={createMaintenanceRequest} className="grid gap-3">
            <HiddenOperationFields
              organizationId={activeOrganization.id}
              returnPath={returnPath}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <SelectField label="Room" name="roomId">
                {maintenanceRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {roomLabel(room)}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Stay" name="roomAssignmentId" optional>
                {data.activeAssignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.residentFullName} - {roomLabel(assignment.room)}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_180px]">
              <TextField name="title" label="Title" required />
              <SelectField label="Priority" name="priority" defaultValue="MEDIUM">
                {maintenancePriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </SelectField>
            </div>
            <label className="grid gap-2 text-sm font-medium">
              Description
              <textarea
                name="description"
                required
                className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <Button type="submit" className="justify-self-start">
              <LifeBuoy className="size-4" aria-hidden="true" />
              Create request
            </Button>
          </form>
        ) : (
          <EmptyState label="No rooms can open maintenance right now." />
        )}
      </Panel>

      <MaintenanceRequestList
        canManageMaintenance={canManageMaintenance}
        maintenanceRequests={data.maintenanceRequests}
        organizationId={activeOrganization.id}
        staffUsers={data.staffUsers}
      />
    </div>
  );
}

function ResidentMaintenance({
  activeAssignment,
  canCreateMaintenance,
  maintenanceRequests,
  organizationId,
  query,
  rooms
}: {
  activeAssignment: NonNullable<
    Awaited<ReturnType<typeof getOperationState>>["data"]
  >["ownAssignment"];
  canCreateMaintenance: boolean;
  maintenanceRequests: NonNullable<
    Awaited<ReturnType<typeof getOperationState>>["data"]
  >["maintenanceRequests"];
  organizationId: string;
  query: { error?: string; updated?: string };
  rooms: NonNullable<Awaited<ReturnType<typeof getOperationState>>["data"]>["rooms"];
}) {
  return (
    <div className="grid gap-8">
      <ModuleHeader
        title="Maintenance"
        description="Send maintenance requests for your active room and follow their status."
      />
      <StatusBanner error={query.error} updated={query.updated} />

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel
          icon={<FileText className="size-5" aria-hidden="true" />}
          title="My active stay"
          description="Resident maintenance is limited to your current room assignment."
        >
          {activeAssignment ? (
            <div className="grid gap-2 text-sm">
              <p className="font-semibold">{activeAssignment.residentFullName}</p>
              <p className="text-muted-foreground">
                {activeAssignment.residentCode} -{" "}
                {activeAssignment.residentPhone || "No phone"}
              </p>
              <p className="text-muted-foreground">
                Active stay: {roomLabel(activeAssignment.room)} since{" "}
                {formatDate(activeAssignment.moveInDate)}
              </p>
            </div>
          ) : (
            <EmptyState label="No active stay linked to this room login." />
          )}
        </Panel>

        {canCreateMaintenance ? (
          <Panel
            icon={<LifeBuoy className="size-5" aria-hidden="true" />}
            title="Create maintenance request"
            description="Requests go to the operation team for your room."
          >
            {activeAssignment ? (
              <form action={createMaintenanceRequest} className="grid gap-3">
                <HiddenOperationFields
                  organizationId={organizationId}
                  returnPath={returnPath}
                />
                <SelectField label="Room" name="roomId" optional>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {roomLabel(room)}
                    </option>
                  ))}
                </SelectField>
                <div className="grid gap-3 md:grid-cols-[1fr_160px]">
                  <TextField name="title" label="Title" required />
                  <SelectField
                    label="Priority"
                    name="priority"
                    defaultValue="MEDIUM"
                  >
                    {maintenancePriorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <label className="grid gap-2 text-sm font-medium">
                  Description
                  <textarea
                    name="description"
                    required
                    className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <Button type="submit" className="justify-self-start">
                  <LifeBuoy className="size-4" aria-hidden="true" />
                  Send request
                </Button>
              </form>
            ) : (
              <EmptyState label="No active room can create maintenance." />
            )}
          </Panel>
        ) : null}
      </section>

      <MaintenanceRequestList
        canManageMaintenance={false}
        maintenanceRequests={maintenanceRequests}
        organizationId={organizationId}
        staffUsers={[]}
      />
    </div>
  );
}

function MaintenanceRequestList({
  canManageMaintenance,
  maintenanceRequests,
  organizationId,
  staffUsers
}: {
  canManageMaintenance: boolean;
  maintenanceRequests: NonNullable<
    Awaited<ReturnType<typeof getOperationState>>["data"]
  >["maintenanceRequests"];
  organizationId: string;
  staffUsers: NonNullable<
    Awaited<ReturnType<typeof getOperationState>>["data"]
  >["staffUsers"];
}) {
  return (
    <ListPanel
      icon={<Wrench className="size-5" aria-hidden="true" />}
      title="Maintenance requests"
    >
      {maintenanceRequests.length ? (
        maintenanceRequests.map((request) => (
          <article
            key={request.id}
            className="grid gap-3 border-b py-4 last:border-b-0"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{request.title}</h3>
              <StatusPill label={request.status} />
              <StatusPill label={request.priority} muted />
            </div>
            <p className="text-sm text-muted-foreground">
              {request.room?.roomNumber || "No room"} -{" "}
              {request.roomAssignment?.residentFullName || "No stay"} -{" "}
              {request.assignedTo?.email || "Unassigned"}
            </p>
            {canManageMaintenance ? (
              <form
                action={updateMaintenanceStatus}
                className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]"
              >
                <HiddenOperationFields
                  organizationId={organizationId}
                  returnPath={returnPath}
                />
                <input type="hidden" name="requestId" value={request.id} />
                <SelectField
                  label="Status"
                  name="status"
                  defaultValue={request.status}
                >
                  {maintenanceStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Assignee"
                  name="assignedToUserId"
                  defaultValue={request.assignedToUserId ?? ""}
                  optional
                >
                  {staffUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.email} - {roleLabels[user.role]}
                    </option>
                  ))}
                </SelectField>
                <Button type="submit" variant="outline" className="self-end">
                  Save
                </Button>
                {request.roomId ? (
                  <div className="self-end">
                    <RoomLink organizationId={organizationId} roomId={request.roomId}>
                      View room
                    </RoomLink>
                  </div>
                ) : null}
              </form>
            ) : request.roomId ? (
              <RoomLink organizationId={organizationId} roomId={request.roomId}>
                View room
              </RoomLink>
            ) : null}
          </article>
        ))
      ) : (
        <EmptyState label="No maintenance requests yet." />
      )}
    </ListPanel>
  );
}
