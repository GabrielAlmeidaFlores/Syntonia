import * as ToastPrimitive from '@radix-ui/react-toast';
import { CheckCircle, Info, TriangleAlert, XCircle } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';
import { useToastStore, type ToastType } from '@/stores/toast';

function toastIcon(type: ToastType): React.JSX.Element {
  switch (type) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-400" aria-hidden />;
    case 'error':
      return <XCircle className="h-4 w-4 text-red-400" aria-hidden />;
    case 'warning':
      return <TriangleAlert className="h-4 w-4 text-amber-400" aria-hidden />;
    case 'info':
      return <Info className="h-4 w-4 text-blue-400" aria-hidden />;
  }
}

function ToastItem({
  id,
  type,
  message,
  duration = 4000,
}: {
  readonly id: string;
  readonly type: ToastType;
  readonly message: string;
  readonly duration?: number;
}): React.JSX.Element {
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <ToastPrimitive.Root
      duration={duration}
      onOpenChange={(open) => {
        if (!open) removeToast(id);
      }}
      className={cn(
        'flex items-center gap-3 rounded-xl border border-surface-border bg-surface-card px-4 py-3 shadow-card',
        'data-[state=open]:animate-toast-in data-[state=closed]:animate-toast-out',
      )}
    >
      {toastIcon(type)}
      <ToastPrimitive.Description className="text-sm text-gray-200">
        {message}
      </ToastPrimitive.Description>
    </ToastPrimitive.Root>
  );
}

/** Renders all active toasts from the toast store. */
export function ToastContainer(): React.JSX.Element {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <>
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </>
  );
}

/** Fixed viewport anchor where toast notifications are positioned. */
export function ToastViewport(): React.JSX.Element {
  return (
    <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2" />
  );
}
