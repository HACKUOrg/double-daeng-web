import { redirect } from "next/navigation";
import {
  ModuleHeader,
  NoOrganizationState,
  StatusBanner
} from "@/app/app/operations/_components/operation-ui";
import {
  getOperationState,
  type OperationSearchParams
} from "@/app/app/operations/_lib/data";

type OperationsPageProps = {
  searchParams: OperationSearchParams;
};

export default async function OperationsPage({
  searchParams
}: OperationsPageProps) {
  const {
    activeOrganization,
    canCreateMaintenance,
    canManageCustomers,
    canManageMaintenance,
    canRecordMeters,
    query
  } = await getOperationState(searchParams);

  if (activeOrganization) {
    const organizationQuery = `organizationId=${activeOrganization.id}`;

    if (canManageCustomers) {
      redirect(`/app/operations/move-in?${organizationQuery}`);
    }

    if (canRecordMeters) {
      redirect(`/app/operations/meter-reading?${organizationQuery}`);
    }

    if (canManageMaintenance || canCreateMaintenance) {
      redirect(`/app/operations/maintenance?${organizationQuery}`);
    }

    redirect(`/app/rooms?${organizationQuery}`);
  }

  return (
    <div className="grid gap-8">
      <ModuleHeader
        title="Operations"
        description="Choose an active organization from the sidebar before using daily operation modules."
      />
      <StatusBanner error={query.error} updated={query.updated} />
      <NoOrganizationState />
    </div>
  );
}
