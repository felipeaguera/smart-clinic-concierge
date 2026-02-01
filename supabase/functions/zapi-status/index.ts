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

    // Verify user is authenticated
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
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");

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

    // Headers for Z-API requests - Client-Token is optional for some endpoints
    // Note: Client-Token is the Account Security Token from Z-API dashboard,
    // NOT the instance token. If misconfigured, we try without it.
    const zapiHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    // Only add Client-Token if it looks valid (different from zapiToken)
    if (clientToken && clientToken !== zapiToken && clientToken.length > 0) {
      zapiHeaders["Client-Token"] = clientToken;
    }

    // Step 1: Check Z-API connection status
    const statusUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/status`;
    
    let connected = false;
    let statusError: string | null = null;

    try {
      console.log("Checking Z-API status...");
      const statusResponse = await fetch(statusUrl, {
        method: "GET",
        headers: zapiHeaders,
      });

      const statusText = await statusResponse.text();
      console.log("Z-API status response:", statusResponse.status, statusText);

      if (statusResponse.ok) {
        try {
          const statusData = JSON.parse(statusText);
          connected = statusData.connected === true || statusData.status === "connected";
          console.log("Connected status:", connected);
        } catch {
          console.log("Failed to parse status response as JSON");
        }
      } else {
        // Try parsing error message
        try {
          const errorData = JSON.parse(statusText);
          statusError = errorData.error || errorData.message || `Status check failed: ${statusResponse.status}`;
        } catch {
          statusError = `Status check failed: ${statusResponse.status}`;
        }
      }
    } catch (e) {
      console.error("Error checking Z-API status:", e);
      statusError = "Error connecting to Z-API";
    }

    // If connected, configure webhook for sent messages and return success
    if (connected) {
      // Configure Z-API to notify us of messages sent (so we detect secretary manual messages)
      const webhookUrl = `${supabaseUrl}/functions/v1/zapi-webhook?token=${clientToken || zapiToken}`;
      
      try {
        console.log("Configuring webhooks for sent message detection...");
        console.log("Webhook URL:", webhookUrl);
        
        // 1. Configure webhook for SENT messages (fromMe: true)
        const updateSendUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/update-webhook-send`;
        const sendRes = await fetch(updateSendUrl, {
          method: "PUT",
          headers: {
            ...zapiHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ value: webhookUrl }),
        });
        
        if (sendRes.ok) {
          console.log("✅ Webhook SEND configurado");
        } else {
          console.log("❌ Erro webhook send:", await sendRes.text());
        }

        // 2. Configure webhook for RECEIVED messages
        const updateReceivedUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/update-webhook-received`;
        const receivedRes = await fetch(updateReceivedUrl, {
          method: "PUT",
          headers: {
            ...zapiHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ value: webhookUrl }),
        });
        
        if (receivedRes.ok) {
          console.log("✅ Webhook RECEIVED configurado");
        } else {
          console.log("❌ Erro webhook received:", await receivedRes.text());
        }

        // 3. CRITICAL: Enable "Notify sent by me" option via API
        // This ensures the toggle in Z-API dashboard is activated
        const notifySentByMeUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/update-notify-sent-by-me`;
        const notifyRes = await fetch(notifySentByMeUrl, {
          method: "PUT",
          headers: {
            ...zapiHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ value: true }),
        });
        
        if (notifyRes.ok) {
          console.log("✅ Notify sent by me ATIVADO via API");
        } else {
          console.log("⚠️ Não foi possível ativar notify-sent-by-me via API:", await notifyRes.text());
          console.log("   (Isso é OK se já está ativado no painel da Z-API)");
        }

      } catch (e) {
        console.error("Error configuring webhooks:", e);
      }

      return new Response(
        JSON.stringify({ connected: true, qrCodeBase64: null, webhookConfigured: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: If not connected, fetch QR code image
    const qrUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/qr-code/image`;
    
    let qrCodeBase64: string | null = null;
    let errorMessage: string | null = statusError;

    try {
      console.log("Fetching QR code from Z-API...");
      const qrResponse = await fetch(qrUrl, {
        method: "GET",
        headers: zapiHeaders,
      });

      const contentType = qrResponse.headers.get("content-type") || "";
      console.log("QR response status:", qrResponse.status, "content-type:", contentType);

      if (!qrResponse.ok) {
        const errorText = await qrResponse.text();
        console.error("Z-API QR error:", qrResponse.status, errorText);
        
        // Parse error message if JSON
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || `Z-API error: ${qrResponse.status}`;
        } catch {
          errorMessage = `Z-API error: ${qrResponse.status}`;
        }
      } else if (contentType.includes("application/json")) {
        // JSON response - could be { value: "base64..." } or error
        const jsonData = await qrResponse.json();
        console.log("QR JSON response keys:", Object.keys(jsonData));

        if (jsonData.value) {
          const base64Data = jsonData.value;
          if (base64Data.startsWith("data:image")) {
            qrCodeBase64 = base64Data;
          } else {
            qrCodeBase64 = `data:image/png;base64,${base64Data}`;
          }
        } else if (jsonData.qrcode) {
          const base64Data = jsonData.qrcode;
          if (base64Data.startsWith("data:image")) {
            qrCodeBase64 = base64Data;
          } else {
            qrCodeBase64 = `data:image/png;base64,${base64Data}`;
          }
        } else if (jsonData.error) {
          errorMessage = jsonData.error;
        } else if (jsonData.message) {
          // Info message - might indicate need to restart instance
          console.log("Z-API message:", jsonData.message);
          errorMessage = jsonData.message;
        }
      } else if (contentType.includes("image/")) {
        // Binary image response - convert to base64
        const arrayBuffer = await qrResponse.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        qrCodeBase64 = `data:image/png;base64,${base64}`;
        console.log("Converted binary image to base64, length:", base64.length);
      } else {
        // Text response - might be base64 directly
        const textData = await qrResponse.text();
        console.log("QR text response length:", textData.length);
        
        if (textData.startsWith("data:image")) {
          qrCodeBase64 = textData;
        } else if (textData.match(/^[A-Za-z0-9+/=]+$/) && textData.length > 100) {
          qrCodeBase64 = `data:image/png;base64,${textData}`;
        }
      }
    } catch (e) {
      console.error("Error fetching QR code:", e);
      if (!errorMessage) {
        errorMessage = "Erro ao buscar QR Code";
      }
    }

    return new Response(
      JSON.stringify({ 
        connected: false, 
        qrCodeBase64,
        error: errorMessage
      }),
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
