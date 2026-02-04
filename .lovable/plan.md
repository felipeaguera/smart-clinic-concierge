

# Plano: Clara pedir telefone além do nome para agendamentos

## Resumo

Atualizar o fluxo de agendamento da Clara para coletar o telefone do paciente junto com o nome, salvando ambos na reserva.

---

## Situação Atual

| Aspecto | Status Atual |
|---------|--------------|
| Edge function `agenda-reservar` | ✅ Já aceita `paciente_telefone` |
| Tool `reservar_horario` | ❌ Não tem parâmetro `paciente_telefone` |
| System prompt da Clara | ❌ Só pede nome, não pede telefone |
| Conversa WhatsApp | ⚠️ Telefone disponível no contexto (mas não usado) |

---

## Solução Proposta

### 1. Atualizar o System Prompt da Clara

Modificar a regra 9 para incluir telefone:

**De:**
```
ANTES de chamar reservar_horario → PERGUNTAR NOME COMPLETO e AGUARDAR resposta
```

**Para:**
```
ANTES de chamar reservar_horario:
1. PERGUNTAR NOME COMPLETO e AGUARDAR resposta
2. PERGUNTAR TELEFONE (com DDD) e AGUARDAR resposta
3. SOMENTE após ter AMBOS os dados → chamar reservar_horario
```

### 2. Atualizar a Tool `reservar_horario`

Adicionar parâmetro `paciente_telefone`:

```typescript
parameters: {
  properties: {
    // ... campos existentes ...
    paciente_nome: { type: "string", description: "..." },
    paciente_telefone: { 
      type: "string", 
      description: "Telefone do paciente com DDD (ex: 15999991234). DEVE ser informado pelo paciente na conversa."
    },
  },
  required: ["doctor_id", "exam_type_id", "data", "hora_inicio", "hora_fim", "paciente_nome", "paciente_telefone"],
}
```

### 3. Passar o telefone para a edge function

Na chamada da `agenda-reservar`:

```typescript
body: JSON.stringify({
  doctor_id: args.doctor_id,
  exam_type_id: args.exam_type_id,
  data: args.data,
  hora_inicio: args.hora_inicio,
  hora_fim: args.hora_fim,
  paciente_nome: args.paciente_nome,
  paciente_telefone: args.paciente_telefone, // NOVO
}),
```

### 4. Atualizar `reservar_multiplos_horarios` também

Adicionar o mesmo parâmetro para reservas múltiplas.

---

## Fluxo Atualizado

```text
Paciente: "Quero marcar consulta amanhã às 8h"
Clara: "Perfeito! Vou reservar às 08:00. Qual é o seu nome completo?"
Paciente: "Maria da Silva"
Clara: "Obrigada, Maria! E qual é o seu telefone com DDD?"
Paciente: "15 99999-1234"
Clara: [chama reservar_horario com nome + telefone]
Clara: "Pronto! ✅ Agendamento confirmado para Maria da Silva..."
```

---

## Caso WhatsApp (otimização futura)

Quando a conversa vem do WhatsApp, o telefone já é conhecido. Futuramente podemos passar o telefone no contexto para a Clara não precisar perguntar nesses casos. Por ora, ela perguntará em ambos os canais.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/chat-atendimento/index.ts` | Atualizar SYSTEM_PROMPT + tools + chamada da API |

---

## Ordem de Implementação

| Passo | Descrição |
|-------|-----------|
| 1 | Atualizar regra 9 do SYSTEM_PROMPT para pedir telefone |
| 2 | Adicionar `paciente_telefone` na tool `reservar_horario` |
| 3 | Adicionar `paciente_telefone` na tool `reservar_multiplos_horarios` |
| 4 | Passar o telefone na chamada para `agenda-reservar` |
| 5 | Passar o telefone na chamada para `agenda-reservar-multiplos` |
| 6 | Deploy e teste |

---

## Resultado Esperado

| Cenário | Comportamento |
|---------|---------------|
| Novo agendamento | Clara pede nome → depois pede telefone → reserva com ambos |
| Múltiplos exames | Mesmo fluxo, pede dados uma vez para todos |
| Banco de dados | `appointments` terá nome E telefone preenchidos |

