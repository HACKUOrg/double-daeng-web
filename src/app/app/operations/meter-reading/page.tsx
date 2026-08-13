import { Gauge } from "lucide-react";
import { recordMeterReading } from "@/app/app/operations/actions";
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
  formatMoney,
  roomLabel
} from "@/app/app/operations/_components/operation-ui";
import {
  canUseModule,
  getOperationState,
  type OperationSearchParams
} from "@/app/app/operations/_lib/data";
import { Button } from "@/components/ui/button";

type MeterReadingPageProps = {
  searchParams: OperationSearchParams;
};

const returnPath = "/app/operations/meter-reading";

export default async function MeterReadingPage({
  searchParams
}: MeterReadingPageProps) {
  const { activeOrganization, data, query, role } =
    await getOperationState(searchParams);

  if (!activeOrganization || !data) {
    return (
      <div className="grid gap-8">
        <ModuleHeader
          title="Meter reading"
          description="Record water and electric meter readings by room."
        />
        <StatusBanner error={query.error} updated={query.updated} />
        <EmptyState label="Choose an active organization from the sidebar." />
      </div>
    );
  }

  if (!canUseModule(role, ["room_status.update", "rooms.manage"])) {
    return (
      <div className="grid gap-8">
        <ModuleHeader
          title="Meter reading"
          description="Record water and electric meter readings by room."
        />
        <AccessDeniedState />
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <ModuleHeader
        title="Meter reading"
        description="Capture utility readings for every room in the selected organization."
      />
      <StatusBanner error={query.error} updated={query.updated} />

      <Panel
        icon={<Gauge className="size-5" aria-hidden="true" />}
        title="Record reading"
        description="Use decimal values for both water and electric readings."
      >
        {data.rooms.length ? (
          <form action={recordMeterReading} className="grid gap-3">
            <HiddenOperationFields
              organizationId={activeOrganization.id}
              returnPath={returnPath}
            />
            <SelectField label="Room" name="roomId">
              {data.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {roomLabel(room)}
                </option>
              ))}
            </SelectField>
            <div className="grid gap-3 md:grid-cols-3">
              <SelectField label="Meter" name="meterType" defaultValue="WATER">
                <option value="WATER">Water</option>
                <option value="ELECTRIC">Electric</option>
              </SelectField>
              <TextField
                name="readingDate"
                label="Reading date"
                type="date"
                required
              />
              <TextField
                name="readingValue"
                label="Reading"
                inputMode="decimal"
                required
              />
            </div>
            <TextField name="note" label="Note" />
            <Button type="submit" className="justify-self-start">
              <Gauge className="size-4" aria-hidden="true" />
              Record reading
            </Button>
          </form>
        ) : (
          <EmptyState label="No rooms are available for meter readings." />
        )}
      </Panel>

      <ListPanel
        icon={<Gauge className="size-5" aria-hidden="true" />}
        title="Recent meter readings"
      >
        {data.meterReadings.length ? (
          data.meterReadings.map((reading) => (
            <article
              key={reading.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b py-4 last:border-b-0"
            >
              <div>
                <p className="font-semibold">{reading.room.roomNumber}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(reading.readingDate)} - {reading.note || "No note"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  label={`${reading.meterType === "WATER" ? "Water" : "Electric"} ${formatMoney(reading.readingValue)}`}
                />
                <RoomLink
                  organizationId={activeOrganization.id}
                  roomId={reading.roomId}
                >
                  View room
                </RoomLink>
              </div>
            </article>
          ))
        ) : (
          <EmptyState label="No meter readings yet." />
        )}
      </ListPanel>
    </div>
  );
}
