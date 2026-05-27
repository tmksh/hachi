"use client";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between flex-wrap gap-3", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F5132]">{title}</h1>
        {description && (
          <p className="text-sm text-[#2A8055] mt-1 opacity-80">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
