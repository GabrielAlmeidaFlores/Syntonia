import * as React from "react";

/**
 * Adds mouse-wheel and keyboard navigation to a CSS snap-scroll container.
 *
 * On desktop, `scroll-snap-type: mandatory` reverts to the current snap point
 * when the wheel delta is too small. This hook intercepts `wheel` and `keydown`
 * events and programmatically scrolls to the exact next/previous card offset,
 * bypassing the snap revert entirely.
 *
 * Keyboard: ArrowDown / Space / PageDown → next card.
 *           ArrowUp / PageUp             → previous card.
 */
export function useSnapNavigation(
  containerRef: React.RefObject<HTMLDivElement | null>,
): void {
  const isAnimatingRef = React.useRef(false);
  const isLockedRef = React.useRef(false);

  React.useEffect(() => {
    const el = containerRef.current;
    if (el === null) return;

    let animationTimer: ReturnType<typeof setTimeout> | null = null;

    const scrollToCard = (direction: "next" | "prev"): void => {
      if (isAnimatingRef.current || isLockedRef.current) return;

      const cardHeight = el.clientHeight;
      if (cardHeight === 0) return;

      const currentCardIndex = Math.round(el.scrollTop / cardHeight);
      const rawTarget =
        direction === "next" ? currentCardIndex + 1 : currentCardIndex - 1;
      const maxIndex = Math.max(
        0,
        Math.round(el.scrollHeight / cardHeight) - 1,
      );
      const targetIndex = Math.max(0, Math.min(rawTarget, maxIndex));

      if (targetIndex === currentCardIndex) return;

      isAnimatingRef.current = true;
      el.scrollTo({ top: targetIndex * cardHeight, behavior: "smooth" });

      animationTimer = setTimeout(() => {
        isAnimatingRef.current = false;
      }, 700);
    };

    const syncLock = (): void => {
      isLockedRef.current = el.style.overflowY === "hidden";
    };

    const onWheel = (e: WheelEvent): void => {
      syncLock();
      if (isLockedRef.current) return;
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      if (e.deltaY > 0) scrollToCard("next");
      else scrollToCard("prev");
    };

    const onKeyDown = (e: KeyboardEvent): void => {
      syncLock();
      if (isLockedRef.current) return;
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        scrollToCard("next");
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        scrollToCard("prev");
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("keydown", onKeyDown);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("keydown", onKeyDown);
      if (animationTimer !== null) clearTimeout(animationTimer);
      isAnimatingRef.current = false;
      isLockedRef.current = false;
    };
  }, [containerRef]);
}
