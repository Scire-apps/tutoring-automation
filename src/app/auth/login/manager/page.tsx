import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Manager sign in" };

export default function ManagerLoginPage() {
  return (
    <AuthShell
      title="Manager sign in"
      subtitle="Sign in to your organization's manager panel."
      badge={<Badge variant="secondary">Manager</Badge>}
      footer={
        <div className="space-y-1">
          <p>
            Need a manager account?{" "}
            <Link
              href="/auth/register/manager"
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              Register as a manager
            </Link>
          </p>
          <p>
            <Link
              href="/auth/login"
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              Member sign in →
            </Link>
          </p>
        </div>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
