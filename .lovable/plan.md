

## Plano: Ajustar Regra de Horário Final para Permitir Último Slot

### Problema Identificado

Quando um médico configura atendimento das **14:00 às 17:00** com exames de **20 minutos**, a lógica atual **NÃO permite** agendar às 17:00.

**Por quê?**

A função `generateTimeSlots()` nas Edge Functions usa a condição:

```javascript
while (currentMinutes + duracaoMinutos <= endMinutes) {
  // Gera slot
}
```

Isso significa:
- Para agendar às 17:00, o sistema verifica: `17:00 (1020 min) + 20 min = 1040 min`
- O horário fim é 17:00 (1020 min)
- Como `1040 > 1020`, o slot das 17:00 **NÃO é gerado**

**Slots gerados atualmente** (14:00-17:00, duração 20 min):
| Início | Fim |
|--------|-----|
| 14:00 | 14:20 |
| 14:20 | 14:40 |
| 14:40 | 15:00 |
| ... | ... |
| 16:20 | 16:40 |
| 16:40 | 17:00 ← **ÚLTIMO** |

O slot **17:00-17:20** não é gerado porque ultrapassa o limite de 17:00.

---

### Solução Proposta

Mudar a interpretação do horário final para significar **"horário de início do último atendimento possível"** ao invés de **"horário máximo de término"**.

Ou seja, se o médico configura 14:00-17:00:
- O último atendimento pode **começar** às 17:00
- E terminar às 17:20 (se o exame durar 20 min)

**Nova condição:**

```javascript
while (currentMinutes <= endMinutes) {
  // Gera slot
}
```

**Novos slots gerados** (14:00-17:00, duração 20 min):
| Início | Fim |
|--------|-----|
| 14:00 | 14:20 |
| 14:20 | 14:40 |
| ... | ... |
| 16:40 | 17:00 |
| 17:00 | 17:20 ← **NOVO!** |

---

### Mudanças Técnicas

| Arquivo | Função | Mudança |
|---------|--------|---------|
| `supabase/functions/agenda-disponibilidade/index.ts` | `generateTimeSlots()` | `currentMinutes + duracaoMinutos <= endMinutes` → `currentMinutes <= endMinutes` |
| `supabase/functions/agenda-disponibilidade-categoria/index.ts` | `generateTimeSlots()` | Mesma alteração |
| `supabase/functions/agenda-reservar/index.ts` | `isWithinRule` | Ajustar validação para aceitar slots que começam no horário limite |
| `src/components/admin/agenda/AgendaGrid.tsx` | `useMemo` | Manter lógica atual (usa slots existentes do banco) |
| `src/components/admin/agenda/ProximosHorariosLivres.tsx` | loop de slots | Ajustar para `min <= dayEnd` |

---

### Detalhes da Implementação

#### 1. Edge Function `agenda-disponibilidade/index.ts`

**Linha 335, de:**
```javascript
while (currentMinutes + duracaoMinutos <= endMinutes) {
```

**Para:**
```javascript
while (currentMinutes <= endMinutes) {
```

#### 2. Edge Function `agenda-disponibilidade-categoria/index.ts`

**Linha 260, de:**
```javascript
while (currentMinutes + duracaoMinutos <= endMinutes) {
```

**Para:**
```javascript
while (currentMinutes <= endMinutes) {
```

#### 3. Edge Function `agenda-reservar/index.ts`

**Linhas 217-221, de:**
```javascript
const isWithinRule = filteredRules.some(rule => {
  const ruleStart = timeToMinutes(rule.hora_inicio)
  const ruleEnd = timeToMinutes(rule.hora_fim)
  return horaInicioMinutos >= ruleStart && horaFimMinutos <= ruleEnd
})
```

**Para:**
```javascript
const isWithinRule = filteredRules.some(rule => {
  const ruleStart = timeToMinutes(rule.hora_inicio)
  const ruleEnd = timeToMinutes(rule.hora_fim)
  // Permite que o slot COMECE até o horário limite (hora_fim)
  return horaInicioMinutos >= ruleStart && horaInicioMinutos <= ruleEnd
})
```

#### 4. Componente `ProximosHorariosLivres.tsx`

**Linha 146, de:**
```javascript
for (let min = minMinutes; min < dayEnd && freeSlots.length < 8; min += 10) {
```

**Para:**
```javascript
for (let min = minMinutes; min <= dayEnd && freeSlots.length < 8; min += 10) {
```

**Linhas 155-159, de:**
```javascript
const isWithinRules = rulesForDay.some(rule => {
  const ruleStart = timeToMinutes(rule.hora_inicio);
  const ruleEnd = timeToMinutes(rule.hora_fim);
  return min >= ruleStart && min < ruleEnd;
});
```

**Para:**
```javascript
const isWithinRules = rulesForDay.some(rule => {
  const ruleStart = timeToMinutes(rule.hora_inicio);
  const ruleEnd = timeToMinutes(rule.hora_fim);
  return min >= ruleStart && min <= ruleEnd;
});
```

**Linhas 162-166 (schedule openings), de:**
```javascript
return min >= openingStart && min < openingEnd;
```

**Para:**
```javascript
return min >= openingStart && min <= openingEnd;
```

---

### Impacto da Mudança

| Antes | Depois |
|-------|--------|
| Médico 14:00-17:00 → Último slot inicia 16:40 | Médico 14:00-17:00 → Último slot inicia 17:00 |
| O paciente não pode agendar às 17:00 | O paciente pode agendar às 17:00-17:20 |

**Importante:** Isso significa que o médico pode atender **além** do horário configurado em `hora_fim`. Se quiser que o último atendimento termine exatamente às 17:00, deve configurar `hora_fim` = 16:40 (para exames de 20 min).

---

### Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/agenda-disponibilidade/index.ts` | Modificar `generateTimeSlots()` |
| `supabase/functions/agenda-disponibilidade-categoria/index.ts` | Modificar `generateTimeSlots()` |
| `supabase/functions/agenda-reservar/index.ts` | Modificar validação `isWithinRule` |
| `src/components/admin/agenda/ProximosHorariosLivres.tsx` | Ajustar loop e verificações de horário |

