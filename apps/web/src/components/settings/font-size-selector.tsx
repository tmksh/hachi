"use client";

import { cn } from "@/lib/utils";
import { useFontSize } from "@/components/providers/font-size-provider";
import { FONT_SIZE_LABELS, type FontSize } from "@/lib/font-size";
import { Loader2, Type } from "lucide-react";

const SIZES: FontSize[] = ["sm", "md", "lg"];

export function FontSizeSelector({ compact = false }: { compact?: boolean }) {
  const { fontSize, setFontSize, saving } = useFontSize();

  if (compact) {
    return (
      <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <Type className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-xs font-medium">文字サイズ</p>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="segmented-control w-fit">
          {SIZES.map(size => (
            <button
              key={size}
              type="button"
              onClick={() => void setFontSize(size)}
              className={cn(
                "segmented-control-btn min-w-[48px] text-xs",
                fontSize === size && "segmented-control-btn-active",
              )}
            >
              {FONT_SIZE_LABELS[size]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-4 border-t border-border">
      <div className="flex items-center gap-2">
        <Type className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">文字サイズ</p>
          <p className="text-xs text-muted-foreground">
            アプリ全体の表示サイズを変更します（メニュー・表・フォームなど）
          </p>
        </div>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />}
      </div>
      <div className="segmented-control w-fit">
        {SIZES.map(size => (
          <button
            key={size}
            type="button"
            onClick={() => void setFontSize(size)}
            className={cn(
              "segmented-control-btn min-w-[52px]",
              fontSize === size && "segmented-control-btn-active",
            )}
          >
            {FONT_SIZE_LABELS[size]}
          </button>
        ))}
      </div>
    </div>
  );
}
