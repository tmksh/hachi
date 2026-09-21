import DetailPage from "../../../quotes/[id]/page";
import { DetailRouteDialog } from "@/components/layout/detail-route-dialog";

export default function ModalPage() {
  return <DetailRouteDialog title="見積詳細"><DetailPage /></DetailRouteDialog>;
}
