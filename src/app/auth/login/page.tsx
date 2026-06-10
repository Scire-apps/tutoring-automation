"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/app/providers";

// NOTE: minimal interim login (S2). The old tutor/tutee role selector and the
// plus-addressed email suffix transform are gone; routing is delegated to the
// proxy via router.refresh() on success. S5 rebuilds this against AuthShell (§8.2).
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error } = await signIn(email.trim(), password);
    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    // The auth-state listener refreshes the tree and the proxy routes the
    // now-authed user to their home (§3.4).
    router.refresh();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 w-[40rem] h-[40rem] rounded-full bg-gradient-to-tr from-blue-200 via-indigo-200 to-purple-200 blur-3xl opacity-70 animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-[40rem] h-[40rem] rounded-full bg-gradient-to-tr from-indigo-200 via-purple-200 to-pink-200 blur-3xl opacity-70 animate-pulse" />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

      <div className="mx-auto max-w-7xl px-6 min-h-screen flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-10 items-center py-10">
          <div className="hidden lg:block">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-semibold ring-1 ring-inset ring-blue-200">
              Welcome back
            </div>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900">Sign in to continue</h1>
            <p className="mt-4 text-gray-600 leading-7">Access your dashboard, manage sessions, and keep learning moving.</p>
          </div>

          <div className="relative order-first lg:order-none">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-blue-400 via-indigo-400 to-purple-400 opacity-30 blur-2xl animate-pulse" />
            <div className="relative bg-white/80 backdrop-blur shadow-xl ring-1 ring-gray-200 rounded-3xl p-6 sm:p-8">
              <h2 className="text-center text-2xl font-bold text-gray-900">Sign in</h2>
              <p className="mt-1 text-center text-sm text-gray-600">
                New here? <Link href="/auth/register" className="text-blue-600 hover:text-blue-700 font-medium">Create an account</Link>
              </p>

              <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
                <div className="rounded-md -space-y-px">
                  <div>
                    <label htmlFor="email-address" className="sr-only">Email address</label>
                    <input
                      id="email-address"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="appearance-none rounded-xl relative block w-full h-15 px-3 py-2 border border-gray-200 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:z-10 sm:text-sm shadow-sm"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="relative">
                    <label htmlFor="password" className="sr-only">Password</label>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      className="appearance-none w-full h-15 px-3 py-2 pr-12 mt-5 rounded-xl border border-gray-200 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:z-10 sm:text-sm shadow-sm"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 top-5 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {error && <div className="text-red-500 text-sm mt-2">{error}</div>}

                <div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="group relative w-full h-15 flex justify-center items-center text-[15px] font-bold py-2 px-4 border border-transparent rounded-2xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 shadow-md"
                  >
                    {isLoading ? "Signing in..." : "Sign in"}
                  </button>
                </div>

                <div className="text-sm text-right">
                  <Link href="/auth/forgot-password" className="font-medium text-blue-600 hover:text-blue-700">Forgot your password?</Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
