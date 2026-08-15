"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Building,
  ChevronDown,
  Copy,
  DoorOpen,
  Home,
  Layers3,
  MoreHorizontal,
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

  function duplicateAsset(assetClientId: string) {
    updateDraft((next) => {
      const source = findAsset(next, assetClientId);
      if (!source) {
        return;
      }

      next.assets.push({
        clientId: nextClientId("asset"),
        name: nextCopyName(
          source.name,
          next.assets.map((asset) => asset.name)
        ),
        abbreviation: nextAssetAbbreviation(next.assets, next.assets.length + 1),
        type: source.type,
        status: source.status,
        buildings: source.buildings.map((building) =>
          duplicateBuildingDraft(building, nextClientId)
        )
      });
    });
  }

  function duplicateBuilding(
    assetClientId: string,
    buildingClientId: string
  ) {
    updateDraft((next) => {
      const asset = findAsset(next, assetClientId);
      const source = asset?.buildings.find(
        (building) => building.clientId === buildingClientId
      );
      if (!asset || !source) {
        return;
      }

      asset.buildings.push({
        ...duplicateBuildingDraft(source, nextClientId),
        name: nextCopyName(
          source.name,
          asset.buildings.map((building) => building.name)
        )
      });
    });
  }

  function duplicateFloor(
    assetClientId: string,
    buildingClientId: string,
    floorClientId: string
  ) {
    updateDraft((next) => {
      const building = findBuilding(next, assetClientId, buildingClientId);
      const source = building?.floors.find(
        (floor) => floor.clientId === floorClientId
      );
      if (!building || !source) {
        return;
      }

      building.floors.push({
        ...duplicateFloorDraft(source, nextClientId),
        name: nextCopyName(
          source.name,
          building.floors.map((floor) => floor.name)
        ),
        number: nextFloorNumber(building.floors)
      });
    });
  }

  function duplicateRoom(
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
      const source = floor?.rooms.find((room) => room.clientId === roomClientId);
      if (!floor || !source) {
        return;
      }

      floor.rooms.push({
        ...duplicateRoomDraft(source, nextClientId),
        roomNumber: nextRoomNumber(floor)
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
              onDuplicate={() => duplicateAsset(asset.clientId)}
              onAddBuilding={() => addBuilding(asset.clientId)}
              onAddFloor={(buildingClientId) =>
                addFloor(asset.clientId, buildingClientId)
              }
              onAddRoom={(buildingClientId, floorClientId) =>
                addRoom(asset.clientId, buildingClientId, floorClientId)
              }
              onRemove={() => removeAsset(asset.clientId)}
              onDuplicateBuilding={(buildingClientId) =>
                duplicateBuilding(asset.clientId, buildingClientId)
              }
              onDuplicateFloor={(buildingClientId, floorClientId) =>
                duplicateFloor(asset.clientId, buildingClientId, floorClientId)
              }
              onDuplicateRoom={(buildingClientId, floorClientId, roomClientId) =>
                duplicateRoom(
                  asset.clientId,
                  buildingClientId,
                  floorClientId,
                  roomClientId
                )
              }
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
  onDuplicate,
  onAddBuilding,
  onAddFloor,
  onAddRoom,
  onRemove,
  onDuplicateBuilding,
  onDuplicateFloor,
  onDuplicateRoom,
  onRemoveBuilding,
  onRemoveFloor,
  onRemoveRoom,
  updateDraft
}: {
  asset: AssetDraft;
  onDuplicate: () => void;
  onAddBuilding: () => void;
  onAddFloor: (buildingClientId: string) => void;
  onAddRoom: (buildingClientId: string, floorClientId: string) => void;
  onRemove: () => void;
  onDuplicateBuilding: (buildingClientId: string) => void;
  onDuplicateFloor: (buildingClientId: string, floorClientId: string) => void;
  onDuplicateRoom: (
    buildingClientId: string,
    floorClientId: string,
    roomClientId: string
  ) => void;
  onRemoveBuilding: (buildingClientId: string) => void;
  onRemoveFloor: (buildingClientId: string, floorClientId: string) => void;
  onRemoveRoom: (
    buildingClientId: string,
    floorClientId: string,
    roomClientId: string
  ) => void;
  updateDraft: (mutator: (next: OrganizationStructureDraft) => void) => void;
}) {
  const [isOpen, setIsOpen] = useState(() => !asset.persistedId);
  const floorCount = asset.buildings.reduce(
    (count, building) => count + building.floors.length,
    0
  );
  const roomCount = asset.buildings.reduce(
    (count, building) =>
      count + building.floors.reduce((floorCount, floor) => floorCount + floor.rooms.length, 0),
    0
  );

  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="group flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setIsOpen((current) => !current)}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? "Collapse" : "Expand"} asset ${asset.name}`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-200",
                  !isOpen && "-rotate-90"
                )}
                aria-hidden="true"
              />
            </span>
            <Home className="size-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0">
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate text-lg font-semibold">{asset.name}</span>
                <StatusPill status={asset.status} />
                <MutedPill>{asset.abbreviation || "No code"}</MutedPill>
                <MutedPill>{asset.type}</MutedPill>
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                {asset.buildings.length} buildings / {floorCount} floors / {roomCount} rooms
              </span>
            </span>
          </button>
          <DeleteMenu
            entityLabel={`asset ${asset.name}`}
            confirmationMessage={getAssetRemovalConfirmation(asset)}
            onRemove={onRemove}
            onDuplicate={onDuplicate}
          />
        </div>

      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid gap-3 p-4">
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
            <div className="grid gap-3 md:grid-cols-[140px_160px_160px]">
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

          <div className="grid gap-4 bg-background/60 p-5">
            {asset.buildings.map((building) => (
              <BuildingEditor
                key={building.clientId}
                asset={asset}
                onDuplicate={() => onDuplicateBuilding(building.clientId)}
                building={building}
                onAddFloor={() => onAddFloor(building.clientId)}
                onAddRoom={(floorClientId) => onAddRoom(building.clientId, floorClientId)}
                onRemove={() => onRemoveBuilding(building.clientId)}
                onDuplicateFloor={(floorClientId) =>
                  onDuplicateFloor(building.clientId, floorClientId)
                }
                onDuplicateRoom={(floorClientId, roomClientId) =>
                  onDuplicateRoom(building.clientId, floorClientId, roomClientId)
                }
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
        </div>
      </div>
    </section>
  );
}

function BuildingEditor({
  asset,
  building,
  onDuplicate,
  onAddFloor,
  onAddRoom,
  onRemove,
  onDuplicateFloor,
  onDuplicateRoom,
  onRemoveFloor,
  onRemoveRoom,
  updateDraft
}: {
  asset: AssetDraft;
  building: BuildingDraft;
  onDuplicate: () => void;
  onAddFloor: () => void;
  onAddRoom: (floorClientId: string) => void;
  onRemove: () => void;
  onDuplicateFloor: (floorClientId: string) => void;
  onDuplicateRoom: (floorClientId: string, roomClientId: string) => void;
  onRemoveFloor: (floorClientId: string) => void;
  onRemoveRoom: (floorClientId: string, roomClientId: string) => void;
  updateDraft: (mutator: (next: OrganizationStructureDraft) => void) => void;
}) {
  const [isOpen, setIsOpen] = useState(() => !building.persistedId);

  return (
    <div className="rounded-md border bg-background p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
          aria-label={`${isOpen ? "Collapse" : "Expand"} building ${building.name}`}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-200",
                !isOpen && "-rotate-90"
              )}
              aria-hidden="true"
            />
          </span>
          <Building className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{building.name}</span>
            <span className="block text-sm text-muted-foreground">
              {building.floors.length} floors
            </span>
          </span>
        </button>
        <DeleteMenu
          entityLabel={`building ${building.name}`}
          confirmationMessage={getBuildingRemovalConfirmation(building)}
          onRemove={onRemove}
          onDuplicate={onDuplicate}
        />
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="min-h-0 overflow-hidden">
          <label className="mt-4 grid gap-2 text-sm font-medium">
            Building name
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
          <div className="mt-4 grid gap-3">
            {building.floors.map((floor) => (
              <FloorEditor
                key={floor.clientId}
                asset={asset}
                building={building}
                floor={floor}
                onDuplicate={() => onDuplicateFloor(floor.clientId)}
                onAddRoom={() => onAddRoom(floor.clientId)}
                onRemove={() => onRemoveFloor(floor.clientId)}
                onDuplicateRoom={(roomClientId) =>
                  onDuplicateRoom(floor.clientId, roomClientId)
                }
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
      </div>
    </div>
  );
}

function FloorEditor({
  asset,
  building,
  floor,
  onDuplicate,
  onAddRoom,
  onRemove,
  onDuplicateRoom,
  onRemoveRoom,
  updateDraft
}: {
  asset: AssetDraft;
  building: BuildingDraft;
  floor: FloorDraft;
  onDuplicate: () => void;
  onAddRoom: () => void;
  onRemove: () => void;
  onDuplicateRoom: (roomClientId: string) => void;
  onRemoveRoom: (roomClientId: string) => void;
  updateDraft: (mutator: (next: OrganizationStructureDraft) => void) => void;
}) {
  const [isOpen, setIsOpen] = useState(() => !floor.persistedId);

  return (
    <div className="rounded-md bg-secondary/70 p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="group flex min-w-0 flex-1 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
          aria-label={`${isOpen ? "Collapse" : "Expand"} floor ${floor.name}`}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background/70 text-muted-foreground transition-colors group-hover:bg-background">
            <ChevronDown
              className={cn(
                "size-4 transition-transform duration-200",
                !isOpen && "-rotate-90"
              )}
              aria-hidden="true"
            />
          </span>
          <Layers3 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{floor.name}</span>
            <span className="block text-sm text-muted-foreground">
              Floor {floor.number} / {floor.rooms.length} rooms
            </span>
          </span>
        </button>
        <DeleteMenu
          entityLabel={`floor ${floor.name}`}
          confirmationMessage={getFloorRemovalConfirmation(floor)}
          onRemove={onRemove}
          onDuplicate={onDuplicate}
        />
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_120px]">
            <label className="grid gap-2 text-sm font-medium">
              Floor name
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

          {floor.rooms.length ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {floor.rooms.map((room) => (
                <RoomEditor
                  key={room.clientId}
                  asset={asset}
                  building={building}
                  floor={floor}
                  onDuplicate={() => onDuplicateRoom(room.clientId)}
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
      </div>
    </div>
  );
}

function RoomEditor({
  asset,
  building,
  floor,
  room,
  onDuplicate,
  onRemove,
  updateDraft
}: {
  asset: AssetDraft;
  building: BuildingDraft;
  floor: FloorDraft;
  room: RoomDraft;
  onDuplicate: () => void;
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
          className="h-9 min-w-0 flex-1"
          required
        />
        <StatusPill status={room.status} />
        <DeleteMenu
          entityLabel={`room ${room.roomNumber}`}
          onRemove={onRemove}
          onDuplicate={onDuplicate}
        />
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
    </div>
  );
}

function DeleteMenu({
  entityLabel,
  confirmationMessage,
  onDuplicate,
  onRemove
}: {
  entityLabel: string;
  confirmationMessage?: string;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const menuItemRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        (menuRef.current?.contains(event.target) ||
          menuPortalRef.current?.contains(event.target))
      ) {
        return;
      }

      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function updateMenuPosition() {
      const trigger = triggerRef.current;
      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const menuWidth = 192;
      const menuHeight = 104;
      const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
      const left = Math.min(Math.max(8, rect.right - menuWidth), maxLeft);
      const top =
        rect.bottom + 8 + menuHeight <= window.innerHeight
          ? rect.bottom + 8
          : Math.max(8, rect.top - menuHeight - 8);

      setMenuPosition({ top, left });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      menuItemRef.current?.focus();
    }
  }, [isOpen]);

  function handleRemove() {
    setIsOpen(false);

    if (confirmationMessage) {
      setIsConfirmOpen(true);
      return;
    }

    onRemove();
  }

  function handleDuplicate() {
    setIsOpen(false);
    onDuplicate();
  }

  function closeConfirmation() {
    setIsConfirmOpen(false);
    triggerRef.current?.focus();
  }

  function confirmRemove() {
    setIsConfirmOpen(false);
    onRemove();
  }

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex size-11 items-center justify-center rounded-md p-0 text-sm font-medium transition-colors hover:bg-secondary hover:text-secondary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={`More actions for ${entityLabel}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="More actions"
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>
      {isOpen && menuPosition && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuPortalRef}
              className="fixed z-100 w-48 rounded-md border bg-popover p-1 shadow-lg"
              style={{ top: menuPosition.top, left: menuPosition.left }}
              role="menu"
              aria-label={`Actions for ${entityLabel}`}
            >
              <button
                ref={menuItemRef}
                type="button"
                role="menuitem"
                className="flex min-h-11 w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium outline-none transition-colors hover:bg-secondary focus-visible:bg-secondary"
                onClick={handleDuplicate}
              >
                <Copy className="size-4" aria-hidden="true" />
                Duplicate
              </button>
              <div className="my-1 h-px bg-border" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="flex min-h-11 w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm font-medium text-destructive outline-none transition-colors hover:bg-destructive/10 focus-visible:bg-destructive/10"
                onClick={handleRemove}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                Remove from draft
              </button>
            </div>,
            document.body
          )
        : null}
      {confirmationMessage ? (
        <ConfirmationDialog
          open={isConfirmOpen}
          message={confirmationMessage}
          onConfirm={confirmRemove}
          onClose={closeConfirmation}
        />
      ) : null}
    </div>
  );
}

function ConfirmationDialog({
  open,
  message,
  title = "Remove from draft?",
  confirmLabel = "Remove from draft",
  onConfirm,
  onClose
}: {
  open: boolean;
  message: string;
  title?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => {
        dialog
          .querySelector<HTMLButtonElement>("[data-dialog-cancel]")
          ?.focus();
      });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, [onClose]);

  function handleConfirm() {
    dialogRef.current?.close();
    onConfirm();
  }

  return (
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
      <div className="grid gap-5 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-destructive/10 p-2 text-destructive">
            <TriangleAlert className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            <p id={descriptionId} className="mt-2 text-sm leading-6 text-muted-foreground">
              {message}
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
          <Button type="button" variant="destructive" onClick={handleConfirm}>
            <Trash2 className="size-4" aria-hidden="true" />
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

function getAssetRemovalConfirmation(asset: AssetDraft) {
  const floorCount = asset.buildings.reduce(
    (count, building) => count + building.floors.length,
    0
  );
  const roomCount = asset.buildings.reduce(
    (count, building) =>
      count + building.floors.reduce((floorTotal, floor) => floorTotal + floor.rooms.length, 0),
    0
  );

  if (!asset.buildings.length) {
    return undefined;
  }

  return `Remove asset ${asset.name} from this draft? This will also remove ${formatCount(
    asset.buildings.length,
    "building"
  )}, ${formatCount(floorCount, "floor")}, and ${formatCount(
    roomCount,
    "room"
  )}. You can restore it with Cancel.`;
}

function getBuildingRemovalConfirmation(building: BuildingDraft) {
  const roomCount = building.floors.reduce(
    (count, floor) => count + floor.rooms.length,
    0
  );

  if (!building.floors.length) {
    return undefined;
  }

  return `Remove building ${building.name} from this draft? This will also remove ${formatCount(
    building.floors.length,
    "floor"
  )} and ${formatCount(roomCount, "room")}. You can restore it with Cancel.`;
}

function getFloorRemovalConfirmation(floor: FloorDraft) {
  if (!floor.rooms.length) {
    return undefined;
  }

  return `Remove floor ${floor.name} from this draft? This will also remove ${formatCount(
    floor.rooms.length,
    "room"
  )}. You can restore it with Cancel.`;
}

function formatCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function FloatingActions({
  isCreate,
  onCancel
}: {
  isCreate: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 px-4 lg:left-19">
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
  const [isOpen, setIsOpen] = useState(false);
  const displayName = organizationName || "this organization";

  function confirmDelete() {
    const deleteForm = document.getElementById("delete-organization-form");
    if (deleteForm instanceof HTMLFormElement) {
      deleteForm.requestSubmit();
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={() => setIsOpen(true)}
      >
        <TriangleAlert className="size-4" aria-hidden="true" />
        Delete organization
      </Button>
      <ConfirmationDialog
        open={isOpen}
        title="Delete organization?"
        message={`Delete ${displayName} and all related structure? This action cannot be undone.`}
        confirmLabel="Delete organization"
        onConfirm={confirmDelete}
        onClose={() => setIsOpen(false)}
      />
    </>
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

function cloneDraft(draft: OrganizationStructureDraft): OrganizationStructureDraft {
  return JSON.parse(JSON.stringify(draft)) as OrganizationStructureDraft;
}

function duplicateBuildingDraft(
  building: BuildingDraft,
  nextClientId: (prefix: string) => string
): BuildingDraft {
  return {
    clientId: nextClientId("building"),
    name: building.name,
    floors: building.floors.map((floor) =>
      duplicateFloorDraft(floor, nextClientId)
    )
  };
}

function duplicateFloorDraft(
  floor: FloorDraft,
  nextClientId: (prefix: string) => string
): FloorDraft {
  return {
    clientId: nextClientId("floor"),
    name: floor.name,
    number: floor.number,
    rooms: floor.rooms.map((room) => duplicateRoomDraft(room, nextClientId))
  };
}

function duplicateRoomDraft(
  room: RoomDraft,
  nextClientId: (prefix: string) => string
): RoomDraft {
  return {
    clientId: nextClientId("room"),
    roomNumber: room.roomNumber,
    rentAmount: room.rentAmount,
    depositAmount: room.depositAmount,
    status: room.status
  };
}

function nextCopyName(name: string, existingNames: string[]) {
  const baseName = name.trim() || "Untitled";
  const preferredName = `${baseName} Copy`;
  let candidate = preferredName;
  let suffix = 2;

  while (existingNames.includes(candidate)) {
    candidate = `${preferredName} ${suffix}`;
    suffix += 1;
  }

  return candidate;
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
