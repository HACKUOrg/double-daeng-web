"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";

const uuidSchema = z.string().uuid();
const nameSchema = z.string().trim().min(1).max(120);
const abbreviationSchema = z
  .string()
  .trim()
  .min(2)
  .max(12)
  .regex(/^[A-Za-z0-9]+$/)
  .transform((value) => value.toUpperCase());
const floorNumberSchema = z.coerce.number().int().min(-10).max(300);
const moneySchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/);

const organizationStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);
const assetTypeSchema = z.enum(["DORMITORY", "CONDO", "APARTMENT", "MIXED"]);
const assetStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);
const roomStatusSchema = z.enum([
  "VACANT",
  "OCCUPIED",
  "MAINTENANCE",
  "UNAVAILABLE"
]);

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requireSA() {
  const actor = await requirePermission("organizations.manage");

  return {
    actorUserId: actor.id,
    prisma: getPrisma()
  };
}

function invalidOrganization(): never {
  redirect("/admin/organizations?error=invalid-organization");
}

function invalidAsset(): never {
  redirect("/admin/organizations?error=invalid-asset");
}

function invalidBuilding(): never {
  redirect("/admin/organizations?error=invalid-building");
}

function invalidFloor(): never {
  redirect("/admin/organizations?error=invalid-floor");
}

function invalidRoom(): never {
  redirect("/admin/organizations?error=invalid-room");
}

function scopeMismatch(): never {
  redirect("/admin/organizations?error=resource-scope");
}

function organizationPath(organizationId: string, search: string) {
  return `/admin/organizations/${organizationId}?${search}`;
}

function organizationSnapshot(organization: {
  id: string;
  name: string;
  status: string;
}) {
  return {
    id: organization.id,
    name: organization.name,
    status: organization.status
  };
}

function assetSnapshot(asset: {
  id: string;
  organizationId: string;
  name: string;
  abbreviation: string;
  type: string;
  status: string;
}) {
  return {
    id: asset.id,
    organizationId: asset.organizationId,
    name: asset.name,
    abbreviation: asset.abbreviation,
    type: asset.type,
    status: asset.status
  };
}

function buildingSnapshot(building: {
  id: string;
  assetId: string;
  name: string;
}) {
  return {
    id: building.id,
    assetId: building.assetId,
    name: building.name
  };
}

function floorSnapshot(floor: {
  id: string;
  buildingId: string;
  name: string;
  number: number;
}) {
  return {
    id: floor.id,
    buildingId: floor.buildingId,
    name: floor.name,
    number: floor.number
  };
}

function roomSnapshot(room: {
  id: string;
  floorId: string;
  roomNumber: string;
  rentAmount: { toString(): string };
  depositAmount: { toString(): string };
  status: string;
}) {
  return {
    id: room.id,
    floorId: room.floorId,
    roomNumber: room.roomNumber,
    rentAmount: room.rentAmount.toString(),
    depositAmount: room.depositAmount.toString(),
    status: room.status
  };
}

export async function createOrganization(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = nameSchema.safeParse(getString(formData, "name"));

  if (!parsed.success) {
    invalidOrganization();
  }

  await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: parsed.data
      },
      select: {
        id: true,
        name: true,
        status: true
      }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "organization.create",
      entityType: "organization",
      entityId: organization.id,
      organizationId: organization.id,
      after: organizationSnapshot(organization)
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/organizations");
  redirect("/admin/organizations?created=organization");
}

