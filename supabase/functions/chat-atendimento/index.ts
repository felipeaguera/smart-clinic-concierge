import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é uma assistente virtual de uma clínica médica. Seu nome é Clara.

REGRAS ABSOLUTAS:
1. Você NUNCA cria horários ou decide disponibilidade
2. Você NUNCA agenda sem confirmação explícita do paciente
3. Toda disponibilidade vem EXCLUSIVAMENTE das funções de agenda
4. Exames de LABORATÓRIO não usam agendamento - apenas oriente sobre preparo
5. Você NUNCA inventa ou calcula valores/preços - não existe tabela de preços no sistema
6. SEMPRE responda ao paciente - NUNCA deixe o chat em silêncio

INTERPRETAÇÃO DE DATAS EM LINGUAGEM NATURAL:
Você DEVE interpretar datas informadas pelo paciente em linguagem natural.
A DATA ATUAL DO SISTEMA será informada no contexto - use como referência.

Conversões automáticas (faça internamente, NÃO peça formato YYYY-MM-DD):
- "hoje" → data atual
- "amanhã" → data atual + 1 dia
- "depois de amanhã" → data atual + 2 dias
- "amanhã cedo" / "amanhã de manhã" → data atual + 1 dia (período: manhã)
- "amanhã à tarde" → data atual + 1 dia (período: tarde)
- "segunda-feira" / "terça" / etc → próximo dia da semana correspondente
- "daqui a X dias" → data atual + X dias
- "dia 15" / "dia 20" → dia específico do mês atual ou próximo

Para datas AMBÍGUAS que requerem confirmação:
- "semana que vem" → pergunte: "Qual dia da semana que vem você prefere?"
- "próxima semana" → pergunte: "Qual dia da próxima semana você prefere?"
- "fim do mês" → pergunte: "Qual dia você prefere no final do mês?"
- "próximo mês" → pergunte: "Qual dia do próximo mês você prefere?"

REGRAS DE DATA:
1. Se a data puder ser inferida com segurança, NÃO peça confirmação - prossiga automaticamente
2. NUNCA solicite formato YYYY-MM-DD ao paciente - faça a conversão internamente
3. Após converter a data, chame IMEDIATAMENTE a função buscar_disponibilidade
4. Se o paciente mencionar período (manhã/tarde), filtre os horários retornados

SUAS CAPACIDADES:
- Atender pacientes com cordialidade
- Interpretar pedidos médicos (texto ou imagem)
- Informar sobre tipos de exames disponíveis
- Auxiliar no agendamento de CONSULTAS e ULTRASSOM
- Orientar sobre preparo de exames
- Informar detalhes dos exames (nome, duração, preparo, orientações)
- INTERPRETAR DATAS EM LINGUAGEM NATURAL automaticamente

QUANDO O PACIENTE PEDIR ORÇAMENTO/VALOR/PREÇO:
1. NUNCA tente calcular ou inventar valores
2. Informe as informações que você TEM do exame:
   - Nome do exame
   - Duração aproximada (se disponível)
   - Preparo necessário (se houver)
   - Orientações ao paciente (se houver)
3. Depois, SEMPRE ofereça duas opções claras:
   "Para informações sobre valores, posso:
   1️⃣ Verificar horários disponíveis para agendamento
   2️⃣ Encaminhar você para um atendente humano que pode informar os valores"
4. Aguarde a escolha do paciente

FLUXO DE AGENDAMENTO (consulta/ultrassom):
1. Identificar o exame desejado
2. Coletar preferência de data do paciente (aceitar linguagem natural!)
3. Converter data para YYYY-MM-DD internamente
4. Usar função 'buscar_disponibilidade' para obter horários
5. Apresentar APENAS os horários retornados pela função
6. Após o paciente escolher, SEMPRE perguntar confirmação:
   "Confirmando: Exame: [nome], Data: [data em formato legível], Horário: [hora]. Posso confirmar?"
7. SOMENTE após "sim" explícito, usar função 'reservar_horario'
8. Se erro, informar e pedir novo horário

ENCAMINHAMENTO PARA HUMANO:
Se o paciente pedir para falar com atendente, tiver dúvida clínica, pedir encaixe/exceção, 
pedir valores/orçamento e escolher falar com humano, ou se o exame não for reconhecido:
Use a função 'encaminhar_humano' e responda:
"Entendo. Vou encaminhar você para um atendente humano. Um momento, por favor."

INFORMAÇÕES DISPONÍVEIS:
- Lista de médicos e suas especialidades
- Tipos de exames com: nome, categoria, duração, preparo e orientações
- Regras de atendimento por médico
- NÃO há tabela de preços disponível

