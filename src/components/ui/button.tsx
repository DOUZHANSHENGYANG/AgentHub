import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover",
        secondary: "border border-border bg-surface text-foreground hover:bg-surface-2 hover:border-border-strong",
        ghost: "text-ink-2 hover:bg-surface-2 hover:text-foreground",
        outline: "border border-border bg-transparent text-foreground hover:bg-surface-2",
        destructive: "bg-danger text-white shadow-sm hover:opacity-90",
        glow: "bg-primary text-primary-foreground shadow-glow hover:bg-primary-hover",
      },
      size: {
        sm: "h-8 rounded-lg px-3 text-xs",
        md: "h-9 rounded-lg px-4 text-sm",
        lg: "h-10 rounded-xl px-5 text-sm",
        icon: "h-9 w-9 rounded-lg",
        iconSm: "h-7 w-7 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
