import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-client-token",
};

// Helper to check if a message is from Clara (sent via API) by checking provider_message_id
async function isMessageFromClara(supabase: any, messageId: string): Promise<boolean> {
  if (!messageId) return false;
  
  const { data: existingMsg } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("provider_message_id", messageId)
    .maybeSingle();
  
  return !!existingMsg;
}

// Helper to create or update auto-pause for 1 hour
async function createOrUpdateAutoPause(supabase: any, phone: string, senderName: string | null) {
  const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  
  // Check if there's already a handoff entry for this phone
  const { data: existingHandoff } = await supabase
    .from("human_handoff_queue")
    .select("id, status")
    .eq("phone", phone)
    .or(`status.eq.open,auto_pause_until.gt.${new Date().toISOString()}`)
    .maybeSingle();
  
  if (existingHandoff) {
    // Update existing entry with new pause time
    await supabase
      .from("human_handoff_queue")
      .update({ auto_pause_until: oneHourFromNow })
      .eq("id", existingHandoff.id);
    console.log("Updated auto-pause for phone:", phone);
  } else {
    // Create new entry with auto-pause (status = 'resolved' since it's automatic)
    await supabase.from("human_handoff_queue").insert({
      phone,
      patient_name: senderName,
      status: "resolved", // Not a manual handoff, just auto-pause
      auto_pause_until: oneHourFromNow,
    });
    console.log("Created auto-pause for phone:", phone);
  }
}

