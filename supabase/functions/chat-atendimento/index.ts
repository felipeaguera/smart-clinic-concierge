import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT - Reestruturado para consistência
// ════════════════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `Você é Clara, assistente virtual de uma clínica médica.

═══════════════════════════════════════
1. REGRAS DE OURO (invioláveis)
═══════════════════════════════════════
1. SEMPRE responda ao paciente - NUNCA deixe o chat em silêncio.
2. Se o exame/consulta tem preço cadastrado → RESPONDA COM O VALOR. Proibido encaminhar para humano.
3. Se há múltiplos itens COM preço → liste valores individuais + total.
4. Encaminhe para humano APENAS se: convênio, desconto, item SEM preço, pedido explícito, dúvida clínica.
5. Interprete erros de escrita e abreviações - NUNCA corrija o paciente.
6. Não falar tempo de duração da consulta ou exame
7. Sempre seja cordial e com tom acolhedor


═══════════════════════════════════════
2. FLUXO DE ORÇAMENTO
═══════════════════════════════════════
Quando o paciente pedir orçamento:

PASSO 1: Identificar itens na mensagem (exames, consultas)
- Normalizar: "usg/ultra/ultrason" → Ultrassom
- Normalizar: "eco" → Ultrassom
- Normalizar: "morfo" → Ultrassom Morfológico
- Ignorar erros de escrita

PASSO 2: Para cada item identificado, verificar no cadastro:
- Se has_price = true → usar o valor cadastrado
- Se has_price = false → marcar como "sem preço"

PASSO 3: Responder:
- UM item com preço: "Ultrassom de Abdome: R$ 250,00. Deseja agendar?"
- MÚLTIPLOS itens com preço: listar cada + total
- ALGUNS sem preço: listar os que têm preço, depois avisar sobre os demais e encaminhar

Formato para múltiplos itens:
"Segue os valores:
- Item 1: R$ X
- Item 2: R$ Y
Total: R$ Z

Deseja agendar?"

⚠️ NÃO informar duração, preparo ou orientações no orçamento.

═══════════════════════════════════════
3. FLUXO DE AGENDAMENTO
═══════════════════════════════════════

PASSO 1: Identificar categoria do exame
- ULTRASSOM: Usar buscar_disponibilidade_categoria (busca TODOS os médicos de ultrassom)
- CONSULTA: Se médico não especificado, perguntar qual médico deseja

PASSO 2: BUSCA DA PRÓXIMA VAGA (IMPORTANTE)
- Se o paciente pedir “próxima vaga/horário/data disponível” OU se não houver horários na data consultada,
  use buscar_proxima_vaga para encontrar automaticamente a PRIMEIRA disponibilidade.
- Se o pedido for “próximo HORÁRIO” (ainda hoje), passe hora_minima (ex: hora atual) para evitar sugerir horários no passado.
Fale APENAS OS 3 PROXIMOS HORÁRIOS DISPONÍVEIS. 

PASSO 3: PARA ULTRASSONS
1. Chamar buscar_disponibilidade_categoria com exam_type_id + data
2. Receber lista de TODOS os médicos disponíveis com seus horários
3. Apresentar de forma clara:
   "Para amanhã, tenho os seguintes horários:
   
   Com Dr. Felipe Aguera:
   - 08:00, 08:30, 09:00
   
   Com Dra. Maria:
   - 14:00, 14:30, 15:00
   
   Qual prefere?"
4. AGUARDAR escolha do paciente (médico + horário)
5. ANTES de reservar, PERGUNTAR O NOME COMPLETO DO PACIENTE
6. Chamar reservar_horario com os dados escolhidos + paciente_nome
7. Após sucesso: informar data/horário + preparo + orientações

PASSO 4: PARA CONSULTAS
1. Se paciente especificou médico → usar buscar_disponibilidade direto
2. Se não especificou → perguntar: "Temos consulta com Dr. X (especialidade) e Dr. Y (especialidade). Qual prefere?"
3. Após escolha, buscar disponibilidade do médico escolhido
4. Se não houver horários, usar buscar_proxima_vaga e oferecer a primeira data disponível

