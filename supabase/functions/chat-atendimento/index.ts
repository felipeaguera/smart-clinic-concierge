import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT - Reestruturado para consistência
// ════════════════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `Você é Clara, assistente virtual da Clínica Pilar Med.

═══════════════════════════════════════
0. APRESENTAÇÃO E CONTINUIDADE DA CONVERSA (CRÍTICO!)
═══════════════════════════════════════

⚠️ REGRA MAIS IMPORTANTE: ANALISE O HISTÓRICO ANTES DE RESPONDER!

COMO IDENTIFICAR SE DEVE SE APRESENTAR:
- Verifique se JÁ EXISTE conversa anterior no histórico
- Se o histórico contém mensagens anteriores sobre agendamentos/exames → É UMA CONTINUAÇÃO
- Se você (assistant) já se apresentou antes → NÃO se apresente novamente!

QUANDO SE APRESENTAR (primeira mensagem apenas):
- Histórico vazio ou só tem 1-2 mensagens genéricas ("oi", "olá")
- Use: "Olá! Eu sou a Clara 😊, assistente virtual da Pilar Med! Como posso ajudar você hoje?"

QUANDO NÃO SE APRESENTAR (maioria das vezes):
- Já existe conversa em andamento sobre agendamento/exame
- Paciente está respondendo a uma pergunta sua
- Paciente está escolhendo um horário que você ofereceu
- Exemplo: paciente diz "as 8 da manha" após você listar horários → CONTINUAR CONVERSA, não recomeçar!

⚠️ PROIBIÇÃO ABSOLUTA: Se você já ofereceu horários e o paciente escolheu um, NUNCA pergunte "o que você gostaria de agendar?" - isso mostra que você perdeu o contexto!

EXEMPLO DE ERRO A EVITAR:
- Você: "Temos 08:00, 08:20, 08:40. Qual deles seria melhor?"
- Paciente: "as 8 da manha"
- ❌ ERRADO: "Olá! Eu sou a Clara! O que você gostaria de agendar?"
- ✅ CERTO: "Perfeito! Vou reservar às 08:00. Qual é o seu nome completo para confirmar?"

═══════════════════════════════════════
1. REGRAS INVIOLÁVEIS
═══════════════════════════════════════
1. SEMPRE responda ao paciente - NUNCA deixe o chat em silêncio.
2. Se exame/consulta tem preço cadastrado → RESPONDA COM O VALOR. Proibido encaminhar para humano.
3. Múltiplos itens COM preço → liste valores individuais + total.
4. Encaminhe para humano APENAS se: convênio, desconto, item SEM preço, pedido explícito, dúvida clínica.
5. Interprete erros de escrita e abreviações - NUNCA corrija o paciente.
6. Não informar duração da consulta ou exame (a menos que pergunte explicitamente).
7. Sempre cordial e acolhedor.
8. Reagendamento/troca de horário → SEMPRE encaminhar para humano.
9. ANTES de reservar_horario → PERGUNTAR NOME COMPLETO e AGUARDAR resposta. NUNCA inventar nomes.
10. ⚠️ CRÍTICO - NUNCA INVENTAR HORÁRIOS:
    - SOMENTE exiba horários que vieram LITERALMENTE da resposta das ferramentas
    - Se buscar_disponibilidade retornar VAZIO → diga "Não há disponibilidade nessa data"
    - Se buscar_proxima_vaga retornar vazio → diga "Nenhum horário disponível nos próximos dias"
    - NUNCA suponha, deduza, ou invente horários como "08:00, 08:10, 08:20" sem eles estarem no JSON de resposta
    - VERIFICAR: O horário que você vai mostrar está EXATAMENTE na resposta da ferramenta?
    - Se a ferramenta retornar disponibilidades: [] → NÃO HÁ HORÁRIOS, ponto final.

═══════════════════════════════════════
2. REGRA DE DESAMBIGUAÇÃO (aplicar SEMPRE no início)
═══════════════════════════════════════

A) ULTRASSOM/LABORATÓRIO (muitos tipos - NÃO LISTAR):
   - Termo genérico ("ultrassom", "exame de sangue") → NÃO LISTE todos os tipos!
   - Pergunte de forma aberta: "Claro! Qual tipo de ultrassom você precisa?"
   - Aguarde o paciente especificar antes de prosseguir.

B) CONSULTAS (poucos tipos por médico - PODE LISTAR):
   - Termo genérico ("consulta gineco") → PODE listar as opções (máx 4-5 itens)
   - Exemplo: "Temos: Consulta Ginecológica simples e com Preventivo. Qual você precisa?"
   - AGUARDAR resposta antes de prosseguir.

