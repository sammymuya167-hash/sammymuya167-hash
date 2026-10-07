"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Plus, X, Eye, EyeOff, ShieldCheck, Trash2 } from "lucide-react";
import type { Assertion, Environment, Pair } from "../lib/lab";
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current
      ?.querySelector<HTMLElement>("button, input, textarea, select")
      ?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <dialog
        open
        aria-modal="true"
        aria-label={title}
        ref={ref}
        className={`modal ${wide ? "wide-modal" : ""}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
          if (e.key === "Tab") {
            const targets = Array.from(
                ref.current?.querySelectorAll<HTMLElement>(
                  "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href]",
                ) ?? [],
              ),
              first = targets[0],
              last = targets[targets.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </dialog>
    </div>
  );
}
export function PairEditor({
  rows,
  onChange,
}: {
  rows: Pair[];
  onChange: (rows: Pair[]) => void;
}) {
  const change = (id: string, fields: Partial<Pair>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...fields } : row)));
  return (
    <div className="headers-editor">
      <div className="pair-table-heading with-check">
        <span />
        <span>KEY</span>
        <span>VALUE</span>
        <span />
      </div>
      {rows.map((row, index) => (
        <div className="header-row" key={row.id}>
          <input
            type="checkbox"
            checked={row.enabled}
            aria-label={`Enable header ${index + 1}`}
            onChange={(e) => change(row.id, { enabled: e.target.checked })}
          />
          <input
            placeholder="Header name"
            aria-label={`Header ${index + 1} name`}
            value={row.key}
            onChange={(e) => change(row.id, { key: e.target.value })}
          />
          <input
            placeholder="Value or {{variable}}"
            aria-label={`Header ${index + 1} value`}
            value={row.value}
            onChange={(e) => change(row.id, { value: e.target.value })}
          />
          <button
            className="icon-button"
            onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
            aria-label={`Remove header ${index + 1}`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        className="add-row"
        disabled={rows.length >= 24}
        onClick={() =>
          onChange([
            ...rows,
            { id: crypto.randomUUID(), key: "", value: "", enabled: true },
          ])
        }
      >
        <Plus size={14} />
        Add header
      </button>
      <p className="editor-hint">
        Authorization and credential header values are cleared when saved or
        exported. Use a secret variable for tokens.
      </p>
    </div>
  );
}
export function AssertionsEditor({
  assertions,
  onChange,
}: {
  assertions: Assertion[];
  onChange: (assertions: Assertion[]) => void;
}) {
  const update = (id: string, patch: Partial<Assertion>) =>
    onChange(assertions.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  return (
    <div className="assertions-editor">
      {assertions.map((a, index) => (
        <div className="assertion-editor-row" key={a.id}>
          <span className="assertion-number">
            {String(index + 1).padStart(2, "0")}
          </span>
          <select
            aria-label={`Assertion ${index + 1} type`}
            value={a.kind}
            onChange={(e) =>
              update(a.id, { kind: e.target.value as Assertion["kind"] })
            }
          >
            <option value="status">Status equals</option>
            <option value="json">JSON value equals</option>
            <option value="exists">JSON field exists</option>
            <option value="header">Header contains</option>
            <option value="time">Time below (ms)</option>
          </select>
          {["json", "exists", "header"].includes(a.kind) && (
            <input
              aria-label={`Assertion ${index + 1} path`}
              value={a.path}
              placeholder={
                a.kind === "header" ? "content-type" : "products.0.id"
              }
              onChange={(e) => update(a.id, { path: e.target.value })}
            />
          )}
          {a.kind !== "exists" && (
            <input
              aria-label={`Assertion ${index + 1} expected value`}
              value={a.expected}
              placeholder={
                a.kind === "status"
                  ? "200"
                  : a.kind === "time"
                    ? "1500"
                    : "Expected value"
              }
              onChange={(e) => update(a.id, { expected: e.target.value })}
            />
          )}
          <button
            className="icon-button"
            aria-label={`Remove assertion ${index + 1}`}
            onClick={() =>
              onChange(assertions.filter((item) => item.id !== a.id))
            }
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        className="add-row"
        disabled={assertions.length >= 20}
        onClick={() =>
          onChange([
            ...assertions,
            {
              id: crypto.randomUUID(),
              kind: "status",
              path: "",
              expected: "200",
            },
          ])
        }
      >
        <Plus size={14} />
        Add assertion
      </button>
      <p className="editor-hint">
        JSON expectations accept strings, numbers, booleans, null, arrays, and
        objects. Dotted paths and JSON Pointer are supported.
      </p>
    </div>
  );
}
export function JsonResponse({ body }: { body: string }) {
  let formatted = body;
  try {
    formatted = JSON.stringify(JSON.parse(body), null, 2);
  } catch {}
  const lines = formatted.split("\n");
  return (
    <div className="json-response" tabIndex={0} aria-label="Response body">
      {lines.slice(0, 2500).map((line, index) => (
        <div className="code-line" key={index}>
          <span className="line-number">{index + 1}</span>
          <code>
            {line
              .split(
                /("(?:[^"\\]|\\.)*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b)/g,
              )
              .map((part, i) => (
                <span
                  key={i}
                  className={
                    part.startsWith('"')
                      ? line
                          .slice(line.indexOf(part) + part.length)
                          .trimStart()
                          .startsWith(":")
                        ? "json-key"
                        : "json-string"
                      : /^(true|false|null)$/.test(part)
                        ? "json-boolean"
                        : /^-?\d/.test(part)
                          ? "json-number"
                          : undefined
                  }
                >
                  {part}
                </span>
              ))}
          </code>
        </div>
      ))}
      {lines.length > 2500 && (
        <p className="editor-hint">
          Showing the first 2,500 lines. Copy body to get the full response.
        </p>
      )}
    </div>
  );
}
export function EnvironmentEditor({
  environments,
  onChange,
  onClose,
}: {
  environments: Environment[];
  onChange: (environments: Environment[]) => void;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(environments[0]?.id ?? ""),
    [visible, setVisible] = useState(false),
    [error, setError] = useState("");
  const environment =
    environments.find((e) => e.id === selectedId) ?? environments[0];
  const patch = (values: Partial<Environment>) => {
    if (environment)
      onChange(
        environments.map((e) =>
          e.id === environment.id ? { ...e, ...values } : e,
        ),
      );
  };
  return (
    <Modal title="The right context for every request" onClose={onClose} wide>
      <div className="environment-panel">
        <div className="environment-list">
          {environments.map((e) => (
            <button
              key={e.id}
              className={environment?.id === e.id ? "selected" : ""}
              onClick={() => setSelectedId(e.id)}
            >
              {e.name}
            </button>
          ))}
          <button
            disabled={environments.length >= 10}
            onClick={() => {
              const id = crypto.randomUUID();
              onChange([
                ...environments,
                { id, name: "New environment", variables: [] },
              ]);
              setSelectedId(id);
            }}
          >
            <Plus size={13} />
            New environment
          </button>
        </div>
        <div className="environment-form">
          {environment ? (
            <>
              <label>
                Environment name
                <input
                  value={environment.name}
                  maxLength={60}
                  onChange={(e) => patch({ name: e.target.value })}
                />
              </label>
              <div className="environment-form-heading">
                <span>VARIABLES</span>
                <button
                  className="icon-button"
                  onClick={() => setVisible(!visible)}
                  aria-label={
                    visible ? "Hide secret values" : "Show secret values"
                  }
                >
                  {visible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {environment.variables.map((v, index) => (
                <div className="variable-row" key={v.id}>
                  <input
                    aria-label={`Variable ${index + 1} name`}
                    placeholder="variable_name"
                    value={v.key}
                    onChange={(e) =>
                      patch({
                        variables: environment.variables.map((item) =>
                          item.id === v.id
                            ? { ...item, key: e.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                  <input
                    aria-label={`Variable ${index + 1} value`}
                    type={v.secret && !visible ? "password" : "text"}
                    placeholder={v.secret ? "Session-only secret" : "Value"}
                    value={v.value}
                    onChange={(e) =>
                      patch({
                        variables: environment.variables.map((item) =>
                          item.id === v.id
                            ? { ...item, value: e.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                  <label className="secret-toggle">
                    <input
                      type="checkbox"
                      checked={v.secret}
                      onChange={(e) =>
                        patch({
                          variables: environment.variables.map((item) =>
                            item.id === v.id
                              ? { ...item, secret: e.target.checked }
                              : item,
                          ),
                        })
                      }
                    />
                    Secret
                  </label>
                  <button
                    className="icon-button"
                    onClick={() =>
                      patch({
                        variables: environment.variables.filter(
                          (item) => item.id !== v.id,
                        ),
                      })
                    }
                    aria-label={`Delete variable ${v.key}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button
                className="add-row"
                disabled={environment.variables.length >= 24}
                onClick={() => {
                  let number = environment.variables.length + 1;
                  while (
                    environment.variables.some(
                      (v) => v.key === `variable_${number}`,
                    )
                  )
                    number++;
                  patch({
                    variables: [
                      ...environment.variables,
                      {
                        id: crypto.randomUUID(),
                        key: `variable_${number}`,
                        value: "",
                        secret: false,
                      },
                    ],
                  });
                }}
              >
                <Plus size={14} />
                Add variable
              </button>
              <p className="privacy-note">
                <ShieldCheck size={14} />
                Secret values are never saved or exported. {"{{origin}}"} is
                built in.
              </p>
              <button
                className="send-button"
                onClick={() => {
                  const invalid = environments.some(
                    (e) =>
                      !e.name.trim() ||
                      e.variables.some(
                        (v) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(v.key),
                      ) ||
                      new Set(e.variables.map((v) => v.key)).size !==
                        e.variables.length,
                  );
                  if (invalid)
                    setError(
                      "Use a name for each environment and unique variable names containing letters, digits, or underscores.",
                    );
                  else onClose();
                }}
              >
                Done
              </button>
              {error && <p className="form-error">{error}</p>}
            </>
          ) : (
            <p>Add an environment to get started.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
