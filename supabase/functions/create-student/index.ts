import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle browser preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: "Method not allowed",
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Supabase environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase server configuration is missing.");
    }

    // Client using the service-role key.
    // This code runs on the server, NOT in the browser.
    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get the logged-in staff member's access token
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: "Authentication required.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify the logged-in user
    const {
      data: { user },
      error: userError,
    } = await adminClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: "Invalid or expired session.",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Get staff profile
    const {
      data: staffProfile,
      error: staffError,
    } = await adminClient
      .from("profiles")
      .select("id, full_name, role, status")
      .eq("id", user.id)
      .single();

    if (
      staffError ||
      !staffProfile ||
      !["admin", "caretaker"].includes(staffProfile.role)
    ) {
      return new Response(
        JSON.stringify({
          error: "Only Admin or Caretaker can create student accounts.",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (staffProfile.status !== "active") {
      return new Response(
        JSON.stringify({
          error: "Your staff account is inactive.",
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Read request body
    const body = await req.json();

    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const gender = body.gender || null;
    const dateOfBirth = body.date_of_birth || null;
    const password = String(body.password || "");
    const status = body.status === "inactive" ? "inactive" : "active";

    // Validate required fields
    if (!fullName || !email || !password) {
      return new Response(
        JSON.stringify({
          error: "Full name, email and password are required.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({
          error: "Password must contain at least 8 characters.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (
      gender !== null &&
      !["male", "female", "other"].includes(gender)
    ) {
      return new Response(
        JSON.stringify({
          error: "Invalid gender.",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Create Auth account
    const {
      data: authData,
      error: createUserError,
    } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "student",
      },
    });

    if (createUserError) {
      return new Response(
        JSON.stringify({
          error: createUserError.message,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const studentUser = authData.user;

    if (!studentUser) {
      throw new Error("Student account was not created.");
    }

    // The auth.users trigger should normally create the profile.
    // We update it with the complete student information.
    const {
      data: studentProfile,
      error: profileError,
    } = await adminClient
      .from("profiles")
      .update({
        full_name: fullName,
        email,
        phone: phone || null,
        role: "student",
        gender,
        date_of_birth: dateOfBirth || null,
        status,
      })
      .eq("id", studentUser.id)
      .select()
      .single();

    if (profileError) {
      // Clean up Auth account if profile creation/update fails.
      await adminClient.auth.admin.deleteUser(studentUser.id);

      throw new Error(
        `Student profile could not be created: ${profileError.message}`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Student account created successfully.",
        student: {
          id: studentProfile.id,
          full_name: studentProfile.full_name,
          email: studentProfile.email,
          student_id: studentProfile.student_id,
          role: studentProfile.role,
          status: studentProfile.status,
        },
      }),
      {
        status: 201,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});