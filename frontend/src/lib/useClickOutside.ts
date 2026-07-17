import * as React from "react";

/** Calls `onOutside` on a pointerdown outside `ref`'s element, or on Escape
 * — the standard way to close a hand-rolled dropdown/popover. Only listens
 * while `active` is true, so closed panels don't pay for a global listener. */
export function useClickOutside<T extends HTMLElement>(active: boolean, onOutside: () => void) {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    if (!active) return;

    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onOutside();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [active, onOutside]);

  return ref;
}
