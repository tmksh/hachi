import { cn } from "@/lib/utils";
import { getCustomerAvatarColor } from "@/lib/customer-avatar-color";

type CustomerAvatarProps = {
  seed: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-xl",
};

export function CustomerAvatar({ seed, name, size = "sm", className }: CustomerAvatarProps) {
  const avatar = getCustomerAvatarColor(seed);
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center shrink-0 text-white font-bold shadow-sm",
        sizeClasses[size],
        className,
      )}
      style={{ background: avatar.avatarGradient }}
    >
      {name.charAt(0)}
    </div>
  );
}
