import { CalendarX } from "lucide-react";
import { markRoomUnavailable } from "@/app/app/operations/actions";
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
  roomLabel
} from "@/app/app/operations/_components/operation-ui";
import {
  canUseModule,
  getOperationState,
  type OperationSearchParams
} from "@/app/app/operations/_lib/data";
import { Button } from "@/components/ui/button";

type MarkUnavailablePageProps = {
  searchParams: OperationSearchParams;
};

const returnPath = "/app/operations/mark-unavailable";

export default async function MarkUnavailablePage({
  searchParams
}: MarkUnavailablePageProps) {
  const { activeOrganization, data, query, role } =
    await getOperationState(searchParams);

  if (!activeOrganization || !data) {
    return (
      <div className="grid gap-8">
        <ModuleHeader
          title="Mark unavailable"
          description="Take vacant rooms out of service."
        />
        <StatusBanner error={query.error} updated={query.updated} />
        <EmptyState label="Choose an active organization from the sidebar." />
      </div>
    );
  }

  if (!canUseModule(role, ["rooms.manage"])) {
    return (
      <div className="grid gap-8">
        <ModuleHeader
          title="Mark unavailable"
          description="Take vacant rooms out of service."
        />
        <AccessDeniedState />
      </div>
    );
  }

  const vacantRooms = data.rooms.filter((room) => room.status === "VACANT");
  const unavailableRooms = data.rooms.filter(
    (room) => room.status === "UNAVAILABLE"
  );

  return (
    <div className="grid gap-8">
      <ModuleHeader
        title="Mark unavailable"
        description="Move a vacant room to Unavailable when it should not be offered or reserved."
      />
      <StatusBanner error={query.error} updated={query.updated} />

      <Panel
        icon={<CalendarX className="size-5" aria-hidden="true" />}
        title="Take room out of service"
        description="Only vacant rooms can be marked unavailable from this module."
      >
        {vacantRooms.length ? (
          <form action={markRoomUnavailable} className="grid gap-3">
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
            <Button type="submit" variant="outline" className="justify-self-start">
              <CalendarX className="size-4" aria-hidden="true" />
              Mark unavailable
            </Button>
          </form>
        ) : (
          <EmptyState label="No vacant rooms can be marked unavailable." />
        )}
      </Panel>

      <ListPanel
        icon={<CalendarX className="size-5" aria-hidden="true" />}
        title="Unavailable rooms"
      >
        {unavailableRooms.length ? (
          unavailableRooms.map((room) => (
            <article
              key={room.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b py-4 last:border-b-0"
            >
              <div>
                <h3 className="font-semibold">{room.roomNumber}</h3>
                <p className="text-sm text-muted-foreground">{roomLabel(room)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill label={room.status} />
                <RoomLink organizationId={activeOrganization.id} roomId={room.id}>
                  View room
                </RoomLink>
              </div>
            </article>
          ))
        ) : (
          <EmptyState label="No rooms are currently unavailable." />
        )}
      </ListPanel>
    </div>
  );
}
