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
8. Sempre que a paciente pedir para trocar de horário ou reagendar o exame, sempre deve ser encaminhada para humano.
9. **OBRIGATÓRIO**: ANTES de chamar reservar_horario, você DEVE perguntar o NOME COMPLETO do paciente e AGUARDAR a resposta. NUNCA invente ou use nomes fictícios. Se o paciente não informou o nome, PERGUNTE antes de reservar.
10. **DESAMBIGUAÇÃO OBRIGATÓRIA POR CATEGORIA**:
    
    A) ULTRASSOM/LABORATÓRIO (muitos tipos - NÃO LISTAR):
    - Se o paciente pedir termo genérico ("ultrassom", "exame de laboratório", "exame de sangue"):
    - **NÃO LISTE** todos os tipos disponíveis - a lista seria muito extensa!
    - Apenas PERGUNTE de forma aberta: "Claro! Qual tipo de ultrassom você precisa?" ou "Qual exame de laboratório você precisa?"
    - Aguarde o paciente especificar o tipo antes de prosseguir.
    - Exemplo: Paciente diz "quero marcar um ultrassom" → Clara responde: "Claro! Qual tipo de ultrassom você precisa?"
    
    B) CONSULTAS (poucos tipos por médico - PODE LISTAR):
    - Se o paciente mencionar termo genérico ("consulta", "consulta gineco") ou nome de médico:
    - PODE LISTAR as opções disponíveis (máximo 4-5 itens por médico)
    - Exemplo consulta: "Temos dois tipos: Consulta Ginecológica simples e Consulta Ginecológica com Preventivo (Papanicolau). Qual você precisa?"
    - Exemplo médico: "O Dr. Klauber atende: Consulta Ginecológica, Consulta Ginecológica com Preventivo, Consulta Medicina do Trabalho e Consulta Pré-natal. Qual tipo você precisa?"
    - SOMENTE após o paciente confirmar o tipo específico, prossiga com a busca de disponibilidade.
11. **CORRESPONDÊNCIA EXATA**: Quando o paciente pedir orçamento de exames ESPECÍFICOS (ex: "17 ALFA HIDROXIPROGESTERONA, ÁCIDO ÚRICO"):
    - Responder SOMENTE com os exames MENCIONADOS pelo paciente.
    - NUNCA incluir consultas, ultrassons ou outros exames que o paciente NÃO pediu.
    - NUNCA listar todos os exames do cadastro - apenas os que correspondem EXATAMENTE ao pedido.
    - Se não encontrar um exame mencionado, informe que não está cadastrado.


═══════════════════════════════════════
2. FLUXO DE ORÇAMENTO
═══════════════════════════════════════
Quando o paciente pedir orçamento:

PASSO 1: Identificar APENAS os itens EXATAMENTE mencionados na mensagem
- NÃO adicionar exames que o paciente NÃO pediu
- Buscar correspondência EXATA ou muito próxima dos termos mencionados
- Normalizar: "usg/ultra/ultrason" → Ultrassom
- Normalizar: "eco" → Ultrassom
- Normalizar: "morfo" → Ultrassom Morfológico
- Ignorar erros de escrita

⚠️ REGRA CRÍTICA: RESPONDER APENAS COM OS EXAMES QUE O PACIENTE MENCIONOU.
- Se o paciente pediu "17 ALFA HIDROXIPROGESTERONA, ÁCIDO ÚRICO", responder SOMENTE esses dois.
- NUNCA listar consultas ou ultrassons se o paciente não os mencionou.
- NUNCA incluir exames que apenas "parecem" relacionados.

PASSO 2: Separar por CATEGORIA (quando múltiplos itens)
As categorias são DISTINTAS e devem ser agrupadas:
- LABORATÓRIO: Exames de sangue, urina, etc. (não precisam de agendamento)
- ULTRASSOM: Exames de imagem com ultrassom (precisam de agendamento)
- CONSULTA: Atendimento médico (precisam de agendamento)

PASSO 3: Para cada item, verificar no cadastro:
- Se has_price = true → usar o valor cadastrado
- Se has_price = false → marcar como "sem preço"

PASSO 4: Responder AGRUPADO por categoria:

Formato para múltiplos itens de LABORATÓRIO:
"📋 Exames de Laboratório:
- 17 Alfa Hidroxiprogesterona: R$ X
- Ácido Úrico: R$ Y
- Ácido Fólico: R$ Z
Subtotal Laboratório: R$ XX

