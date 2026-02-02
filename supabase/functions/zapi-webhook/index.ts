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
async function createOrUpdateAutoPause(
  supabase: any,
  phone: string,
  senderName: string | null
): Promise<boolean> {
  // Safety: require a real phone number (digits only is the expectation in our DB)
  if (!phone || phone.includes("@")) {
    console.log("⏭️ Ignorando auto-pause: phone inválido:", phone);
    return false;
  }

  // Also ignore the clinic's own number (connectedPhone)
  const connectedPhone = Deno.env.get("CLINIC_PHONE") || "5515981342319";
  if (phone === connectedPhone) {
    console.log("⏭️ Ignorando auto-pause para o próprio número da clínica:", phone);
    return false;
  }
  
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
    return true;
  } else {
    // Create new entry with auto-pause (status = 'resolved' since it's automatic)
    await supabase.from("human_handoff_queue").insert({
      phone,
      patient_name: senderName,
      status: "resolved", // Not a manual handoff, just auto-pause
      auto_pause_until: oneHourFromNow,
    });
    console.log("Created auto-pause for phone:", phone);
    return true;
  }
}

// When Z-API sends a manual secretary message, sometimes it uses a @lid identifier.
// In that case, we can resolve the real patient phone by looking up the referenced message.
async function resolveRealPhoneFromReference(
  supabase: any,
  payload: any
): Promise<string | null> {
  const phoneRaw = payload?.phone || payload?.from || null;
  if (typeof phoneRaw === "string" && !phoneRaw.includes("@")) return phoneRaw;

  const referenceMessageId =
    payload?.referenceMessageId ||
    payload?.reference_message_id ||
    payload?.quotedMessageId ||
    null;

  if (!referenceMessageId) return null;

  const { data: referencedMsg, error } = await supabase
    .from("whatsapp_messages")
    .select("phone")
    .eq("provider_message_id", referenceMessageId)
    .maybeSingle();

  if (error) {
    console.log("⚠️ Falha ao resolver phone via referenceMessageId:", error);
    return null;
  }

  return referencedMsg?.phone ?? null;
}

