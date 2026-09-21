import NewPage from "../../../circulation/new/page";
import { DetailRouteDialog } from "@/components/layout/detail-route-dialog";

// Keep the reserved new route from being interpreted as a record ID.
export default function ModalPage() {
  return <DetailRouteDialog title="新規回覧作成"><NewPage /></DetailRouteDialog>;
}
