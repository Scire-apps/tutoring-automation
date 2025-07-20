"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/services/supabase";
import { School } from "@/types/models";

export default function AdminRegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [role, setRole] = useState("admin");
  const [schools, setSchools] = useState<School[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSchools, setIsLoadingSchools] = useState(true);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [invitationData, setInvitationData] = useState<any>(null);
  const [isValidatingToken, setIsValidatingToken] = useState(true);

  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  // Verify invitation token and fetch data
  useEffect(() => {
    const verifyInvitation = async () => {
      if (!token) {
        setError(
          "No invitation token provided. Admin registration requires an invitation."
        );
        setIsValidatingToken(false);
        return;
      }

      try {
        // Verify invitation token directly with Supabase
        const { data: invitationData, error: invitationError } = await supabase
          .from("admin_invitations")
          .select("*")
          .eq("invitation_token", token)
          .single();

        if (invitationError || !invitationData) {
          setError("Invalid or expired invitation token");
          setIsValidatingToken(false);
          return;
        }

        // Check if invitation is expired
        const expiresAt = new Date(invitationData.expires_at);
        if (new Date() > expiresAt) {
          setError("This invitation has expired");
          setIsValidatingToken(false);
          return;
        }

        // Check if invitation is already used
        if (invitationData.status !== "pending") {
          setError("This invitation has already been used");
          setIsValidatingToken(false);
          return;
        }

        // Set invitation data
        setInvitationData(invitationData);
        setEmail(invitationData.email);
        setRole(invitationData.role);
        setSchoolId(invitationData.school_id || "");

        // Fetch schools
        const { data: schoolsData, error: schoolsError } = await supabase
          .from("schools")
          .select("*")
          .order("name");

        if (schoolsError) {
          console.error("Error fetching schools:", schoolsError);
        } else {
          setSchools(schoolsData || []);
        }
      } catch (err) {
        console.error("Error verifying invitation:", err);
        setError("Failed to verify invitation");
      } finally {
        setIsValidatingToken(false);
        setIsLoadingSchools(false);
      }
    };

    verifyInvitation();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!invitationData) {
      setError("Invalid invitation data");
      setIsLoading(false);
      return;
    }

    try {
      // Create user in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
            role: role,
          },
        },
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        setError("Failed to create user");
        setIsLoading(false);
        return;
      }

      // Create admin record in database
      const { error: adminError } = await supabase.from("admins").insert({
        auth_id: data.user.id,
        email: email,
        first_name: firstName,
        last_name: lastName,
        school_id: role === "admin" ? schoolId : null,
        role: role,
      });

      if (adminError) {
        console.error("Error creating admin record:", adminError);
        setError("Failed to create admin record");
        setIsLoading(false);
        return;
      }

      // Mark invitation as used
      try {
        const { error: updateError } = await supabase
          .from("admin_invitations")
          .update({
            status: "used",
            used_at: new Date().toISOString(),
          })
          .eq("invitation_token", token);

        if (updateError) {
          console.error("Error marking invitation as used:", updateError);
        }
      } catch (err) {
        console.error("Error marking invitation as used:", err);
        // Don't fail the registration for this
      }

      // Show success message
      setRegistrationComplete(true);
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // If registration is complete, show success message
  if (registrationComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Registration Successful!
            </h2>
            <div className="mt-4 text-md text-gray-600">
              <p className="mb-4">
                <strong>Please check your email to verify your account.</strong>
              </p>
              <p className="mb-4">
                We've sent a verification link to{" "}
                <span className="font-semibold">{email}</span>.
              </p>
              <p className="mb-4">
                You must verify your email before you can log in.
              </p>
              <div className="mt-8 border-t pt-4">
                <p>
                  Already verified?{" "}
                  <Link
                    href="/auth/login"
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Register as an Admin
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{" "}
            <Link
              href="/auth/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              sign in to your existing account
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label htmlFor="first-name" className="sr-only">
                  First Name
                </label>
                <input
                  id="first-name"
                  name="firstName"
                  type="text"
                  required
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="last-name" className="sr-only">
                  Last Name
                </label>
                <input
                  id="last-name"
                  name="lastName"
                  type="text"
                  required
                  className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="mb-3">
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Role
              </label>
              <div className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 bg-gray-50 text-gray-900 sm:text-sm">
                {role === "superadmin" ? "Super Admin" : "School Admin"}
              </div>
              <input type="hidden" name="role" value={role} />
            </div>

            {role === "admin" && (
              <div className="mb-3">
                <label
                  htmlFor="school"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  School
                </label>
                <div className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 bg-gray-50 text-gray-900 sm:text-sm">
                  {schools.find((school) => school.id === schoolId)?.name ||
                    "Loading..."}
                </div>
                <input type="hidden" name="school" value={schoolId} />
              </div>
            )}

            <div className="mb-3">
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
              />
            </div>
          </div>

          {error && <div className="text-red-500 text-sm mt-2">{error}</div>}

          <div>
            <button
              type="submit"
              disabled={isLoading || isLoadingSchools}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
            >
              {isLoading ? "Registering..." : "Register"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
