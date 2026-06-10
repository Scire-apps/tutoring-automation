"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { BRAND } from "@/lib/brand";
import { useAuth } from "@/app/providers";
import { AccountStatusCard } from "@/components/account-status-card";
import { Button } from "@/components/ui/button";

/**
 * The manager-suspended gate (§5.2). Shown by the panel layout when an active
 * manager's account has been suspended (admin-only action). Exact copy:
 * "Your Manager account for [Org] has been suspended. Contact contact@tutoringapp.ca."
 * The sole escape is Sign out.
 */
export function ManagerSuspendedCard({ orgName }: { orgName: string | null }) {
  const router = useRouter();
  const { signOut } = useAuth();
  const org = orgName ?? "your organization";

  async function handleSignOut() {
    await signOut();
    router.push("/auth/login");
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <AccountStatusCard
        icon={ShieldAlert}
        tone="amber"
        heading="Your account is suspended"
        body={
          <p>
            Your Manager account for {org} has been suspended. Contact{" "}
            <a
              href={`mailto:${BRAND.contactEmail}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {BRAND.contactEmail}
            </a>
            .
          </p>
        }
        actions={
          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
        }
      />
    </div>
  );
}
