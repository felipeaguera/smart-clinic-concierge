import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é Clara, a assistente virtual de uma clínica médica.
Seu papel é atender pacientes de forma natural, humana, educada e eficiente,
auxiliando principalmente com orçamentos, agendamentos e informações gerais.

────────────────────────────────
COMPORTAMENTO GERAL
────────────────────────────────
• Fale sempre em português brasileiro.
• Use tom humano, educado, acolhedor e profissional.
• Interprete linguagem natural, mesmo com erros de ortografia, abreviações,
  informalidade ou frases incompletas.
• Nunca corrija o paciente.
• Nunca diga que "não entendeu" por erro de escrita.
• Sempre tente interpretar a intenção antes de qualquer decisão.
• SEMPRE responda ao paciente - NUNCA deixe o chat em silêncio.
• Frases curtas e claras. Evite excesso de informações.
• Emojis com moderação (máximo 1, quando fizer sentido).

Exemplos de tom:
- "Perfeito 😊"
- "Claro, te explico"
- "Fico à disposição"
- "Se quiser, posso agendar para você"

────────────────────────────────
ORÇAMENTOS (REGRA CENTRAL)
────────────────────────────────
A IA DEVE fornecer orçamentos automaticamente sempre que houver valores cadastrados.
O orçamento é uma das funções principais da IA.

Quando o paciente pedir orçamento:
- NÃO informar duração
- NÃO informar preparo
- NÃO informar orientações
- APENAS valores

### Identificação de itens:
O paciente pode pedir:
- Um item
- Vários itens na mesma frase
- Exames + consulta + médico específico

A IA deve identificar AUTOMATICAMENTE TODOS os itens citados,
mesmo que estejam escritos com erros de português.

### Apresentação do orçamento:

Quando houver APENAS UM ITEM com valor cadastrado:
- Informar apenas o valor daquele item
- Perguntar se deseja agendar

Exemplo:
"Ultrassom Abdominal
Valor: R$ 250,00

Deseja agendar?"

Quando houver MAIS DE UM ITEM com valores cadastrados:
- Informar o valor individual de cada item
- Informar o VALOR TOTAL ao final
- Perguntar se deseja agendar

Exemplo:
"Segue os valores:
- Ultrassom Morfológico: R$ 300,00
- Consulta com Dr. Klauber: R$ 180,00

Valor total: R$ 480,00

Deseja agendar?"

### IMPORTANTE:
• A IA NÃO deve encaminhar para atendente humano apenas porque há mais de um item.
• A IA NÃO deve encaminhar para humano se todos os valores existirem.
• Se algum item não tiver valor (has_price = false), informar os valores dos que têm e encaminhar o restante para humano.

────────────────────────────────
QUANDO ENCAMINHAR PARA HUMANO
────────────────────────────────
Encaminhe para atendente humano SOMENTE se:
• Algum item não existir no cadastro
• Algum item não tiver valor cadastrado (has_price = false)
• O paciente pedir convênio
• O paciente pedir desconto
• O paciente pedir negociação
• O paciente pedir explicitamente para falar com atendente
• Dúvida clínica complexa
• Pedido de encaixe/exceção
• Erro técnico real

NUNCA encaminhar por:
• Frase confusa ou mal escrita
• Erro de português
• Pedido com múltiplos itens (se todos têm valor, responda normalmente)

Ao encaminhar:
"Vou te encaminhar para um atendente humano agora, tudo bem?"
Usar função encaminhar_humano e encerrar respostas da IA.

────────────────────────────────
DURAÇÃO DOS EXAMES
────────────────────────────────
- NUNCA informar duração espontaneamente
- Informar duração SOMENTE se o paciente perguntar explicitamente:
  "Quanto tempo demora?", "É rápido?", "Dura quanto tempo?"

────────────────────────────────
AGENDAMENTO
────────────────────────────────
• A IA NÃO decide horários por conta própria.
• A IA SEMPRE consulta o Motor de Agenda (buscar_disponibilidade).
• A IA SEMPRE pede confirmação explícita antes de reservar.

Fluxo correto:
1. Orçamento
2. Perguntar se deseja agendar
3. Perguntar data
4. Consultar horários disponíveis
5. Apresentar opções
6. Confirmar explicitamente
7. Reservar

Interpretar frases como:
- "amanhã cedo" → amanhã, primeiro horário
- "primeiro horário" → buscar primeiro disponível
- "o mais cedo possível" → buscar primeiro disponível
- "marca no primeiro disponível" → buscar e sugerir

────────────────────────────────
INTERPRETAÇÃO DE DATAS
────────────────────────────────
A DATA ATUAL será informada no contexto - use como referência.

Conversões automáticas (faça internamente):
- "hoje" → data atual
- "amanhã" → data atual + 1 dia
- "depois de amanhã" → data atual + 2 dias
- "segunda/terça/etc" → próximo dia da semana correspondente
- "dia 15" → dia específico do mês atual ou próximo

Para datas ambíguas, pergunte:
- "semana que vem" → "Qual dia da semana que vem você prefere?"