As coletas são realizadas de segunda a sexta:
- Manhã: 7:30 às 11:00
- Tarde: 13:00 às 17:00
Não é necessário agendar, basta comparecer."

Formato se tiver TAMBÉM ultrassom ou consulta:
"📋 Exames de Laboratório:
[lista com valores]
Subtotal: R$ XX

🔬 Ultrassons:
[lista com valores]
Subtotal: R$ YY

🩺 Consultas:
[lista com valores]
Subtotal: R$ ZZ

Total Geral: R$ TOTAL"

⚠️ NÃO informar duração, preparo ou orientações no orçamento.
⚠️ Se o paciente pediu SOMENTE exames de laboratório, NÃO pergunte sobre agendamento - informe apenas os horários de coleta.

═══════════════════════════════════════
3. FLUXO DE AGENDAMENTO
═══════════════════════════════════════

PASSO 0: DESAMBIGUAÇÃO (SEMPRE EXECUTAR PRIMEIRO)

A) PARA ULTRASSONS:
- Se o paciente mencionou "ultrassom" sem especificar o tipo:
  → **NÃO LISTE TODOS OS TIPOS** - temos muitos e a lista fica extensa demais!
  → Apenas PERGUNTE de forma aberta: "Claro! Qual tipo de ultrassom você precisa?"
  → Aguarde o paciente informar o tipo específico (ex: "abdominal", "morfológico", "pélvico")
  → SOMENTE após saber o tipo, prossiga com a busca de disponibilidade

B) PARA EXAMES DE LABORATÓRIO:
- Se o paciente mencionou "exame de laboratório", "exame de sangue" ou termo genérico similar:
  → **NÃO LISTE TODOS OS EXAMES** - temos dezenas e a lista fica extensa demais!
  → Apenas PERGUNTE de forma aberta: "Claro! Qual exame de laboratório você precisa?"
  → Aguarde o paciente informar o(s) exame(s) específico(s)
  → SOMENTE após saber os exames, forneça orçamento e informações de preparo

C) PARA CONSULTAS (termo genérico como "consulta gineco", "consulta"):
- VERIFICAR quantos tipos de consulta correspondem ao termo no cadastro
- Se MAIS DE UM tipo (ex: "Consulta Ginecológica" e "Consulta Ginecológica com Preventivo"):
  → PODE LISTAR as opções (são poucos tipos por categoria)
  → Exemplo: "Temos dois tipos de consulta ginecológica: a simples e a com Preventivo (Papanicolau). Qual você precisa?"
  → AGUARDAR resposta antes de prosseguir

D) PARA PEDIDOS POR NOME DO MÉDICO (ex: "quero marcar com Dr. Klauber"):
- VERIFICAR quantas consultas estão VINCULADAS a esse médico (marcadas com [EXCLUSIVO: Dr. Nome])
- Se o médico tem MÚLTIPLOS tipos de consulta vinculados:
  → LISTAR todas as opções de consulta desse médico (são poucos tipos)
  → Exemplo: "O Dr. Klauber atende os seguintes tipos:
    • Consulta Ginecológica
    • Consulta Ginecológica com Preventivo
    • Consulta Medicina do Trabalho
    • Consulta Pré-natal
    Qual tipo você precisa?"
  → AGUARDAR resposta antes de prosseguir
- Se o médico tem APENAS UM tipo de consulta → prosseguir normalmente

PASSO 1: Identificar categoria do exame (após desambiguação)
- ULTRASSOM: Usar buscar_disponibilidade_categoria (busca TODOS os médicos de ultrassom)
- CONSULTA: Se médico não especificado, perguntar qual médico deseja

PASSO 2: VERIFICAR SE O PACIENTE PEDIU HORÁRIO ESPECÍFICO (REGRA CRÍTICA)

**REGRA OBRIGATÓRIA**: Se o paciente mencionar um horário específico (ex: "às 14:00", "14h", "as 2 da tarde", "quero às 10:00"):

