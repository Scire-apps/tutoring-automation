// @ts-nocheck

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/app/providers";
import { supabase } from "@/services/supabase";
import Image from "next/image";

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

    console.log("Login attempt started...");

    try {
      const { error } = await signIn(email, password);

      console.log("Sign in response:", { error });

      if (error) {
        console.error("Sign in error:", error);
        setError(error.message);
        setIsLoading(false);
        return;
      }

      console.log("Sign in successful!");

      // Wait a moment for the session to be processed, then redirect based on role
      console.log("Waiting for session processing...");

      // Small delay to ensure session is properly set, then redirect
      setTimeout(async () => {
        console.log("Determining redirect destination via backend role endpoint...");

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            window.location.reload();
            return;
          }
          // Do not auto-create a tutee on login; backend account creation is handled based on signup intent
          const resp = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/role`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
            credentials: 'include',
          });
          if (!resp.ok) {
            console.log('Role endpoint returned non-ok, reloading');
            window.location.reload();
            return;
          }
          const json = await resp.json();
          const role = json.role;
          if (role === 'admin') return router.push('/admin/dashboard');
          if (role === 'tutor') return router.push('/tutor/dashboard');
          if (role === 'tutee') return router.push('/tutee/dashboard');
          window.location.reload();
        } catch (error) {
          console.error("Error determining redirect:", error);
          window.location.reload();
        }
      }, 500);
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center mb-6">
            <Image
              src="/logo.png.png"
              alt="Tutoring Logo"
              width={64}
              height={64}
              className="object-contain"
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            New?{" "}
            <Link
              href="/"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Register here
            </Link>
          </p>
          {/* Invitations removed */}
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md  -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-[10px] relative block w-full h-15 px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="appearance-none w-full h-15 px-3 py-2 pr-12 mt-5 rounded-[10px] border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 top-5 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                <Image
                  src={showPassword ? "/Hide.svg" : "/Show.svg"}
                  alt={showPassword ? "Hide password" : "Show password"}
                  width={24}
                  height={24}
                  className="object-contain mr-2"
                />
              </button>
            </div>
          </div>

          {error && <div className="text-red-500 text-sm mt-2">{error}</div>}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full h-15 flex justify-center items-center text-[15px] font-bold py-2 px-4 border border-transparent text-sm font-medium rounded-[15px] text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </div>

          <div className="text-sm text-right mr-[-15]">
            <Link
              href="/auth/forgot-password"
              className="font-medium text-blue-600 hover:text-blue-500 mr-4"
            >
              Forgot your password?
            </Link>
            {/* <Link
              href="/debug"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Debug Auth
            </Link> */}
          </div>
        </form>
      </div>
    </div>
  );
}