DATAS:
- Usar DATA ATUAL do contexto como referência fixa
- "amanhã" = data atual + 1
- "segunda/terça" = próximo dia da semana
- Formato interno: YYYY-MM-DD
- Formato para paciente: DD/MM/YYYY

MÚLTIPLOS ITENS:
- Tentar agendar TODOS no mesmo dia
- Se impossível, informar e perguntar se aceita datas diferentes

EXIBIÇÃO DE HORÁRIOS (REGRA OBRIGATÓRIA):

Quando buscar_disponibilidade retornar vários horários:

- A IA deve EXIBIR APENAS OS 3 PRÓXIMOS HORÁRIOS DISPONÍVEIS.
- Os horários devem estar em ordem cronológica.
- A IA NÃO deve listar todos os horários do dia.
- A IA pode informar que há outros horários disponíveis, sem listá-los.

Formato preferencial:
"Tenho os seguintes horários disponíveis:
- 08:00
- 08:10
- 08:20

Posso agendar algum desses para você?"

Se o paciente não escolher nenhum:
- Oferecer os próximos horários em seguida
- OU perguntar se deseja outro período (manhã/tarde).

═══════════════════════════════════════
4. QUANDO ENCAMINHAR PARA HUMANO
═══════════════════════════════════════
ENCAMINHAR se:
- Paciente pedir convênio/desconto/negociação
- Paciente pedir explicitamente para falar com atendente
- Item não existe no cadastro
- Item existe mas has_price = false
- Dúvida clínica complexa
- Pedido de encaixe/exceção

NUNCA encaminhar por:
- Frase confusa ou erro de português
- Múltiplos itens (se todos têm preço, responda)
- Agenda cheia em um dia (buscar próxima vaga automaticamente)

═══════════════════════════════════════
5. TOM DE VOZ
═══════════════════════════════════════
- Português brasileiro, educado, acolhedor
- Frases curtas e claras, sem sem parecer seco. 
- Máximo 1 emoji por mensagem, quando natural
- Exemplos: "Perfeito 😊", "Claro!", "Fico à disposição"
- Evite frases como "marcar o que"

