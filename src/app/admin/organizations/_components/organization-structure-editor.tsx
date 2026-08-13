"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ArrowLeft,
  Building,
  DoorOpen,
  Home,
  Layers3,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  TriangleAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  assetStatusOptions,
  assetTypeOptions,
  organizationStatusOptions,
  type AssetDraft,
  type BuildingDraft,
  type FloorDraft,
  type OrganizationStructureDraft,
  type RoomDraft
} from "../_lib/structure-draft";
import {
  deleteOrganization,
  saveOrganizationStructureDraft
} from "../actions";

type OrganizationStructureEditorProps = {
  initialDraft: OrganizationStructureDraft;
  status?: {
    created?: string;
    updated?: string;
    error?: string;
  };
};

const inputClassName =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";
const selectClassName =
  "h-9 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

export function OrganizationStructureEditor({
  initialDraft,
  status
}: OrganizationStructureEditorProps) {
  const [draft, setDraft] = useState(() => cloneDraft(initialDraft));
  const idCounterRef = useRef(0);
  const serializedInitialDraft = useMemo(
    () => JSON.stringify(initialDraft),
    [initialDraft]
  );
  const serializedDraft = useMemo(() => JSON.stringify(draft), [draft]);
  const isDirty = serializedDraft !== serializedInitialDraft;
  const stats = getStats(draft);
  const isCreate = draft.mode === "create";

  function updateDraft(mutator: (next: OrganizationStructureDraft) => void) {
    setDraft((current) => {
      const next = cloneDraft(current);
      mutator(next);
      return next;
    });
  }

  function nextClientId(prefix: string) {
    idCounterRef.current += 1;
    return `${prefix}-new-${idCounterRef.current}`;
  }

  function addAsset() {
    updateDraft((next) => {
      const order = next.assets.length + 1;
      next.assets.push({
        clientId: nextClientId("asset"),
        name: `Asset ${order}`,
        abbreviation: nextAssetAbbreviation(next.assets, order),
        type: "DORMITORY",
        status: "ACTIVE",
        buildings: []
      });
    });
  }

  function addBuilding(assetClientId: string) {
    updateDraft((next) => {
      const asset = findAsset(next, assetClientId);
      if (!asset) {
        return;
      }

      asset.buildings.push({
        clientId: nextClientId("building"),
        name: `Building ${asset.buildings.length + 1}`,
        floors: []
      });
    });
  }

  function addFloor(assetClientId: string, buildingClientId: string) {
    updateDraft((next) => {
      const building = findBuilding(next, assetClientId, buildingClientId);
      if (!building) {
        return;
      }

      const number = nextFloorNumber(building.floors);
      building.floors.push({
        clientId: nextClientId("floor"),
        name: `Floor ${number}`,
        number,
        rooms: []
      });
    });
  }

  function addRoom(
    assetClientId: string,
    buildingClientId: string,
    floorClientId: string
  ) {
    updateDraft((next) => {
      const floor = findFloor(
        next,
        assetClientId,
        buildingClientId,
        floorClientId
      );
      if (!floor) {
        return;
      }

      floor.rooms.push({
        clientId: nextClientId("room"),
        roomNumber: nextRoomNumber(floor),
        rentAmount: "0.00",
        depositAmount: "0.00",
        status: "VACANT"
      });
    });
  }

  function removeAsset(assetClientId: string) {
    updateDraft((next) => {
      const asset = findAsset(next, assetClientId);
      if (asset) {
        collectDeletedAsset(next, asset);
      }
      next.assets = next.assets.filter((item) => item.clientId !== assetClientId);
    });
  }

  function removeBuilding(assetClientId: string, buildingClientId: string) {
    updateDraft((next) => {
      const asset = findAsset(next, assetClientId);
      const building = asset?.buildings.find(
        (item) => item.clientId === buildingClientId
      );
      if (building) {
        collectDeletedBuilding(next, building);
      }
      if (asset) {
        asset.buildings = asset.buildings.filter(
          (item) => item.clientId !== buildingClientId
        );
      }
    });
  }

  function removeFloor(
    assetClientId: string,
    buildingClientId: string,
    floorClientId: string
  ) {
    updateDraft((next) => {
      const building = findBuilding(next, assetClientId, buildingClientId);
      const floor = building?.floors.find((item) => item.clientId === floorClientId);
      if (floor) {
        collectDeletedFloor(next, floor);
      }
      if (building) {
        building.floors = building.floors.filter(
          (item) => item.clientId !== floorClientId
        );
      }
    });
  }

  function removeRoom(
    assetClientId: string,
    buildingClientId: string,
    floorClientId: string,
    roomClientId: string
  ) {
    updateDraft((next) => {
      const floor = findFloor(
        next,
        assetClientId,
        buildingClientId,
        floorClientId
      );
      const room = floor?.rooms.find((item) => item.clientId === roomClientId);
      if (room?.persistedId) {
        pushUnique(next.deleted.roomIds, room.persistedId);
      }
      if (floor) {
        floor.rooms = floor.rooms.filter((item) => item.clientId !== roomClientId);
      }
    });
  }

  return (
    <>
      <form action={saveOrganizationStructureDraft} className="grid gap-6 pb-24">
        <input type="hidden" name="draft" value={serializedDraft} />

      <section className="grid gap-4">
        <Button asChild variant="ghost" size="sm" className="w-fit px-0">
          <Link href="/admin/organizations">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Organizations
          </Link>
        </Button>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">
              {isCreate ? "New organization" : draft.organization.status}
            </p>
            <h1 className="mt-2 truncate text-3xl font-semibold tracking-normal">
              {draft.organization.name || "Untitled organization"}
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Manage organization settings and property structure in one draft.
              Save once when the structure is ready.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
            <Metric label="Assets" value={stats.assets} />
            <Metric label="Buildings" value={stats.buildings} />
            <Metric label="Floors" value={stats.floors} />
            <Metric label="Rooms" value={stats.rooms} />
          </div>
        </div>
      </section>

      <StatusBanner params={status} />

      <section className="rounded-lg border bg-card p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-base font-semibold">Organization settings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Name and availability status for this organization.
            </p>
          </div>
          {!isCreate && draft.organizationId ? (
            <DeleteOrganizationButton
              organizationName={draft.organization.name}
            />
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
          <label className="grid gap-2 text-sm font-medium">
            Name
            <Input
              value={draft.organization.name}
              onChange={(event) =>
                updateDraft((next) => {
                  next.organization.name = event.target.value;
                })
              }
              placeholder="Sathorn Residence"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Status
            <select
              value={draft.organization.status}
              onChange={(event) =>
                updateDraft((next) => {
                  next.organization.status = event.target
                    .value as OrganizationStructureDraft["organization"]["status"];
                })
              }
              className={selectClassName}
            >
              {organizationStatusOptions.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold">Property structure</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Assets hold buildings, buildings hold floors, and floors hold rooms.
            </p>
          </div>
          {draft.assets.length ? (
            <Button type="button" variant="outline" onClick={addAsset}>
              <Plus className="size-4" aria-hidden="true" />
              Create asset
            </Button>
          ) : null}
        </div>

        {draft.assets.length ? (
          draft.assets.map((asset) => (
            <AssetEditor
              key={asset.clientId}
              asset={asset}
              onAddBuilding={() => addBuilding(asset.clientId)}
              onAddFloor={(buildingClientId) =>
                addFloor(asset.clientId, buildingClientId)
              }
              onAddRoom={(buildingClientId, floorClientId) =>
                addRoom(asset.clientId, buildingClientId, floorClientId)
              }
              onRemove={() => removeAsset(asset.clientId)}
              onRemoveBuilding={(buildingClientId) =>
                removeBuilding(asset.clientId, buildingClientId)
              }
              onRemoveFloor={(buildingClientId, floorClientId) =>
                removeFloor(asset.clientId, buildingClientId, floorClientId)
              }
              onRemoveRoom={(buildingClientId, floorClientId, roomClientId) =>
                removeRoom(
                  asset.clientId,
                  buildingClientId,
                  floorClientId,
                  roomClientId
                )
              }
              updateDraft={updateDraft}
            />
          ))
        ) : (
          <section className="rounded-lg border border-dashed bg-card p-8 text-center">
            <Home className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No assets yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Create an asset to start building the property structure.
            </p>
            <Button type="button" className="mt-4" onClick={addAsset}>
              <Plus className="size-4" aria-hidden="true" />
              Create asset
            </Button>
          </section>
        )}
      </section>

      {isDirty ? (
        <FloatingActions
          onCancel={() => setDraft(cloneDraft(initialDraft))}
          isCreate={isCreate}
        />
      ) : null}
      </form>
      {!isCreate && draft.organizationId ? (
        <form id="delete-organization-form" action={deleteOrganization} hidden>
          <input type="hidden" name="organizationId" value={draft.organizationId} />
        </form>
      ) : null}
    </>
  );
}

function AssetEditor({
  asset,
  onAddBuilding,
  onAddFloor,
  onAddRoom,
  onRemove,
  onRemoveBuilding,
  onRemoveFloor,
  onRemoveRoom,
  updateDraft
}: {
  asset: AssetDraft;
  onAddBuilding: () => void;
  onAddFloor: (buildingClientId: string) => void;
  onAddRoom: (buildingClientId: string, floorClientId: string) => void;
  onRemove: () => void;
  onRemoveBuilding: (buildingClientId: string) => void;
  onRemoveFloor: (buildingClientId: string, floorClientId: string) => void;
  onRemoveRoom: (
    buildingClientId: string,
    floorClientId: string,
    roomClientId: string
  ) => void;
  updateDraft: (mutator: (next: OrganizationStructureDraft) => void) => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="border-b p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Home className="size-5 text-primary" aria-hidden="true" />
              <h3 className="truncate text-xl font-semibold">{asset.name}</h3>
              <StatusPill status={asset.status} />
              <MutedPill>{asset.abbreviation || "No code"}</MutedPill>
              <MutedPill>{asset.type}</MutedPill>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {asset.buildings.length} buildings
            </p>
          </div>
          <Button type="button" variant="destructive" size="sm" onClick={onRemove}>
            <Trash2 className="size-4" aria-hidden="true" />
            Delete asset
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_140px_160px_160px]">
          <label className="grid gap-2 text-sm font-medium">
            Asset name
            <Input
              value={asset.name}
              onChange={(event) =>
                updateDraft((next) => {
                  const target = findAsset(next, asset.clientId);
                  if (target) {
                    target.name = event.target.value;
                  }
                })
              }
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Abbreviation
            <Input
              value={asset.abbreviation}
              onChange={(event) =>
                updateDraft((next) => {
                  const target = findAsset(next, asset.clientId);
                  if (target) {
                    target.abbreviation = event.target.value.toUpperCase();
                  }
                })
              }
              pattern="[A-Za-z0-9]+"
              minLength={2}
              maxLength={12}
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Type
            <select
              value={asset.type}
              onChange={(event) =>
                updateDraft((next) => {
                  const target = findAsset(next, asset.clientId);
                  if (target) {
                    target.type = event.target.value as AssetDraft["type"];
                  }
                })
              }
              className={selectClassName}
            >
              {assetTypeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Status
            <select
              value={asset.status}
              onChange={(event) =>
                updateDraft((next) => {
                  const target = findAsset(next, asset.clientId);
                  if (target) {
                    target.status = event.target.value as AssetDraft["status"];
                  }
                })
              }
              className={selectClassName}
            >
              {assetStatusOptions.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-4 p-5">
        {asset.buildings.map((building) => (
          <BuildingEditor
            key={building.clientId}
            asset={asset}
            building={building}
            onAddFloor={() => onAddFloor(building.clientId)}
            onAddRoom={(floorClientId) => onAddRoom(building.clientId, floorClientId)}
            onRemove={() => onRemoveBuilding(building.clientId)}
            onRemoveFloor={(floorClientId) =>
              onRemoveFloor(building.clientId, floorClientId)
            }
            onRemoveRoom={(floorClientId, roomClientId) =>
              onRemoveRoom(building.clientId, floorClientId, roomClientId)
            }
            updateDraft={updateDraft}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed"
          onClick={onAddBuilding}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add building
        </Button>
      </div>
    </section>
  );
}

function BuildingEditor({
  asset,
  building,
  onAddFloor,
  onAddRoom,
  onRemove,
  onRemoveFloor,
  onRemoveRoom,
  updateDraft
}: {
  asset: AssetDraft;
  building: BuildingDraft;
  onAddFloor: () => void;
  onAddRoom: (floorClientId: string) => void;
  onRemove: () => void;
  onRemoveFloor: (floorClientId: string) => void;
  onRemoveRoom: (floorClientId: string, roomClientId: string) => void;
  updateDraft: (mutator: (next: OrganizationStructureDraft) => void) => void;
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium">
          <span className="flex items-center gap-2">
            <Building className="size-4 text-primary" aria-hidden="true" />
            Building
            <span className="text-muted-foreground">
              {building.floors.length} floors
            </span>
          </span>
          <Input
            value={building.name}
            onChange={(event) =>
              updateDraft((next) => {
                const target = findBuilding(
                  next,
                  asset.clientId,
                  building.clientId
                );
                if (target) {
                  target.name = event.target.value;
                }
              })
            }
            className="max-w-sm"
            required
          />
        </label>
        <Button type="button" variant="destructive" size="sm" onClick={onRemove}>
          <Trash2 className="size-4" aria-hidden="true" />
          Delete building
        </Button>
      </div>

      <div className="mt-4 grid gap-3">
        {building.floors.map((floor) => (
          <FloorEditor
            key={floor.clientId}
            asset={asset}
            building={building}
            floor={floor}
            onAddRoom={() => onAddRoom(floor.clientId)}
            onRemove={() => onRemoveFloor(floor.clientId)}
            onRemoveRoom={(roomClientId) => onRemoveRoom(floor.clientId, roomClientId)}
            updateDraft={updateDraft}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          className="w-full border-dashed"
          onClick={onAddFloor}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add floor
        </Button>
      </div>
    </div>
  );
}

function FloorEditor({
  asset,
  building,
  floor,
  onAddRoom,
  onRemove,
  onRemoveRoom,
  updateDraft
}: {
  asset: AssetDraft;
  building: BuildingDraft;
  floor: FloorDraft;
  onAddRoom: () => void;
  onRemove: () => void;
  onRemoveRoom: (roomClientId: string) => void;
  updateDraft: (mutator: (next: OrganizationStructureDraft) => void) => void;
}) {
  return (
    <div className="rounded-md bg-secondary p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 md:grid-cols-[1fr_120px]">
          <label className="grid gap-2 text-sm font-medium">
            <span className="flex items-center gap-2">
              <Layers3 className="size-4 text-muted-foreground" aria-hidden="true" />
              Floor name
            </span>
            <Input
              value={floor.name}
              onChange={(event) =>
                updateDraft((next) => {
                  const target = findFloor(
                    next,
                    asset.clientId,
                    building.clientId,
                    floor.clientId
                  );
                  if (target) {
                    target.name = event.target.value;
                  }
                })
              }
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Number
            <Input
              type="number"
              value={floor.number}
              onChange={(event) =>
                updateDraft((next) => {
                  const target = findFloor(
                    next,
                    asset.clientId,
                    building.clientId,
                    floor.clientId
                  );
                  if (target) {
                    target.number = Number(event.target.value);
                  }
                })
              }
              required
            />
          </label>
        </div>
        <Button type="button" variant="destructive" size="sm" onClick={onRemove}>
          <Trash2 className="size-4" aria-hidden="true" />
          Delete floor
        </Button>
      </div>

      {floor.rooms.length ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {floor.rooms.map((room) => (
            <RoomEditor
              key={room.clientId}
              asset={asset}
              building={building}
              floor={floor}
              room={room}
              onRemove={() => onRemoveRoom(room.clientId)}
              updateDraft={updateDraft}
            />
          ))}
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        className="mt-3 w-full border-dashed bg-card"
        onClick={onAddRoom}
      >
        <Plus className="size-4" aria-hidden="true" />
        Add room
      </Button>
    </div>
  );
}

function RoomEditor({
  asset,
  building,
  floor,
  room,
  onRemove,
  updateDraft
}: {
  asset: AssetDraft;
  building: BuildingDraft;
  floor: FloorDraft;
  room: RoomDraft;
  onRemove: () => void;
  updateDraft: (mutator: (next: OrganizationStructureDraft) => void) => void;
}) {
  return (
    <div className="grid gap-3 rounded-md border bg-card p-3">
      <div className="flex items-center gap-2">
        <DoorOpen className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <Input
          value={room.roomNumber}
          onChange={(event) =>
            updateDraft((next) => {
              const target = findRoom(
                next,
                asset.clientId,
                building.clientId,
                floor.clientId,
                room.clientId
              );
              if (target) {
                target.roomNumber = event.target.value;
              }
            })
          }
          aria-label="Room number"
          className="h-9 min-w-0"
          required
        />
        <StatusPill status={room.status} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Rent
          <input
            value={room.rentAmount}
            onChange={(event) =>
              updateDraft((next) => {
                const target = findRoom(
                  next,
                  asset.clientId,
                  building.clientId,
                  floor.clientId,
                  room.clientId
                );
                if (target) {
                  target.rentAmount = event.target.value;
                }
              })
            }
            inputMode="decimal"
            className={inputClassName}
            required
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Deposit
          <input
            value={room.depositAmount}
            onChange={(event) =>
              updateDraft((next) => {
                const target = findRoom(
                  next,
                  asset.clientId,
                  building.clientId,
                  floor.clientId,
                  room.clientId
                );
                if (target) {
                  target.depositAmount = event.target.value;
                }
              })
            }
            inputMode="decimal"
            className={inputClassName}
            required
          />
        </label>
      </div>
      <Button type="button" variant="destructive" size="sm" onClick={onRemove}>
        <Trash2 className="size-4" aria-hidden="true" />
        Delete room
      </Button>
    </div>
  );
}

function FloatingActions({
  isCreate,
  onCancel
}: {
  isCreate: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 px-4 lg:left-[4.75rem]">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-lg border bg-card p-3 shadow-xl md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
            <Save className="size-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold">Unsaved changes</p>
            <p className="text-sm text-muted-foreground">
              {isCreate
                ? "Save this organization when the draft is ready."
                : "Save once to apply every structure change."}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <Button type="button" variant="outline" onClick={onCancel}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Cancel
          </Button>
          <SubmitButton />
        </div>
      </div>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      <Save className="size-4" aria-hidden="true" />
      {pending ? "Saving..." : "Save changes"}
    </Button>
  );
}

function DeleteOrganizationButton({
  organizationName
}: {
  organizationName: string;
}) {
  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      onClick={() => {
        if (
          window.confirm(
            `Delete ${organizationName || "this organization"} and all related structure?`
          )
        ) {
          const deleteForm = document.getElementById("delete-organization-form");
          if (deleteForm instanceof HTMLFormElement) {
            deleteForm.requestSubmit();
          }
        }
      }}
    >
      <TriangleAlert className="size-4" aria-hidden="true" />
      Delete organization
    </Button>
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
  params?: { created?: string; updated?: string; error?: string };
}) {
  if (!params) {
    return null;
  }

  if (params.error) {
    return (
      <p
        className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        role="alert"
      >
        The submitted organization structure could not be saved.
      </p>
    );
  }

  if (params.created || params.updated) {
    return (
      <p
        className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"
        role="status"
      >
        Organization structure changes saved.
      </p>
    );
  }

  return null;
}

function StatusPill({ status }: { status: string }) {
  const className =
    status === "ACTIVE" || status === "VACANT"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-muted bg-secondary text-muted-foreground";

  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",
        className
      )}
    >
      {status}
    </span>
  );
}

function MutedPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function getStats(draft: OrganizationStructureDraft) {
  return draft.assets.reduce(
    (stats, asset) => {
      stats.assets += 1;
      stats.buildings += asset.buildings.length;
      for (const building of asset.buildings) {
        stats.floors += building.floors.length;
        for (const floor of building.floors) {
          stats.rooms += floor.rooms.length;
        }
      }
      return stats;
    },
    { assets: 0, buildings: 0, floors: 0, rooms: 0 }
  );
}

function cloneDraft(draft: OrganizationStructureDraft): OrganizationStructureDraft {
  return JSON.parse(JSON.stringify(draft)) as OrganizationStructureDraft;
}

function findAsset(draft: OrganizationStructureDraft, assetClientId: string) {
  return draft.assets.find((asset) => asset.clientId === assetClientId);
}

function findBuilding(
  draft: OrganizationStructureDraft,
  assetClientId: string,
  buildingClientId: string
) {
  return findAsset(draft, assetClientId)?.buildings.find(
    (building) => building.clientId === buildingClientId
  );
}

function findFloor(
  draft: OrganizationStructureDraft,
  assetClientId: string,
  buildingClientId: string,
  floorClientId: string
) {
  return findBuilding(draft, assetClientId, buildingClientId)?.floors.find(
    (floor) => floor.clientId === floorClientId
  );
}

function findRoom(
  draft: OrganizationStructureDraft,
  assetClientId: string,
  buildingClientId: string,
  floorClientId: string,
  roomClientId: string
) {
  return findFloor(
    draft,
    assetClientId,
    buildingClientId,
    floorClientId
  )?.rooms.find((room) => room.clientId === roomClientId);
}

function collectDeletedAsset(
  draft: OrganizationStructureDraft,
  asset: AssetDraft
) {
  if (asset.persistedId) {
    pushUnique(draft.deleted.assetIds, asset.persistedId);
  }
  for (const building of asset.buildings) {
    collectDeletedBuilding(draft, building);
  }
}

function collectDeletedBuilding(
  draft: OrganizationStructureDraft,
  building: BuildingDraft
) {
  if (building.persistedId) {
    pushUnique(draft.deleted.buildingIds, building.persistedId);
  }
  for (const floor of building.floors) {
    collectDeletedFloor(draft, floor);
  }
}

function collectDeletedFloor(
  draft: OrganizationStructureDraft,
  floor: FloorDraft
) {
  if (floor.persistedId) {
    pushUnique(draft.deleted.floorIds, floor.persistedId);
  }
  for (const room of floor.rooms) {
    if (room.persistedId) {
      pushUnique(draft.deleted.roomIds, room.persistedId);
    }
  }
}

function pushUnique(values: string[], value: string) {
  if (!values.includes(value)) {
    values.push(value);
  }
}

function nextAssetAbbreviation(assets: AssetDraft[], start: number) {
  const abbreviations = new Set(
    assets.map((asset) => asset.abbreviation.toUpperCase())
  );
  let order = start;

  while (abbreviations.has(`A${order}`)) {
    order += 1;
  }

  return `A${order}`;
}

function nextFloorNumber(floors: FloorDraft[]) {
  const numbers = new Set(floors.map((floor) => floor.number));
  let number = floors.length + 1;

  while (numbers.has(number)) {
    number += 1;
  }

  return number;
}

function nextRoomNumber(floor: FloorDraft) {
  const roomNumbers = new Set(floor.rooms.map((room) => room.roomNumber));
  let roomNumber = `${Math.max(1, floor.number) * 100 + 1}`;

  while (roomNumbers.has(roomNumber)) {
    roomNumber = `${Number(roomNumber) + 1}`;
  }

  return roomNumber;
}
