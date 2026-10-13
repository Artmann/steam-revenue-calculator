import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent text-ink shadow-sm hover:bg-accent-strong",
        destructive: "bg-red-900 text-paper shadow-xs hover:bg-red-900/90",
        outline:
          "border border-rule-strong bg-transparent shadow-xs hover:bg-rule hover:text-paper",
        secondary: "bg-rule text-paper shadow-xs hover:bg-rule-strong",
        ghost: "hover:bg-rule hover:text-paper",
        link: "text-accent underline-offset-4 hover:text-accent-strong hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
