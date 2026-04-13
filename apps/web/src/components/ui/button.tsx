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
          "bg-primary text-primary-foreground " +
          "shadow-[inset_0_1px_1px_rgba(255,255,255,0.30),inset_0_-1px_2px_rgba(0,0,0,0.15),0_4px_10px_rgba(107,201,179,0.35),0_1px_3px_rgba(0,0,0,0.12),3px_3px_8px_rgba(168,182,210,0.30),-2px_-2px_5px_rgba(255,255,255,0.70)] " +
          "hover:bg-primary/90 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_6px_14px_rgba(107,201,179,0.42),0_2px_4px_rgba(0,0,0,0.14),4px_4px_10px_rgba(168,182,210,0.36),-2px_-2px_6px_rgba(255,255,255,0.75)] hover:-translate-y-px " +
          "active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.18),inset_-1px_-1px_3px_rgba(255,255,255,0.20)] active:translate-y-0",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 " +
          "shadow-[inset_0_1px_1px_rgba(255,255,255,0.20),0_4px_10px_rgba(239,68,68,0.30),0_1px_3px_rgba(0,0,0,0.14)] " +
          "hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_6px_14px_rgba(239,68,68,0.38)] hover:-translate-y-px " +
          "active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.18)] active:translate-y-0",
        outline:
          "bg-white/30 backdrop-blur-sm text-foreground border-none " +
          "shadow-[0_1px_0_rgba(255,255,255,0.95),4px_4px_10px_rgba(168,182,210,0.36),-2px_-2px_6px_rgba(255,255,255,0.88),inset_0_1px_1px_rgba(255,255,255,0.80)] " +
          "hover:bg-white/45 hover:shadow-[0_1px_0_rgba(255,255,255,0.98),6px_6px_14px_rgba(168,182,210,0.44),-3px_-3px_8px_rgba(255,255,255,0.92),inset_0_1px_2px_rgba(255,255,255,0.90)] hover:-translate-y-px " +
          "active:shadow-[inset_2px_2px_5px_rgba(168,182,210,0.40),inset_-1px_-1px_3px_rgba(255,255,255,0.80)] active:translate-y-0 " +
          "dark:bg-white/8 dark:hover:bg-white/14 dark:shadow-[0_1px_0_rgba(255,255,255,0.05),4px_4px_10px_rgba(0,0,0,0.30),-2px_-2px_6px_rgba(255,255,255,0.04)]",
        secondary:
          "bg-white/30 backdrop-blur-sm text-secondary-foreground border-none " +
          "shadow-[0_1px_0_rgba(255,255,255,0.92),4px_4px_10px_rgba(168,182,210,0.30),-2px_-2px_6px_rgba(255,255,255,0.82),inset_0_1px_1px_rgba(255,255,255,0.75)] " +
          "hover:bg-white/42 hover:shadow-[0_1px_0_rgba(255,255,255,0.96),6px_6px_12px_rgba(168,182,210,0.36),-3px_-3px_7px_rgba(255,255,255,0.86)] hover:-translate-y-px " +
          "active:shadow-[inset_2px_2px_5px_rgba(168,182,210,0.38),inset_-1px_-1px_3px_rgba(255,255,255,0.75)] active:translate-y-0 " +
          "dark:bg-white/6 dark:hover:bg-white/12",
        ghost:
          "hover:bg-white/30 hover:backdrop-blur-sm hover:text-foreground hover:shadow-[0_1px_0_rgba(255,255,255,0.90),3px_3px_8px_rgba(168,182,210,0.28),-2px_-2px_5px_rgba(255,255,255,0.80)] dark:hover:bg-white/8",
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
