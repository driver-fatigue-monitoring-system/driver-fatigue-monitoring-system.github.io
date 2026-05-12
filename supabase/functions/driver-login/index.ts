import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { signJwt } from "../_shared/crypto.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }

  try {
    const body = await readJson(req);
    const email = String(body.email || "").trim().toLowerCase();
    const serial = String(body.serial_number || body.device_serial || "").trim().toUpperCase();

    if (!email || !serial) {
      return errorResponse("email and serial_number are required.", 400);
    }

    const supabase = serviceClient();
    const { data: driver, error: driverError } = await supabase
      .from("drivers")
      .select("id, name, email, created_at")
      .eq("email", email)
      .maybeSingle();

    if (driverError) throw driverError;
    if (!driver) return errorResponse("No driver is assigned to this email.", 404);

    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("id, serial_number, driver_id, activated_at, status, created_at")
      .eq("serial_number", serial)
      .maybeSingle();

    if (deviceError) throw deviceError;
    if (!device || device.driver_id !== driver.id) {
      return errorResponse("The email and serial number do not match.", 401);
    }
    if (device.status !== "active") {
      return errorResponse("This device is not active. Contact an administrator.", 403);
    }

    const jwtSecret = Deno.env.get("APP_JWT_SECRET");
    if (!jwtSecret) {
      throw new Error("APP_JWT_SECRET is required for driver login.");
    }

    const expiresIn = 60 * 60 * 24 * 7;
    const accessToken = await signJwt(
      {
        aud: "authenticated",
        role: "authenticated",
        sub: driver.id,
        email: driver.email,
        app_metadata: {
          provider: "device-serial",
          user_type: "driver"
        },
        user_metadata: {
          driver_name: driver.name,
          driver_id: driver.id,
          device_id: device.id,
          serial_number: device.serial_number
        }
      },
      jwtSecret,
      expiresIn
    );

    return jsonResponse({
      success: true,
      access_token: accessToken,
      token_type: "bearer",
      expires_in: expiresIn,
      driver,
      device
    });
  } catch (error) {
    console.error(error);
    return errorResponse(error instanceof Error ? error.message : "Unexpected server error.", 500);
  }
});