C) PEDIDO POR MÉDICO ("quero com Dr. Klauber"):
   - Se médico tem MÚLTIPLOS tipos de consulta → LISTAR todas as opções
   - Se apenas UM tipo → prosseguir normalmente.

═══════════════════════════════════════
3. UPSELL OBSTÉTRICO (aplicar ANTES de buscar disponibilidade)
═══════════════════════════════════════
Quando paciente solicitar exame obstétrico base, oferecer versão mais completa:

A) ULTRASSOM OBSTÉTRICO SIMPLES (sem doppler, sem morfológico):
   - Detectar: "obstétrico" E NÃO "doppler" E NÃO "morfológico"
   - Oferecer: Ultrassom Obstétrico com Doppler
   - Frase: "A maioria das gestantes prefere incluir o Doppler — ele mostra a circulação do bebê e da placenta, garantindo uma avaliação mais completa. Posso incluir?"
   - Se tiver preços: mostrar valor base vs valor com doppler

B) MORFOLÓGICO 1º TRIMESTRE (sem pré-eclâmpsia):
   - Detectar: "morfológico" E "1" E NÃO "pré-eclâmpsia"
   - Oferecer: Morfológico 1º tri com Rastreamento de Pré-eclâmpsia
   - Frase: "No primeiro trimestre, além do morfológico, é possível incluir o rastreamento de pré-eclâmpsia. A pré-eclâmpsia está relacionada à pressão alta na gestação e, quando identificada precocemente, permite um acompanhamento mais cuidadoso e medidas preventivas. Você gostaria de incluir esse rastreamento no exame?"
   - Se tiver preços: mostrar valor base vs valor completo

C) MORFOLÓGICO 2º TRIMESTRE:
   - Detectar: "morfológico" E "2"
   - Oferecer: Doppler + Transvaginal (complementos separados)
   - Frase Doppler: "Além da avaliação anatômica do bebê, é possível incluir o Doppler, que analisa a circulação da placenta e do bebê. Esse complemento pode trazer informações importantes sobre o bem-estar fetal ao longo da gestação. Gostaria de incluir o Doppler junto ao morfológico?"
   - Frase Transvaginal: "Outro complemento que pode ser realizado é o ultrassom transvaginal, que permite medir o colo do útero. Essa medida ajuda a identificar precocemente situações associadas ao risco de parto prematuro e orientar o acompanhamento da gestação. Você gostaria de incluir esse exame junto ao morfológico?"

FLUXO (CRÍTICO - AGUARDAR RESPOSTA):
1. Paciente solicita exame base → IA detecta match com regra de upsell
2. IA apresenta preços (se disponíveis): "Obstétrico: R$ X | Com Doppler: R$ Y"
3. IA faz pergunta de fechamento e PARA. NÃO buscar horários ainda!
4. ⚠️ AGUARDAR RESPOSTA DO PACIENTE (sim, não, ou outra)
5. Paciente responde:
   - Se "sim" → adicionar complemento(s) ao pedido
   - Se "não" → manter exame original
   - Se paciente ignorar e pedir horário → perguntar novamente sobre upsell de forma breve
6. SOMENTE APÓS resposta → buscar disponibilidade e mostrar horários

⚠️ PROIBIÇÃO: NUNCA buscar horários ou mostrar disponibilidade ANTES de receber resposta sobre o upsell!

═══════════════════════════════════════
4. REGRA TEMPORAL (INVIOLÁVEL)
═══════════════════════════════════════
- NUNCA sugerir horários no passado.
- Se data = HOJE: descartar horários ≤ hora atual do contexto.
- Se TODOS os horários de HOJE passaram → buscar próxima data automaticamente.
- Sempre usar hora_minima = hora atual quando data = HOJE.
- Validar: horário > hora atual QUANDO data = hoje.
- Uma data SÓ é "disponível" se tiver PELO MENOS UM horário FUTURO.

INTERPRETAÇÃO DE EXPRESSÕES TEMPORAIS (CRÍTICO):
Entender variações naturais de linguagem:

📅 PERÍODOS DO DIA:
- "mais tarde" / "mais pra tarde" / "de tarde" / "à tarde" → período da TARDE (13:00-18:00)
- "de manhã" / "pela manhã" / "cedo" → período da MANHÃ (07:00-12:00)
- "no final da tarde" → entre 16:00-18:00
- "meio-dia" / "almoço" → entre 11:30-13:30
- "noite" → informar que a clínica não funciona à noite

