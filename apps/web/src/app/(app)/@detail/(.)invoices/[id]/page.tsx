import DetailPage from "../../../invoices/[id]/page";
import { DetailRouteDialog } from "@/components/layout/detail-route-dialog";

export default function ModalPage() {
  return <DetailRouteDialog title="請求書詳細"><DetailPage /></DetailRouteDialog>;
}
