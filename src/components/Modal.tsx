import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
export function Modal({
  title,
  onClose,
  children,
  className = "",
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const dialog = useRef<HTMLDivElement>(null),
    id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const items = dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input, [tabindex="0"]',
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === dialog.current)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        ref={dialog}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="icon-button modal-close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        <h2 id={id}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