📅 DIAS DA SEMANA:
- "amanhã" → data atual + 1 dia
- "depois de amanhã" → data atual + 2 dias
- "na segunda" / "na terça" / etc → próximo dia da semana correspondente
- "essa semana" → buscar qualquer dia disponível até domingo
- "semana que vem" / "próxima semana" → segunda a domingo da próxima semana
- "daqui a X dias" → data atual + X dias

📅 COMBINAÇÕES:
- "amanhã de tarde" → amanhã, período da tarde
- "segunda de manhã" → próxima segunda, período da manhã
- "mais tarde hoje" → HOJE, mas apenas horários da tarde

⚠️ OBRIGATÓRIO: Ao detectar preferência por período:
1. Converter para hora_minima/hora_maxima adequada
2. Se não houver horários no período → informar e sugerir alternativas
3. NUNCA ignorar a preferência de período do paciente

═══════════════════════════════════════
5. FLUXO DE ORÇAMENTO
═══════════════════════════════════════
Quando paciente pedir orçamento:

PASSO 1: Identificar APENAS os itens EXATAMENTE mencionados
- NÃO adicionar exames que o paciente NÃO pediu
- Correspondência EXATA ou muito próxima
- Normalizar: "usg/ultra/eco" → Ultrassom, "morfo" → Morfológico

⚠️ REGRA CRÍTICA: Responder APENAS com exames MENCIONADOS.
- Paciente pediu "17 ALFA, ÁCIDO ÚRICO" → responder SOMENTE esses dois.
- NUNCA listar consultas ou ultrassons se não mencionados.

PASSO 2: Separar por CATEGORIA
- LABORATÓRIO: Não precisam de agendamento
- ULTRASSOM: Precisam de agendamento
- CONSULTA: Precisam de agendamento

PASSO 3: Verificar preços
- has_price = true → usar valor cadastrado
- has_price = false → marcar como "sem preço"

PASSO 4: Responder AGRUPADO por categoria:

📋 Exames de Laboratório:
- Exame 1: R$ X
- Exame 2: R$ Y
Subtotal: R$ XX

Coletas: segunda a sexta, 7:30-11:00 e 13:00-17:00. Não precisa agendar.

🔬 Ultrassons:
[lista com valores]

🩺 Consultas:
[lista com valores]

Total Geral: R$ TOTAL

⚠️ NÃO informar duração, preparo ou orientações no orçamento.
⚠️ Se SOMENTE laboratório → NÃO pergunte sobre agendamento.

═══════════════════════════════════════
6. FLUXO DE AGENDAMENTO
═══════════════════════════════════════

PASSO 1: DESAMBIGUAÇÃO + UPSELL
- Aplicar Regra de Desambiguação (Seção 2)
- Se exame obstétrico → Aplicar Upsell (Seção 3) ANTES de buscar disponibilidade

PASSO 2: Identificar categoria
- ULTRASSOM: buscar_disponibilidade_categoria (todos os médicos)
- CONSULTA: usar doctor_id vinculado automaticamente

PASSO 3: HORÁRIO ESPECÍFICO (se paciente mencionar)
- Converter para HH:MM
- Verificar se está disponível:
  - SE DISPONÍVEL: confirmar exatamente o horário
  - SE NÃO DISPONÍVEL: oferecer 3 alternativas mais próximas
  - SE FORA DA GRADE: explicar intervalos e ajustar

⚠️ PROIBIÇÃO: Quando pediu horário específico, NUNCA responder apenas "o primeiro disponível é..."

PASSO 4: BUSCA DE PRÓXIMA VAGA (sem horário específico)
- Usar buscar_proxima_vaga para encontrar PRIMEIRA disponibilidade
- Aplicar Regra Temporal (Seção 4)
- ⚠️ LIMITE ESTRITO: Exibir APENAS 3 HORÁRIOS, bem espaçados (ex: 08:00, 09:00, 10:00)
- NUNCA listar horários sequenciais de 10 em 10 minutos (ex: 08:00, 08:10, 08:20)
- Selecionar horários espaçados em ~30-60 minutos para não poluir a conversa
- Se paciente pedir "manhã" → mostrar 3 horários da manhã espaçados
- Se paciente pedir "tarde" → mostrar 3 horários da tarde espaçados

PASSO 5: ULTRASSONS
1. buscar_disponibilidade_categoria com exam_type_id + data
2. Apresentar opções por médico
3. AGUARDAR escolha (médico + horário)
4. PERGUNTAR NOME COMPLETO
5. reservar_horario
6. Após sucesso: data/horário + preparo + orientações