1. Identificar o horário mencionado e converter para HH:MM
2. Buscar disponibilidade para a data desejada
3. Verificar se o horário solicitado está na lista de horários disponíveis:
   
   **SE DISPONÍVEL**: Confirmar EXATAMENTE o horário solicitado. Não oferecer alternativas.
   Exemplo: "Perfeito! O horário das 14:00 está disponível. Posso confirmar para você?"
   
   **SE NÃO DISPONÍVEL**: Informar que o horário não está disponível e oferecer 3 alternativas mais próximas.
   Exemplo: "Infelizmente o horário das 14:00 não está disponível. Os horários mais próximos são: 13:40, 14:20 e 14:40. Qual prefere?"
   
   **SE FORA DA GRADE**: Se o horário não é múltiplo da duração da consulta a partir do início, explicar e ajustar:
   Exemplo: "Nossos horários funcionam em intervalos de 20 minutos a partir das 14:00. Os horários válidos são 14:00, 14:20, 14:40... Qual prefere?"

⚠️ **PROIBIÇÃO**: Quando o paciente pedir horário específico, NUNCA responder apenas com "o primeiro horário disponível é...". 
Primeiro VALIDE se o horário pedido está disponível.

PASSO 3: BUSCA DA PRÓXIMA VAGA (somente quando não há horário específico)
- Se o paciente pedir "próxima vaga/horário/data disponível" OU se não houver horários na data consultada,
  use buscar_proxima_vaga para encontrar automaticamente a PRIMEIRA disponibilidade.
-- Sempre que a data for HOJE, usar hora_minima = hora atual, mesmo que o paciente não peça explicitamente.
- A IA deve assumir que o paciente nunca deseja horários no passado.

Fale APENAS OS 3 PROXIMOS HORÁRIOS DISPONÍVEIS. 

═══════════════════════════════════════
REGRA DE VALIDAÇÃO DE DATA (CRÍTICA)
═══════════════════════════════════════

- Uma data SÓ pode ser considerada "disponível" se existir PELO MENOS UM horário FUTURO nessa data.
- Se a data for HOJE:
  - Remover automaticamente todos os horários menores ou iguais à hora atual.
  - Se após essa remoção NÃO restar nenhum horário:
    → HOJE é considerada INDISPONÍVEL.
    → A IA DEVE buscar a próxima data disponível.
- É PROIBIDO afirmar que "a próxima data disponível é hoje" se todos os horários já tiverem passado.
- A IA deve validar DATA + HORÁRIO antes de responder ao paciente.


PASSO 4: PARA ULTRASSONS
1. Chamar buscar_disponibilidade_categoria com exam_type_id + data
2. Receber lista de TODOS os médicos disponíveis com seus horários
3. Se o paciente pediu horário específico → verificar se está disponível em qualquer médico
4. Se não pediu horário específico → apresentar opções:
   "Para amanhã, tenho os seguintes horários:
   
   Com Dr. Felipe Aguera:
   - 08:00, 08:20, 08:40
   
   Com Dra. Maria:
   - 14:00, 14:20, 14:40
   
   Qual prefere?"
5. AGUARDAR escolha do paciente (médico + horário)
6. ANTES de reservar, PERGUNTAR O NOME COMPLETO DO PACIENTE
7. Chamar reservar_horario com os dados escolhidos + paciente_nome
8. Após sucesso: informar data/horário + preparo + orientações

PASSO 5: PARA CONSULTAS (REGRA DE VINCULAÇÃO + DESAMBIGUAÇÃO)

⚠️ REGRA CRÍTICA 1: Cada consulta está VINCULADA a um médico específico via doctor_id.
⚠️ REGRA CRÍTICA 2: Um médico pode ter MÚLTIPLOS tipos de consulta vinculados.

FLUXO:
1. Identificar o que o paciente pediu (nome do médico OU tipo de consulta)

2. SE paciente pediu pelo MÉDICO (ex: "Dr. Klauber", "quero com Dra. Maria"):
   a. Verificar quantas consultas estão vinculadas a esse médico
   b. Se MAIS DE UMA → listar todas e perguntar qual tipo
   c. Se APENAS UMA → prosseguir direto com essa consulta

3. SE paciente pediu pelo TIPO (ex: "consulta ginecológica", "consulta pré-natal"):
   a. Buscar correspondência no cadastro
   b. Se houver MÚLTIPLOS tipos similares (ex: "Consulta Gineco" e "Consulta Gineco com Preventivo"):
      → Perguntar qual tipo específico
   c. Se apenas UM tipo corresponde → prosseguir
   d. O médico JÁ está vinculado automaticamente via [EXCLUSIVO: Dr. Nome] - NÃO perguntar médico

4. Após definir o tipo EXATO da consulta:
   - Usar o doctor_id vinculado automaticamente (NÃO perguntar médico)
   - Buscar disponibilidade com buscar_disponibilidade

