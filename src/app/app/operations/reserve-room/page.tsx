import { CalendarCheck, CalendarX, DoorOpen } from "lucide-react";
import {
  assignRoom,
  cancelReservation,
  reserveRoom
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
  roomLabel
} from "@/app/app/operations/_components/operation-ui";
import {
  canUseModule,
  getOperationState,
  type OperationSearchParams
} from "@/app/app/operations/_lib/data";
import { Button } from "@/components/ui/button";

type ReserveRoomPageProps = {
  searchParams: OperationSearchParams;
};

const returnPath = "/app/operations/reserve-room";

export default async function ReserveRoomPage({
  searchParams
}: ReserveRoomPageProps) {
  const { activeOrganization, data, query, role } =
    await getOperationState(searchParams);

  if (!activeOrganization || !data) {
    return (
      <div className="grid gap-8">
        <ModuleHeader
          title="Reserve room"
          description="Hold vacant rooms and convert reservations into active stays."
        />
        <StatusBanner error={query.error} updated={query.updated} />
        <EmptyState label="Choose an active organization from the sidebar." />
      </div>
    );
  }

  if (!canUseModule(role, ["customers.manage"])) {
    return (
      <div className="grid gap-8">
        <ModuleHeader
          title="Reserve room"
          description="Hold vacant rooms and convert reservations into active stays."
        />
        <AccessDeniedState />
      </div>
    );
  }

  const vacantRooms = data.rooms.filter((room) => room.status === "VACANT");

  return (
    <div className="grid gap-8">
      <ModuleHeader
        title="Reserve room"
        description="Reserve a vacant room, cancel the hold, or move the reserved resident in when the contract is ready."
      />
      <StatusBanner error={query.error} updated={query.updated} />

      <Panel
        icon={<CalendarCheck className="size-5" aria-hidden="true" />}
        title="New reservation"
        description="A reservation changes the room from Vacant to Reserved until it is cancelled or converted."
      >
        {vacantRooms.length ? (
          <form action={reserveRoom} className="grid gap-3">
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
              <TextField name="reserverName" label="Reserver name" required />
              <TextField name="reserverPhone" label="Phone" />
              <TextField
                name="reservedDate"
                label="Reserved date"
                type="date"
                required
              />
              <TextField
                name="expectedMoveInDate"
                label="Expected move-in"
                type="date"
              />
            </div>
            <TextField name="note" label="Note" />
            <Button type="submit" className="justify-self-start">
              <CalendarCheck className="size-4" aria-hidden="true" />
              Reserve room
            </Button>
          </form>
        ) : (
          <EmptyState label="No vacant rooms are available for reservation." />
        )}
      </Panel>

      <ListPanel
        icon={<CalendarCheck className="size-5" aria-hidden="true" />}
        title="Active reservations"
      >
        {data.activeReservations.length ? (
          data.activeReservations.map((reservation) => (
            <article
              key={reservation.id}
              className="grid gap-3 border-b py-4 last:border-b-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{reservation.reserverName}</h3>
                <StatusPill label={reservation.status} />
                <StatusPill label={roomLabel(reservation.room)} muted />
              </div>
              <p className="text-sm text-muted-foreground">
                {reservation.reserverPhone || "No phone"} - reserved{" "}
                {formatDate(reservation.reservedDate)}
                {reservation.expectedMoveInDate
                  ? ` - expected ${formatDate(reservation.expectedMoveInDate)}`
                  : ""}
              </p>
              <form action={assignRoom} className="grid gap-2 md:grid-cols-2">
                <HiddenOperationFields
                  organizationId={activeOrganization.id}
                  returnPath={returnPath}
                />
                <input type="hidden" name="reservationId" value={reservation.id} />
                <input type="hidden" name="roomId" value={reservation.roomId} />
                <TextField
                  name="moveInDate"
                  label="Move-in date"
                  type="date"
                  required
                />
                <TextField
                  name="idDocumentNumber"
                  label="ID / passport number"
                  minLength={6}
                  maxLength={64}
                  required
                />
                <TextField name="emergencyContact" label="Emergency contact" />
                <TextField name="contractNumber" label="Contract number" />
                <Button type="submit" className="justify-self-start">
                  <DoorOpen className="size-4" aria-hidden="true" />
                  Move in
                </Button>
              </form>
              <div className="flex flex-wrap gap-2">
                <form action={cancelReservation}>
                  <HiddenOperationFields
                    organizationId={activeOrganization.id}
                    returnPath={returnPath}
                  />
                  <input
                    type="hidden"
                    name="reservationId"
                    value={reservation.id}
                  />
                  <Button type="submit" variant="outline" size="sm">
                    <CalendarX className="size-4" aria-hidden="true" />
                    Cancel reservation
                  </Button>
                </form>
                <RoomLink
                  organizationId={activeOrganization.id}
                  roomId={reservation.roomId}
                >
                  View room
                </RoomLink>
              </div>
            </article>
          ))
        ) : (
          <EmptyState label="No active reservations." />
        )}
      </ListPanel>
    </div>
  );
}
