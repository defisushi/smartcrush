import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export function RosterDropdown<T extends string>({
  label,
  ariaLabel,
  value,
  options,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected =
    options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="roster-dropdown-field">
      <span>{label}</span>
      <div className="roster-dropdown" ref={rootRef}>
        <button
          type="button"
          className="roster-dropdown-trigger"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((current) => !current)}
        >
          <span>{selected.label}</span>
          <ChevronDown size={14} />
        </button>
        {open && (
          <div className="roster-dropdown-menu" id={menuId} role="listbox">
            {options.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {option.value === value && <Check size={13} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
