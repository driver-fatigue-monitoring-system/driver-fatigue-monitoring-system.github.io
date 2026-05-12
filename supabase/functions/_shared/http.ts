export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

export function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

export function errorResponse(error: string, status = 400) {
  return jsonResponse({ success: false, error }, status);
}

export async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}
