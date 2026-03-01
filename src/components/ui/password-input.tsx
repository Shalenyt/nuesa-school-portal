import * as React from "react"
import { cn } from "@/lib/utils"
import { Eye, EyeOff } from "lucide-react"

const PasswordInput = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<"input">, "type">>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    const show = () => setVisible(true);
    const hide = () => setVisible(false);

    return (
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className
          )}
          ref={ref}
          {...props}
        />
        <button
          type="button"
          className="absolute right-0 top-0 h-full px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
          onMouseDown={show}
          onMouseUp={hide}
          onMouseLeave={hide}
          onTouchStart={show}
          onTouchEnd={hide}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    )
  }
)
PasswordInput.displayName = "PasswordInput"

export { PasswordInput }
