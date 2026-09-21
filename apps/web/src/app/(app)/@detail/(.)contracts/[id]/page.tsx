import DetailPage from "../../../contracts/[id]/page";
import { DetailRouteDialog } from "@/components/layout/detail-route-dialog";

export default function ModalPage() {
  return <DetailRouteDialog title="契約詳細"><DetailPage /></DetailRouteDialog>;
}