PASSO 6: CONSULTAS
- Cada consulta está VINCULADA a um médico via doctor_id
- Usar o doctor_id vinculado automaticamente (NÃO perguntar médico)
- buscar_disponibilidade

DATAS:
- "amanhã" = data atual + 1
- "segunda/terça" = próximo dia da semana
- Formato interno: YYYY-MM-DD
- Formato paciente: DD/MM/YYYY

MÚLTIPLOS ITENS:
- Tentar agendar TODOS no mesmo dia
- Se impossível, perguntar se aceita datas diferentes

REGRA 11 - CORRESPONDÊNCIA EXATA:
- Responder SOMENTE com exames MENCIONADOS
- NUNCA incluir exames que paciente NÃO pediu
- Se não encontrar exame → informar que não está cadastrado

REGRA 12 - INSTRUÇÕES DO MÉDICO (PRIORIDADE MÁXIMA):
- Quando houver "⚠️ INSTRUÇÕES OBRIGATÓRIAS" para um médico, seguir ANTES das regras gerais

REGRA 13 - MÚLTIPLOS EXAMES CONSECUTIVOS:
Quando paciente solicitar 2+ exames em sequência (ex: "abdome e transvaginal"):
1. Identificar exames e durações
2. Verificar mesma categoria (mesmo médico)
3. Somar durações totais
4. Buscar disponibilidade com tempo total
5. Apresentar: "08:00 às 08:50 (Abdome 08:00-08:30, depois Transvaginal 08:30-08:50)"
6. Após nome + horário → reservar_multiplos_horarios
7. Confirmar TODOS em uma mensagem

═══════════════════════════════════════
7. ENCAMINHAR PARA HUMANO
═══════════════════════════════════════
ENCAMINHAR se:
- Convênio/desconto/negociação
- Pedido explícito para atendente
- Item não existe no cadastro
- Item com has_price = false
- Dúvida clínica complexa
- Pedido de encaixe/exceção
- Troca de horário ou exame agendado

NUNCA encaminhar por:
- Frase confusa ou erro de português
- Múltiplos itens (se todos têm preço, responda)
- Agenda cheia (buscar próxima vaga automaticamente)

═══════════════════════════════════════
8. TOM DE VOZ
═══════════════════════════════════════
- Português brasileiro, educado, acolhedor
- Frases curtas e claras, sem parecer seco
- Máximo 1 emoji por mensagem, quando natural
- Exemplos: "Perfeito 😊", "Claro!", "Fico à disposição"

═══════════════════════════════════════
9. REGRAS ESPECÍFICAS POR CATEGORIA
═══════════════════════════════════════

LABORATÓRIO:
- NÃO utilizam agendamento
- Informar horários: segunda a sexta, 7:30-11:00 e 13:00-17:00
- Agrupar exames por preparo (não repetir mesma recomendação)
- Se pedir agendamento → explicar que não é necessário

ULTRASSONS MORFOLÓGICOS:
- ANTES de buscar disponibilidade, OBRIGATÓRIO informar período gestacional:
  
  1º TRIMESTRE: "O Morfológico de 1º Trimestre é recomendado entre 11 semanas e 13 semanas e 6 dias. Você está dentro desse período?"
  → AGUARDAR confirmação
  → Se dúvida → encaminhar para humano
  
  2º TRIMESTRE: "O Morfológico de 2º Trimestre é recomendado entre 20 e 24 semanas. Você está dentro desse período?"
  → AGUARDAR confirmação
  → Se dúvida → encaminhar para humano

⚠️ Essa verificação é OBRIGATÓRIA antes de oferecer horários.

PREPARO/ORIENTAÇÕES:
- Só informar APÓS agendamento confirmado (exceto laboratório)
- Quando preparo for "NENHUM" ou vazio → não citar

═══════════════════════════════════════
10. VALORIZAÇÃO DO PROFISSIONAL
═══════════════════════════════════════
Quando identificar o médico para o exame/consulta, ANTES de listar os horários disponíveis:

1. Verificar se o médico possui CREDENCIAIS no contexto (marcador [CREDENCIAIS] ou 💡 CREDENCIAIS nas instruções do médico)
2. Se houver informações sobre formação, especializações ou diferenciais:
   - Mencionar de forma NATURAL e BREVE enquanto "busca" os horários
   - Tom: Informativo, transmitir segurança SEM parecer promocional

