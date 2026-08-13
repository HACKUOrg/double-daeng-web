import { Banknote } from "lucide-react";
import { createInvoice } from "@/app/app/operations/actions";
import {
  AccessDeniedState,
  EmptyState,
  HiddenOperationFields,
  ListPanel,
  ModuleHeader,
  Panel,
  SelectField,
  StatusBanner,
  StatusPill,
  TextField,
  formatDate,
  formatMoney,
  invoiceStatuses,
  roomLabel
} from "@/app/app/operations/_components/operation-ui";
import {
  canUseModule,
  getOperationState,
  type OperationSearchParams
} from "@/app/app/operations/_lib/data";
import { Button } from "@/components/ui/button";

type MonthlyInvoicePageProps = {
  searchParams: OperationSearchParams;
};

const returnPath = "/app/operations/monthly-invoice";

export default async function MonthlyInvoicePage({
  searchParams
}: MonthlyInvoicePageProps) {
  const { activeOrganization, data, query, role } =
    await getOperationState(searchParams);

  if (!activeOrganization || !data) {
    return (
      <div className="grid gap-8">
        <ModuleHeader
          title="Monthly invoice"
          description="Create and review invoices for active stays."
        />
        <StatusBanner error={query.error} updated={query.updated} />
        <EmptyState label="Choose an active organization from the sidebar." />
      </div>
    );
  }

  if (!canUseModule(role, ["customers.manage"])) {
    return (
      <div className="grid gap-8">
        <ModuleHeader
          title="Monthly invoice"
          description="Create and review invoices for active stays."
        />
        <AccessDeniedState />
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <ModuleHeader
        title="Monthly invoice"
        description="Create one invoice for a current stay and scan recent invoice status without leaving the workflow."
      />
      <StatusBanner error={query.error} updated={query.updated} />

      <Panel
        icon={<Banknote className="size-5" aria-hidden="true" />}
        title="Create invoice"
        description="Invoices stay scoped to the selected organization and active room assignment."
      >
        {data.activeAssignments.length ? (
          <form action={createInvoice} className="grid gap-3">
            <HiddenOperationFields
              organizationId={activeOrganization.id}
              returnPath={returnPath}
            />
            <SelectField label="Stay" name="roomAssignmentId">
              {data.activeAssignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.residentFullName} - {roomLabel(assignment.room)}
                </option>
              ))}
            </SelectField>
            <div className="grid gap-3 md:grid-cols-2">
              <TextField name="invoiceNumber" label="Invoice number" required />
              <TextField
                name="totalAmount"
                label="Total amount"
                inputMode="decimal"
                required
              />
              <TextField name="issueDate" label="Issue date" type="date" required />
              <TextField name="dueDate" label="Due date" type="date" required />
            </div>
            <SelectField label="Status" name="status" defaultValue="ISSUED">
              {invoiceStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </SelectField>
            <Button type="submit" className="justify-self-start">
              <Banknote className="size-4" aria-hidden="true" />
              Create invoice
            </Button>
          </form>
        ) : (
          <EmptyState label="No active stays are ready for invoicing." />
        )}
      </Panel>

      <ListPanel
        icon={<Banknote className="size-5" aria-hidden="true" />}
        title="Recent invoices"
      >
        {data.invoices.length ? (
          data.invoices.map((invoice) => (
            <article
              key={invoice.id}
              className="grid gap-2 border-b py-4 last:border-b-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{invoice.invoiceNumber}</h3>
                <StatusPill label={invoice.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {invoice.roomAssignment?.residentFullName || "No stay"} -{" "}
                {formatMoney(invoice.totalAmount)} - due{" "}
                {formatDate(invoice.dueDate)}
              </p>
            </article>
          ))
        ) : (
          <EmptyState label="No invoices yet." />
        )}
      </ListPanel>
    </div>
  );
}
