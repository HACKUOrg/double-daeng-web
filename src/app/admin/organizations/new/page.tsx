import { OrganizationStructureEditor } from "../_components/organization-structure-editor";
import { createEmptyOrganizationDraft } from "../_lib/structure-draft";
import { requirePermission } from "@/lib/auth/session";

type NewOrganizationPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewOrganizationPage({
  searchParams
}: NewOrganizationPageProps) {
  await requirePermission("organizations.manage");
  const query = await searchParams;

  return (
    <OrganizationStructureEditor
      initialDraft={createEmptyOrganizationDraft()}
      status={query}
    />
  );
}
