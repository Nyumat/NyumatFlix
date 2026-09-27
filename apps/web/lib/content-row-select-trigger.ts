import { cn } from "@/lib/utils";

/** Underlined row-header selects (genre, provider, because-you-watched seed). */
export const contentRowSelectTriggerClassName = (
  large = false,
  underline = false,
) =>
  cn(
    "h-auto w-fit max-w-full shrink-0 gap-1.5 rounded-none border-0 bg-transparent px-0 py-0 font-semibold text-foreground shadow-none ring-offset-0 focus:ring-0 focus:ring-offset-0 data-[placeholder]:text-foreground dark:bg-transparent",
    underline &&
      "border-b-2 border-pink-500/35 pb-1 transition-[border-color] hover:border-pink-500/60 data-[state=open]:border-pink-500 dark:border-pink-500/45 dark:hover:border-pink-500/75 dark:data-[state=open]:border-pink-500",
    "[&>svg]:shrink-0 [&>svg]:text-muted-foreground [&>svg]:opacity-70 [&>svg]:transition-[color,transform] hover:[&>svg]:text-pink-500 hover:[&>svg]:opacity-100 data-[state=open]:[&>svg]:rotate-180",
    large
      ? "text-2xl md:text-3xl [&>svg]:size-5"
      : "text-lg md:text-xl [&>svg]:size-4",
    "[&>span]:line-clamp-none [&>span]:overflow-visible [&>span]:whitespace-nowrap [&>span]:text-left",
  );

/** Movies / Series tab underline on catalog and provider rows. */
export const contentRowTabIndicatorClassName = "bg-pink-500";
