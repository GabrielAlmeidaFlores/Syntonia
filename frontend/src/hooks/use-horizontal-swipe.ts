import * as React from "react";

interface UseHorizontalSwipeOptions {
  /** Direction that triggers the callback. */
  readonly direction: "left" | "right";
  /** Minimum horizontal distance in pixels before the callback fires. Defaults to 50. */
  readonly threshold?: number;
  /** When false, the hook attaches no listeners. Defaults to true. */
  readonly enabled?: boolean;
  /** Called once when a qualifying swipe is detected. */
  readonly onSwipe: () => void;
}

/**
 * Attaches pointer event listeners to a DOM element and calls `onSwipe` when
 * the user performs a horizontal drag past `threshold` in the given `direction`.
 *
 * Uses `setPointerCapture` so the gesture is tracked even when the pointer
 * moves outside the element. Calls `preventDefault` on `pointermove` only after
 * horizontal intent is confirmed, allowing vertical snap-scroll to proceed
 * uninterrupted when the gesture is primarily vertical.
 */
export function useHorizontalSwipe(
  ref: React.RefObject<HTMLElement | null>,
  {
    direction,
    threshold = 50,
    enabled = true,
    onSwipe,
  }: UseHorizontalSwipeOptions,
): void {
  const onSwipeRef = React.useRef(onSwipe);
  React.useEffect(() => {
    onSwipeRef.current = onSwipe;
  });

  React.useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (el === null) return;

    let startX = 0;
    let startY = 0;
    let active = false;
    let directionLocked = false;
    let horizontal = false;

    const onDown = (e: PointerEvent): void => {
      el.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      active = true;
      directionLocked = false;
      horizontal = false;
    };

    const onMove = (e: PointerEvent): void => {
      if (!active) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!directionLocked && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        directionLocked = true;
        horizontal = Math.abs(dx) > Math.abs(dy);

        if (!horizontal) {
          el.releasePointerCapture(e.pointerId);
          active = false;
          return;
        }
      }

      if (horizontal) {
        e.preventDefault();
      }
    };

    const onUp = (e: PointerEvent): void => {
      if (!active) return;
      active = false;
      directionLocked = false;
      const dx = e.clientX - startX;
      if (horizontal) {
        const triggered =
          direction === "left" ? dx < -threshold : dx > threshold;
        if (triggered) onSwipeRef.current();
      }
      horizontal = false;
    };

    const onCancel = (): void => {
      active = false;
      directionLocked = false;
      horizontal = false;
    };

    el.addEventListener("pointerdown", onDown, { passive: true });
    el.addEventListener("pointermove", onMove, { passive: false });
    el.addEventListener("pointerup", onUp, { passive: true });
    el.addEventListener("pointercancel", onCancel, { passive: true });

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
    };
  }, [ref, direction, threshold, enabled]);
}
