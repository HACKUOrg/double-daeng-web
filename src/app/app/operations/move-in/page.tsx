import { DoorOpen } from "lucide-react";
import { assignRoom } from "@/app/app/operations/actions";
import {
  AccessDeniedState,
  EmptyState,
  HiddenOperationFields,
  ModuleHeader,
  Panel,
  RoomLink,
  SelectField,
  StatusBanner,
  StatusPill,
  TextField,
  roomLabel
} from "@/app/app/operations/_components/operation-ui";
import {
  canUseModule,
  getOperationState,
  type OperationSearchParams
} from "@/app/app/operations/_lib/data";
import { Button } from "@/components/ui/button";

type MoveInPageProps = {
  searchParams: OperationSearchParams;
};

const returnPath = "/app/operations/move-in";

export default async function MoveInPage({ searchParams }: MoveInPageProps) {
  const { activeOrganization, data, query, role } =
    await getOperationState(searchParams);

  if (!activeOrganization || !data) {
    return (
      <div className="grid gap-8">
        <ModuleHeader
          title="Move-in"
          description="Create a resident stay and room login inside the active organization."
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
          title="Move-in"
          description="Create a resident stay and room login inside the active organization."
        />
        <AccessDeniedState />
      </div>
    );
  }

  const vacantRooms = data.rooms.filter((room) => room.status === "VACANT");

  return (
    <div className="grid gap-8">
      <ModuleHeader
        title="Move-in"
        description="Assign a vacant room, capture resident identity, and create the room login from the asset abbreviation and room number."
      />
      <StatusBanner error={query.error} updated={query.updated} />

      <Panel
        icon={<DoorOpen className="size-5" aria-hidden="true" />}
        title="New resident stay"
        description="Room rent and deposit are read from the room record when the contract is created."
      >
        {vacantRooms.length ? (
          <form action={assignRoom} className="grid gap-3">
            <HiddenOperationFields
              organizationId={activeOrganization.id}
              returnPath={returnPath}
            />
            <SelectField label="Room" name="roomId">
              {vacantRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {roomLabel(room)}
                </option>
              ))}
            </SelectField>
            <div className="grid gap-3 md:grid-cols-2">
              <TextField name="residentFullName" label="Resident full name" required />
              <TextField name="residentPhone" label="Phone" />
              <TextField name="emergencyContact" label="Emergency contact" />
              <TextField name="moveInDate" label="Move-in date" type="date" required />
              <TextField
                name="idDocumentNumber"
                label="ID / passport number"
                minLength={6}
                maxLength={64}
                required
              />
              <TextField name="contractNumber" label="Contract number" />
            </div>
            <Button type="submit" className="justify-self-start">
              <DoorOpen className="size-4" aria-hidden="true" />
              Assign room
            </Button>
          </form>
        ) : (
          <EmptyState label="No vacant rooms are ready for move-in." />
        )}
      </Panel>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {vacantRooms.map((room) => (
          <article key={room.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{room.roomNumber}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {roomLabel(room)}
                </p>
              </div>
              <StatusPill label={room.status} />
            </div>
            <div className="mt-4">
              <RoomLink organizationId={activeOrganization.id} roomId={room.id}>
                View room
              </RoomLink>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
