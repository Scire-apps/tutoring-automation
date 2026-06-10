import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create your account" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Join your school or club's tutoring program."
      footer={
        <div className="space-y-1">
          <p>
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-blue-600 underline-offset-4 hover:underline"
            >
              Log in
            </Link>
          </p>
          <p>
            Are you a teacher or club exec?{" "}
            <Link
              href="/auth/register/manager"
              className="font-medium text-blue-600 underline-offset-4 hover:underline"
            >
              Register as a manager
            </Link>
          </p>
        </div>
      }
    >
      <RegisterForm kind="member" />
    </AuthShell>
  );
}
