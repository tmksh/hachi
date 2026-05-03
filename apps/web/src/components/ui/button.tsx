import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-[#1a7a52] to-[#0a3d26] text-primary-foreground " +
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_3px_rgba(15,81,50,0.40),0_2px_6px_rgba(0,0,0,0.12)] " +
          "hover:from-[#1f9060] hover:to-[#0d4a2e] hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_2px_8px_rgba(15,81,50,0.50),0_3px_8px_rgba(0,0,0,0.14)] " +
          "active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.20),inset_0_1px_2px_rgba(0,0,0,0.10)] active:translate-y-0",
        destructive:
          "bg-gradient-to-b from-[#ef4444] to-[#b91c1c] text-white " +
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_3px_rgba(185,28,28,0.40),0_2px_6px_rgba(0,0,0,0.12)] " +
          "hover:from-[#f87171] hover:to-[#dc2626] hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_2px_8px_rgba(185,28,28,0.50)] " +
          "focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 " +
          "active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.20)] active:translate-y-0",
        outline:
          "bg-white text-foreground border border-input " +
          "shadow-[0_1px_2px_rgba(0,0,0,0.06)] " +
          "hover:bg-gray-50 hover:border-gray-300 hover:-translate-y-px hover:shadow-[0_2px_5px_rgba(0,0,0,0.08)] " +
          "active:bg-gray-100 active:translate-y-0 active:shadow-none " +
          "dark:bg-white/8 dark:border-white/10 dark:text-foreground dark:hover:bg-white/14 dark:hover:border-white/18",
        secondary:
          "bg-gray-100 text-gray-800 border border-gray-200 " +
          "shadow-[0_1px_2px_rgba(0,0,0,0.05)] " +
          "hover:bg-gray-200 hover:border-gray-300 hover:-translate-y-px hover:shadow-[0_2px_5px_rgba(0,0,0,0.08)] " +
          "active:bg-gray-200 active:translate-y-0 active:shadow-none " +
          "dark:bg-white/8 dark:text-foreground dark:border-white/10 dark:hover:bg-white/14",
        ghost:
          "text-foreground hover:bg-gray-100 hover:text-foreground active:bg-gray-200 " +
          "dark:hover:bg-white/8 dark:active:bg-white/12",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
