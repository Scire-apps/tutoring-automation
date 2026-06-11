import type { Metadata } from "next";
import Link from "next/link";
import {
  GraduationCap,
  ShieldCheck,
  Clock3,
  UserPlus,
  ClipboardList,
  CalendarDays,
  BadgeCheck,
  ArrowRight,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import { BrandMark, BrandWordmark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Scire — Peer tutoring, organized",
  description: BRAND.description,
};

const WHY_CARDS = [
  {
    icon: GraduationCap,
    title: "Learn and tutor with one account",
    body: "No separate logins. Post a request when you need help, and tutor the subjects you're approved for — all from the same place.",
  },
  {
    icon: ShieldCheck,
    title: "Quality your school controls",
    body: "Managers admit members and approve which subjects each tutor can teach, so help comes from people your organization trusts.",
  },
  {
    icon: BadgeCheck,
    title: "Volunteer hours, verified",
    body: "Every completed session is reviewed by a manager and logged as verified volunteer hours you can actually report.",
  },
];

const STEPS = [
  {
    icon: UserPlus,
    title: "Join your organization",
    body: "Sign up with any email and pick your school or club. A manager admits you to unlock tutoring.",
  },
  {
    icon: ClipboardList,
    title: "Post or claim a request",
    body: "Need help? Post a request. Want to tutor? Claim an open request in a subject you're approved for.",
  },
  {
    icon: CalendarDays,
    title: "Schedule it",
    body: "Share your availability, pick a time that fits, and meet online or in person.",
  },
  {
    icon: Clock3,
    title: "Meet, learn, log hours",
    body: "Run the session, submit the recording, and a manager verifies it — banking your volunteer hours.",
  },
];

const FAQ = [
  {
    q: "Who can join Scire?",
    a: "Anyone at an organization that's on Scire. Sign up with any email address and choose your school or club from the list — there's no domain restriction.",
  },
  {
    q: "Why is my account pending after I sign up?",
    a: "New accounts start inactive until a manager at your organization admits you. This keeps each organization's space limited to its own members. You'll get access as soon as you're admitted.",
  },
  {
    q: "How do I become a tutor?",
    a: "Every member can tutor — you just need a manager to approve you for the specific subjects you want to teach. Request approval from your dashboard with a bit of evidence (like a grade), and a manager reviews it.",
  },
  {
    q: "How do volunteer hours work?",
    a: "After a session, the tutor submits the recording link and marks it complete. A manager at your organization verifies the session and awards the hours, which are tracked in your account.",
  },
];

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Atmosphere — emerald light from the top + faint grid. No gradient blobs. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(60%_100%_at_50%_0%,var(--brand-subtle),transparent_70%)]" />
        <div className="absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_45%)] bg-[linear-gradient(to_right,oklch(0.5_0.01_160/0.045)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.5_0.01_160/0.045)_1px,transparent_1px)] [background-size:48px_48px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandMark className="h-8 w-8" />
            <BrandWordmark className="text-xl" />
          </Link>
          <div className="flex items-center gap-1.5">
            <div className="mr-3 hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
              <a
                href="#how-it-works"
                className="rounded-md transition-colors hover:text-foreground"
              >
                How it works
              </a>
              <a
                href="#for-schools"
                className="rounded-md transition-colors hover:text-foreground"
              >
                For schools
              </a>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/auth/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/auth/register">Get started</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center sm:pt-24">
          <span
            className="animate-rise-in inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-subtle px-3.5 py-1.5 text-xs font-semibold tracking-tight text-brand-strong"
            style={{ animationDelay: "0ms" }}
          >
            <span className="size-1.5 rounded-full bg-brand" />
            One account. Learn and tutor.
          </span>
          <h1
            className="animate-rise-in font-display mt-6 text-5xl font-bold leading-[1.02] tracking-[-0.03em] text-foreground sm:text-7xl"
            style={{ animationDelay: "70ms" }}
          >
            Peer tutoring,
            <br />
            <span className="text-brand">organized.</span>
          </h1>
          <p
            className="animate-rise-in mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground"
            style={{ animationDelay: "140ms" }}
          >
            Scire runs your school or club&apos;s tutoring program: post a request
            when you need help, tutor the subjects you&apos;re approved for, and
            get every volunteer hour verified — all in one place.
          </p>
          <div
            className="animate-rise-in mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: "210ms" }}
          >
            <Button asChild size="lg" className="group">
              <Link href="/auth/register">
                Create your account
                <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/auth/login">Log in</Link>
            </Button>
          </div>
          <p
            className="animate-rise-in mt-5 text-sm text-muted-foreground"
            style={{ animationDelay: "280ms" }}
          >
            Free for students. Any email address works.
          </p>

          {/* Quick value strip */}
          <ul
            className="animate-rise-in mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm font-medium text-muted-foreground"
            style={{ animationDelay: "350ms" }}
          >
            {["Manager-approved subjects", "Built-in scheduling", "Verified hours"].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <BadgeCheck className="size-4 text-brand" aria-hidden />
                  {item}
                </li>
              ),
            )}
          </ul>
        </section>

        {/* Why Scire? */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-display text-center text-3xl font-semibold tracking-tight text-foreground">
            Why Scire?
          </h2>
          <ul className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
            {WHY_CARDS.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
              >
                <div className="flex size-11 items-center justify-center rounded-xl bg-brand-subtle text-brand ring-1 ring-inset ring-brand/15 transition-transform duration-200 group-hover:scale-105">
                  <Icon aria-hidden className="size-6" />
                </div>
                <h3 className="font-display mt-5 text-lg font-semibold tracking-tight text-foreground">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16"
        >
          <h2 className="font-display text-center text-3xl font-semibold tracking-tight text-foreground">
            How it works
          </h2>
          <ol className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li
                key={title}
                className="relative rounded-2xl border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="font-display flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background tabular-nums">
                    {i + 1}
                  </span>
                  <Icon aria-hidden className="size-5 text-brand" />
                </div>
                <h3 className="font-display mt-5 text-base font-semibold tracking-tight text-foreground">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* For schools & tutoring clubs — confident dark band */}
        <section id="for-schools" className="scroll-mt-20 px-6 py-16">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-foreground px-6 py-16 text-background sm:px-12">
            {/* subtle emerald glow inside the dark panel */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(50%_80%_at_85%_0%,oklch(0.56_0.114_159/0.35),transparent_70%)]"
            />
            <div className="relative mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-background/20 bg-background/10 px-3.5 py-1.5 text-xs font-semibold tracking-tight text-background/90">
                For schools &amp; tutoring clubs
              </span>
              <h2 className="font-display mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
                Run your program on Scire
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-background/70">
                Each organization is its own private space — the members you
                admit, a subject catalog you define, and the hours you verify.
              </p>
              <ul className="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
                {["Members you admit", "A subject catalog you define", "Hours you verify"].map(
                  (item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 rounded-xl border border-background/10 bg-background/5 px-4 py-3 text-sm font-medium text-background/90"
                    >
                      <BadgeCheck className="size-4 shrink-0 text-brand" aria-hidden />
                      {item}
                    </li>
                  ),
                )}
              </ul>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button asChild size="lg" variant="secondary">
                  <Link href="/auth/register/manager">Register as a manager</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-background/25 bg-transparent text-background hover:bg-background/10 hover:text-background"
                >
                  <Link href="/auth/login/manager">Manager sign in</Link>
                </Button>
              </div>
              <p className="mx-auto mt-7 max-w-xl text-sm text-background/60">
                New organizations are set up by the Scire team. Want your school
                or club on Scire? Email{" "}
                <a
                  href={`mailto:${BRAND.contactEmail}`}
                  className="font-medium text-background underline-offset-4 hover:underline"
                >
                  {BRAND.contactEmail}
                </a>
                .
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="font-display text-center text-3xl font-semibold tracking-tight text-foreground">
            Frequently asked questions
          </h2>
          <Accordion type="single" collapsible className="mt-10 w-full">
            {FAQ.map(({ q, a }) => (
              <AccordionItem key={q} value={q}>
                <AccordionTrigger className="font-display text-left text-base font-semibold tracking-tight">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-6 text-muted-foreground">
                  {a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <BrandMark className="h-7 w-7" />
              <BrandWordmark className="text-lg" />
            </div>
            <p className="mt-3 text-sm italic text-muted-foreground">
              Scire — from the Latin <span className="italic">scire</span>, &quot;to
              know.&quot;
            </p>
            <p className="mt-3 text-sm">
              <a
                href={`mailto:${BRAND.contactEmail}`}
                className="font-medium text-brand underline-offset-4 hover:underline"
              >
                {BRAND.contactEmail}
              </a>
            </p>
          </div>
          <nav aria-label="Footer">
            <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground sm:items-end">
              <li>
                <Link
                  href="/auth/login"
                  className="rounded transition-colors hover:text-foreground"
                >
                  Log in
                </Link>
              </li>
              <li>
                <Link
                  href="/auth/register"
                  className="rounded transition-colors hover:text-foreground"
                >
                  Create account
                </Link>
              </li>
              <li>
                <Link
                  href="/auth/register/manager"
                  className="rounded transition-colors hover:text-foreground"
                >
                  Manager registration
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
