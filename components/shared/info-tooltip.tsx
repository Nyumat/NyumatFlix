"use client";

import type { TooltipContentProps } from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import * as React from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const InfoTooltip: React.FC<TooltipContentProps> = ({ ...props }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setOpen(false);
          }
        }}
      >
        <TooltipTrigger
          type="button"
          tabIndex={-1}
          onPointerEnter={() => setOpen(true)}
          onPointerLeave={() => setOpen(false)}
          onFocus={(event) => event.currentTarget.blur()}
          onClick={(event) => event.preventDefault()}
        >
          <Info className="size-4" />
        </TooltipTrigger>
        <TooltipContent
          onPointerEnter={() => setOpen(true)}
          onPointerLeave={() => setOpen(false)}
          {...props}
        />
      </Tooltip>
    </TooltipProvider>
  );
};
