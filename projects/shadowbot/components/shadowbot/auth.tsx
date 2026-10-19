"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { Modal } from "./ui";
import { api } from "../../lib/api-client";
export function Auth({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [signup, setSignup] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/" + (signup ? "signup" : "login"), "POST", {
        name: d.get("name"),
        email: d.get("email"),
        password: d.get("password"),
      });
      await onSuccess();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="A little more you. A lot more possible." onClose={onClose}>
      <div className="auth-copy">
        <span className="eyebrow">YOUR SHADOWBOT WORKSPACE</span>
        <h2>
          {signup ? "Make room for your ideas." : "Good to have you back."}
        </h2>
        <p className="muted">
          Create assistants, bring your knowledge, and pick up every
          conversation where you left off.
        </p>
      </div>
      <form className="form" onSubmit={submit}>
        {signup && (
          <label>
            Your name
            <input
              name="name"
              autoComplete="name"
              maxLength={60}
              placeholder="What should we call you?"
              required
              disabled={busy}
            />
          </label>
        )}
        <label>
          Email address
          <span className="input-icon">
            <Mail size={16} />
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              placeholder="you@example.com"
              required
              disabled={busy}
            />
          </span>
        </label>
        <label>
          Password
          <span className="input-icon">
            <LockKeyhole size={16} />
            <input
              name="password"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={signup ? 12 : 1}
              maxLength={128}
              placeholder={signup ? "At least 12 characters" : "Your password"}
              required
              disabled={busy}
            />
          </span>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          {busy ? "One moment…" : signup ? "Create your account" : "Sign in"}
          <ArrowRight size={16} />
        </button>
      </form>
      <p className="auth-toggle">
        {signup ? "Already have an account?" : "New around here?"}{" "}
        <button
          onClick={() => {
            setSignup(!signup);
            setError("");
          }}
          disabled={busy}
        >
          {signup ? "Sign in" : "Create an account"}
        </button>
      </p>
      <div className="privacy-note">
        <LockKeyhole size={15} />
        <p>
          Your history is private to your account. Messages and relevant
          knowledge are sent to the AI provider. This v1 has no email
          verification or password recovery—keep your password somewhere safe.
        </p>
      </div>
    </Modal>
  );
}
