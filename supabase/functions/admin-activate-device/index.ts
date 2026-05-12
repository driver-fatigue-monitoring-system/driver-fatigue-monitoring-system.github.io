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
    const driverName = String(body.driver_name || "").trim();
    const driverEmail = String(body.driver_email || body.email || "").trim().toLowerCase();
    const requestedSerial = body.serial_number ? String(body.serial_number).trim().toUpperCase() : "";
    const dashboardUrl = String(body.dashboard_url || Deno.env.get("DASHBOARD_LOGIN_URL") || "").trim();

    if (!driverName || !driverEmail) {
      return errorResponse("driver_name and driver_email are required.", 400);
    }

    const serialNumber = requestedSerial || (await uniqueSerial(supabase));
    const { data: existingDevice, error: serialError } = await supabase
      .from("devices")
      .select("id")
      .eq("serial_number", serialNumber)
      .maybeSingle();
    if (serialError) throw serialError;
    if (existingDevice) {
      return errorResponse("This serial number already exists. Each serial number must be permanent and unique.", 409);
    }

    const { data: existingDriver, error: existingDriverError } = await supabase
      .from("drivers")
      .select("*")
      .eq("email", driverEmail)
      .maybeSingle();
    if (existingDriverError) throw existingDriverError;

    let driver = existingDriver;
    if (driver) {
      const { data, error } = await supabase
        .from("drivers")
        .update({ name: driverName })
        .eq("id", driver.id)
        .select("*")
        .single();
      if (error) throw error;
      driver = data;
    } else {
      const { data, error } = await supabase
        .from("drivers")
        .insert({ name: driverName, email: driverEmail })
        .select("*")
        .single();
      if (error) throw error;
      driver = data;
    }

    const deviceToken = randomToken(32);
    const pepper = Deno.env.get("DEVICE_TOKEN_PEPPER") || "";
    const deviceTokenHash = await hashDeviceToken(deviceToken, pepper);
    const { data: device, error: deviceError } = await supabase
      .from("devices")
      .insert({
        serial_number: serialNumber,
        device_token_hash: deviceTokenHash,
        driver_id: driver.id,
        activated_at: new Date().toISOString(),
        status: "active"
      })
      .select("id, serial_number, driver_id, activated_at, status, created_at")
      .single();
    if (deviceError) throw deviceError;

    const emailResult = await sendActivationEmail({
      driverName,
      driverEmail,
      serialNumber,
      dashboardUrl
    });

    return jsonResponse({
      success: true,
      serial_number: serialNumber,
      device_token: deviceToken,
      device,
      driver,
      email_sent: emailResult.sent,
      email_warning: emailResult.warning
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

async function sendActivationEmail(input: {
  driverName: string;
  driverEmail: string;
  serialNumber: string;
  dashboardUrl: string;
}) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) {
    return { sent: false, warning: "BREVO_API_KEY is not configured; activation email was skipped." };
  }

  const senderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
  const senderName = Deno.env.get("BREVO_SENDER_NAME") || "Driver Fatigue Monitoring System";
  if (!senderEmail) {
    return { sent: false, warning: "BREVO_SENDER_EMAIL is not configured; activation email was skipped." };
  }

  const dashboardUrl = input.dashboardUrl || "https://your-dashboard-url.example.com";
  const html = `
    <div style="font-family:Arial,sans-serif;color:#10213f;line-height:1.6">
      <h2>Your Driver Fatigue Monitoring device is active</h2>
      <p>Hello ${escapeHtml(input.driverName)},</p>
      <p>Your physical AI fatigue detection device has been assigned to your driver account.</p>
      <p><strong>Permanent device serial number:</strong> ${escapeHtml(input.serialNumber)}</p>
      <p>Open the dashboard and sign in using your email address and this serial number.</p>
      <p><a href="${escapeHtml(dashboardUrl)}" style="background:#0f5bd7;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none">Open Dashboard</a></p>
      <p>Keep this serial number safe. It is your permanent dashboard identifier for this device.</p>
    </div>
  `;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: input.driverEmail, name: input.driverName }],
      subject: "Your DFMS device serial number",
      htmlContent: html,
      textContent:
        `Hello ${input.driverName},\n\n` +
        `Your Driver Fatigue Monitoring device is active.\n` +
        `Permanent device serial number: ${input.serialNumber}\n` +
        `Dashboard login link: ${dashboardUrl}\n\n` +
        `Use your email address and serial number to access the dashboard.`
    })
  });

  if (!response.ok) {
    const text = await response.text();
    return { sent: false, warning: `Brevo email failed: ${text}` };
  }
  return { sent: true, warning: "" };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
