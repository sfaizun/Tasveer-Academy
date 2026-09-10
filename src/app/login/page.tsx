"use client";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { signIn } from "./actions";
import ThemeToggle from "@/components/ThemeToggle";
import Req from "@/components/Req";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [state, action, pending] = useActionState(signIn, null);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label className="lbl" htmlFor="email">Email<Req /></label>
        <input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </div>
      <div className="field">
        <label className="lbl" htmlFor="password">Password<Req /></label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error && (
        <div
          role="alert"
          style={{
            background: "var(--crit-soft)", color: "var(--crit)",
            border: "1px solid var(--crit-soft)", borderRadius: 7,
            padding: "10px 12px", fontSize: 13,
          }}
        >
          {state.error}
        </div>
      )}
      <button className="btn" type="submit" disabled={pending} style={{ justifyContent: "center", padding: "11px 15px" }}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh", display: "grid", placeItems: "center",
        padding: 24, background: "var(--ground)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 396 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 26 }}>
          <div className="mark" style={{ width: 40, height: 40, flex: "0 0 40px", fontSize: 14 }}>TA</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.01em" }}>
              Tasveer Academy
            </div>
            <div className="lbl">Portal</div>
          </div>
          <div className="spacer" />
          <ThemeToggle />
        </div>

        <div className="panel" style={{ padding: 26 }}>
          <h1 style={{ fontSize: 19, marginBottom: 4 }}>Sign in</h1>
          <p className="sub" style={{ marginTop: 0, marginBottom: 22 }}>
            Admin, teacher and student accounts all sign in here.
          </p>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="sub" style={{ textAlign: "center", marginTop: 18 }}>
          New here?{" "}
          <a href="/apply" style={{ fontWeight: 600 }}>
            Apply for admission
          </a>
        </p>

        <p className="sub" style={{ textAlign: "center", marginTop: 10 }}>
          105/A (2nd &amp; 3rd Floor), Kakrail, Dhaka 1000
        </p>
      </div>
    </main>
  );
}
