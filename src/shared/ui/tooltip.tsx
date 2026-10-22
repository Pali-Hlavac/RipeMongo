import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

/** Delay before a tooltip appears, in milliseconds. */
const TOOLTIP_DELAY_MS = 400;

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={TOOLTIP_DELAY_MS}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

type TooltipProps = Omit<ComponentProps<typeof TooltipPrimitive.Content>, "content"> & {
  content: ReactNode;
  children: ReactNode;
};

/** Wraps a focusable child and shows `content` on hover/focus. */
export function Tooltip({ content, children, className, sideOffset = 4, ...props }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={sideOffset}
          className={cn(
            "z-50 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow",
            className,
          )}
          {...props}
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
