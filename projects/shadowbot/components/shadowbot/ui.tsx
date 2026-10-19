"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Bot, X, Sparkles } from "lucide-react";
export function Avatar({
  color = "purple",
  large = false,
}: {
  color?: string;
  large?: boolean;
}) {
  return (
    <span className={`bot-avatar ${color} ${large ? "large" : ""}`}>
      <Bot size={large ? 30 : 22} strokeWidth={1.6} />
      <i />
    </span>
  );
}
export function Brand() {
  return (
    <a className="brand" href="/" aria-label="ShadowBot home">
      <span className="brand-mark">
        <Bot size={24} strokeWidth={1.7} />
        <i />
      </span>
      <span>
        Shadow<span className="brand-light">Bot</span>
        <small>BY SHADOWNET</small>
      </span>
    </a>
  );
}
export function Modal({
  children,
  title,
  onClose,
  wide = false,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const list = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]',
        );
        if (!list?.length) return;
        const first = list[0],
          last = list[list.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
      >
        <div className="modal-heading">
          <span>
            <Sparkles size={17} />
            {title}
          </span>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Text({ content }: { content: string }) {
  return (
    <div className="message-text">
      {content.split(/(```[\s\S]*?```)/g).map((part, i) =>
        part.startsWith("```") ? (
          <pre key={i}>
            <code>{part.replace(/^```[^\n]*\n?/, "").replace(/```$/, "")}</code>
          </pre>
        ) : (
          <span key={i}>
            {part
              .split(/(\*\*[^*]+\*\*|`[^`\n]+`)/g)
              .map((p, j) =>
                p.startsWith("**") ? (
                  <strong key={j}>{p.slice(2, -2)}</strong>
                ) : p.startsWith("`") ? (
                  <code key={j}>{p.slice(1, -1)}</code>
                ) : (
                  p
                ),
              )}
          </span>
        ),
      )}
    </div>
  );
}
