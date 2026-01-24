

## Plano: Clara Valoriza o Médico Durante a Busca de Horários

### Objetivo
Fazer a Clara mencionar as qualificações do médico de forma natural enquanto busca disponibilidade, usando informações já cadastradas no `prompt_ia`.

---

### Alteração 1: Nova Seção no SYSTEM_PROMPT - Regra de Valorização

**Arquivo:** `supabase/functions/chat-atendimento/index.ts`

**Localização:** Adicionar nova seção 10 após a seção 9 (REGRAS ESPECÍFICAS POR CATEGORIA)

**Conteúdo:**
```
═══════════════════════════════════════
10. VALORIZAÇÃO DO PROFISSIONAL
═══════════════════════════════════════
Quando identificar o médico para o exame/consulta, ANTES de listar os horários disponíveis:

1. Verificar se o médico possui CREDENCIAIS no contexto (seção [CREDENCIAIS] das instruções do médico)
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
```

---

### Alteração 2: Ajustar Formato do Contexto do Médico

**Localização:** Linhas 630-639 (onde monta o contexto dos médicos)

**Mudança:** Separar CREDENCIAIS de INSTRUÇÕES para a IA saber o que pode falar

**De:**
```javascript
if (d.prompt_ia) {
  info += `\n  ⚠️ INSTRUÇÕES OBRIGATÓRIAS PARA ESTE MÉDICO:\n  ${d.prompt_ia}`;
}
```

**Para:**
```javascript
if (d.prompt_ia) {
  // Tentar separar credenciais de instruções
  const hasCredenciais = d.prompt_ia.includes('[CREDENCIAIS]') || 
                         d.prompt_ia.includes('formação') || 
                         d.prompt_ia.includes('pós-graduação') ||
                         d.prompt_ia.includes('especialização');
  
  info += `\n  ⚠️ INSTRUÇÕES OBRIGATÓRIAS (seguir com prioridade):\n  ${d.prompt_ia}`;
  
  if (hasCredenciais) {
    info += `\n  💡 CREDENCIAIS (pode mencionar ao paciente de forma natural)`;
  }
}
```

---

### Alteração 3: Sugerir Formato para o prompt_ia do Médico

Para facilitar a distinção, sugerir que o campo `prompt_ia` use marcadores:

**Formato Sugerido:**
```
[CREDENCIAIS]
- 3 pós-graduações em Medicina Fetal
- Mestrado pela USP
- 15 anos de experiência

[INSTRUÇÕES]
- Preferir horários pela manhã
- Não agendar menos de 30 minutos entre consultas
```

Isso permite que a IA:
1. **CREDENCIAIS** → Pode mencionar ao paciente
2. **INSTRUÇÕES** → Apenas para comportamento interno

---

### Fluxo Esperado

| Etapa | O que acontece |
|-------|----------------|
| Paciente: "Quero ultrassom obstétrico" | Clara aplica desambiguação + upsell |
| Paciente confirma exame | Clara identifica Dr. Felipe |
| **NOVO** | Clara: "Vou verificar a agenda do Dr. Felipe! Ele possui formação especializada em Medicina Fetal, com 3 pós-graduações 😊" |
| Clara busca horários | Apresenta opções disponíveis |

---

### Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/chat-atendimento/index.ts` | Nova seção 10 no SYSTEM_PROMPT + ajuste no contexto dos médicos |

---

### Próximo Passo Opcional

Depois de implementar, você pode atualizar o `prompt_ia` de cada médico no painel Admin → Médicos → Prompt IA para usar o formato com `[CREDENCIAIS]` e `[INSTRUÇÕES]`.

