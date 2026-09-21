import NewPage from "../../../invoices/new/page";
import { DetailRouteDialog } from "@/components/layout/detail-route-dialog";

// Keep the reserved new route from being interpreted as a record ID.
export default function ModalPage() {
  return <DetailRouteDialog title="新規請求書作成"><NewPage /></DetailRouteDialog>;
}
