import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

/**
 * Controlled password input with a toggle button to show or hide the value.
 * Renders an Eye / EyeOff icon button on the right side of the field.
 * The `type` prop is managed internally and cannot be overridden.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const t = useTranslation();
    const [visible, setVisible] = React.useState(false);

    const toggle = (): void => {
      setVisible((v) => !v);
    };

    return (
      <div className="relative flex items-center">
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn(
            "flex h-10 w-full rounded border border-surface-border bg-surface-elevated px-3 py-2 pr-10 text-sm text-content-primary placeholder:text-content-subtle transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={toggle}
          tabIndex={-1}
          aria-label={visible ? t.common.hidePassword : t.common.showPassword}
          className="absolute right-2.5 flex items-center justify-center text-content-subtle transition-colors hover:text-content-primary focus-visible:outline-none"
          disabled={props.disabled}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
export type { PasswordInputProps };
