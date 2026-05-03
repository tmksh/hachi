/*
  ── Card spacing rules ────────────────────────────────────────────
  カード内の余白は以下のルールに従う。

  Card          外側 py-5 (20px 上下)、セクション間 gap-4 (16px)
  CardHeader    px-6 pt-5 pb-3  — タイトル行。下のみ少し詰める
  CardContent   px-6 py-4       — コンテンツ本体
  CardFooter    px-6 pt-3 pb-5  — アクションエリア

  ページ固有の上書きは最小限に。py-0 等の全リセットは避ける。
  ──────────────────────────────────────────────────────────────────
*/
import * as React from "react"

import { cn } from "@/lib/utils"

type CardVariant = "default" | "inset";

interface CardProps extends React.ComponentProps<"div"> {
  variant?: CardVariant;
}

function Card({ className, variant = "default", ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      data-variant={variant}
      className={cn(
        "text-card-foreground flex flex-col gap-4 rounded-lg py-5 transition-[box-shadow] duration-200",
        variant === "inset" ? "frost-card-inset" : "frost-card",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex flex-row items-center justify-between min-h-10 px-5 border-b border-border/60",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-4", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
