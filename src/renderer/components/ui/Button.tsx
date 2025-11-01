import * as React from "react";
import { cn } from "../../lib/cn";

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center rounded-2xl px-4 py-2 text-sm font-medium",
      "bg-primary text-primary-foreground shadow transition-colors",
      "hover:opacity-90 disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Button.displayName = "Button";