export async function updateOrganization(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = z
    .object({
      organizationId: uuidSchema,
      name: nameSchema,
      status: organizationStatusSchema
    })
    .safeParse({
      organizationId: getString(formData, "organizationId"),
      name: getString(formData, "name"),
      status: getString(formData, "status")
    });

  if (!parsed.success) {
    invalidOrganization();
  }

  const before = await prisma.organization.findUnique({
    where: { id: parsed.data.organizationId },
    select: {
      id: true,
      name: true,
      status: true
    }
  });

  if (!before) {
    invalidOrganization();
  }

  await prisma.$transaction(async (tx) => {
    const after = await tx.organization.update({
      where: { id: parsed.data.organizationId },
      data: {
        name: parsed.data.name,
        status: parsed.data.status
      },
      select: {
        id: true,
        name: true,
        status: true
      }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "organization.update",
      entityType: "organization",
      entityId: after.id,
      organizationId: after.id,
      before: organizationSnapshot(before),
      after: organizationSnapshot(after)
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/organizations");
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  redirect("/admin/organizations?updated=organization");
}

export async function deleteOrganization(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = uuidSchema.safeParse(getString(formData, "organizationId"));

  if (!parsed.success) {
    invalidOrganization();
  }

  const before = await prisma.organization.findUnique({
    where: { id: parsed.data },
    select: {
      id: true,
      name: true,
      status: true
    }
  });

  if (!before) {
    invalidOrganization();
  }

  await prisma.$transaction(async (tx) => {
    await tx.organization.delete({
      where: { id: parsed.data }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "organization.delete",
      entityType: "organization",
      entityId: before.id,
      organizationId: null,
      before: organizationSnapshot(before)
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/organizations");
  redirect("/admin/organizations?deleted=organization");
}

export async function createAsset(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = z
    .object({
      organizationId: uuidSchema,
      name: nameSchema,
      abbreviation: abbreviationSchema,
      type: assetTypeSchema
    })
    .safeParse({
      organizationId: getString(formData, "organizationId"),
      name: getString(formData, "name"),
      abbreviation: getString(formData, "abbreviation"),
      type: getString(formData, "type")
    });

  if (!parsed.success) {
    invalidAsset();
  }

  const organization = await prisma.organization.findUnique({
    where: { id: parsed.data.organizationId },
    select: { id: true }
  });

  if (!organization) {
    invalidAsset();
  }

  await prisma.$transaction(async (tx) => {
    const asset = await tx.asset.create({
      data: parsed.data,
      select: {
        id: true,
        organizationId: true,
        name: true,
        abbreviation: true,
        type: true,
        status: true
      }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "asset.create",
      entityType: "asset",
      entityId: asset.id,
      organizationId: asset.organizationId,
      after: assetSnapshot(asset)
    });
  });

  revalidatePath("/admin/organizations");
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  redirect(organizationPath(parsed.data.organizationId, "created=asset"));
}

export async function updateAsset(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = z
    .object({
      organizationId: uuidSchema,
      assetId: uuidSchema,
      name: nameSchema,
      abbreviation: abbreviationSchema,
      type: assetTypeSchema,
      status: assetStatusSchema
    })
    .safeParse({
      organizationId: getString(formData, "organizationId"),
      assetId: getString(formData, "assetId"),
      name: getString(formData, "name"),
      abbreviation: getString(formData, "abbreviation"),
      type: getString(formData, "type"),
      status: getString(formData, "status")
    });

  if (!parsed.success) {
    invalidAsset();
  }

  const before = await prisma.asset.findUnique({
    where: { id: parsed.data.assetId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      abbreviation: true,
      type: true,
      status: true
    }
  });

  if (!before) {
    invalidAsset();
  }

  if (before.organizationId !== parsed.data.organizationId) {
    scopeMismatch();
  }

  await prisma.$transaction(async (tx) => {
    const after = await tx.asset.update({
      where: { id: parsed.data.assetId },
      data: {
        name: parsed.data.name,
        abbreviation: parsed.data.abbreviation,
        type: parsed.data.type,
        status: parsed.data.status
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
        abbreviation: true,
        type: true,
        status: true
      }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "asset.update",
      entityType: "asset",
      entityId: after.id,
      organizationId: after.organizationId,
      before: assetSnapshot(before),
      after: assetSnapshot(after)
    });
  });

  revalidatePath("/admin/organizations");
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  redirect(organizationPath(parsed.data.organizationId, "updated=asset"));
}

export async function deleteAsset(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = z
    .object({
      organizationId: uuidSchema,
      assetId: uuidSchema
    })
    .safeParse({
      organizationId: getString(formData, "organizationId"),
      assetId: getString(formData, "assetId")
    });

  if (!parsed.success) {
    invalidAsset();
  }

  const before = await prisma.asset.findUnique({
    where: { id: parsed.data.assetId },
    select: {
      id: true,
      organizationId: true,
      name: true,
      abbreviation: true,
      type: true,
      status: true
    }
  });

  if (!before) {
    invalidAsset();
  }

  if (before.organizationId !== parsed.data.organizationId) {
    scopeMismatch();
  }

  await prisma.$transaction(async (tx) => {
    await tx.asset.delete({
      where: { id: parsed.data.assetId }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "asset.delete",
      entityType: "asset",
      entityId: before.id,
      organizationId: before.organizationId,
      before: assetSnapshot(before)
    });
  });

  revalidatePath("/admin/organizations");
  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  redirect(organizationPath(parsed.data.organizationId, "deleted=asset"));
}

export async function createBuilding(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = z
    .object({
      organizationId: uuidSchema,
      assetId: uuidSchema,
      name: nameSchema
    })
    .safeParse({
      organizationId: getString(formData, "organizationId"),
      assetId: getString(formData, "assetId"),
      name: getString(formData, "name")
    });

  if (!parsed.success) {
    invalidBuilding();
  }

  const asset = await prisma.asset.findUnique({
    where: { id: parsed.data.assetId },
    select: { organizationId: true }
  });

  if (!asset) {
    invalidBuilding();
  }

  if (asset.organizationId !== parsed.data.organizationId) {
    scopeMismatch();
  }

  await prisma.$transaction(async (tx) => {
    const building = await tx.building.create({
      data: {
        assetId: parsed.data.assetId,
        name: parsed.data.name
      },
      select: {
        id: true,
        assetId: true,
        name: true
      }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "building.create",
      entityType: "building",
      entityId: building.id,
      organizationId: parsed.data.organizationId,
      after: buildingSnapshot(building)
    });
  });

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  redirect(organizationPath(parsed.data.organizationId, "created=building"));
}

export async function updateBuilding(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = z
    .object({
      organizationId: uuidSchema,
      buildingId: uuidSchema,
      name: nameSchema
    })
    .safeParse({
      organizationId: getString(formData, "organizationId"),
      buildingId: getString(formData, "buildingId"),
      name: getString(formData, "name")
    });

  if (!parsed.success) {
    invalidBuilding();
  }

  const before = await prisma.building.findUnique({
    where: { id: parsed.data.buildingId },
    select: {
      id: true,
      assetId: true,
      name: true,
      asset: {
        select: {
          organizationId: true
        }
      }
    }
  });

  if (!before) {
    invalidBuilding();
  }

  if (before.asset.organizationId !== parsed.data.organizationId) {
    scopeMismatch();
  }

  await prisma.$transaction(async (tx) => {
    const after = await tx.building.update({
      where: { id: parsed.data.buildingId },
      data: { name: parsed.data.name },
      select: {
        id: true,
        assetId: true,
        name: true
      }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "building.update",
      entityType: "building",
      entityId: after.id,
      organizationId: parsed.data.organizationId,
      before: buildingSnapshot(before),
      after: buildingSnapshot(after)
    });
  });

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  redirect(organizationPath(parsed.data.organizationId, "updated=building"));
}

export async function deleteBuilding(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = z
    .object({
      organizationId: uuidSchema,
      buildingId: uuidSchema
    })
    .safeParse({
      organizationId: getString(formData, "organizationId"),
      buildingId: getString(formData, "buildingId")
    });

  if (!parsed.success) {
    invalidBuilding();
  }

  const before = await prisma.building.findUnique({
    where: { id: parsed.data.buildingId },
    select: {
      id: true,
      assetId: true,
      name: true,
      asset: {
        select: {
          organizationId: true
        }
      }
    }
  });

  if (!before) {
    invalidBuilding();
  }

  if (before.asset.organizationId !== parsed.data.organizationId) {
    scopeMismatch();
  }

  await prisma.$transaction(async (tx) => {
    await tx.building.delete({
      where: { id: parsed.data.buildingId }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "building.delete",
      entityType: "building",
      entityId: before.id,
      organizationId: parsed.data.organizationId,
      before: buildingSnapshot(before)
    });
  });

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  redirect(organizationPath(parsed.data.organizationId, "deleted=building"));
}

export async function createFloor(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = z
    .object({
      organizationId: uuidSchema,
      buildingId: uuidSchema,
      name: nameSchema,
      number: floorNumberSchema
    })
    .safeParse({
      organizationId: getString(formData, "organizationId"),
      buildingId: getString(formData, "buildingId"),
      name: getString(formData, "name"),
      number: getString(formData, "number")
    });

  if (!parsed.success) {
    invalidFloor();
  }

  const building = await prisma.building.findUnique({
    where: { id: parsed.data.buildingId },
    select: {
      asset: {
        select: {
          organizationId: true
        }
      }
    }
  });

  if (!building) {
    invalidFloor();
  }

  if (building.asset.organizationId !== parsed.data.organizationId) {
    scopeMismatch();
  }

  await prisma.$transaction(async (tx) => {
    const floor = await tx.floor.create({
      data: {
        buildingId: parsed.data.buildingId,
        name: parsed.data.name,
        number: parsed.data.number
      },
      select: {
        id: true,
        buildingId: true,
        name: true,
        number: true
      }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "floor.create",
      entityType: "floor",
      entityId: floor.id,
      organizationId: parsed.data.organizationId,
      after: floorSnapshot(floor)
    });
  });

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  redirect(organizationPath(parsed.data.organizationId, "created=floor"));
}

export async function updateFloor(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = z
    .object({
      organizationId: uuidSchema,
      floorId: uuidSchema,
      name: nameSchema,
      number: floorNumberSchema
    })
    .safeParse({
      organizationId: getString(formData, "organizationId"),
      floorId: getString(formData, "floorId"),
      name: getString(formData, "name"),
      number: getString(formData, "number")
    });

  if (!parsed.success) {
    invalidFloor();
  }

  const before = await prisma.floor.findUnique({
    where: { id: parsed.data.floorId },
    select: {
      id: true,
      buildingId: true,
      name: true,
      number: true,
      building: {
        select: {
          asset: {
            select: {
              organizationId: true
            }
          }
        }
      }
    }
  });

  if (!before) {
    invalidFloor();
  }

  if (before.building.asset.organizationId !== parsed.data.organizationId) {
    scopeMismatch();
  }

  await prisma.$transaction(async (tx) => {
    const after = await tx.floor.update({
      where: { id: parsed.data.floorId },
      data: {
        name: parsed.data.name,
        number: parsed.data.number
      },
      select: {
        id: true,
        buildingId: true,
        name: true,
        number: true
      }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "floor.update",
      entityType: "floor",
      entityId: after.id,
      organizationId: parsed.data.organizationId,
      before: floorSnapshot(before),
      after: floorSnapshot(after)
    });
  });

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  redirect(organizationPath(parsed.data.organizationId, "updated=floor"));
}

export async function deleteFloor(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = z
    .object({
      organizationId: uuidSchema,
      floorId: uuidSchema
    })
    .safeParse({
      organizationId: getString(formData, "organizationId"),
      floorId: getString(formData, "floorId")
    });

  if (!parsed.success) {
    invalidFloor();
  }

  const before = await prisma.floor.findUnique({
    where: { id: parsed.data.floorId },
    select: {
      id: true,
      buildingId: true,
      name: true,
      number: true,
      building: {
        select: {
          asset: {
            select: {
              organizationId: true
            }
          }
        }
      }
    }
  });

  if (!before) {
    invalidFloor();
  }

  if (before.building.asset.organizationId !== parsed.data.organizationId) {
    scopeMismatch();
  }

  await prisma.$transaction(async (tx) => {
    await tx.floor.delete({
      where: { id: parsed.data.floorId }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "floor.delete",
      entityType: "floor",
      entityId: before.id,
      organizationId: parsed.data.organizationId,
      before: floorSnapshot(before)
    });
  });

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  redirect(organizationPath(parsed.data.organizationId, "deleted=floor"));
}

export async function createRoom(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = z
    .object({
      organizationId: uuidSchema,
      floorId: uuidSchema,
      roomNumber: nameSchema,
      rentAmount: moneySchema,
      depositAmount: moneySchema,
      status: roomStatusSchema
    })
    .safeParse({
      organizationId: getString(formData, "organizationId"),
      floorId: getString(formData, "floorId"),
      roomNumber: getString(formData, "roomNumber"),
      rentAmount: getString(formData, "rentAmount") || "0",
      depositAmount: getString(formData, "depositAmount") || "0",
      status: getString(formData, "status") || "VACANT"
    });

  if (!parsed.success) {
    invalidRoom();
  }

  const floor = await prisma.floor.findUnique({
    where: { id: parsed.data.floorId },
    select: {
      building: {
        select: {
          asset: {
            select: {
              organizationId: true
            }
          }
        }
      }
    }
  });

  if (!floor) {
    invalidRoom();
  }

  if (floor.building.asset.organizationId !== parsed.data.organizationId) {
    scopeMismatch();
  }

  await prisma.$transaction(async (tx) => {
    const room = await tx.room.create({
      data: {
        floorId: parsed.data.floorId,
        roomNumber: parsed.data.roomNumber,
        rentAmount: parsed.data.rentAmount,
        depositAmount: parsed.data.depositAmount,
        status: parsed.data.status
      },
      select: {
        id: true,
        floorId: true,
        roomNumber: true,
        rentAmount: true,
        depositAmount: true,
        status: true
      }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "room.create",
      entityType: "room",
      entityId: room.id,
      organizationId: parsed.data.organizationId,
      after: roomSnapshot(room)
    });
  });

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  redirect(organizationPath(parsed.data.organizationId, "created=room"));
}

export async function updateRoom(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = z
    .object({
      organizationId: uuidSchema,
      roomId: uuidSchema,
      roomNumber: nameSchema,
      rentAmount: moneySchema,
      depositAmount: moneySchema,
      status: roomStatusSchema
    })
    .safeParse({
      organizationId: getString(formData, "organizationId"),
      roomId: getString(formData, "roomId"),
      roomNumber: getString(formData, "roomNumber"),
      rentAmount: getString(formData, "rentAmount") || "0",
      depositAmount: getString(formData, "depositAmount") || "0",
      status: getString(formData, "status")
    });

  if (!parsed.success) {
    redirect("/admin/organizations?error=invalid-room-status");
  }

  const before = await prisma.room.findUnique({
    where: { id: parsed.data.roomId },
    select: {
      id: true,
      floorId: true,
      roomNumber: true,
      rentAmount: true,
      depositAmount: true,
      status: true,
      floor: {
        select: {
          building: {
            select: {
              asset: {
                select: {
                  organizationId: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!before) {
    invalidRoom();
  }

  if (before.floor.building.asset.organizationId !== parsed.data.organizationId) {
    scopeMismatch();
  }

  await prisma.$transaction(async (tx) => {
    const after = await tx.room.update({
      where: { id: parsed.data.roomId },
      data: {
        roomNumber: parsed.data.roomNumber,
        rentAmount: parsed.data.rentAmount,
        depositAmount: parsed.data.depositAmount,
        status: parsed.data.status
      },
      select: {
        id: true,
        floorId: true,
        roomNumber: true,
        rentAmount: true,
        depositAmount: true,
        status: true
      }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "room.update",
      entityType: "room",
      entityId: after.id,
      organizationId: parsed.data.organizationId,
      before: roomSnapshot(before),
      after: roomSnapshot(after)
    });
  });

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  redirect(organizationPath(parsed.data.organizationId, "updated=room"));
}

export async function deleteRoom(formData: FormData) {
  const { actorUserId, prisma } = await requireSA();
  const parsed = z
    .object({
      organizationId: uuidSchema,
      roomId: uuidSchema
    })
    .safeParse({
      organizationId: getString(formData, "organizationId"),
      roomId: getString(formData, "roomId")
    });

  if (!parsed.success) {
    invalidRoom();
  }

  const before = await prisma.room.findUnique({
    where: { id: parsed.data.roomId },
    select: {
      id: true,
      floorId: true,
      roomNumber: true,
      rentAmount: true,
      depositAmount: true,
      status: true,
      floor: {
        select: {
          building: {
            select: {
              asset: {
                select: {
                  organizationId: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!before) {
    invalidRoom();
  }

  if (before.floor.building.asset.organizationId !== parsed.data.organizationId) {
    scopeMismatch();
  }

  await prisma.$transaction(async (tx) => {
    await tx.room.delete({
      where: { id: parsed.data.roomId }
    });

    await writeAuditLog(tx, {
      actorUserId,
      action: "room.delete",
      entityType: "room",
      entityId: before.id,
      organizationId: parsed.data.organizationId,
      before: roomSnapshot(before)
    });
  });

  revalidatePath(`/admin/organizations/${parsed.data.organizationId}`);
  redirect(organizationPath(parsed.data.organizationId, "deleted=room"));
}
