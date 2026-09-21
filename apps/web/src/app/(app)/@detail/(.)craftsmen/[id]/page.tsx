import DetailPage from "../../../craftsmen/[id]/page";
import { DetailRouteDialog } from "@/components/layout/detail-route-dialog";

export default function ModalPage() {
  return <DetailRouteDialog title="業者詳細"><DetailPage /></DetailRouteDialog>;
}