FORMATAÇÃO:
⚠️ INTERNAMENTE: sempre YYYY-MM-DD (ex: 2026-01-06)
⚠️ PARA O PACIENTE: sempre DD/MM/YYYY (ex: 06/01/2026)

ÂNCORA TEMPORAL (OBRIGATÓRIA):

A IA deve considerar como "HOJE" a data informada no contexto inicial da conversa,
e manter essa referência fixa durante TODA a conversa.

A IA NÃO deve recalcular “hoje” a cada mensagem.
A IA NÃO deve avançar a data automaticamente sem confirmação explícita do paciente.

Se houver qualquer dúvida temporal, a IA deve PERGUNTAR antes de assumir.

────────────────────────────────
CONFIRMAÇÃO DE RESERVA
────────────────────────────────
- SOMENTE chamar reservar_horario após confirmação clara:
  "Pode marcar", "Confirmo", "Ok", "Esse mesmo", "Sim"
- NUNCA prometer horário antes da reserva
- Se o paciente pedir "primeiro horário disponível":
  - SUGERIR o horário encontrado
  - AGUARDAR confirmação
  - SÓ ENTÃO reservar

────────────────────────────────
APÓS AGENDAMENTO CONFIRMADO
────────────────────────────────
Somente após o agendamento ter sucesso:
- Informar data e horário confirmados
- Informar preparo (se houver)
- Informar orientações (se houver)
- Manter linguagem clara e tranquila

Exemplo:
"Seu exame ficou agendado para 06/01/2026 às 08:00.

Preparo: jejum de 6 horas.
Recomendação: trazer exames anteriores, se tiver.

Qualquer dúvida, fico à disposição 😊"

────────────────────────────────
AGENDA (TIPOS DE ATENDIMENTO)
────────────────────────────────
• Consultas seguem a agenda do médico.
• Ultrassons possuem agenda própria (independente do médico).
• Exames de sangue (laboratório) NÃO usam agenda - apenas informativos.

────────────────────────────────
OBJETIVO FINAL
────────────────────────────────
• Resolver o máximo possível sem intervenção humana.
• Passar segurança, clareza e profissionalismo.
• Simular uma recepcionista experiente e atenciosa.
• Priorizar sempre a experiência do paciente.

Seja sempre cordial, clara e objetiva.`;

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ConversationContext {
  selectedDoctorId?: string;
  selectedExamTypeId?: string;
  selectedDate?: string;
  selectedTime?: string;
  awaitingConfirmation?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = (await req.json()) as {
      messages: Message[];
      context?: ConversationContext;
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch available data for context
    const [doctorsResult, examTypesResult] = await Promise.all([
      supabase.from("doctors").select("id, nome, especialidade").eq("ativo", true),
      supabase
        .from("exam_types")
        .select("id, nome, categoria, duracao_minutos, preparo, orientacoes, has_price, price_private, currency")
        .eq("ativo", true),
    ]);

    const doctors = doctorsResult.data || [];
    const examTypes = examTypesResult.data || [];

    // Build context information with exam details including pricing
    const examTypesInfo = examTypes
      .map((e) => {
        let info = `- ${e.nome} (${e.categoria}) [ID: ${e.id}]`;

        // Add pricing info
        if (e.has_price && e.price_private) {
          const formattedPrice = new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: e.currency || "BRL",
          }).format(e.price_private);
          info += `\n  Valor: ${formattedPrice} (has_price: true)`;
        } else {
          info += `\n  Valor: NÃO CADASTRADO (has_price: false) - encaminhar para humano`;
        }

        // Add duration (only for non-lab exams)
        if (e.categoria !== "laboratorio" && e.duracao_minutos) {
          info += `\n  Duração: ${e.duracao_minutos} minutos`;
        }

        if (e.preparo) {
          info += `\n  Preparo: ${e.preparo}`;
        }
        if (e.orientacoes) {
          info += `\n  Orientações: ${e.orientacoes}`;
        }
        return info;
      })
      .join("\n\n");

    // Get current date for natural language date interpretation
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0];
    const weekdays = [
      "domingo",
      "segunda-feira",
      "terça-feira",
      "quarta-feira",
      "quinta-feira",
      "sexta-feira",
      "sábado",
    ];
    const currentWeekday = weekdays[now.getDay()];
    const formattedDate = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`;

    const contextInfo = `
DATA ATUAL DO SISTEMA: ${currentDate} (${currentWeekday}, ${formattedDate})
Use esta data como referência para interpretar datas em linguagem natural.

MÉDICOS DISPONÍVEIS:
${doctors.map((d) => `- ${d.nome} (${d.especialidade}) [ID: ${d.id}]`).join("\n")}

TIPOS DE EXAME (com preparo e orientações):
${examTypesInfo}

IMPORTANTE: Verifique o campo has_price de cada exame. Se has_price = false, encaminhar para humano para valores.

${
  context
    ? `CONTEXTO DA CONVERSA ATUAL:
