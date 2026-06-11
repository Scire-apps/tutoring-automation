import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { VerifyEmailResend } from "@/components/auth/verify-email-resend";

export const metadata: Metadata = { title: "Check your email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; kind?: string }>;
}) {
  const { email, kind } = await searchParams;
  const isManager = kind === "manager";

  return (
    <AuthShell
      title="Check your email"
      subtitle={
        email ? (
          <>
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{email}</span>.
          </>
        ) : (
          "We sent you a confirmation link."
        )
      }
      footer={
        <p>
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-brand underline-offset-4 hover:underline"
          >
            Log in
          </Link>{" "}
          or{" "}
          <Link
            href="/auth/forgot-password"
            className="font-medium text-brand underline-offset-4 hover:underline"
          >
            reset your password
          </Link>
          .
        </p>
      }
    >
      <div className="space-y-5">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-subtle text-brand">
            <MailCheck aria-hidden className="h-7 w-7" />
          </div>
        </div>

        <p className="text-center text-sm leading-6 text-muted-foreground">
          {isManager ? (
            <>
              Click the link to confirm your email, then sign in. The Scire team
              activates your manager account for your organization — you&apos;ll
              see how to reach them after you sign in.
            </>
          ) : (
            <>
              Click the link to confirm your email, then sign in. A manager at
              your organization will admit your account so you can start
              requesting and giving tutoring.
            </>
          )}
        </p>

        <VerifyEmailResend email={email ?? null} />
      </div>
    </AuthShell>
  );
}
