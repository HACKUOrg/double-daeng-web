import { Prisma } from "@/generated/prisma/client";

type AuditLogCreateInput = {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  organizationId?: string | null;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
};

type AuditWriter = {
  auditLog: {
    create(args: { data: AuditLogCreateInput }): Promise<unknown>;
  };
};

export type AuditSnapshot = Record<string, unknown>;

function toAuditJson(value: AuditSnapshot): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeAuditLog(
  prisma: AuditWriter,
  data: Omit<AuditLogCreateInput, "before" | "after"> & {
    before?: AuditSnapshot;
    after?: AuditSnapshot;
  }
) {
  await prisma.auditLog.create({
    data: {
      actorUserId: data.actorUserId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      organizationId: data.organizationId ?? null,
      before: data.before ? toAuditJson(data.before) : undefined,
      after: data.after ? toAuditJson(data.after) : undefined
    }
  });
}