// Helper to check if Clara should be paused (handoff open OR auto-pause active)
async function shouldPauseClara(supabase: any, phone: string): Promise<boolean> {
  const now = new Date().toISOString();
  
  const { data: activeHandoff } = await supabase
    .from("human_handoff_queue")
    .select("id, status, auto_pause_until")
    .eq("phone", phone)
    .or(`status.eq.open,auto_pause_until.gt.${now}`)
    .maybeSingle();
  
  return !!activeHandoff;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate webhook secret.
    const expectedToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
    const url = new URL(req.url);
    const tokenFromQuery = url.searchParams.get("token");
    const tokenFromHeaders =
      req.headers.get("Client-Token") ||
      req.headers.get("client-token") ||
      req.headers.get("x-client-token") ||
      req.headers.get("X-Client-Token");

    const providedToken = tokenFromHeaders || tokenFromQuery;
    if (!expectedToken || !providedToken || providedToken !== expectedToken) {
      console.log(
        "Unauthorized webhook (missing/invalid token). HasHeaderToken:",
        Boolean(tokenFromHeaders),
        "HasQueryToken:",
        Boolean(tokenFromQuery)
      );
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body, null, 2));

    // Initialize Supabase with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Extract common data
    const phone = body.phone || body.from?.replace("@c.us", "");
    const messageId = body.messageId || body.id;
    const text = body.text?.message || body.text || body.body || "";
    const senderName = body.senderName || body.pushName || body.notifyName || null;

    // Handle fromMe messages (could be Clara or Secretary)
    if (body.fromMe) {
      // Check if message is old or from history - ignore these
      if (body.isOld || body.isFromHistory || body.waitingMessage) {
        console.log("Ignoring fromMe message: isOld, isFromHistory, or waitingMessage");
        return new Response(
          JSON.stringify({ success: true, ignored: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if this message was sent by Clara (already exists in our database)
      const isFromClara = await isMessageFromClara(supabase, messageId);
      
      if (isFromClara) {
        console.log("Message is from Clara (API), ignoring");
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: "from_clara" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // This is a manual message from the secretary - create/update auto-pause
      console.log("Manual message from secretary detected, creating 1-hour auto-pause");
      await createOrUpdateAutoPause(supabase, phone, null);
      
      return new Response(
        JSON.stringify({ success: true, autoPauseCreated: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // From here on, handle inbound messages from patients (fromMe = false)
    
    // Ignore old messages or history sync
    if (body.isOld || body.isFromHistory || body.waitingMessage) {
      console.log("Ignoring message: isOld, isFromHistory, or waitingMessage");
      return new Response(
        JSON.stringify({ success: true, ignored: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check message timestamp (ignore if older than 2 minutes)
    const messageTimestamp = body.momment || body.timestamp;
    if (messageTimestamp) {
      const msgTime = new Date(messageTimestamp).getTime();
      const now = Date.now();
      const twoMinutesAgo = now - (2 * 60 * 1000);
      
      if (msgTime < twoMinutesAgo) {
        console.log("Ignoring old message (> 2 minutes)");
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: "old_message" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!phone || !text) {
      console.log("Missing phone or text");
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: "missing_data" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate message (idempotency)
    if (messageId) {
      const { data: existingMsg } = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("provider_message_id", messageId)
        .maybeSingle();

      if (existingMsg) {
        console.log("Duplicate message, ignoring");
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: "duplicate" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Save inbound message to context table
    await supabase.from("whatsapp_messages").insert({
      phone,
      provider_message_id: messageId,
      direction: "inbound",
      content: text,
    });

    // Check if Clara should be paused (handoff open OR auto-pause active)
    const isPaused = await shouldPauseClara(supabase, phone);
    if (isPaused) {
      console.log("Clara is paused for this phone (handoff or auto-pause), skipping AI processing");
      return new Response(
        JSON.stringify({ success: true, handoffActive: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load last 15 messages for context
    const { data: contextMessages } = await supabase
      .from("whatsapp_messages")
      .select("direction, content, created_at")
      .eq("phone", phone)
      .order("created_at", { ascending: true })
      .limit(15);

    // Format messages for AI
    const formattedHistory = (contextMessages || []).map((msg) => ({
      role: msg.direction === "inbound" ? "user" : "assistant",
      content: msg.content,
    }));

    // Call chat-atendimento edge function
    const chatResponse = await fetch(`${supabaseUrl}/functions/v1/chat-atendimento`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        mensagem: text,
        historico: formattedHistory,
        canal: "whatsapp",
        telefone: phone,
        nome_paciente: senderName,
      }),
    });

    if (!chatResponse.ok) {
      console.error("Error calling chat-atendimento:", await chatResponse.text());
      return new Response(
        JSON.stringify({ success: false, error: "AI processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chatResult = await chatResponse.json();
    const aiResponse = chatResult.message || chatResult.resposta || chatResult.response || "";
    const humanHandoff = chatResult.handoff_humano || chatResult.humanHandoff || chatResult.human_handoff || false;

    // If AI signals handoff, create handoff entry and send notification message
    if (humanHandoff) {
      console.log("AI requested human handoff");
      
      // Send handoff notification message to patient
      const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
      const zapiToken = Deno.env.get("ZAPI_TOKEN");
      const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
      
      const handoffMessage = "Entendi! Vou encaminhar você para um de nossos atendentes. " +
        "Assim que possível, alguém da nossa equipe entrará em contato. " +
        "Fique tranquilo(a), não precisa repetir a solicitação. 😊";

      if (instanceId && zapiToken) {
        const sendUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/send-text`;
        
        const sendResponse = await fetch(sendUrl, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Client-Token": clientToken || "",
          },
          body: JSON.stringify({
            phone,
            message: handoffMessage,
          }),
        });

        if (sendResponse.ok) {
          const sendResult = await sendResponse.json();
          
          // Save outbound message
          await supabase.from("whatsapp_messages").insert({
            phone,
            provider_message_id: sendResult.messageId || null,
            direction: "outbound",
            content: handoffMessage,
          });
          
          console.log("Handoff notification sent successfully");
        } else {
          console.error("Failed to send handoff notification:", await sendResponse.text());
        }
      }
      
      // Create handoff entry
      await supabase.from("human_handoff_queue").insert({
        phone,
        patient_name: senderName,
        status: "open",
      });

      return new Response(
        JSON.stringify({ success: true, handoffCreated: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send response via Z-API
    if (aiResponse) {
      const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
      const zapiToken = Deno.env.get("ZAPI_TOKEN");

      if (instanceId && zapiToken) {
        const sendUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/send-text`;
        
        const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
        
        const sendResponse = await fetch(sendUrl, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Client-Token": clientToken || "",
          },
          body: JSON.stringify({
            phone,
            message: aiResponse,
          }),
        });

        if (sendResponse.ok) {
          const sendResult = await sendResponse.json();
          
          // Save outbound message
          await supabase.from("whatsapp_messages").insert({
            phone,
            provider_message_id: sendResult.messageId || null,
            direction: "outbound",
            content: aiResponse,
          });
        } else {
          console.error("Failed to send Z-API message:", await sendResponse.text());
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in zapi-webhook:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
