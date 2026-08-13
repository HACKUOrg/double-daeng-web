import { notFound } from "next/navigation";
import { OrganizationStructureEditor } from "../_components/organization-structure-editor";
import { organizationToStructureDraft } from "../_lib/structure-draft";
import { getPrisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/session";

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

  return (
    <OrganizationStructureEditor
      initialDraft={organizationToStructureDraft(organization)}
      status={query}
    />
  );
}