3. QUANDO usar:
   - Primeira vez que menciona o médico na conversa
   - Paciente demonstra insegurança

4. QUANDO NÃO usar:
   - Já mencionou na mesma conversa
   - Conversa é apenas sobre orçamento
   - Médico não tem credenciais cadastradas

Exemplos de uso natural:
- "Vou verificar a agenda do Dr. Felipe! Ele possui formação especializada em Medicina Fetal, com 3 pós-graduações 😊"
- "O Dr. Klauber é referência em Ginecologia, com mais de 15 anos de experiência. Vamos ver os horários..."
`;

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

// Helper para espaçar horários (não mostrar sequenciais de 10 em 10)
function selectSpacedSlots(slots: any[], maxSlots: number = 3, minGapMinutes: number = 30): any[] {
  if (!Array.isArray(slots) || slots.length === 0) return [];
  if (slots.length <= maxSlots) return slots;
  
  const timeToMinutes = (time: string) => {
    const [h, m] = (time || "").split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  
  const result: any[] = [slots[0]];
  let lastMinutes = timeToMinutes(slots[0]?.hora_inicio);
  
  for (let i = 1; i < slots.length && result.length < maxSlots; i++) {
    const currentMinutes = timeToMinutes(slots[i]?.hora_inicio);
    if (currentMinutes - lastMinutes >= minGapMinutes) {
      result.push(slots[i]);
      lastMinutes = currentMinutes;
    }
  }
  
  // Se não conseguiu preencher, pega os primeiros mesmo
  if (result.length < maxSlots) {
    for (const slot of slots) {
      if (!result.includes(slot) && result.length < maxSlots) {
        result.push(slot);
      }
    }
  }
  
  return result.sort((a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio));
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

// Verifica se um termo corresponde a um exame - MAIS RIGOROSO
function matchesExam(examName: string, searchTerm: string): boolean {
  const normalizedExam = normalizeText(examName);
  const normalizedSearch = normalizeText(searchTerm);

  // Ignorar termos muito curtos (menos de 4 caracteres) para evitar falsos positivos
  if (normalizedSearch.length < 4) {
    return false;
  }

  // Match direto - o nome do exame está contido no termo de busca ou vice-versa
  if (normalizedExam === normalizedSearch) {
    return true;
  }

  // Match parcial - mas precisa ser mais de 70% do nome do exame
  if (normalizedSearch.includes(normalizedExam) || normalizedExam.includes(normalizedSearch)) {
    const shorter = normalizedSearch.length < normalizedExam.length ? normalizedSearch : normalizedExam;
    const longer = normalizedSearch.length >= normalizedExam.length ? normalizedSearch : normalizedExam;
    if (shorter.length >= longer.length * 0.5) {
      return true;
    }
  }

  // Match por palavras-chave principais (precisa ter palavras significativas em comum)
  const searchWords = normalizedSearch.split(" ").filter((w) => w.length >= 3);
  const examWords = normalizedExam.split(" ").filter((w) => w.length >= 3);

  // Para exames de lab com nomes compostos, precisa de match mais preciso
  const significantMatches = searchWords.filter((sw) =>
    examWords.some((ew) => {
      // Match exato da palavra
      if (ew === sw) return true;
      // Ou pelo menos 80% de similaridade
      if (sw.length >= 5 && (ew.includes(sw) || sw.includes(ew))) {
        const shorter = sw.length < ew.length ? sw : ew;
        const longer = sw.length >= ew.length ? sw : ew;
        return shorter.length >= longer.length * 0.8;
      }
      return false;
    }),
  );

  // Precisa de pelo menos 1 palavra significativa em comum para nomes curtos
  // ou 2+ palavras para nomes longos
  const requiredMatches = searchWords.length <= 2 ? 1 : 2;
  if (significantMatches.length >= requiredMatches) {
    return true;
  }

  // Match por aliases - mas apenas se a palavra-chave completa estiver presente
  for (const [key, aliases] of Object.entries(EXAM_ALIASES)) {
    const keyNormalized = normalizeText(key);
    if (normalizedExam.includes(keyNormalized)) {
      for (const alias of aliases) {
        const aliasNormalized = normalizeText(alias);
        // Verificar se o alias está como palavra completa, não apenas substring
        const aliasRegex = new RegExp(`\\b${aliasNormalized}\\b`);
        if (aliasRegex.test(normalizedSearch)) {
          return true;
        }
      }
    }
  }

  return false;
}

// Separa a mensagem em itens individuais (por vírgula, "e", quebra de linha, etc)
function splitMessageIntoItems(message: string): string[] {
  const normalized = message.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

  // Separar por vírgulas, "e", ponto e vírgula, etc
  const items = normalized
    .split(/[,;]|\s+e\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return items;
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

  // Separar a mensagem em itens individuais para matching mais preciso
  const messageItems = splitMessageIntoItems(message);

  // Para cada item mencionado na mensagem, buscar correspondência EXATA
  for (const item of messageItems) {
    let foundMatch = false;

    for (const exam of examTypes) {
      if (matchesExam(exam.nome, item)) {
        if (!foundExams.find((e) => e.id === exam.id)) {
          foundExams.push(exam);
          foundMatch = true;
        }
      }
    }

    // Se não encontrou match para este item, adicionar aos não resolvidos
    if (!foundMatch && item.length > 3) {
      // Filtrar palavras comuns que não são nomes de exame
      const stopWords = [
        "ola",
        "oi",
        "preciso",
        "quero",
        "gostaria",
        "fazer",
        "marcar",
        "orcamento",
        "orçamento",
        "valor",
        "valores",
        "preco",
        "preço",
        "desses",
        "exames",
        "exame",
        "quanto",
        "custa",
        "custam",
      ];
      const itemNormalized = normalizeText(item);
      const isStopWord = stopWords.some((sw) => itemNormalized === sw || itemNormalized.startsWith(sw + " "));

      if (!isStopWord && !unresolved.includes(item)) {
        unresolved.push(item);
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
    const body = (await req.json()) as any;

    // Backward/forward compatible payload parsing.
    // Supported:
    // 1) { messages: Message[], context? }
    // 2) { mensagem: string, historico?: { role: string, content: string }[], ... }
    const context = (body?.context ?? {}) as ConversationContext | undefined;

    const parsedMessages: Message[] = Array.isArray(body?.messages)
      ? body.messages
      : Array.isArray(body?.historico)
        ? body.historico
        : [];

    const mensagem = typeof body?.mensagem === "string" ? body.mensagem : "";
    const messages: Message[] = parsedMessages
      .filter((m: any) => m && typeof m.content === "string" && typeof m.role === "string")
      .map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user",
        content: String(m.content),
      }));

    // If webhook sent a single message, append it so we always have a user turn.
    if (mensagem.trim().length > 0) {
      messages.push({ role: "user", content: mensagem.trim() });
    }

    // WhatsApp users often reply with short confirmations like "sim" / "ok".
    // When that happens, we must treat it as an answer to the previous assistant question
    // (instead of restarting the conversation).
    const lastIdx = messages.length - 1;
    const last = messages[lastIdx];
    if (last?.role === "user") {
      const lastNorm = normalizeText(last.content);
      const isShortAffirmative =
        ["sim", "ok", "pode", "pode sim", "pode ser", "isso", "isso mesmo", "claro", "pode verificar"].includes(
          lastNorm,
        ) ||
        (/^(sim|ok|pode|claro|isso)(\s+por\s+favor)?[!.]*$/i.test(last.content.trim()) &&
          last.content.trim().length <= 25);

      if (isShortAffirmative) {
        const prevAssistant = [...messages]
          .slice(0, -1)
          .reverse()
          .find((m) => m.role === "assistant")?.content;
        const prevAssistantNorm = prevAssistant ? normalizeText(prevAssistant) : "";

        // If Clara asked permission to check another date, expand the user's "sim" to an explicit request.
        const askedToCheckOtherDay =
          prevAssistantNorm.includes("posso verificar") &&
          (prevAssistantNorm.includes("outro dia") || prevAssistantNorm.includes("outra data"));

        if (askedToCheckOtherDay) {
          messages[lastIdx] = {
            role: "user",
            content: "Sim, pode verificar disponibilidade para outro dia, por favor.",
          };
        }
      }
    }

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: messages" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Empty conversation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch available data for context
    const [doctorsResult, examTypesResult] = await Promise.all([
      supabase.from("doctors").select("id, nome, especialidade, prompt_ia").eq("ativo", true),
      supabase
        .from("exam_types")
        .select(
          "id, nome, categoria, duracao_minutos, preparo, orientacoes, has_price, price_private, currency, doctor_id",
        )
        .eq("ativo", true),
    ]);

    const doctors = doctorsResult.data || [];
    const examTypes = examTypesResult.data || [];

    // Pré-processar a última mensagem do usuário para ajudar a IA
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";

    // ═══════════════════════════════════════
    // DETECÇÃO AUTOMÁTICA DE REAGENDAMENTO
    // ═══════════════════════════════════════
    const rescheduleKeywords = [
      "trocar horario",
      "trocar meu horario",
      "trocar o horario",
      "reagendar",
      "remarcar",
      "mudar horario",
      "alterar horario",
      "mudar meu horario",
      "alterar meu horario",
      "mudar a data",
      "trocar a data",
      "alterar a data",
      "trocar de horario",
      "preciso trocar",
      "quero trocar",
      "gostaria de trocar",
      "preciso reagendar",
      "quero reagendar",
      "gostaria de reagendar",
      "preciso remarcar",
      "quero remarcar",
      "gostaria de remarcar",
    ];
    const normalizedUserMessage = normalizeText(lastUserMessage);
    const isRescheduleRequest = rescheduleKeywords.some((kw) => normalizedUserMessage.includes(kw));

    if (isRescheduleRequest) {
      console.log("Reschedule request detected - forcing handoff");
      return new Response(
        JSON.stringify({
          message:
            "Entendi que você precisa reagendar seu horário! 😊 Vou encaminhar você para um atendente que poderá ajudá-la com a alteração. Um momento, por favor!",
          humanHandoff: true,
          toolsUsed: [
            {
              name: "encaminhar_humano",
              result: { encaminhado: true, motivo: "Reagendamento/troca de horário de consulta ou exame" },
            },
          ],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
    // IMPORTANTE: Usar fuso horário do Brasil (America/Sao_Paulo)
    const now = new Date();
    const brasilFormatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = brasilFormatter.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";

    const brasilYear = getPart("year");
    const brasilMonth = getPart("month");
    const brasilDay = getPart("day");
    const brasilHour = parseInt(getPart("hour"), 10);
    const brasilMinute = parseInt(getPart("minute"), 10);

    const currentDate = `${brasilYear}-${brasilMonth}-${brasilDay}`;
    const nowMinutesBrasil = brasilHour * 60 + brasilMinute;

    const weekdays = [
      "domingo",
      "segunda-feira",
      "terça-feira",
      "quarta-feira",
      "quinta-feira",
      "sexta-feira",
      "sábado",
    ];
    // Calcular dia da semana baseado na data do Brasil
    const brasilDate = new Date(`${currentDate}T12:00:00`);
    const currentWeekday = weekdays[brasilDate.getDay()];
    const formattedDate = `${brasilDay}/${brasilMonth}/${brasilYear}`;
    const currentTime = `${brasilHour.toString().padStart(2, "0")}:${brasilMinute.toString().padStart(2, "0")}`;

    // Context info simplificado
    const contextInfo = `
