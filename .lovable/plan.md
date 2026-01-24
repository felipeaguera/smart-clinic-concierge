

## Plano: Consolidação Conservadora do Prompt (Sem Risco de Quebrar Lógica)

### Objetivo
Eliminar duplicações usando referências cruzadas, mantendo 100% da lógica original.

---

### Princípio: Substituir Duplicação por Referência

Em vez de remover regras, vamos **manter a regra completa em UM lugar** e **referenciar** nos outros lugares.

---

### Alteração 1: Consolidar Desambiguação de Ultrassom

**Manter completo em:** Regra 10A (linhas 28-33)

**Substituir em:**
- Passo 0A (linhas 177-182) → `"A) ULTRASSONS: Aplicar Regra 10A"`
- Regra 6 linha 384 → Remover frase duplicada (já está na Regra 10A)

---

### Alteração 2: Consolidar Desambiguação de Consulta/Médico

**Manter completo em:** Regra 10C e 10D (linhas 35-40)

**Substituir em:**
- Passo 0C (linhas 191-196) → `"C) CONSULTAS: Aplicar Regra 10C"`
- Passo 0D (linhas 198-209) → `"D) POR MÉDICO: Aplicar Regra 10D"`

---

### Alteração 3: Consolidar Regra Temporal

**Manter completo em:** Seção "Regra Temporal Absoluta" (linhas 315-325)

**Substituir em:**
- Passo 3 linha 239 → `"Ver Regra Temporal Absoluta abaixo"`
- Seção Validação de Data (linhas 244-255) → Mesclar na Regra Temporal (não duplicar)

---

### Alteração 4: Remover Duplicação de Duração

**Manter em:** Regra de Ouro 6 (linha 22)

**Remover de:** Regra 6 linha 382 (já está na Regra de Ouro)

---

### Alteração 5: Adicionar Referência de Upsell no Fluxo

**Problema:** A Regra 14 (Upsell) não é referenciada no Fluxo de Agendamento

**Solução:** Adicionar no Passo 1 do Fluxo de Agendamento:
```
PASSO 1: Se exame obstétrico → Aplicar Regra 14 (Upsell) ANTES de buscar disponibilidade
```

---

### O Que NÃO Será Alterado

| Seção | Status |
|-------|--------|
| Regras de Ouro 1-9 | Mantidas integralmente |
| Regra 11 (Correspondência Exata) | Mantida |
| Regra 12 (Instruções do Médico) | Mantida |
| Regra 13 (Múltiplos Exames) | Mantida |
| Regra 14 (Upsell) | Mantida - frases não alteradas |
| Fluxo de Orçamento | Mantido |
| Seção 4 (Encaminhar Humano) | Mantida |
| Seção 5 (Tom de Voz) | Mantida |
| Seção 7 (Laboratório) | Mantida |
| Seção 8 (Morfológicos) | Mantida |

---

### Resultado Esperado

- **Redução:** ~20% (443 → ~350 linhas)
- **Lógica removida:** ZERO
- **Risco:** MÍNIMO (apenas substitui texto duplicado por referências)
- **Benefício:** Modelo não vê mesma instrução 3 vezes, segue melhor

---

### Arquivo Modificado

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/chat-atendimento/index.ts` | Consolidação do SYSTEM_PROMPT com referências cruzadas |