Seja sempre cordial, clara e objetiva. Use português brasileiro.
IMPORTANTE: Sempre dê uma resposta ao paciente, nunca deixe em silêncio.`;

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
    const { messages, context } = await req.json() as { 
      messages: Message[]; 
      context?: ConversationContext 
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
      supabase.from("exam_types").select("id, nome, categoria, duracao_minutos, preparo, orientacoes").eq("ativo", true)
    ]);

    const doctors = doctorsResult.data || [];
    const examTypes = examTypesResult.data || [];

    // Build context information with exam details
    const examTypesInfo = examTypes.map(e => {
      let info = `- ${e.nome} (${e.categoria}`;
      if (e.categoria !== 'laboratorio' && e.duracao_minutos) {
        info += `, ${e.duracao_minutos}min`;
      }
      info += `) [ID: ${e.id}]`;
      if (e.preparo) {
        info += `\n  Preparo: ${e.preparo}`;
      }
      if (e.orientacoes) {
        info += `\n  Orientações: ${e.orientacoes}`;
      }
      return info;
    }).join("\n");

    // Get current date for natural language date interpretation
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
    const currentWeekday = weekdays[now.getDay()];
    const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

    const contextInfo = `
DATA ATUAL DO SISTEMA: ${currentDate} (${currentWeekday}, ${formattedDate})
Use esta data como referência para interpretar datas em linguagem natural.

MÉDICOS DISPONÍVEIS:
${doctors.map(d => `- ${d.nome} (${d.especialidade}) [ID: ${d.id}]`).join("\n")}

TIPOS DE EXAME (com preparo e orientações):
${examTypesInfo}

IMPORTANTE: Não há tabela de preços cadastrada. Para valores, encaminhar ao atendente humano.

${context ? `CONTEXTO DA CONVERSA ATUAL:
- Médico selecionado: ${context.selectedDoctorId || "nenhum"}
- Exame selecionado: ${context.selectedExamTypeId || "nenhum"}
- Data selecionada: ${context.selectedDate || "nenhuma"}
- Horário selecionado: ${context.selectedTime || "nenhum"}
- Aguardando confirmação: ${context.awaitingConfirmation ? "sim" : "não"}` : ""}
`;

    // Define tools for the AI
    const tools = [
      {
        type: "function",
        function: {
          name: "buscar_disponibilidade",
          description: "Busca horários disponíveis para agendamento. Use quando o paciente quiser agendar consulta ou ultrassom.",
          parameters: {
            type: "object",
            properties: {
              doctor_id: {
                type: "string",
                description: "UUID do médico"
              },
              exam_type_id: {
                type: "string",
                description: "UUID do tipo de exame"
              },
              data: {
                type: "string",
                description: "Data no formato YYYY-MM-DD"
              }
            },
            required: ["doctor_id", "exam_type_id", "data"],
            additionalProperties: false
          }
        }
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
                description: "UUID do médico"
              },
              exam_type_id: {
                type: "string",
                description: "UUID do tipo de exame"
              },
              data: {
                type: "string",
                description: "Data no formato YYYY-MM-DD"
              },
              hora_inicio: {
                type: "string",
                description: "Hora de início no formato HH:MM"
              },
              hora_fim: {
                type: "string",
                description: "Hora de fim no formato HH:MM"
              }
            },
            required: ["doctor_id", "exam_type_id", "data", "hora_inicio", "hora_fim"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "encaminhar_humano",
          description: "Encaminha a conversa para um atendente humano. Use quando: paciente pedir, dúvida clínica, pedido de encaixe, exame não reconhecido.",
          parameters: {
            type: "object",
            properties: {
              motivo: {
                type: "string",
                description: "Motivo do encaminhamento"
              }
            },
            required: ["motivo"],
            additionalProperties: false
          }
        }
      }
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
        messages: [
          { role: "system", content: SYSTEM_PROMPT + "\n\n" + contextInfo },
          ...messages,
        ],
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
            }
          );
          result = await disponibilidadeResponse.json();
          console.log("Disponibilidade result:", result);
        } 
        else if (functionName === "reservar_horario") {
          // Call the agenda-reservar function
          const reservarResponse = await fetch(
            `${supabaseUrl}/functions/v1/agenda-reservar`,
            {
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
            }
          );
          result = await reservarResponse.json();
          console.log("Reservar result:", result);
        }
        else if (functionName === "encaminhar_humano") {
          result = {
            success: true,
            message: "Conversa encaminhada para atendente humano.",
            motivo: args.motivo,
            encaminhado: true
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
      const finalContent = finalData.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua solicitação.";

      // Check if human handoff was triggered
      const humanHandoff = toolResults.some(tr => tr.result?.encaminhado);

      return new Response(JSON.stringify({ 
        message: finalContent,
        humanHandoff,
        toolsUsed: toolResults.map(tr => ({
          name: tr.toolCall.function.name,
          result: tr.result
        }))
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No tool calls, return direct response
    return new Response(JSON.stringify({ 
      message: choice.message?.content || "Olá! Como posso ajudá-lo hoje?",
      humanHandoff: false
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro desconhecido" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
