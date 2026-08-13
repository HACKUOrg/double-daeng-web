export const organizationStatusOptions = ["ACTIVE", "SUSPENDED"] as const;
export const assetTypeOptions = ["DORMITORY", "CONDO", "APARTMENT", "MIXED"] as const;
export const assetStatusOptions = ["ACTIVE", "SUSPENDED"] as const;

export type OrganizationStructureDraft = {
  mode: "create" | "update";
  organizationId?: string;
  organization: {
    name: string;
    status: (typeof organizationStatusOptions)[number];
  };
  assets: AssetDraft[];
  deleted: {
    assetIds: string[];
    buildingIds: string[];
    floorIds: string[];
    roomIds: string[];
  };
};

export type AssetDraft = {
  clientId: string;
  persistedId?: string;
  name: string;
  abbreviation: string;
  type: (typeof assetTypeOptions)[number];
  status: (typeof assetStatusOptions)[number];
  buildings: BuildingDraft[];
};

export type BuildingDraft = {
  clientId: string;
  persistedId?: string;
  name: string;
  floors: FloorDraft[];
};

export type FloorDraft = {
  clientId: string;
  persistedId?: string;
  name: string;
  number: number;
  rooms: RoomDraft[];
};

export type RoomDraft = {
  clientId: string;
  persistedId?: string;
  roomNumber: string;
  rentAmount: string;
  depositAmount: string;
  status: string;
};

export type OrganizationStructureSource = {
  id: string;
  name: string;
  status: string;
  assets: {
    id: string;
    name: string;
    abbreviation: string;
    type: string;
    status: string;
    buildings: {
      id: string;
      name: string;
      floors: {
        id: string;
        name: string;
        number: number;
        rooms: {
          id: string;
          roomNumber: string;
          rentAmount: { toString(): string };
          depositAmount: { toString(): string };
          status: string;
        }[];
      }[];
    }[];
  }[];
};

export function createEmptyOrganizationDraft(): OrganizationStructureDraft {
  return {
    mode: "create",
    organization: {
      name: "",
      status: "ACTIVE"
    },
    assets: [],
    deleted: {
      assetIds: [],
      buildingIds: [],
      floorIds: [],
      roomIds: []
    }
  };
}

export function organizationToStructureDraft(
  organization: OrganizationStructureSource
): OrganizationStructureDraft {
  return {
    mode: "update",
    organizationId: organization.id,
    organization: {
      name: organization.name,
      status: organization.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE"
    },
    assets: organization.assets.map((asset) => ({
      clientId: asset.id,
      persistedId: asset.id,
      name: asset.name,
      abbreviation: asset.abbreviation,
      type: assetTypeOptions.includes(asset.type as (typeof assetTypeOptions)[number])
        ? (asset.type as (typeof assetTypeOptions)[number])
        : "DORMITORY",
      status: asset.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
      buildings: asset.buildings.map((building) => ({
        clientId: building.id,
        persistedId: building.id,
        name: building.name,
        floors: building.floors.map((floor) => ({
          clientId: floor.id,
          persistedId: floor.id,
          name: floor.name,
          number: floor.number,
          rooms: floor.rooms.map((room) => ({
            clientId: room.id,
            persistedId: room.id,
            roomNumber: room.roomNumber,
            rentAmount: formatMoney(room.rentAmount),
            depositAmount: formatMoney(room.depositAmount),
            status: room.status
          }))
        }))
      }))
    })),
    deleted: {
      assetIds: [],
      buildingIds: [],
      floorIds: [],
      roomIds: []
    }
  };
}

export function formatMoney(value: { toString(): string }) {
  return Number(value.toString()).toFixed(2);
}
