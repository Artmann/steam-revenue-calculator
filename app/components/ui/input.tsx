import * as React from "react"

import { cn } from "~/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex w-full border-b border-rule-strong bg-transparent py-1 text-paper transition-colors placeholder:text-paper-dim focus:border-accent focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
        // Native number spinners render as light-themed widgets; hide them.
        "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        className
      )}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }
