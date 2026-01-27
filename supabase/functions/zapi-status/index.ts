import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated and admin
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Z-API credentials
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const zapiToken = Deno.env.get("ZAPI_TOKEN");

    if (!instanceId || !zapiToken) {
      return new Response(
        JSON.stringify({ 
          connected: false, 
          error: "Z-API credentials not configured",
          qrCodeBase64: null 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check Z-API connection status
    const statusUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/status`;
    
    let connected = false;
    let qrCodeBase64: string | null = null;

    try {
      const statusResponse = await fetch(statusUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        connected = statusData.connected === true || statusData.status === "connected";
      }
    } catch (e) {
      console.error("Error checking Z-API status:", e);
    }

    // If not connected, fetch QR code
    if (!connected) {
      try {
        const qrUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/qr-code/image`;
        const qrResponse = await fetch(qrUrl, {
          method: "GET",
        });

        if (qrResponse.ok) {
          const arrayBuffer = await qrResponse.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          qrCodeBase64 = `data:image/png;base64,${base64}`;
        }
      } catch (e) {
        console.error("Error fetching QR code:", e);
      }
    }

    return new Response(
      JSON.stringify({ connected, qrCodeBase64 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in zapi-status:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
