import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Manager registration" };

export default function ManagerRegisterPage() {
  return (
    <AuthShell
      title="Create your manager account"
      subtitle="For teachers and club execs who run a tutoring program."
      badge={<Badge variant="secondary">Manager registration</Badge>}
      footer={
        <div className="space-y-1">
          <p>
            Already a manager?{" "}
            <Link
              href="/auth/login/manager"
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              Manager sign in
            </Link>
          </p>
          <p>
            Looking to get tutored or tutor?{" "}
            <Link
              href="/auth/register"
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              Create a member account
            </Link>
          </p>
        </div>
      }
    >
      <Alert className="mb-4">
        <AlertDescription>
          Manager accounts are activated by the Scire team after email
          verification. Once you verify and sign in, you&apos;ll see how to get
          your account activated for your organization.
        </AlertDescription>
      </Alert>
      <RegisterForm kind="manager" />
    </AuthShell>
  );
}
