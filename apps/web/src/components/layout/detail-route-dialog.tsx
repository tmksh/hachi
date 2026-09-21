"use client";

import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/** 一覧を背面に保持し、閉じる・ブラウザーの戻るで元の位置へ戻る。 */
export function DetailRouteDialog({ children, title }: { children: React.ReactNode; title: string }) {
  const router = useRouter();
  return (
    <Dialog open onOpenChange={(open) => { if (!open) router.back(); }}>
      <DialogContent className="h-[90dvh] w-[calc(100%-2rem)] sm:max-w-[1440px] flex flex-col gap-0 p-0 overflow-hidden" aria-describedby={undefined}>
        <DialogTitle className="border-b px-6 py-4 pr-12 shrink-0">{title}</DialogTitle>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
