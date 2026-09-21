import DetailPage from "../../../circulation/[id]/page";
import { DetailRouteDialog } from "@/components/layout/detail-route-dialog";

export default function ModalPage() {
  return <DetailRouteDialog title="回覧詳細"><DetailPage /></DetailRouteDialog>;
}
