import DetailPage from "../../../workflow/[id]/page";
import { DetailRouteDialog } from "@/components/layout/detail-route-dialog";

export default function ModalPage() {
  return <DetailRouteDialog title="申請詳細"><DetailPage /></DetailRouteDialog>;
}