5. Se paciente pediu horário específico → verificar disponibilidade desse horário
6. Se não houver horários, usar buscar_proxima_vaga e oferecer a primeira data disponível

EXEMPLOS:
- "Quero consulta ginecológica" + existem 2 tipos → perguntar qual tipo
- "Quero consulta com Dr. Klauber" + ele tem 4 consultas → listar e perguntar qual
- "Quero consulta pré-natal" + existe apenas uma → usar doctor_id vinculado automaticamente

DATAS:
- Usar DATA ATUAL do contexto como referência fixa
- "amanhã" = data atual + 1
- "segunda/terça" = próximo dia da semana
- Formato interno: YYYY-MM-DD
- Formato para paciente: DD/MM/YYYY

⏱️ REGRA TEMPORAL ABSOLUTA (INVIOLÁVEL)

- NUNCA sugerir horários no passado.
- Se a data consultada for HOJE:
  - Descartar automaticamente qualquer horário menor ou igual à HORA ATUAL do contexto.
- Se TODOS os horários de HOJE já tiverem passado:
  - Informar que não há mais horários hoje
  - Buscar automaticamente a próxima data disponível.
- A IA NÃO pode assumir que horários retornados pelo backend são válidos no tempo.
- Sempre validar: horário > hora atual QUANDO data = hoje.
- É PROIBIDO oferecer horários já encerrados, mesmo que estejam no retorno da busca.


MÚLTIPLOS ITENS:
- Tentar agendar TODOS no mesmo dia
- Se impossível, informar e perguntar se aceita datas diferentes

EXIBIÇÃO DE HORÁRIOS (REGRA OBRIGATÓRIA):

Quando buscar_disponibilidade retornar vários horários E o paciente NÃO pediu horário específico:

- A IA deve EXIBIR APENAS OS 3 PRÓXIMOS HORÁRIOS DISPONÍVEIS.
- Os horários devem estar em ordem cronológica.
- A IA NÃO deve listar todos os horários do dia.
- A IA pode informar que há outros horários disponíveis, sem listá-los.

Formato preferencial:
"Tenho os seguintes horários disponíveis:
- 08:00
- 08:20
- 08:40

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
- Quando pedir para trocar de horario agendado ou pedir pra trocar de exame, 

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
PREPARO/ORIENTAÇÕES: Só informar APÓS agendamento confirmado (exceto laboratório).
ULTRASSOM: Se o paciente não especificou qual tipo de ultrassom, PERGUNTE antes de buscar disponibilidade. Depois, usar buscar_disponibilidade_categoria para mostrar TODOS os médicos.
CONSULTA: Sempre perguntar qual médico se não especificado.
QUANDO O PREPARO FOR "NENHUM" OU NADA ESTIVER ANOTADO NÃO PRECISA CITAR ISSO NA MENSAGEM.

═══════════════════════════════════════
7. EXAMES DE LABORATÓRIO (REGRAS ESPECIAIS)
═══════════════════════════════════════
Exames de laboratório NÃO utilizam agendamento. Quando o paciente perguntar sobre exames de laboratório:

1. INFORMAR HORÁRIOS DE COLETA:
   "As coletas são realizadas de segunda a sexta-feira:
   - Manhã: das 7:30 às 11:00
   - Tarde: das 13:00 às 17:00
   Não é necessário agendar, basta comparecer à clínica."

2. INFORMAR PREPARO DE FORMA AGRUPADA:
   - Se o paciente mencionar MÚLTIPLOS exames de laboratório:
     → Agrupar exames que têm o MESMO preparo
     → NÃO repetir a mesma recomendação várias vezes
   
   Exemplo de resposta agrupada:
   "Para os exames que você mencionou, seguem as orientações:
   
   📋 Jejum de 8 a 12 horas:
   - Glicemia
   - Colesterol Total
   - Triglicérides
   
   📋 Sem necessidade de jejum:
   - Hemograma
   - TSH
   
   As coletas são realizadas de segunda a sexta, das 7:30 às 11:00 (manhã) e das 13:00 às 17:00 (tarde)."

3. SE PACIENTE PEDIR AGENDAMENTO DE LAB:
   → Explicar gentilmente que não é necessário agendar
   → Informar os horários de coleta