═══════════════════════════════════════
6. REGRAS ESPECÍFICAS
═══════════════════════════════════════
DURAÇÃO: Só informar se o paciente perguntar explicitamente.
PREPARO/ORIENTAÇÕES: Só informar APÓS agendamento confirmado.
LABORATÓRIO: Exames de laboratório NÃO usam agenda.
ULTRASSOM: Sempre usar buscar_disponibilidade_categoria para mostrar TODOS os médicos.
CONSULTA: Sempre perguntar qual médico se não especificado.
QUANDO O PREPARO FOR "NEHUM" OU NADA ESTIVER ANOTADO NAO PRECISA CITAR ISSO NA MENSSAGEM
`;

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

// Normaliza texto para matching
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Aliases comuns para exames
const EXAM_ALIASES: Record<string, string[]> = {
  ultrassom: ["usg", "ultra", "ultrason", "ultrassonografia", "us"],
  morfologico: ["morfo", "morfológico", "morfologica"],
  abdome: ["abdominal", "abdomen", "abdomem", "abdome total"],
  transvaginal: ["tv", "transvaginal", "endovaginal"],
  mamaria: ["mama", "mamas", "mamografia"],
  tireoide: ["tireóide", "tireoide"],
  consulta: ["consulta", "atendimento"],
};

// Verifica se um termo corresponde a um exame
function matchesExam(examName: string, searchTerm: string): boolean {
  const normalizedExam = normalizeText(examName);
  const normalizedSearch = normalizeText(searchTerm);

  // Match direto
  if (normalizedExam.includes(normalizedSearch) || normalizedSearch.includes(normalizedExam)) {
    return true;
  }

  // Match por palavras
  const searchWords = normalizedSearch.split(" ");
  const examWords = normalizedExam.split(" ");

  const matchingWords = searchWords.filter((sw) => examWords.some((ew) => ew.includes(sw) || sw.includes(ew)));

  if (matchingWords.length >= Math.min(2, searchWords.length)) {
    return true;
  }

  // Match por aliases
  for (const [key, aliases] of Object.entries(EXAM_ALIASES)) {
    if (normalizedExam.includes(key)) {
      for (const alias of aliases) {
        if (normalizedSearch.includes(alias)) {
          return true;
        }
      }
    }
  }

  return false;
}

// Extrai itens mencionados na mensagem do paciente
function extractMentionedItems(
  message: string,
  examTypes: any[],
  doctors: any[],
): {
  foundExams: any[];
  foundDoctors: any[];
  unresolved: string[];
} {
  const normalized = normalizeText(message);
  const foundExams: any[] = [];
  const foundDoctors: any[] = [];
  const unresolved: string[] = [];

  // Tentar encontrar exames
  for (const exam of examTypes) {
    if (matchesExam(exam.nome, message)) {
      if (!foundExams.find((e) => e.id === exam.id)) {
        foundExams.push(exam);
      }
    }
  }

  // Tentar encontrar médicos
  for (const doctor of doctors) {
    const normalizedDoctor = normalizeText(doctor.nome);
    if (
      normalized.includes(normalizedDoctor) ||
      normalizedDoctor.split(" ").some((w: string) => w.length > 3 && normalized.includes(w))
    ) {
      if (!foundDoctors.find((d) => d.id === doctor.id)) {
        foundDoctors.push(doctor);
      }
    }
  }

  // Detectar termos não resolvidos (palavras-chave de orçamento sem match)
  const budgetKeywords = ["orcamento", "valor", "preco", "quanto", "custa"];
  const hasBudgetIntent = budgetKeywords.some((k) => normalized.includes(k));

  if (hasBudgetIntent && foundExams.length === 0) {
    // Tentar extrair o que o paciente quer
    const words = normalized.split(" ");
    const stopWords = [
      "de",
      "do",
      "da",
      "um",
      "uma",
      "o",
      "a",
      "e",
      "para",
      "com",
      "quero",
      "gostaria",
      "orcamento",
      "valor",
      "preco",
      "quanto",
      "custa",
      "saber",
    ];
    const relevantWords = words.filter((w) => w.length > 2 && !stopWords.includes(w));
    if (relevantWords.length > 0) {
      unresolved.push(relevantWords.join(" "));
    }
  }

  return { foundExams, foundDoctors, unresolved };
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
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

    // Pré-processar a última mensagem do usuário para ajudar a IA
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const { foundExams, foundDoctors, unresolved } = extractMentionedItems(lastUserMessage, examTypes, doctors);

    // Build simplified context with pricing focus
    const examsWithPrice = examTypes.filter((e) => e.has_price && e.price_private);
    const examsWithoutPrice = examTypes.filter((e) => !e.has_price || !e.price_private);

    const formatPrice = (exam: any) => {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: exam.currency || "BRL",
      }).format(exam.price_private);
    };

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

    // Context info simplificado
    const contextInfo = `
═══════════════════════════════════════
DADOS DO SISTEMA
═══════════════════════════════════════

DATA ATUAL: ${currentDate} (${currentWeekday}, ${formattedDate})

MÉDICOS:
${doctors.map((d) => `• ${d.nome} (${d.especialidade}) [ID: ${d.id}]`).join("\n")}

EXAMES COM PREÇO CADASTRADO:
${examsWithPrice.map((e) => `• "${e.nome}" (${e.categoria}): ${formatPrice(e)} [ID: ${e.id}]`).join("\n") || "(nenhum)"}

EXAMES SEM PREÇO (encaminhar para humano):
${examsWithoutPrice.map((e) => `• "${e.nome}" (${e.categoria}) [ID: ${e.id}]`).join("\n") || "(nenhum)"}

