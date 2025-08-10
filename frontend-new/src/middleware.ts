import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create a Supabase client for server-side operations
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  // Try to get the session with better error handling
  let session = null;
  let sessionError = null;

  try {
    const {
      data: { session: sessionData },
      error,
    } = await supabase.auth.getSession();
    session = sessionData;
    sessionError = error;

    if (error) {
      console.log("Middleware: Error getting session:", error.message);
    }
  } catch (e) {
    console.log("Middleware: Exception getting session:", e);
    sessionError = e;
  }

  // ⓵ If we *do* have a cookie, ask Supabase for the user.
  //    • If the token was revoked (SIGNED_OUT) you'll get an error.
  //    • Treat that the same as "no session".
  if (session) {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();

    if (userErr || !user) {
      console.log('Middleware: Cookie is stale (', userErr?.message, ') – wiping');

      // remove both cookies so the browser stops sending them
      ['sb-access-token', 'sb-refresh-token'].forEach((name) =>
        response.cookies.set({
          name,
          value: '',
          path: '/',
          maxAge: 0,
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        }),
      );

      session = null;          // treat this request as signed‑out
    }
  }

  // Get the pathname from the URL
  const pathname = request.nextUrl.pathname;

  console.log("Middleware: Processing request for:", pathname);
  console.log("Middleware: Session exists:", !!session);
  console.log("Middleware: User ID:", session?.user?.id || "None");

  // Add debugging for session state during sign out
  if (session) {
    console.log(
      "Middleware: Session user metadata:",
      session.user?.user_metadata
    );
  }

  // Define protected routes
  const protectedRoutes = ["/opportunities", "/jobs", "/profile", "/dashboard", "/tutee"];
  const adminRoutes = ["/admin"];
  const authRoutes = [
    "/auth/login",
    "/auth/register",
    "/auth/register/tutee",
    "/auth/forgot-password",
    "/auth/reset-password",
  ];

  // Check if the route is protected and user is not authenticated
  if (protectedRoutes.some((route) => pathname.startsWith(route)) && !session) {
    // Redirect to login page
    const redirectUrl = new URL("/auth/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Check if the route is admin-only
  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    // If not authenticated, redirect to login
    if (!session) {
      console.log(
        "Middleware: No session found for admin route, redirecting to login"
      );
      const redirectUrl = new URL("/auth/login", request.url);
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Check if user has admin role from database (not session metadata)
    let userRole = null;
    try {
      const { data: adminData } = await supabase
        .from("admins")
        .select("role")
        .eq("auth_id", session.user.id)
        .single();

      if (adminData) {
        userRole = adminData.role;
      }
    } catch (error) {
      console.log("Middleware: Error checking admin role:", error);
    }

    console.log("Middleware: User role from database:", userRole);

    // Allow both superadmin and admin roles to access admin routes
    if (userRole !== "superadmin" && userRole !== "admin") {
      console.log(
        "Middleware: User is not an admin, access denied. Role:",
        userRole
      );
      const redirectUrl = new URL("/auth/login", request.url);
      redirectUrl.searchParams.set("error", "access_denied");
      return NextResponse.redirect(redirectUrl);
    }

    // Check for role-specific route restrictions
    if (userRole === "admin") {
      // School admins should only access school-specific routes
      if (pathname === "/admin/dashboard" || pathname.startsWith("/admin/invitations")) {
        console.log("Middleware: School admin trying to access superadmin route, redirecting");
        return NextResponse.redirect(new URL("/admin/school/dashboard", request.url));
      }
      
      // Allow school admins to access their specific routes
      if (!pathname.startsWith("/admin/school/") && !pathname.startsWith("/admin/tutors/")) {
        console.log("Middleware: School admin accessing non-school route, redirecting");
        return NextResponse.redirect(new URL("/admin/school/dashboard", request.url));
      }
    }

    console.log(
      "Middleware: Admin access granted for user:",
      session.user?.email,
      "with role:",
      userRole
    );
  }

  // Check if the user is authenticated and trying to access auth routes
  // Only redirect away from auth routes if we're confident about the session
  // This prevents redirect loops when session detection is inconsistent
  if (
    authRoutes.some((route) => pathname === route) &&
    session &&
    !sessionError
  ) {
    // Only redirect if we have a valid session without errors
    console.log(
      "Middleware: Redirecting authenticated user away from auth pages"
    );

    // Determine redirect target based on user role from database
    let userRole = null;
    try {
      // Check if user is an admin
      const { data: adminData } = await supabase
        .from("admins")
        .select("role")
        .eq("auth_id", session.user.id)
        .single();

      if (adminData) {
        userRole = adminData.role;
      } else {
        // Check if user is a tutor or tutee
        const { data: tutorData } = await supabase
          .from("tutors")
          .select("id")
          .eq("auth_id", session.user.id)
          .single();

        if (tutorData) {
          userRole = "tutor";
        } else {
          const { data: tuteeData } = await supabase
            .from("tutees")
            .select("id")
            .eq("auth_id", session.user.id)
            .single();
          if (tuteeData) userRole = "tutee";
        }
      }
    } catch (error) {
      console.log("Middleware: Error determining user role:", error);
    }

    // Determine redirect target based on role
    let target = "/dashboard"; // default for tutors
    if (userRole === "superadmin") {
      target = "/admin/dashboard";
    } else if (userRole === "admin") {
      target = "/admin/school/dashboard";
    } else if (userRole === "tutee") {
      target = "/tutee/dashboard";
    }

    console.log("Middleware: Redirecting to:", target, "for role:", userRole);
    return NextResponse.redirect(new URL(target, request.url));
  }

  return response;
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/opportunities/:path*",
    "/jobs/:path*",
    "/profile/:path*",
    "/auth/:path*",
    "/admin/:path*",
  ],
};
