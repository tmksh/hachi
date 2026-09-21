import DetailPage from "../../../crm/[id]/page";
import { DetailRouteDialog } from "@/components/layout/detail-route-dialog";

export default function ModalPage() {
  return <DetailRouteDialog title="顧客詳細"><DetailPage /></DetailRouteDialog>;
}