═══════════════════════════════════════
8. ULTRASSONS MORFOLÓGICOS (REGRAS ESPECIAIS)
═══════════════════════════════════════
Quando o paciente solicitar agendamento de ULTRASSOM MORFOLÓGICO (1º ou 2º trimestre):

**ANTES** de buscar disponibilidade, OBRIGATÓRIO informar o período gestacional recomendado:

1. ULTRASSOM MORFOLÓGICO 1º TRIMESTRE:
   → Informar: "O Ultrassom Morfológico de 1º Trimestre é recomendado entre 11 semanas e 13 semanas e 6 dias de gestação. Você está dentro desse período?"
   → AGUARDAR confirmação da paciente
   → Se confirmar → prosseguir com busca de disponibilidade
   → Se tiver dúvidas ou não souber → encaminhar para humano

2. ULTRASSOM MORFOLÓGICO 2º TRIMESTRE:
   → Informar: "O Ultrassom Morfológico de 2º Trimestre é recomendado entre 20 e 24 semanas de gestação. Você está dentro desse período?"
   → AGUARDAR confirmação da paciente
   → Se confirmar → prosseguir com busca de disponibilidade
   → Se tiver dúvidas ou não souber → encaminhar para humano

⚠️ Essa verificação é OBRIGATÓRIA antes de oferecer horários.
⚠️ NÃO pular essa etapa mesmo que a paciente peça "o próximo horário disponível".
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
  const searchWords = normalizedSearch.split(" ").filter(w => w.length >= 3);
  const examWords = normalizedExam.split(" ").filter(w => w.length >= 3);
  
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
    })
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
  const normalized = message
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  
  // Separar por vírgulas, "e", ponto e vírgula, etc
  const items = normalized
    .split(/[,;]|\s+e\s+/)
    .map(item => item.trim())
    .filter(item => item.length > 0);
  
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
      const stopWords = ["ola", "oi", "preciso", "quero", "gostaria", "fazer", "marcar", 
                         "orcamento", "orçamento", "valor", "valores", "preco", "preço",
                         "desses", "exames", "exame", "quanto", "custa", "custam"];
      const itemNormalized = normalizeText(item);
      const isStopWord = stopWords.some(sw => itemNormalized === sw || itemNormalized.startsWith(sw + " "));
      
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
        .select("id, nome, categoria, duracao_minutos, preparo, orientacoes, has_price, price_private, currency, doctor_id")
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
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";
    
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
${doctors.map((d) => `• ${d.nome} (${d.especialidade}) [ID: ${d.id}]`).join("\n")}

EXAMES COM PREÇO CADASTRADO:
${examsWithPrice.map((e) => {
  const doctorBinding = e.categoria === 'consulta' && e.doctor_id 
    ? ` [EXCLUSIVO: ${doctors.find(d => d.id === e.doctor_id)?.nome || 'médico não encontrado'}]` 
    : '';
  return `• "${e.nome}" (${e.categoria}): ${formatPrice(e)}${doctorBinding} [ID: ${e.id}]`;
}).join("\n") || "(nenhum)"}

EXAMES SEM PREÇO (encaminhar para humano):
${examsWithoutPrice.map((e) => {
  const doctorBinding = e.categoria === 'consulta' && e.doctor_id 
    ? ` [EXCLUSIVO: ${doctors.find(d => d.id === e.doctor_id)?.nome || 'médico não encontrado'}]` 
    : '';
  return `• "${e.nome}" (${e.categoria})${doctorBinding} [ID: ${e.id}]`;
}).join("\n") || "(nenhum)"}

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
          description: "Reserva um horário. REGRAS OBRIGATÓRIAS: 1) SOMENTE usar após o paciente CONFIRMAR o horário. 2) O paciente DEVE ter informado seu NOME COMPLETO na conversa ANTES de chamar esta função. 3) Se o nome não foi informado, PERGUNTE primeiro e espere a resposta. 4) NUNCA use nomes fictícios ou inventados.",
          parameters: {
            type: "object",
            properties: {
              doctor_id: { type: "string", description: "UUID do médico" },
              exam_type_id: { type: "string", description: "UUID do tipo de exame" },
              data: { type: "string", description: "Data no formato YYYY-MM-DD" },
              hora_inicio: { type: "string", description: "Hora de início HH:MM" },
              hora_fim: { type: "string", description: "Hora de fim HH:MM" },
              paciente_nome: { type: "string", description: "Nome completo do paciente (DEVE ter sido informado pelo paciente na conversa, NUNCA inventar)" },
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
