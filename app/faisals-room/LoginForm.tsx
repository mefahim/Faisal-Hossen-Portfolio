"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setBusy(true);
    try {
      const response = await fetch("/api/faisals-room/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to sign in.");
      router.replace("/faisals-room"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }
  return <form className="room-login-form" onSubmit={submit}>
    <label htmlFor="owner-email">Owner email</label>
    <input id="owner-email" name="email" type="email" autoComplete="username" required maxLength={240} value={email} onChange={(event) => setEmail(event.target.value)} />
    <label htmlFor="owner-password">Password</label>
    <input id="owner-password" name="password" type="password" autoComplete="current-password" required maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} />
    <button type="submit" className="room-button room-button-primary" disabled={busy}>{busy ? <LoaderCircle className="room-spin" size={17} /> : <LockKeyhole size={17} />}<span>{busy ? "Checking access…" : "Sign in"}</span><ArrowRight aria-hidden="true" size={16} /></button>
    <p className="room-form-status" role="status" aria-live="polite">{message}</p>
  </form>;
}
