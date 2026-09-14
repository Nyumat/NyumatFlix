import { cn } from "@/lib/utils";

/** Underlined row-header selects (genre, provider, because-you-watched seed). */
export const contentRowSelectTriggerClassName = (large = false) =>
  cn(
    "h-auto w-fit max-w-full shrink-0 gap-1.5 rounded-none border-0 border-b-2 border-pink-500/35 bg-transparent px-0 py-0 pb-1 font-semibold text-foreground shadow-none ring-offset-0 transition-[color,border-color] hover:border-pink-500/60 focus:ring-0 focus:ring-offset-0 data-[placeholder]:text-foreground data-[state=open]:border-pink-500 dark:border-pink-500/45 dark:bg-transparent dark:hover:border-pink-500/75 dark:data-[state=open]:border-pink-500 [&>svg]:shrink-0 [&>svg]:text-muted-foreground [&>svg]:opacity-70 [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180",
    large
      ? "text-2xl md:text-3xl [&>svg]:size-5"
      : "text-lg md:text-xl [&>svg]:size-4",
    "[&>span]:line-clamp-none [&>span]:overflow-visible [&>span]:whitespace-nowrap [&>span]:text-left",
  );

/** Movies / Series tab underline on catalog and provider rows. */
export const contentRowTabIndicatorClassName = "bg-pink-500";
