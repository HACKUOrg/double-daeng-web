import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building,
  DoorOpen,
  Home,
  Layers3,
  Plus,
  RefreshCw,
  Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPrisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";
import {
  createAsset,
  createBuilding,
  createFloor,
  createRoom,
  deleteAsset,
  deleteBuilding,
  deleteFloor,
  deleteRoom,
  updateAsset,
  updateBuilding,
  updateFloor,
  updateRoom
} from "../actions";

type OrganizationDetailPageProps = {
  params: Promise<{
    organizationId: string;
  }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
    error?: string;
  }>;
};

const assetTypes = ["DORMITORY", "CONDO", "APARTMENT", "MIXED"] as const;
const assetStatuses = ["ACTIVE", "SUSPENDED"] as const;
const roomStatuses = [
  "VACANT",
  "OCCUPIED",
  "MAINTENANCE",
  "UNAVAILABLE"
] as const;

export default async function OrganizationDetailPage({
  params,
  searchParams
}: OrganizationDetailPageProps) {
  await requirePermission("organizations.manage");
  const [{ organizationId }, query] = await Promise.all([params, searchParams]);
  const prisma = getPrisma();
  const organization = await prisma.organization.findUnique({
    where: {
      id: organizationId
    },
    include: {
      assets: {
        include: {
          buildings: {
            include: {
              floors: {
                include: {
                  rooms: {
                    orderBy: {
                      roomNumber: "asc"
                    }
                  }
                },
                orderBy: {
                  number: "asc"
                }
              }
            },
            orderBy: {
              name: "asc"
            }
          }
        },
        orderBy: {
          name: "asc"
        }
      }
    }
  });

  if (!organization) {
    notFound();
  }

  const buildingCount = organization.assets.reduce(
    (total, asset) => total + asset.buildings.length,
    0
  );
  const floorCount = organization.assets.reduce(
    (total, asset) =>
      total +
      asset.buildings.reduce((sum, building) => sum + building.floors.length, 0),
    0
  );
  const roomCount = organization.assets.reduce(
    (total, asset) =>
      total +
      asset.buildings.reduce(
        (buildingTotal, building) =>
          buildingTotal +
          building.floors.reduce((sum, floor) => sum + floor.rooms.length, 0),
        0
      ),
    0
  );

  return (
    <div className="grid gap-6">
      <section className="grid gap-4">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0">
          <Link href="/admin/organizations">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Organizations
          </Link>
        </Button>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">
              {organization.status}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              {organization.name}
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Manage the property structure for this organization. Assets hold
              buildings, buildings hold floors, and floors hold rooms.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <Metric label="Assets" value={organization.assets.length} />
            <Metric label="Buildings" value={buildingCount} />
            <Metric label="Floors" value={floorCount} />
            <Metric label="Rooms" value={roomCount} />
          </div>
        </div>
      </section>

      <StatusBanner params={query} />

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Home className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-base font-semibold">Create asset</h2>
        </div>
        <form
          action={createAsset}
          className="grid gap-3 md:grid-cols-[1fr_180px_auto]"
        >
          <input type="hidden" name="organizationId" value={organization.id} />
          <label className="grid gap-2 text-sm font-medium">
            Asset name
            <Input name="name" placeholder="Main Tower" required />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Type
            <select
              name="type"
              defaultValue="DORMITORY"
              className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {assetTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="self-end">
            <Plus className="size-4" aria-hidden="true" />
            Create
          </Button>
        </form>
      </section>

      <div className="grid gap-5">
        {organization.assets.length ? (
          organization.assets.map((asset) => (
            <section key={asset.id} className="rounded-lg border bg-card">
              <div className="border-b p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Home className="size-5 text-primary" aria-hidden="true" />
                      <h2 className="text-xl font-semibold">{asset.name}</h2>
                      <StatusPill status={asset.status} />
                      <span className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {asset.type}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {asset.buildings.length} buildings
                    </p>
                  </div>
                </div>

                <form
                  action={updateAsset}
                  className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_160px_auto]"
                >
                  <input
                    type="hidden"
                    name="organizationId"
                    value={organization.id}
                  />
                  <input type="hidden" name="assetId" value={asset.id} />
                  <label className="grid gap-2 text-sm font-medium">
                    Name
                    <Input name="name" defaultValue={asset.name} required />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Type
                    <select
                      name="type"
                      defaultValue={asset.type}
                      className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {assetTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    Status
                    <select
                      name="status"
                      defaultValue={asset.status}
                      className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {assetStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button type="submit" variant="outline" className="self-end">
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Save
                  </Button>
                </form>
                <form action={deleteAsset} className="mt-3">
                  <input
                    type="hidden"
                    name="organizationId"
                    value={organization.id}
                  />
                  <input type="hidden" name="assetId" value={asset.id} />
                  <Button type="submit" variant="destructive" size="sm">
                    <Trash2 className="size-4" aria-hidden="true" />
                    Delete asset
                  </Button>
                </form>
              </div>

              <div className="grid gap-4 p-5">
                <form
                  action={createBuilding}
                  className="grid gap-3 rounded-md border bg-background p-4 md:grid-cols-[1fr_auto]"
                >
                  <input
                    type="hidden"
                    name="organizationId"
                    value={organization.id}
                  />
                  <input type="hidden" name="assetId" value={asset.id} />
                  <label className="grid gap-2 text-sm font-medium">
                    New building
                    <Input name="name" placeholder="Building A" required />
                  </label>
                  <Button type="submit" className="self-end">
                    <Plus className="size-4" aria-hidden="true" />
                    Add
                  </Button>
                </form>

                {asset.buildings.length ? (
                  asset.buildings.map((building) => (
                    <div key={building.id} className="rounded-md border p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div className="flex items-center gap-2">
                          <Building
                            className="size-4 text-primary"
                            aria-hidden="true"
                          />
                          <h3 className="font-semibold">{building.name}</h3>
                          <span className="text-sm text-muted-foreground">
                            {building.floors.length} floors
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <form
                            action={updateBuilding}
                            className="flex flex-wrap items-end gap-2"
                          >
                            <input
                              type="hidden"
                              name="organizationId"
                              value={organization.id}
                            />
                            <input
                              type="hidden"
                              name="buildingId"
                              value={building.id}
                            />
                            <Input
                              name="name"
                              defaultValue={building.name}
                              className="w-48"
                              required
                            />
                            <Button type="submit" variant="outline" size="sm">
                              <RefreshCw className="size-4" aria-hidden="true" />
                            </Button>
                          </form>
                          <form action={deleteBuilding}>
                            <input
                              type="hidden"
                              name="organizationId"
                              value={organization.id}
                            />
                            <input
                              type="hidden"
                              name="buildingId"
                              value={building.id}
                            />
                            <Button type="submit" variant="destructive" size="sm">
                              <Trash2 className="size-4" aria-hidden="true" />
                            </Button>
                          </form>
                        </div>
                      </div>

                      <form
                        action={createFloor}
                        className="mt-4 grid gap-3 md:grid-cols-[1fr_140px_auto]"
                      >
                        <input
                          type="hidden"
                          name="organizationId"
                          value={organization.id}
                        />
                        <input type="hidden" name="buildingId" value={building.id} />
                        <label className="grid gap-2 text-sm font-medium">
                          New floor
                          <Input name="name" placeholder="Floor 1" required />
                        </label>
                        <label className="grid gap-2 text-sm font-medium">
                          Number
                          <Input name="number" type="number" defaultValue={1} required />
                        </label>
                        <Button type="submit" variant="outline" className="self-end">
                          <Plus className="size-4" aria-hidden="true" />
                          Add
                        </Button>
                      </form>

                      <div className="mt-4 grid gap-3">
                        {building.floors.length ? (
                          building.floors.map((floor) => (
                            <div key={floor.id} className="rounded-md bg-secondary p-4">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Layers3
                                    className="size-4 text-muted-foreground"
                                    aria-hidden="true"
                                  />
                                  <h4 className="font-medium">{floor.name}</h4>
                                  <span className="text-sm text-muted-foreground">
                                    No. {floor.number} - {floor.rooms.length} rooms
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <form
                                    action={updateFloor}
                                    className="flex flex-wrap items-end gap-2"
                                  >
                                    <input
                                      type="hidden"
                                      name="organizationId"
                                      value={organization.id}
                                    />
                                    <input
                                      type="hidden"
                                      name="floorId"
                                      value={floor.id}
                                    />
                                    <Input
                                      name="name"
                                      defaultValue={floor.name}
                                      className="w-40"
                                      required
                                    />
                                    <Input
                                      name="number"
                                      type="number"
                                      defaultValue={floor.number}
                                      className="w-24"
                                      required
                                    />
                                    <Button type="submit" variant="outline" size="sm">
                                      <RefreshCw
                                        className="size-4"
                                        aria-hidden="true"
                                      />
                                    </Button>
                                  </form>
                                  <form action={deleteFloor}>
                                    <input
                                      type="hidden"
                                      name="organizationId"
                                      value={organization.id}
                                    />
                                    <input
                                      type="hidden"
                                      name="floorId"
                                      value={floor.id}
                                    />
                                    <Button
                                      type="submit"
                                      variant="destructive"
                                      size="sm"
                                    >
                                      <Trash2 className="size-4" aria-hidden="true" />
                                    </Button>
                                  </form>
                                </div>
                              </div>

                              <form
                                action={createRoom}
                                className="mt-3 grid gap-3 md:grid-cols-[1fr_180px_auto]"
                              >
                                <input
                                  type="hidden"
                                  name="organizationId"
                                  value={organization.id}
                                />
                                <input type="hidden" name="floorId" value={floor.id} />
                                <label className="grid gap-2 text-sm font-medium">
                                  New room
                                  <Input
                                    name="roomNumber"
                                    placeholder="101"
                                    required
                                  />
                                </label>
                                <label className="grid gap-2 text-sm font-medium">
                                  Status
                                  <select
                                    name="status"
                                    defaultValue="VACANT"
                                    className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    {roomStatuses.map((status) => (
                                      <option key={status} value={status}>
                                        {status}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <Button
                                  type="submit"
                                  variant="outline"
                                  className="self-end"
                                >
                                  <Plus className="size-4" aria-hidden="true" />
                                  Add
                                </Button>
                              </form>

                              {floor.rooms.length ? (
                                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                  {floor.rooms.map((room) => (
                                    <form
                                      key={room.id}
                                      action={updateRoom}
                                      className="grid gap-3 rounded-md border bg-card p-3"
                                    >
                                      <input
                                        type="hidden"
                                        name="organizationId"
                                        value={organization.id}
                                      />
                                      <input
                                        type="hidden"
                                        name="roomId"
                                        value={room.id}
                                      />
                                      <div className="flex items-center gap-2">
                                        <DoorOpen
                                          className="size-4 text-primary"
                                          aria-hidden="true"
                                        />
                                        <Input
                                          name="roomNumber"
                                          defaultValue={room.roomNumber}
                                          className="h-9"
                                          required
                                        />
                                      </div>
                                      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                                        <select
                                          name="status"
                                          defaultValue={room.status}
                                          className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                          {roomStatuses.map((status) => (
                                            <option key={status} value={status}>
                                              {status}
                                            </option>
                                          ))}
                                        </select>
                                        <Button type="submit" variant="outline" size="sm">
                                          <RefreshCw
                                            className="size-4"
                                            aria-hidden="true"
                                          />
                                        </Button>
                                        <Button
                                          form={`delete-room-${room.id}`}
                                          type="submit"
                                          variant="destructive"
                                          size="sm"
                                        >
                                          <Trash2
                                            className="size-4"
                                            aria-hidden="true"
                                          />
                                        </Button>
                                      </div>
                                    </form>
                                  ))}
                                  {floor.rooms.map((room) => (
                                    <form
                                      key={`delete-${room.id}`}
                                      id={`delete-room-${room.id}`}
                                      action={deleteRoom}
                                    >
                                      <input
                                        type="hidden"
                                        name="organizationId"
                                        value={organization.id}
                                      />
                                      <input
                                        type="hidden"
                                        name="roomId"
                                        value={room.id}
                                      />
                                    </form>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <EmptyLine text="No floors yet." />
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyLine text="No buildings yet." />
                )}
              </div>
            </section>
          ))
        ) : (
          <section className="rounded-lg border bg-card p-8 text-center">
            <Home className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No assets yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an asset above before adding buildings, floors, and rooms.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBanner({
  params
}: {
  params: { created?: string; updated?: string; error?: string };
}) {
  if (params.error) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        The submitted property structure could not be saved.
      </p>
    );
  }

  if (params.created || params.updated) {
    return (
      <p className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
        Property structure changes saved.
      </p>
    );
  }

  return null;
}

function StatusPill({ status }: { status: string }) {
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

function EmptyLine({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
      {text}
    </p>
  );
}
