"use client";

export type OrderDocKind = "order" | "acknowledgment";

export type OrderDocData = {
  title: string;
  amount: number;
  orderDate?: string | null;
  acceptedAt?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  completionDate?: string | null;
  paymentDate?: string | null;
  paymentCount?: string | null;
  workContent?: string | null;
  specialNotes?: string | null;
  craftsmanName?: string | null;
  constructionTitle?: string | null;
  paymentSchedule?: Array<{ phase: string; amount: number; due_date?: string | null }>;
};

function yen(n: number) {
  return `¥${n.toLocaleString()}`;
}

/** 発注書 / 請書の帳票プレビュー（No.108） */
export function OrderDocumentPreview({ kind, data }: { kind: OrderDocKind; data: OrderDocData }) {
  const tax = Math.round(data.amount * 0.1);
  const total = data.amount + tax;
  const isAck = kind === "acknowledgment";
  const heading = isAck ? "請　書" : "発 注 書";
  const dateLabel = isAck ? "受領日" : "発注日";
  const dateValue = isAck
    ? (data.acceptedAt ? data.acceptedAt.slice(0, 10) : "—")
    : (data.orderDate ?? "—");

  return (
    <div
      className="bg-white text-black mx-auto w-full max-w-[210mm] min-h-[297mm] box-border space-y-4 text-sm font-sans print:shadow-none"
      style={{ padding: "14mm 16mm" }}
    >
      <div className="text-center border-b-2 border-slate-900 pb-3">
        <h1 className="text-2xl font-bold tracking-[0.35em] mb-1">{heading}</h1>
        {data.constructionTitle && (
          <p className="text-xs text-gray-500">名称: {data.constructionTitle}</p>
        )}
        <p className="text-xs text-gray-500">{dateLabel}: {dateValue}</p>
      </div>

      <div className="flex justify-between gap-4 border-b pb-3">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">{isAck ? "受注者" : "発注先"}</p>
          <p className="text-base font-semibold">{data.craftsmanName ?? "（未設定）"}{isAck ? "" : " 御中"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 mb-0.5">件名</p>
          <p className="font-semibold">{data.title}</p>
        </div>
      </div>

      {isAck && (
        <p className="text-sm leading-relaxed">
          下記のとおり発注を受領し、記載の条件で請け負います。
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div><span className="text-gray-500">工期開始：</span>{data.startDate ?? "—"}</div>
        <div><span className="text-gray-500">工期終了：</span>{data.endDate ?? "—"}</div>
        <div><span className="text-gray-500">完了予定日：</span>{data.completionDate ?? "—"}</div>
        <div><span className="text-gray-500">支払予定日：</span>{data.paymentDate ?? "—"}</div>
        <div><span className="text-gray-500">支払回数：</span>{data.paymentCount ?? "1回"}</div>
        <div><span className="text-gray-500">発注日：</span>{data.orderDate ?? "—"}</div>
      </div>

      {data.workContent && (
        <div className="border rounded p-2">
          <p className="text-[11px] font-semibold text-gray-500 mb-1">工事内容</p>
          <p className="text-xs whitespace-pre-wrap">{data.workContent}</p>
        </div>
      )}

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1.5 text-left">項目</th>
            <th className="border px-2 py-1.5 text-right w-28">金額</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border px-2 py-1.5">{data.title}</td>
            <td className="border px-2 py-1.5 text-right tabular-nums">{yen(data.amount)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td className="border px-2 py-1.5 text-right text-gray-500">消費税（10%）</td>
            <td className="border px-2 py-1.5 text-right tabular-nums">{yen(tax)}</td>
          </tr>
          <tr className="bg-gray-50 font-bold">
            <td className="border px-2 py-1.5 text-right">合計（税込）</td>
            <td className="border px-2 py-1.5 text-right tabular-nums text-base">{yen(total)}</td>
          </tr>
        </tfoot>
      </table>

      {data.paymentSchedule && data.paymentSchedule.length > 1 && (
        <div>
          <p className="text-[11px] font-semibold text-gray-500 mb-1">支払スケジュール</p>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1 text-left">区分</th>
                <th className="border px-2 py-1 text-right">金額</th>
                <th className="border px-2 py-1 text-left">支払期日</th>
              </tr>
            </thead>
            <tbody>
              {data.paymentSchedule.map((s, i) => (
                <tr key={i}>
                  <td className="border px-2 py-1">{s.phase}</td>
                  <td className="border px-2 py-1 text-right tabular-nums">{yen(s.amount)}</td>
                  <td className="border px-2 py-1">{s.due_date ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.specialNotes && (
        <div className="border rounded p-2 border-gray-300">
          <p className="text-[11px] font-semibold text-gray-500 mb-1">特記事項</p>
          <p className="text-xs whitespace-pre-wrap">{data.specialNotes}</p>
        </div>
      )}

      {isAck && (
        <div className="pt-6 text-sm">
          <p className="mb-8">以上</p>
          <p>受注者：{data.craftsmanName ?? "—"}　　印</p>
        </div>
      )}
    </div>
  );
}