${
  foundExams.length > 0
    ? `
═══════════════════════════════════════
ITENS DETECTADOS NA ÚLTIMA MENSAGEM
═══════════════════════════════════════
${foundExams
  .map((e) => {
    if (e.has_price && e.price_private) {
      return `✓ ${e.nome}: ${formatPrice(e)} [ID: ${e.id}]`;
    }
    return `✗ ${e.nome}: SEM PREÇO - encaminhar para humano [ID: ${e.id}]`;
  })
  .join("\n")}
${foundDoctors.map((d) => `• Médico: ${d.nome} [ID: ${d.id}]`).join("\n")}
`
    : ""
}

${
  context
    ? `
CONTEXTO DA CONVERSA:
• Médico: ${context.selectedDoctorId || "nenhum"}
• Exame: ${context.selectedExamTypeId || "nenhum"}  
• Data: ${context.selectedDate || "nenhuma"}
• Horário: ${context.selectedTime || "nenhum"}
• Aguardando confirmação: ${context.awaitingConfirmation ? "sim" : "não"}
`
    : ""
}

═══════════════════════════════════════
DETALHES DOS EXAMES (para usar após agendamento)
═══════════════════════════════════════
${examTypes
  .map((e) => {
    let info = `${e.nome} [ID: ${e.id}]`;
    if (e.preparo) info += `\n  Preparo: ${e.preparo}`;
    if (e.orientacoes) info += `\n  Orientações: ${e.orientacoes}`;
    if (e.duracao_minutos && e.categoria !== "laboratorio") info += `\n  Duração: ${e.duracao_minutos} min`;
    return info;
  })
  .join("\n\n")}
