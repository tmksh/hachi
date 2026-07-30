"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  formatIntegerDisplay,
  normalizeIntegerInput,
  parseIntegerInput,
} from "@/lib/numeric-input";

type IntegerInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange" | "inputMode" | "onBlur"
> & {
  value: number;
  onValueChange: (value: number) => void;
  onBlur?: (value: number, e: React.FocusEvent<HTMLInputElement>) => void;
};

/**
 * 金額・数量などの整数入力。
 * type=number の先頭ゼロ問題（010000 等）を避けるため text + inputMode=numeric を使用。
 */
export function IntegerInput({
  value,
  onValueChange,
  className,
  disabled,
  placeholder = "0",
  onBlur,
  onFocus,
  ...rest
}: IntegerInputProps) {
  const [text, setText] = useState(() => formatIntegerDisplay(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setText(formatIntegerDisplay(value));
    }
  }, [value, focused]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      disabled={disabled}
      placeholder={placeholder}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground h-9 w-full min-w-0 rounded-lg px-3 py-1 text-base outline-none transition-all duration-200 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "bg-white border border-[rgba(0,0,0,0.09)] dark:bg-[#1F2937] dark:border-[rgba(255,255,255,0.08)]",
        "focus-visible:border-ring/60 focus-visible:ring-ring/40 focus-visible:ring-[3px]",
        className,
      )}
      value={text}
      onFocus={(e) => {
        setFocused(true);
        if (value === 0) {
          setText("");
        } else {
          e.currentTarget.select();
        }
        onFocus?.(e);
      }}
      onChange={(e) => {
        const normalized = normalizeIntegerInput(e.target.value);
        setText(normalized);
        onValueChange(parseIntegerInput(normalized));
      }}
      onBlur={(e) => {
        setFocused(false);
        const parsed = parseIntegerInput(text);
        setText(formatIntegerDisplay(parsed));
        onValueChange(parsed);
        onBlur?.(parsed, e);
      }}
    />
  );
}
