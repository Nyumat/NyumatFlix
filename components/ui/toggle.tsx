"use client";

import * as TogglePrimitive from "@radix-ui/react-toggle";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-all duration-200 backdrop-blur-md focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:border-primary/40 data-[state=on]:bg-primary/15 data-[state=on]:text-primary data-[state=off]:text-muted-foreground data-[state=on]:dark:border-white/30 data-[state=on]:dark:bg-white/15 data-[state=on]:dark:text-white",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-transparent shadow-none hover:bg-muted/50 data-[state=off]:hover:text-foreground dark:data-[state=off]:hover:bg-white/10 dark:data-[state=off]:hover:text-white",
        outline:
          "border border-border/80 bg-background/50 shadow-md hover:bg-muted/60 data-[state=off]:text-foreground dark:border-white/25 dark:bg-white/5 dark:data-[state=off]:text-white dark:hover:bg-white/5",
      },
      size: {
        default: "h-10 px-3",
        sm: "h-9 px-2.5",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Toggle = React.forwardRef<
  React.ElementRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> &
    VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(toggleVariants({ variant, size, className }))}
    {...props}
  />
));

Toggle.displayName = TogglePrimitive.Root.displayName;

export { Toggle, toggleVariants };
