import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { signJwt } from "../_shared/crypto.ts";

type DriverJwtPayload = {
  sub?: string;
  email?: string;
  exp?: number;
  app_metadata?: {
    user_type?: string;
  };
  user_metadata?: {
    device_id?: string;
    serial_number?: string;
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return errorResponse("Missing driver authorization token.", 401);
    }

    const jwtSecret = Deno.env.get("APP_JWT_SECRET");
    if (!jwtSecret) {
      throw new Error("APP_JWT_SECRET is required.");
    }

    const payload = await verifyJwt(token, jwtSecret);
    if (!payload.sub || payload.app_metadata?.user_type !== "driver") {
      return errorResponse("Invalid driver authorization token.", 401);
    }

    const body = await readJson(req);
    const name = normalizeDriverName(body.name || body.driver_name || body.driverName);
    const email = normalizeEmail(body.email || body.driver_email || body.driverEmail);
    if (!name) {
      return errorResponse("Driver name is required.", 400);
    }
    if (!email || !isValidEmail(email)) {
      return errorResponse("A valid email address is required.", 400);
    }

    const supabase = serviceClient();
    const { data: updatedDriver, error: updateError } = await supabase
      .from("drivers")
      .update({ name, email })
      .eq("id", payload.sub)
      .select("id, name, email, created_at")
      .single();

    if (updateError) {
      if (String(updateError.message || "").toLowerCase().includes("duplicate")) {
        return errorResponse("This email is already used by another driver.", 409);
      }
      throw updateError;
    }

    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("id, serial_number, driver_id, activated_at, status, created_at")
      .eq("driver_id", updatedDriver.id)
      .order("activated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (deviceError) throw deviceError;

    const expiresIn = 60 * 60 * 24 * 7;
    const accessToken = await signJwt(
      {
        aud: "authenticated",
        role: "authenticated",
        sub: updatedDriver.id,
        email: updatedDriver.email,
        app_metadata: {
          provider: "device-serial",
          user_type: "driver"
        },
        user_metadata: {
          driver_name: updatedDriver.name,
          driver_id: updatedDriver.id,
          device_id: device?.id || payload.user_metadata?.device_id || "",
          serial_number: device?.serial_number || payload.user_metadata?.serial_number || ""
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
      driver: updatedDriver,
      device
    });
  } catch (error) {
    console.error(error);
    return errorResponse(error instanceof Error ? error.message : "Unexpected server error.", 500);
  }
});

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDriverName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function verifyJwt(token: string, secret: string): Promise<DriverJwtPayload> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Invalid authorization token.");
  }

  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(encodedSignature),
    new TextEncoder().encode(unsigned)
  );
  if (!valid) {
    throw new Error("Invalid authorization token.");
  }

  const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encodedPayload))) as DriverJwtPayload;
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Authorization token expired. Sign in again.");
  }
  return payload;
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
