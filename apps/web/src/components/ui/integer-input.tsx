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
      className={cn(className)}
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
