"use client";

import { useState } from "react";
import { Settings2, Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WidgetConfig } from "@/hooks/use-widgets";

interface WidgetCustomizerProps {
  widgets: WidgetConfig[];
  onToggle: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onReset: () => void;
}

export function WidgetCustomizer({
  widgets,
  onToggle,
  onMoveUp,
  onMoveDown,
  onReset,
}: WidgetCustomizerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 text-xs"
      >
        <Settings2 className="h-3.5 w-3.5" />
        カスタマイズ
      </Button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Side panel */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-80 flex flex-col",
          "frost-card rounded-none border-y-0 border-r-0",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/40">
          <div>
            <h2 className="text-sm font-semibold">ウィジェット設定</h2>
            <p className="text-xs text-muted-foreground mt-0.5">表示・順序を変更できます</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-black/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Widget list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {widgets.map((widget, idx) => (
            <div
              key={widget.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                "stat-card",
                !widget.visible && "opacity-50"
              )}
            >
              {/* Toggle */}
              <button
                onClick={() => onToggle(widget.id)}
                className={cn(
                  "shrink-0 h-7 w-7 rounded-lg flex items-center justify-center transition-colors",
                  widget.visible
                    ? "bg-primary/15 text-primary hover:bg-primary/25"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {widget.visible ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
              </button>

              {/* Label */}
              <span className="flex-1 text-sm font-medium">{widget.label}</span>

              {/* Order controls */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => onMoveUp(widget.id)}
                  disabled={idx === 0}
                  className="h-5 w-5 rounded flex items-center justify-center hover:bg-black/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onMoveDown(widget.id)}
                  disabled={idx === widgets.length - 1}
                  className="h-5 w-5 rounded flex items-center justify-center hover:bg-black/8 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="w-full gap-1.5 text-xs text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            デフォルトに戻す
          </Button>
        </div>
      </div>
    </>
  );
}
