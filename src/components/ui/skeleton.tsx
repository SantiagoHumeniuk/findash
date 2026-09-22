import { cn } from "../../lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-accent/30 dark:bg-accent/20 border border-white/[0.02] dark:border-white/[0.04]",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-r before:from-transparent before:via-primary/10 dark:before:via-primary/10 before:to-transparent",
        "before:-translate-x-full before:animate-[shimmer_2s_infinite]",
        "after:absolute after:inset-0 after:bg-gradient-to-br after:from-white/5 after:to-transparent after:opacity-20",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