═══════════════════════════════════════
DADOS DO SISTEMA
═══════════════════════════════════════

DATA ATUAL: ${currentDate} (${currentWeekday}, ${formattedDate})
HORA ATUAL: ${currentTime} (horário de Brasília)

MÉDICOS:
${doctors
  .map((d: any) => {
    let info = `• ${d.nome} (${d.especialidade}) [ID: ${d.id}]`;
    if (d.prompt_ia) {
      // Detectar se há credenciais no prompt_ia
      const hasCredenciais = d.prompt_ia.includes('[CREDENCIAIS]') || 
                             d.prompt_ia.toLowerCase().includes('formação') || 
                             d.prompt_ia.toLowerCase().includes('pós-graduação') ||
                             d.prompt_ia.toLowerCase().includes('pos-graduacao') ||
                             d.prompt_ia.toLowerCase().includes('especialização') ||
                             d.prompt_ia.toLowerCase().includes('especializacao') ||
                             d.prompt_ia.toLowerCase().includes('mestrado') ||
                             d.prompt_ia.toLowerCase().includes('doutorado') ||
                             d.prompt_ia.toLowerCase().includes('experiência') ||
                             d.prompt_ia.toLowerCase().includes('anos de');
      
      info += `\n  ⚠️ INSTRUÇÕES OBRIGATÓRIAS PARA ESTE MÉDICO (siga com prioridade máxima):\n  ${d.prompt_ia}`;
      
      if (hasCredenciais) {
        info += `\n  💡 CREDENCIAIS DETECTADAS: Você pode mencionar ao paciente de forma natural (ver Seção 10)`;
      }
    }
    return info;
  })
  .join("\n\n")}

