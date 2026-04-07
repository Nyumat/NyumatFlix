"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { useRouter } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-200 backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border border-primary/30 bg-primary/12 text-primary shadow-md hover:bg-primary/22 hover:border-primary/45 dark:border-white/30 dark:bg-white/10 dark:text-white dark:hover:bg-white/20",
        secondary:
          "border border-border/60 bg-secondary/35 text-secondary-foreground shadow-sm hover:bg-secondary/55 dark:border-white/25 dark:bg-white/10 dark:text-white dark:hover:bg-white/18",
        destructive:
          "border border-destructive/40 bg-destructive/90 text-destructive-foreground shadow-sm hover:bg-destructive",
        outline:
          "border border-border/80 bg-background/50 text-foreground shadow-sm hover:bg-muted/60 dark:border-white/25 dark:bg-white/5 dark:text-white dark:hover:bg-white/15",
        chrome:
          "border border-border/80 bg-background/50 text-foreground shadow-md hover:bg-muted/65 hover:border-border dark:border-white/30 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:border-white/40",
        stylish:
          "border border-primary/25 bg-gradient-to-r from-[#D247BF]/20 to-primary/20 text-foreground backdrop-blur-sm hover:from-[#D247BF]/30 hover:to-primary/30 hover:border-primary/40 dark:border-white/20 dark:text-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  href?: string;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, href, ...props }, ref) => {
    const router = useRouter();

    const handleMouseEnter = () => {
      if (href) {
        router.prefetch(href);
      }
    };

    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
        onClick={(e) => {
          props.onClick?.(e);
          if (href) {
            router.push(href);
          }
        }}
        onMouseEnter={handleMouseEnter}
      />
    );
  },
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
