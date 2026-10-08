import { redirect } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { getOwnerSession } from "@/lib/server/auth";
import { getConfig } from "@/lib/server/config";
import { LoginForm } from "../LoginForm";

export default async function LoginPage() {
  let owner = null;
  try { owner = await getOwnerSession(); } catch { /* Sign-in stays unavailable until database setup is complete. */ }
  if (owner) redirect("/faisals-room");
  const configured = Boolean(getConfig().DATABASE_URL && getConfig().APP_SECURITY_SECRET);
  return <main className="room-login-page"><section className="room-login-card">
    <div className="room-login-mark"><LockKeyhole size={21} /></div>
    <p className="room-eyebrow">Faisal’s Room / private access</p><h1>Welcome back.</h1><p className="room-login-copy">A private, single-owner space for maintaining the public website.</p>
    {configured ? <LoginForm /> : <div className="room-alert room-alert-warning"><ShieldCheck size={17} /><span>Private access is not configured yet. Set the database and security secret, run the migration and one-time owner bootstrap commands, then sign in here.</span></div>}
    <p className="room-login-footnote">The public website remains available at <a href="/">faisalhossen.com</a>.</p>
  </section></main>;
}
