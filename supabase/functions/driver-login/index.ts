import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { signJwt } from "../_shared/crypto.ts";

type DriverRecord = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

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
    const submittedDriverName = normalizeDriverName(body.driver_name || body.driverName || body.name);
    const serial = String(body.serial_number || body.device_serial || "").trim().toUpperCase();

    if (!serial) {
      return errorResponse("serial_number is required.", 400);
    }

    const supabase = serviceClient();
    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("id, serial_number, driver_id, activated_at, status, created_at")
      .eq("serial_number", serial)
      .maybeSingle();

    if (deviceError) throw deviceError;
    if (!device) {
      return errorResponse("This serial number is not registered. Check the serial printed on your device.", 404);
    }

    if (device.status === "disabled" || device.status === "reset_required") {
      return errorResponse("This device is not active. Contact an administrator.", 403);
    }

    let driver: DriverRecord | null = null;
    if (device.driver_id) {
      const { data: assignedDriver, error: assignedDriverError } = await supabase
        .from("drivers")
        .select("id, name, email, created_at")
        .eq("id", device.driver_id)
        .maybeSingle();
      if (assignedDriverError) throw assignedDriverError;
      if (!assignedDriver) {
        return errorResponse("This device is linked to a missing driver profile. Contact an administrator.", 409);
      }
      if (email && assignedDriver.email !== email) {
        return errorResponse("This serial number is already linked to another email.", 401);
      }
      driver = email ? await updateDriverNameIfNeeded(supabase, assignedDriver, submittedDriverName) : assignedDriver;
    } else {
      if (!email || !submittedDriverName) {
        return jsonResponse({
          success: false,
          code: "DRIVER_PROFILE_REQUIRED",
          needs_email: true,
          needs_driver_name: true,
          error: "Enter your email and name once to activate this device."
        }, 409);
      }
      const driverName = submittedDriverName || displayNameFromEmail(email);
      const { data: existingDriver, error: existingDriverError } = await supabase
        .from("drivers")
        .select("id, name, email, created_at")
        .eq("email", email)
        .maybeSingle();
      if (existingDriverError) throw existingDriverError;

      if (existingDriver) {
        driver = await updateDriverNameIfNeeded(supabase, existingDriver, submittedDriverName);
      } else {
        const { data: createdDriver, error: createDriverError } = await supabase
          .from("drivers")
          .insert({ name: driverName, email })
          .select("id, name, email, created_at")
          .single();
        if (createDriverError) throw createDriverError;
        driver = createdDriver;
      }

      const { data: claimedDevice, error: claimError } = await supabase
        .from("devices")
        .update({
          driver_id: driver.id,
          activated_at: new Date().toISOString(),
          status: "active"
        })
        .eq("id", device.id)
        .is("driver_id", null)
        .select("id, serial_number, driver_id, activated_at, status, created_at")
        .single();
      if (claimError) throw claimError;
      Object.assign(device, claimedDevice);
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

function displayNameFromEmail(email: string) {
  const localPart = email.split("@")[0] || "Driver";
  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim() || "Driver";
}

function normalizeDriverName(value: unknown) {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  return name.slice(0, 80);
}

async function updateDriverNameIfNeeded(supabase: ReturnType<typeof serviceClient>, driver: DriverRecord, name: string) {
  if (!name || driver.name === name) return driver;
  const { data: updatedDriver, error: updateDriverError } = await supabase
    .from("drivers")
    .update({ name })
    .eq("id", driver.id)
    .select("id, name, email, created_at")
    .single();
  if (updateDriverError) throw updateDriverError;
  return updatedDriver;
}
