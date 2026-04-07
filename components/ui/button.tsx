import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 backdrop-blur-md",
  {
    variants: {
      variant: {
        icon: "size-10 rounded-full shadow-md border border-border/70 bg-muted/50 text-foreground hover:bg-muted/75 hover:shadow-lg dark:border-white/30 dark:bg-white/10 dark:text-white dark:hover:bg-white/20",
        stylish:
          "bg-gradient-to-r from-[#D247BF]/20 to-primary/20 text-foreground border border-primary/25 backdrop-blur-sm hover:from-[#D247BF]/30 hover:to-primary/30 hover:border-primary/40 transition-all duration-300 dark:text-white dark:border-white/20",
        default:
          "font-semibold shadow-lg border border-primary/30 bg-primary/12 text-primary hover:bg-primary/22 hover:border-primary/45 hover:shadow-xl dark:border-white/30 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:border-white/45",
        destructive:
          "shadow-lg border border-destructive/80 bg-destructive/90 text-destructive-foreground hover:bg-destructive hover:shadow-xl",
        outline:
          "shadow-md border border-border/80 bg-background/50 text-foreground hover:bg-muted/60 hover:border-border hover:shadow-lg dark:border-white/25 dark:bg-white/5 dark:text-white dark:hover:bg-white/15 dark:hover:border-white/40",
        secondary:
          "shadow-md border border-border/60 bg-secondary/35 text-secondary-foreground hover:bg-secondary/55 hover:shadow-lg dark:bg-white/10 dark:border-white/25 dark:text-white dark:hover:bg-white/18",
        ghost:
          "border border-transparent bg-transparent shadow-none backdrop-blur-sm text-foreground hover:bg-muted/50 hover:border-border/60 hover:shadow-md dark:text-white dark:hover:bg-white/10 dark:hover:border-white/25",
        link: "border-transparent bg-transparent shadow-none backdrop-blur-none text-primary underline-offset-4 hover:underline dark:text-primary",
        chrome:
          "font-semibold shadow-lg group/arrow border border-border/80 bg-background/50 text-foreground hover:bg-muted/65 hover:border-border hover:shadow-xl dark:border-white/30 dark:bg-white/10 dark:text-white dark:hover:bg-white/20 dark:hover:border-white/40",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
