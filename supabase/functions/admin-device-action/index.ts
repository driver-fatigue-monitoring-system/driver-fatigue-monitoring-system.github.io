import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { hashDeviceToken, randomToken } from "../_shared/crypto.ts";
import { requireAdmin, serviceClient } from "../_shared/supabase.ts";

const ACTIONS = new Set(["disable", "activate", "reset_token"]);

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
    const action = String(body.action || "");
    const deviceId = body.device_id ? String(body.device_id) : "";
    const serialNumber = body.serial_number ? String(body.serial_number).trim().toUpperCase() : "";

    if (!ACTIONS.has(action)) {
      return errorResponse("action must be disable, activate, or reset_token.", 400);
    }
    if (!deviceId && !serialNumber) {
      return errorResponse("device_id or serial_number is required.", 400);
    }

    const lookup = supabase.from("devices").select("*").limit(1);
    const { data: device, error: lookupError } = deviceId
      ? await lookup.eq("id", deviceId).maybeSingle()
      : await lookup.eq("serial_number", serialNumber).maybeSingle();
    if (lookupError) throw lookupError;
    if (!device) return errorResponse("Device not found.", 404);

    let update: Record<string, unknown> = {};
    let deviceToken = "";
    let message = "Device updated.";

    if (action === "disable") {
      update = { status: "disabled" };
      message = "Device disabled.";
    }

    if (action === "activate") {
      update = {
        status: "active",
        activated_at: device.activated_at || new Date().toISOString()
      };
      message = "Device activated.";
    }

    if (action === "reset_token") {
      deviceToken = randomToken(32);
      const pepper = Deno.env.get("DEVICE_TOKEN_PEPPER") || "";
      update = {
        device_token_hash: await hashDeviceToken(deviceToken, pepper),
        status: "reset_required"
      };
      message = "Device token reset. Configure the physical device with the new token, then activate it.";
    }

    const { data: updated, error: updateError } = await supabase
      .from("devices")
      .update(update)
      .eq("id", device.id)
      .select("id, serial_number, driver_id, activated_at, status, created_at")
      .single();
    if (updateError) throw updateError;

    return jsonResponse({
      success: true,
      message,
      device: updated,
      device_token: deviceToken || undefined
    });
  } catch (error) {
    console.error(error);
    const status = error instanceof Error && /admin|authorization|role/i.test(error.message) ? 401 : 500;
    return errorResponse(error instanceof Error ? error.message : "Unexpected server error.", status);
  }
});