// Helper to check if Clara should be paused (handoff open OR auto-pause active)
async function shouldPauseClara(supabase: any, phone: string): Promise<boolean> {
  // Only check real phone numbers (not internal @lid identifiers)
  if (!phone || phone.includes("@lid")) {
    return false;
  }
  
  const now = new Date().toISOString();
  
  // Check for OPEN handoff (manual handoff request)
  const { data: openHandoff } = await supabase
    .from("human_handoff_queue")
    .select("id")
    .eq("phone", phone)
    .eq("status", "open")
    .maybeSingle();
  
  if (openHandoff) {
    console.log("🔴 Handoff OPEN encontrado para:", phone);
    return true;
  }
  
  // Check for active auto-pause (secretary intervened recently)
  // IMPORTANT: Only pause if auto_pause_until is in the future AND this is not a resolved handoff
  const { data: autoPause } = await supabase
    .from("human_handoff_queue")
    .select("id, auto_pause_until")
    .eq("phone", phone)
    .eq("status", "resolved")
    .gt("auto_pause_until", now)
    .order("auto_pause_until", { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (autoPause) {
    console.log("⏸️ Auto-pause ativo para:", phone, "até:", autoPause.auto_pause_until);
    return true;
  }
  
  return false;
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
    
    // 🔔 LOG ABSOLUTO - Primeiro log antes de qualquer filtro
    console.log("🔔 WEBHOOK ENTRADA RAW:", JSON.stringify({
      fromMe: body.fromMe,
      fromMeType: typeof body.fromMe,
      self: body.self,
      phone: body.phone || body.from,
      type: body.type,
      event: body.event,
      isStatusMessage: body.isStatusMessage,
      isOld: body.isOld,
      fromApi: body.fromApi,
      messageId: body.messageId || body.id,
    }, null, 2));
    
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

    // ============================================================
    // DETECÇÃO DE MENSAGEM MANUAL DA SECRETÁRIA
    // ============================================================
    // Detectar fromMe em múltiplos formatos (boolean, string, ou self)
    const isFromMe = body.fromMe === true || body.fromMe === "true" || body.self === true;
    
    // NOVO: Detectar evento de mensagem enviada via webhook-send
    // Z-API pode enviar eventos como "MessageSendCallback", "message-send", etc.
    const isSendEvent = 
      body.type === "MessageSendCallback" ||
      body.type === "message-send" ||
      body.event === "message-send" ||
      body.event === "MessageSendCallback" ||
      body.status === "SENT" ||
      (body.fromMe === true && body.type !== "ReceivedCallback");
    
    console.log("📊 Análise fromMe:", {
      "body.fromMe": body.fromMe,
      "typeof body.fromMe": typeof body.fromMe,
      "body.self": body.self,
      "body.type": body.type,
      "body.event": body.event,
      "body.status": body.status,
      "isFromMe (calculado)": isFromMe,
      "isSendEvent": isSendEvent,
    });
    
    if (isFromMe || isSendEvent) {
      console.log("📤 MENSAGEM ENVIADA (fromMe/sendEvent detectado) para telefone:", phone);
      console.log("   - messageId:", messageId);
      console.log("   - isOld:", body.isOld);
      console.log("   - fromApi:", body.fromApi);
      console.log("   - waitingMessage:", body.waitingMessage);
      
      // Check if message is old or from history - ignore these
      if (body.isOld || body.isFromHistory || body.waitingMessage) {
        console.log("⏭️ Ignorando fromMe: isOld, isFromHistory, ou waitingMessage");
        return new Response(
          JSON.stringify({ success: true, ignored: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if this message was sent by Clara (already exists in our database)
      const isFromClara = await isMessageFromClara(supabase, messageId);
      console.log("   - isFromClara (exists in DB):", isFromClara);
      
      if (isFromClara) {
        console.log("✅ Mensagem é da Clara (via API), ignorando");
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: "from_clara" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ============================================================
      // MENSAGEM MANUAL DA SECRETÁRIA DETECTADA!
      // ============================================================
      console.log("🔴🔴🔴 MENSAGEM MANUAL DA SECRETÁRIA DETECTADA! 🔴🔴🔴");
      // Resolve real patient phone when Z-API provides a @lid identifier
      const resolvedPhone = (await resolveRealPhoneFromReference(supabase, body)) || phone;
      console.log("   - Telefone (raw):", phone);
      console.log("   - Telefone (resolvido):", resolvedPhone);
      console.log("   - Texto:", text?.substring(0, 50) || "(vazio)");
      console.log("   - Criando pausa automática de 1 hora...");

      const pauseCreated = await createOrUpdateAutoPause(supabase, resolvedPhone, null);
      if (pauseCreated) {
        console.log("✅ Pausa automática criada/atualizada com sucesso para:", resolvedPhone);
      } else {
        console.log(
          "⚠️ Não foi possível criar pausa automática (sem phone real). Raw:",
          phone,
          "Resolved:",
          resolvedPhone
        );
      }
      
      return new Response(
        JSON.stringify({ success: true, autoPauseCreated: pauseCreated, phone: resolvedPhone }),
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
      console.log("⏸️ CLARA PAUSADA para telefone:", phone);
      console.log("   - Motivo: handoff ativo ou pausa automática (secretária respondendo)");
      console.log("   - A Clara NÃO responderá esta mensagem");
      return new Response(
        JSON.stringify({ success: true, handoffActive: true, claraPaused: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load recent messages for context (MOST RECENT first, then reverse to chronological)
    // IMPORTANT: Using ascending + limit would return the oldest messages and lose context.
    const { data: contextMessages } = await supabase
      .from("whatsapp_messages")
      .select("direction, content, created_at")
      .eq("phone", phone)
      .order("created_at", { ascending: false })
      .limit(30);

    const formattedHistory = (contextMessages || [])
      .slice()
      .reverse()
      .map((msg) => ({
        role: msg.direction === "inbound" ? "user" : "assistant",
        content: msg.content,
      }));

    // Call chat-atendimento backend function.
    // IMPORTANT: Don't send `mensagem` separately because the last inbound message is
    // already included in formattedHistory (we just inserted it). Sending both duplicates
    // the user's last message and can confuse the model.
    const chatResponse = await fetch(`${supabaseUrl}/functions/v1/chat-atendimento`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        messages: formattedHistory,
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
