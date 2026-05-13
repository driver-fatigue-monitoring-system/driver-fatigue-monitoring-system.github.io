import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { generateSerial, hashDeviceToken, randomToken } from "../_shared/crypto.ts";
import { requireAdmin, serviceClient } from "../_shared/supabase.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }

  try {
    const supabase = serviceClient();
    await requireAdmin(req, supabase);

    const body = await readJson(req);
    const requestedSerial = body.serial_number ? String(body.serial_number).trim().toUpperCase() : "";
    const serialNumber = requestedSerial || (await uniqueSerial(supabase));

    const { data: existingDevice, error: serialError } = await supabase
      .from("devices")
      .select("id")
      .eq("serial_number", serialNumber)
      .maybeSingle();
    if (serialError) throw serialError;
    if (existingDevice) {
      return errorResponse("This serial number already exists. Each printed device serial must be unique.", 409);
    }

    const deviceToken = randomToken(32);
    const pepper = Deno.env.get("DEVICE_TOKEN_PEPPER") || "";
    const deviceTokenHash = await hashDeviceToken(deviceToken, pepper);

    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .insert({
        serial_number: serialNumber,
        device_token_hash: deviceTokenHash,
        driver_id: null,
        activated_at: null,
        status: "registered"
      })
      .select("id, serial_number, driver_id, activated_at, status, created_at")
      .single();
    if (deviceError) throw deviceError;

    return jsonResponse({
      success: true,
      serial_number: serialNumber,
      device_token: deviceToken,
      device
    });
  } catch (error) {
    console.error(error);
    const status = error instanceof Error && /admin|authorization|role/i.test(error.message) ? 401 : 500;
    return errorResponse(error instanceof Error ? error.message : "Unexpected server error.", status);
  }
});

async function uniqueSerial(supabase: ReturnType<typeof serviceClient>) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const serial = generateSerial();
    const { data, error } = await supabase
      .from("devices")
      .select("id")
      .eq("serial_number", serial)
      .maybeSingle();
    if (error) throw error;
    if (!data) return serial;
  }
  throw new Error("Could not generate a unique serial number.");
}
