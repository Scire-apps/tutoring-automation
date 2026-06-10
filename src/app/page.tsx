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
    <div className="relative min-h-screen overflow-hidden bg-white text-gray-900">
      {/* Decorative background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 h-[40rem] w-[40rem] rounded-full bg-gradient-to-tr from-blue-200 via-indigo-200 to-purple-200 opacity-70 blur-3xl motion-safe:animate-pulse" />
        <div className="absolute -bottom-32 -right-32 h-[40rem] w-[40rem] rounded-full bg-gradient-to-tr from-indigo-200 via-purple-200 to-pink-200 opacity-70 blur-3xl motion-safe:animate-pulse" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] opacity-40 [background-size:16px_16px]"
      />

      {/* Header */}
      <header className="relative z-10">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <BrandMark className="h-8 w-8" />
            <BrandWordmark className="text-xl" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="mr-2 hidden items-center gap-6 text-sm font-medium text-gray-600 md:flex">
              <a
                href="#how-it-works"
                className="rounded-md transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                How it works
              </a>
              <a
                href="#for-schools"
                className="rounded-md transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                For schools
              </a>
            </div>
            <Button asChild variant="ghost">
              <Link href="/auth/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/register">Get started</Link>
            </Button>
          </div>
        </nav>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-4xl px-6 pb-16 pt-12 text-center sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
            One account. Learn and tutor.
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
            Peer tutoring, organized.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-600">
            Scire runs your school or club&apos;s tutoring program: post a
            request when you need help, tutor the subjects you&apos;re approved
            for, and get every volunteer hour verified — all in one place.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/auth/register">Create your account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/auth/login">Log in</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Free for students. Any email address works.
          </p>
        </section>

        {/* Why Scire? */}
        <section className="mx-auto max-w-7xl px-6 py-16">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            Why Scire?
          </h2>
          <ul className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {WHY_CARDS.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon aria-hidden className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="mx-auto max-w-7xl scroll-mt-20 px-6 py-16"
        >
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            How it works
          </h2>
          <ol className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li
                key={title}
                className="relative rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <Icon aria-hidden className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-gray-900">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* For schools & tutoring clubs */}
        <section
          id="for-schools"
          className="scroll-mt-20 bg-gradient-to-b from-blue-50/60 to-indigo-50/60 py-20"
        >
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">
              Run your program on Scire
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-gray-600">
              Each organization is its own private space — the members you admit,
              a subject catalog you define, and the hours you verify.
            </p>
            <ul className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
              <li className="rounded-xl bg-white/70 px-4 py-3 text-sm font-medium text-gray-700 ring-1 ring-inset ring-blue-100">
                Members you admit
              </li>
              <li className="rounded-xl bg-white/70 px-4 py-3 text-sm font-medium text-gray-700 ring-1 ring-inset ring-blue-100">
                A subject catalog you define
              </li>
              <li className="rounded-xl bg-white/70 px-4 py-3 text-sm font-medium text-gray-700 ring-1 ring-inset ring-blue-100">
                Hours you verify
              </li>
            </ul>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/auth/register/manager">Register as a manager</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/auth/login/manager">Manager sign in</Link>
              </Button>
            </div>
            <p className="mx-auto mt-6 max-w-xl text-sm text-gray-500">
              New organizations are set up by the Scire team. Want your school or
              club on Scire? Email{" "}
              <a
                href={`mailto:${BRAND.contactEmail}`}
                className="font-medium text-blue-600 underline-offset-4 hover:underline"
              >
                {BRAND.contactEmail}
              </a>
              .
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            Frequently asked questions
          </h2>
          <Accordion type="single" collapsible className="mt-8 w-full">
            {FAQ.map(({ q, a }) => (
              <AccordionItem key={q} value={q}>
                <AccordionTrigger className="text-left text-base font-semibold">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-6 text-gray-600">
                  {a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-12 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <BrandWordmark className="text-lg" />
            <p className="mt-2 text-sm italic text-gray-500">
              Scire — from the Latin <span className="italic">scire</span>, &quot;to
              know.&quot;
            </p>
            <p className="mt-3 text-sm text-gray-500">
              <a
                href={`mailto:${BRAND.contactEmail}`}
                className="font-medium text-blue-600 underline-offset-4 hover:underline"
              >
                {BRAND.contactEmail}
              </a>
            </p>
          </div>
          <nav aria-label="Footer">
            <ul className="flex flex-col gap-2 text-sm text-gray-600 sm:items-end">
              <li>
                <Link
                  href="/auth/login"
                  className="rounded transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Log in
                </Link>
              </li>
              <li>
                <Link
                  href="/auth/register"
                  className="rounded transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  Create account
                </Link>
              </li>
              <li>
                <Link
                  href="/auth/register/manager"
                  className="rounded transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
