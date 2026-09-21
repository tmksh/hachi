import DetailPage from "../../../constructions/[id]/page";
import { DetailRouteDialog } from "@/components/layout/detail-route-dialog";

export default function ModalPage() {
  return <DetailRouteDialog title="工事詳細"><DetailPage /></DetailRouteDialog>;
}
