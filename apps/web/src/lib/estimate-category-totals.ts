/**
 * 大項目（カテゴリ行）の直接入力と配下詳細行の優先ロジック（No.68/70）。
 * クライアント表示とサーバー集計で同じ判定を使うための共有ヘルパー。
 */

type ItemLike = {
  is_text_row?: boolean | null;
  cost_amount?: number | null;
  selling_amount?: number | null;
};

type CategoryLike = {
  quantity?: number | null;
  cost_price?: number | null;
  selling_price?: number | null;
};

/** 配下に詳細行（非テキスト）が1件でもあれば詳細行優先（金額0でも上書き） */
export function isCategoryOverridden(items: ItemLike[]): boolean {
  return items.some((item) => !item.is_text_row);
}

/** 大項目に直接入力された値があるか */
export function hasCategoryDirectInput(category: CategoryLike): boolean {
  return (
    Number(category.cost_price ?? 0) > 0 || Number(category.selling_price ?? 0) > 0
  );
}

/** 大項目直接入力の金額（数量×単価） */
export function categoryDirectAmounts(category: CategoryLike): {
  cost_amount: number;
  selling_amount: number;
} {
  const qty = Number(category.quantity ?? 0) || 0;
  return {
    cost_amount: Math.round(qty * (Number(category.cost_price ?? 0) || 0)),
    selling_amount: Math.round(qty * (Number(category.selling_price ?? 0) || 0)),
  };
}

/**
 * カテゴリの有効金額（詳細行があればその合計、無ければ直接入力）。
 * 戻り値 overridden=true のとき「詳細項目により上書き」表示対象。
 */
export function effectiveCategoryAmounts(
  category: CategoryLike,
  items: ItemLike[],
): { cost_amount: number; selling_amount: number; overridden: boolean } {
  const overridden = isCategoryOverridden(items);
  if (overridden) {
    const calcItems = items.filter((i) => !i.is_text_row);
    return {
      cost_amount: calcItems.reduce((s, i) => s + Number(i.cost_amount ?? 0), 0),
      selling_amount: calcItems.reduce((s, i) => s + Number(i.selling_amount ?? 0), 0),
      overridden: true,
    };
  }
  return { ...categoryDirectAmounts(category), overridden: false };
}