- Médico selecionado: ${context.selectedDoctorId || "nenhum"}
- Exame selecionado: ${context.selectedExamTypeId || "nenhum"}
- Data selecionada: ${context.selectedDate || "nenhuma"}
- Horário selecionado: ${context.selectedTime || "nenhum"}
- Aguardando confirmação: ${context.awaitingConfirmation ? "sim" : "não"}`
    : ""
}
`;

    // Define tools for the AI
    const tools = [
      {
        type: "function",
        function: {
          name: "buscar_disponibilidade",
          description:
            "Busca horários disponíveis para agendamento. Use quando o paciente quiser agendar consulta ou ultrassom.",
          parameters: {
            type: "object",
            properties: {
              doctor_id: {
                type: "string",
                description: "UUID do médico",
              },
              exam_type_id: {
                type: "string",
                description: "UUID do tipo de exame",
              },
              data: {
                type: "string",
                description: "Data no formato YYYY-MM-DD",
              },
            },
            required: ["doctor_id", "exam_type_id", "data"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "reservar_horario",
          description: "Reserva um horário após confirmação EXPLÍCITA do paciente. NUNCA use sem confirmação.",
          parameters: {
            type: "object",
            properties: {
              doctor_id: {
                type: "string",
                description: "UUID do médico",
              },
              exam_type_id: {
                type: "string",
                description: "UUID do tipo de exame",
              },
              data: {
                type: "string",
                description: "Data no formato YYYY-MM-DD",
              },
              hora_inicio: {
                type: "string",
                description: "Hora de início no formato HH:MM",
              },
              hora_fim: {
                type: "string",
                description: "Hora de fim no formato HH:MM",
              },
            },
            required: ["doctor_id", "exam_type_id", "data", "hora_inicio", "hora_fim"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "encaminhar_humano",
          description:
            "Encaminha a conversa para um atendente humano. Use quando: paciente pedir, dúvida clínica, pedido de encaixe, exame não reconhecido.",
          parameters: {
            type: "object",
            properties: {
              motivo: {
                type: "string",
                description: "Motivo do encaminhamento",
              },
            },
            required: ["motivo"],
            additionalProperties: false,
          },
        },
      },
    ];

    // First AI call to get response or tool calls
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT + "\n\n" + contextInfo }, ...messages],
        tools,
        tool_choice: "auto",
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error("Erro ao processar sua mensagem.");
    }

    const aiData = await aiResponse.json();
    const choice = aiData.choices?.[0];

    if (!choice) {
      throw new Error("Resposta inválida da IA");
    }

    // Check if AI wants to call a tool
    if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
      const toolResults: { toolCall: any; result: any }[] = [];

      for (const toolCall of choice.message.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        console.log(`Executing tool: ${functionName}`, args);

        let result: any;

        if (functionName === "buscar_disponibilidade") {
          // Call the agenda-disponibilidade function
          const disponibilidadeResponse = await fetch(
            `${supabaseUrl}/functions/v1/agenda-disponibilidade?doctor_id=${args.doctor_id}&exam_type_id=${args.exam_type_id}&data=${args.data}`,
            {
              headers: {
                Authorization: `Bearer ${supabaseKey}`,
              },
            },
          );
          result = await disponibilidadeResponse.json();
          console.log("Disponibilidade result:", result);
        } else if (functionName === "reservar_horario") {
          // Call the agenda-reservar function
          const reservarResponse = await fetch(`${supabaseUrl}/functions/v1/agenda-reservar`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              doctor_id: args.doctor_id,
              exam_type_id: args.exam_type_id,
              data: args.data,
              hora_inicio: args.hora_inicio,
              hora_fim: args.hora_fim,
            }),
          });
          result = await reservarResponse.json();
          console.log("Reservar result:", result);
        } else if (functionName === "encaminhar_humano") {
          result = {
            success: true,
            message: "Conversa encaminhada para atendente humano.",
            motivo: args.motivo,
            encaminhado: true,
          };
        }

        toolResults.push({ toolCall, result });
      }

      // Build messages with tool results
      const messagesWithTools = [
        { role: "system", content: SYSTEM_PROMPT + "\n\n" + contextInfo },
        ...messages,
        choice.message,
        ...toolResults.map(({ toolCall, result }) => ({
          role: "tool" as const,
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        })),
      ];

      // Second AI call with tool results
      const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: messagesWithTools,
        }),
      });

      if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        console.error("Final AI response error:", finalResponse.status, errorText);
        throw new Error("Erro ao processar resposta.");
      }

      const finalData = await finalResponse.json();
      const finalContent =
        finalData.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua solicitação.";

      // Check if human handoff was triggered
      const humanHandoff = toolResults.some((tr) => tr.result?.encaminhado);

      return new Response(
        JSON.stringify({
          message: finalContent,
          humanHandoff,
          toolsUsed: toolResults.map((tr) => ({
            name: tr.toolCall.function.name,
            result: tr.result,
          })),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // No tool calls, return direct response
    return new Response(
      JSON.stringify({
        message: choice.message?.content || "Olá! Como posso ajudá-lo hoje?",
        humanHandoff: false,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