`;

    // Define tools for the AI
    const tools = [
      {
        type: "function",
        function: {
          name: "buscar_disponibilidade",
          description:
            "Busca horários disponíveis para agendamento com um médico específico. Usar apenas quando o paciente já escolheu o médico.",
          parameters: {
            type: "object",
            properties: {
              doctor_id: { type: "string", description: "UUID do médico" },
              exam_type_id: { type: "string", description: "UUID do tipo de exame" },
              data: { type: "string", description: "Data no formato YYYY-MM-DD" },
            },
            required: ["doctor_id", "exam_type_id", "data"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "buscar_disponibilidade_categoria",
          description:
            "Busca horários disponíveis de TODOS os médicos que atendem determinada categoria de exame. SEMPRE usar para ULTRASSONS.",
          parameters: {
            type: "object",
            properties: {
              exam_type_id: { type: "string", description: "UUID do tipo de exame" },
              data: { type: "string", description: "Data no formato YYYY-MM-DD" },
            },
            required: ["exam_type_id", "data"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "buscar_proxima_vaga",
          description:
            "Encontra automaticamente a próxima data com horários disponíveis (evita avançar dia a dia). Use quando o paciente pedir 'próxima vaga/data/horário disponível' OU quando não houver horários na data consultada.",
          parameters: {
            type: "object",
            properties: {
              exam_type_id: { type: "string", description: "UUID do tipo de exame" },
              data_inicial: { type: "string", description: "Data inicial para busca (YYYY-MM-DD)" },
              doctor_id: {
                type: "string",
                description:
                  "UUID do médico (opcional). Se não informado, busca por categoria e retorna o primeiro dia com qualquer médico.",
              },
              hora_minima: {
                type: "string",
                description: "Hora mínima HH:MM (opcional). Para buscar o próximo horário ainda no mesmo dia.",
              },
              max_dias: { type: "number", description: "Quantos dias à frente buscar (padrão 30)." },
            },
            required: ["exam_type_id", "data_inicial"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "reservar_horario",
          description: "Reserva um horário. SOMENTE usar após confirmação EXPLÍCITA do paciente.",
          parameters: {
            type: "object",
            properties: {
              doctor_id: { type: "string", description: "UUID do médico" },
              exam_type_id: { type: "string", description: "UUID do tipo de exame" },
              data: { type: "string", description: "Data no formato YYYY-MM-DD" },
              hora_inicio: { type: "string", description: "Hora de início HH:MM" },
              hora_fim: { type: "string", description: "Hora de fim HH:MM" },
              paciente_nome: { type: "string", description: "Nome completo do paciente" },
            },
            required: ["doctor_id", "exam_type_id", "data", "hora_inicio", "hora_fim", "paciente_nome"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "encaminhar_humano",
          description:
            "Encaminha para atendente humano. Usar APENAS para: convênio, desconto, item sem preço, pedido explícito, dúvida clínica.",
          parameters: {
            type: "object",
            properties: {
              motivo: { type: "string", description: "Motivo do encaminhamento" },
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

      // Check for handoff with items that have prices - fallback logic
      let shouldInterceptHandoff = false;
      let interceptMessage = "";

      for (const toolCall of choice.message.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        console.log(`Executing tool: ${functionName}`, args);

        let result: any;

        if (functionName === "buscar_disponibilidade") {
          const disponibilidadeResponse = await fetch(
            `${supabaseUrl}/functions/v1/agenda-disponibilidade?doctor_id=${args.doctor_id}&exam_type_id=${args.exam_type_id}&data=${args.data}`,
            {
              headers: { Authorization: `Bearer ${supabaseKey}` },
            },
          );
          const fullResult = await disponibilidadeResponse.json();

          // Se não há horários, buscar próxima vaga automaticamente
          if (!fullResult.horarios_disponiveis || fullResult.horarios_disponiveis.length === 0) {
            // Buscar próxima vaga
            let foundNextSlot: any = null;
            for (let i = 1; i <= 30; i++) {
              const nextDate = addDaysISO(args.data, i);
              const nextResponse = await fetch(
                `${supabaseUrl}/functions/v1/agenda-disponibilidade?doctor_id=${args.doctor_id}&exam_type_id=${args.exam_type_id}&data=${nextDate}`,
                { headers: { Authorization: `Bearer ${supabaseKey}` } },
              );
              const nextJson = await nextResponse.json();
              if (nextJson.horarios_disponiveis && nextJson.horarios_disponiveis.length > 0) {
                foundNextSlot = {
                  data: nextDate,
                  horarios_disponiveis: nextJson.horarios_disponiveis.slice(0, 3),
                  doctor: nextJson.doctor,
                };
                break;
              }
            }
            result = {
              ...fullResult,
              horarios_disponiveis: [],
              proxima_vaga: foundNextSlot,
              mensagem_proxima_vaga: foundNextSlot
                ? `Não há horários para a data solicitada. A próxima vaga disponível é em ${foundNextSlot.data}.`
                : "Não há horários disponíveis nos próximos 30 dias.",
            };
          } else {
            // Limitar a 3 horários
            result = {
              ...fullResult,
              horarios_disponiveis: fullResult.horarios_disponiveis.slice(0, 3),
              total_horarios_disponiveis: fullResult.horarios_disponiveis.length,
            };
          }
          console.log("Disponibilidade result:", result);
        } else if (functionName === "buscar_disponibilidade_categoria") {
          // Nova função que busca TODOS os médicos de uma categoria
          const categoriaResponse = await fetch(
            `${supabaseUrl}/functions/v1/agenda-disponibilidade-categoria?exam_type_id=${args.exam_type_id}&data=${args.data}`,
            {
              headers: { Authorization: `Bearer ${supabaseKey}` },
            },
          );
          const fullCategoriaResult = await categoriaResponse.json();

          // Processar cada médico: limitar a 3 horários e buscar próxima vaga se não tiver
          const processedDisponibilidades = [];

          if (fullCategoriaResult.disponibilidades && Array.isArray(fullCategoriaResult.disponibilidades)) {
            for (const disp of fullCategoriaResult.disponibilidades) {
              // Verificar AMBOS os campos: slots OU horarios_disponiveis
              const slots = disp.slots || disp.horarios_disponiveis || [];
              console.log(`Médico ${disp.doctor_name}: slots=${JSON.stringify(slots).substring(0, 200)}`);

              if (slots.length === 0) {
                // Buscar próxima vaga para este médico
                let foundNextSlot: any = null;
                for (let i = 1; i <= 30; i++) {
                  const nextDate = addDaysISO(args.data, i);
                  const nextResponse = await fetch(
                    `${supabaseUrl}/functions/v1/agenda-disponibilidade?doctor_id=${disp.doctor_id}&exam_type_id=${args.exam_type_id}&data=${nextDate}`,
                    { headers: { Authorization: `Bearer ${supabaseKey}` } },
                  );
                  const nextJson = await nextResponse.json();
                  if (nextJson.horarios_disponiveis && nextJson.horarios_disponiveis.length > 0) {
                    foundNextSlot = {
                      data: nextDate,
                      horarios: nextJson.horarios_disponiveis.slice(0, 3),
                    };
                    break;
                  }
                }
                processedDisponibilidades.push({
                  ...disp,
                  slots: [],
                  proxima_vaga: foundNextSlot,
                });
              } else {
                // Limitar a 3 horários
                processedDisponibilidades.push({
                  ...disp,
                  slots: slots.slice(0, 3),
                  total_slots: slots.length,
                });
              }
            }
          }

          result = {
            ...fullCategoriaResult,
            disponibilidades: processedDisponibilidades,
          };
          console.log("Disponibilidade categoria result:", result);
        } else if (functionName === "buscar_proxima_vaga") {
          const maxDias = typeof args.max_dias === "number" && args.max_dias > 0 ? Math.min(args.max_dias, 90) : 30;
          const startDate = args.data_inicial;

          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(startDate)) {
            result = { error: "Formato de data inválido. Use YYYY-MM-DD", data_inicial: startDate };
          } else {
            const timeToMinutes = (time: string) => {
              const m = /^\d{1,2}:\d{2}$/.exec(time?.trim?.() || "");
              if (!m) return NaN;
              const [hh, mm] = time.split(":").map((v) => Number(v));
              if (Number.isNaN(hh) || Number.isNaN(mm)) return NaN;
              return hh * 60 + mm;
            };

            const nowMinutes = now.getHours() * 60 + now.getMinutes();

            const computeMinMinutesForDay0 = (date: string) => {
              // Só faz sentido filtrar no DIA 0 (data_inicial)
              // - Se o paciente deu hora_minima, use.
              // - Se for o dia de hoje, não sugerir horários no passado.
              const provided = typeof args.hora_minima === "string" ? timeToMinutes(args.hora_minima) : NaN;
              const providedValid = Number.isFinite(provided);

              let min = providedValid ? provided : NaN;
              if (date === currentDate) {
                min = Number.isFinite(min) ? Math.max(min, nowMinutes + 1) : nowMinutes + 1;
              }
              return Number.isFinite(min) ? min : null;
            };

            let found: any = null;

            for (let i = 0; i <= maxDias; i++) {
              const date = addDaysISO(startDate, i);
              const minMinutes = i === 0 ? computeMinMinutesForDay0(date) : null;

              if (args.doctor_id) {
                const r = await fetch(
                  `${supabaseUrl}/functions/v1/agenda-disponibilidade?doctor_id=${args.doctor_id}&exam_type_id=${args.exam_type_id}&data=${date}`,
                  { headers: { Authorization: `Bearer ${supabaseKey}` } },
                );
                const json = await r.json();
                const slotsRaw = json?.horarios_disponiveis || [];
                const slots = Array.isArray(slotsRaw)
                  ? minMinutes == null
                    ? slotsRaw
                    : slotsRaw.filter((s: any) => {
                        const m = timeToMinutes(String(s?.hora_inicio || ""));
                        return Number.isFinite(m) && m >= minMinutes;
                      })
                  : [];

                if (slots.length > 0) {
                  found = { modo: "doctor", data: date, doctor_id: args.doctor_id, horarios_disponiveis: slots };
                  break;
                }
              } else {
                const r = await fetch(
                  `${supabaseUrl}/functions/v1/agenda-disponibilidade-categoria?exam_type_id=${args.exam_type_id}&data=${date}`,
                  { headers: { Authorization: `Bearer ${supabaseKey}` } },
                );
                const json = await r.json();
                const disponRaw = json?.disponibilidades || [];

                const disponibilidades = Array.isArray(disponRaw)
                  ? disponRaw
                      .map((d: any) => {
                        const slotsKey = Array.isArray(d?.slots)
                          ? "slots"
                          : Array.isArray(d?.horarios_disponiveis)
                            ? "horarios_disponiveis"
                            : null;
                        if (!slotsKey) return d;

                        const slotsArr = d[slotsKey];
                        const filtered =
                          minMinutes == null
                            ? slotsArr
                            : slotsArr.filter((s: any) => {
                                const m = timeToMinutes(String(s?.hora_inicio || ""));
                                return Number.isFinite(m) && m >= minMinutes;
                              });

                        return { ...d, [slotsKey]: filtered };
                      })
                      .filter((d: any) => {
                        const arr = Array.isArray(d?.slots)
                          ? d.slots
                          : Array.isArray(d?.horarios_disponiveis)
                            ? d.horarios_disponiveis
                            : [];
                        return Array.isArray(arr) && arr.length > 0;
                      })
                  : [];

                if (disponibilidades.length > 0) {
                  found = { modo: "categoria", data: date, disponibilidades };
                  break;
                }
              }
            }

            result = found || {
              success: false,
              message: `Nenhuma disponibilidade encontrada nos próximos ${maxDias} dias.`,
              data_inicial: startDate,
            };
          }

          console.log("Próxima vaga result:", result);
        } else if (functionName === "reservar_horario") {
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
              paciente_nome: args.paciente_nome,
            }),
          });
          result = await reservarResponse.json();
          console.log("Reservar result:", result);
        } else if (functionName === "encaminhar_humano") {
          // FALLBACK LOGIC: Check if we have items with prices that should be returned first
          const examsWithPriceFound = foundExams.filter((e) => e.has_price && e.price_private);

          if (examsWithPriceFound.length > 0) {
            // We have items with prices - intercept and provide partial response
            shouldInterceptHandoff = true;

            const priceLines = examsWithPriceFound.map((e) => `• ${e.nome}: ${formatPrice(e)}`).join("\n");

            const total = examsWithPriceFound.reduce((sum, e) => sum + (e.price_private || 0), 0);
            const formattedTotal = new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(total);

            if (examsWithPriceFound.length === foundExams.length) {
              // All items have prices - don't handoff, just return the budget
              interceptMessage = `Segue os valores:\n${priceLines}${examsWithPriceFound.length > 1 ? `\n\nTotal: ${formattedTotal}` : ""}\n\nDeseja agendar?`;
              result = {
                success: false,
                intercepted: true,
                message: "Orçamento disponível - não é necessário encaminhar",
              };
            } else {
              // Some items have prices, some don't - return what we have, then handoff
              const examsWithoutPriceFound = foundExams.filter((e) => !e.has_price || !e.price_private);
              interceptMessage = `Segue os valores que encontrei:\n${priceLines}\n\nTotal parcial: ${formattedTotal}\n\nPara ${examsWithoutPriceFound.map((e) => e.nome).join(", ")}, vou te encaminhar para um atendente confirmar os valores.`;
              result = {
                success: true,
                message: "Conversa encaminhada para atendente humano.",
                motivo: args.motivo,
                encaminhado: true,
                partialBudget: true,
              };
            }
          } else {
            result = {
              success: true,
              message: "Conversa encaminhada para atendente humano.",
              motivo: args.motivo,
              encaminhado: true,
            };
          }
        }

        toolResults.push({ toolCall, result });
      }

      // If we intercepted a handoff with available prices, return our custom message
      if (shouldInterceptHandoff && interceptMessage) {
        const humanHandoff = toolResults.some((tr) => tr.result?.encaminhado);

        return new Response(
          JSON.stringify({
            message: interceptMessage,
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
