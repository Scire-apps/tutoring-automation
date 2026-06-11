"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Track = "learning" | "tutoring";

type Step = { icon: LucideIcon; title: string; body: string };

const LEARNING_STEPS: Step[] = [
  {
    icon: HelpCircle,
    title: "Post a request",
    body: "Go to Get Help, pick the subject you need, say whether you'd meet online or in person, and describe what you're stuck on.",
  },
  {
    icon: CalendarCheck,
    title: "Set your availability",
    body: "Once a tutor claims your request, choose how long you need and drag to mark the times you're free over the next two weeks.",
  },
  {
    icon: BookOpen,
    title: "Meet your tutor",
    body: "Your tutor picks a time inside your availability. You'll get an email with the details and a reminder the day before.",
  },
  {
    icon: CheckCircle2,
    title: "You're done",
    body: "After the session your tutor logs it and a manager verifies it. No paperwork for you — just show up and learn.",
  },
];

const TUTORING_STEPS: Step[] = [
  {
    icon: GraduationCap,
    title: "Get approved for a subject",
    body: "Open Approvals and request the subjects you can teach. Add evidence — a grade, score, or relevant experience — and a manager reviews it.",
  },
  {
    icon: ClipboardList,
    title: "Claim a request",
    body: "Browse the Tutoring Board and claim any open request in a subject you're approved for. Be quick — anyone approved can claim it.",
  },
  {
    icon: CalendarCheck,
    title: "Schedule and meet",
    body: "When the learner sets their availability, pick a time that fits. Meet them online or in person at the agreed time.",
  },
  {
    icon: CheckCircle2,
    title: "Log it and earn hours",
    body: "Add the recording link, mark the session complete, and a manager verifies it to award your volunteer hours.",
  },
];

export default function MemberTutorialPage() {
  const [track, setTrack] = useState<Track>("learning");
  const steps = track === "learning" ? LEARNING_STEPS : TUTORING_STEPS;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-1 font-display text-2xl font-bold tracking-tight">How it works</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        One account, two ways to take part — get help with your own work, and tutor the
        subjects you&apos;re approved for.
      </p>

      {/* Track switch */}
      <div
        role="tablist"
        aria-label="Tutorial track"
        className="mb-6 inline-flex w-full rounded-lg border border-input bg-muted/40 p-1"
      >
        {(
          [
            { value: "learning", label: "Getting help" },
            { value: "tutoring", label: "Tutoring others" },
          ] as const
        ).map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={track === t.value}
            onClick={() => setTrack(t.value)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              track === t.value
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={step.title}>
            <Card>
              <CardContent className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
                  <step.icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-display font-medium tracking-tight text-foreground">
                    {i + 1}. {step.title}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-wrap gap-3">
        {track === "learning" ? (
          <Button asChild>
            <Link href="/member/request">Get help now</Link>
          </Button>
        ) : (
          <>
            <Button asChild>
              <Link href="/member/approvals">Request a subject approval</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/member/board">Browse the board</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
