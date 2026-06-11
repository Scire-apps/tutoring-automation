import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Log in"
      subtitle="Welcome back to Scire."
      footer={
        <div className="space-y-1">
          <p>
            New to Scire?{" "}
            <Link
              href="/auth/register"
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </p>
          <p>
            <Link
              href="/auth/login/manager"
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              Manager sign in →
            </Link>
          </p>
        </div>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