EXAMES COM PREÇO CADASTRADO:
${
  examsWithPrice
    .map((e) => {
      const doctorBinding =
        e.categoria === "consulta" && e.doctor_id
          ? ` [EXCLUSIVO: ${doctors.find((d) => d.id === e.doctor_id)?.nome || "médico não encontrado"}]`
          : "";
      return `• "${e.nome}" (${e.categoria}): ${formatPrice(e)}${doctorBinding} [ID: ${e.id}]`;
    })
    .join("\n") || "(nenhum)"
}

EXAMES SEM PREÇO (encaminhar para humano):
${
  examsWithoutPrice
    .map((e) => {
      const doctorBinding =
        e.categoria === "consulta" && e.doctor_id
          ? ` [EXCLUSIVO: ${doctors.find((d) => d.id === e.doctor_id)?.nome || "médico não encontrado"}]`
          : "";
      return `• "${e.nome}" (${e.categoria})${doctorBinding} [ID: ${e.id}]`;
    })
    .join("\n") || "(nenhum)"
}

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
          description:
            "Reserva um horário. REGRAS OBRIGATÓRIAS: 1) SOMENTE usar após o paciente CONFIRMAR o horário. 2) O paciente DEVE ter informado seu NOME COMPLETO na conversa ANTES de chamar esta função. 3) Se o nome não foi informado, PERGUNTE primeiro e espere a resposta. 4) NUNCA use nomes fictícios ou inventados.",
          parameters: {
            type: "object",
            properties: {
              doctor_id: { type: "string", description: "UUID do médico" },
              exam_type_id: { type: "string", description: "UUID do tipo de exame" },
              data: { type: "string", description: "Data no formato YYYY-MM-DD" },
              hora_inicio: { type: "string", description: "Hora de início HH:MM" },
              hora_fim: { type: "string", description: "Hora de fim HH:MM" },
              paciente_nome: {
                type: "string",
                description:
                  "Nome completo do paciente (DEVE ter sido informado pelo paciente na conversa, NUNCA inventar)",
              },
            },
            required: ["doctor_id", "exam_type_id", "data", "hora_inicio", "hora_fim", "paciente_nome"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "reservar_multiplos_horarios",
          description:
            "Reserva MÚLTIPLOS exames consecutivos em uma única operação. USAR QUANDO: paciente confirmar 2+ exames em sequência (ex: abdome + transvaginal). REGRAS: 1) Horários devem ser consecutivos (fim do primeiro = início do próximo). 2) Paciente DEVE ter confirmado todos os exames e horário. 3) Nome DEVE ter sido informado na conversa.",
          parameters: {
            type: "object",
            properties: {
              reservas: {
                type: "array",
                description: "Array de reservas consecutivas, ordenadas por horário",
                items: {
                  type: "object",
                  properties: {
                    doctor_id: { type: "string", description: "UUID do médico" },
                    exam_type_id: { type: "string", description: "UUID do tipo de exame" },
                    data: { type: "string", description: "Data no formato YYYY-MM-DD" },
                    hora_inicio: { type: "string", description: "Hora de início HH:MM" },
                    hora_fim: { type: "string", description: "Hora de fim HH:MM" },
                  },
                  required: ["doctor_id", "exam_type_id", "data", "hora_inicio", "hora_fim"],
                },
              },
              paciente_nome: {
                type: "string",
                description: "Nome completo do paciente (DEVE ter sido informado pelo paciente na conversa)",
              },
            },
            required: ["reservas", "paciente_nome"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "encaminhar_humano",
          description:
            "Encaminha para atendente humano. Usar para: convênio, desconto, item sem preço, pedido explícito, dúvida clínica, TROCA DE HORÁRIO ou REAGENDAMENTO de consulta/exame já marcado.",
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
              const slots = disp.slots || [];

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

            // Usar horário do Brasil, não UTC
            const nowMinutes = nowMinutesBrasil;

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
                  // Aplicar espaçamento nos horários para não mostrar sequenciais
                  const spacedSlots = selectSpacedSlots(slots, 3, 30);
                  found = { modo: "doctor", data: date, doctor_id: args.doctor_id, horarios_disponiveis: spacedSlots };
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

                        // Aplicar espaçamento nos horários
                        const spacedSlots = selectSpacedSlots(filtered, 3, 30);
                        return { ...d, [slotsKey]: spacedSlots };
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
        } else if (functionName === "reservar_multiplos_horarios") {
          // Nova função para reservar múltiplos exames consecutivos
          const reservarMultiplosResponse = await fetch(`${supabaseUrl}/functions/v1/agenda-reservar-multiplos`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              reservas: args.reservas,
              paciente_nome: args.paciente_nome,
            }),
          });
          result = await reservarMultiplosResponse.json();
          console.log("Reservar múltiplos result:", result);
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
