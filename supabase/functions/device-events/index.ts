import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { hashDeviceToken, secureEqual } from "../_shared/crypto.ts";
import { serviceClient } from "../_shared/supabase.ts";

const VALID_STATES = new Set(["Awake", "Drowsy", "Yawn"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }

  try {
    const body = await readJson(req);
    const serial = String(body.device_serial || body.serial_number || "").trim().toUpperCase();
    const token = String(body.device_token || "");
    const eventType = String(body.event_type || "");
    const status = String(body.status || eventType);
    const confidence = Number(body.confidence);
    const timestamp = body.timestamp ? new Date(body.timestamp) : new Date();
    const frameUrl = body.frame_url ? String(body.frame_url) : null;
    const sessionId = body.session_id ? String(body.session_id) : null;

    if (!serial || !token) return errorResponse("device_serial and device_token are required.", 400);
    if (!VALID_STATES.has(eventType) || !VALID_STATES.has(status)) {
      return errorResponse("event_type and status must be Awake, Drowsy, or Yawn.", 400);
    }
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      return errorResponse("confidence must be a number between 0 and 1.", 400);
    }
    if (Number.isNaN(timestamp.getTime())) {
      return errorResponse("timestamp must be a valid ISO timestamp.", 400);
    }

    const supabase = serviceClient();
    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .select("id, serial_number, device_token_hash, driver_id, status")
      .eq("serial_number", serial)
      .maybeSingle();

    if (deviceError) throw deviceError;
    if (!device) return errorResponse("Unknown device serial number.", 404);
    if (device.status !== "active") return errorResponse("Device is not active.", 403);
    if (!device.driver_id) return errorResponse("Device is not assigned to a driver.", 409);

    const pepper = Deno.env.get("DEVICE_TOKEN_PEPPER") || "";
    const submittedHash = await hashDeviceToken(token, pepper);
    if (!secureEqual(submittedHash, device.device_token_hash)) {
      return errorResponse("Invalid device token.", 401);
    }

    if (sessionId) {
      const { error: sessionError } = await supabase.from("driving_sessions").upsert(
        {
          id: sessionId,
          driver_id: device.driver_id,
          device_id: device.id,
          started_at: timestamp.toISOString()
        },
        { onConflict: "id", ignoreDuplicates: true }
      );
      if (sessionError) throw sessionError;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("detection_logs")
      .insert({
        device_id: device.id,
        driver_id: device.driver_id,
        timestamp: timestamp.toISOString(),
        event_type: eventType,
        confidence,
        status,
        frame_url: frameUrl,
        session_id: sessionId
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    if (sessionId && (eventType === "Drowsy" || eventType === "Yawn")) {
      const [drowsyCount, yawnCount] = await Promise.all([
        supabase
          .from("detection_logs")
          .select("id", { count: "exact", head: true })
          .eq("session_id", sessionId)
          .eq("event_type", "Drowsy"),
        supabase
          .from("detection_logs")
          .select("id", { count: "exact", head: true })
          .eq("session_id", sessionId)
          .eq("event_type", "Yawn")
      ]);
      if (drowsyCount.error) throw drowsyCount.error;
      if (yawnCount.error) throw yawnCount.error;
      const { error: updateSessionError } = await supabase
        .from("driving_sessions")
        .update({
          total_drowsy_events: drowsyCount.count || 0,
          total_yawn_events: yawnCount.count || 0
        })
        .eq("id", sessionId);
      if (updateSessionError) throw updateSessionError;
    }

    return jsonResponse({
      success: true,
      log_id: inserted.id,
      device_id: device.id,
      driver_id: device.driver_id
    });
  } catch (error) {
    console.error(error);
    return errorResponse(error instanceof Error ? error.message : "Unexpected server error.", 500);
  }
});
