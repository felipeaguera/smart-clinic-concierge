

# Corrigir Clara listando todos os horarios (bug do field name)

## Causa Raiz

O bug esta no handler `buscar_disponibilidade_categoria` dentro de `chat-atendimento/index.ts`.

A Edge Function `agenda-disponibilidade-categoria` retorna os horarios no campo **`horarios_disponiveis`**:

```text
{
  disponibilidades: [
    {
      doctor_id: "...",
      doctor_nome: "Dr. Felipe Aguera",
      horarios_disponiveis: [... TODOS os 36+ slots ...]   <-- campo real
    }
  ]
}
```

Porem, o handler em `chat-atendimento` (linha 1268) procura pelo campo errado:

```typescript
const slots = disp.slots || [];   // disp.slots NAO EXISTE! = undefined = []
```

Como `slots` fica vazio, o codigo entra no branch de "buscar proxima vaga" e faz `...disp` (spread), que **inclui o campo original `horarios_disponiveis` com TODOS os slots**. O modelo AI ve o array completo e lista todos.

## Evidencia

O mesmo bug NAO ocorre em `buscar_proxima_vaga` porque la o codigo JA verifica ambos os nomes de campo:

```typescript
// buscar_proxima_vaga (CORRETO - linhas 1381-1385)
const slotsKey = Array.isArray(d?.slots)
  ? "slots"
  : Array.isArray(d?.horarios_disponiveis)
    ? "horarios_disponiveis"
    : null;
```

Mas `buscar_disponibilidade_categoria` (linhas 1266-1306) so verifica `disp.slots`, ignorando `disp.horarios_disponiveis`.

## Correcao

No handler `buscar_disponibilidade_categoria` (linhas ~1266-1306 de `chat-atendimento/index.ts`):

1. Trocar `const slots = disp.slots || []` por `const slots = disp.slots || disp.horarios_disponiveis || []`
2. Ao fazer spread com `...disp`, remover o campo `horarios_disponiveis` original para que a IA nao veja os slots brutos - substituir por `slots` limitados

### Codigo corrigido:

```typescript
for (const disp of fullCategoriaResult.disponibilidades) {
  const slots = disp.slots || disp.horarios_disponiveis || [];

  if (slots.length === 0) {
    // Buscar proxima vaga (sem mudanca)
    ...
    const { horarios_disponiveis: _, slots: __, ...dispClean } = disp;
    processedDisponibilidades.push({
      ...dispClean,
      slots: [],
      proxima_vaga: foundNextSlot,
    });
  } else {
    // Aplicar selectSpacedSlots (igual ao buscar_proxima_vaga)
    const spacedSlots = selectSpacedSlots(slots, 3, 30);
    const { horarios_disponiveis: _, slots: __, ...dispClean } = disp;
    processedDisponibilidades.push({
      ...dispClean,
      slots: spacedSlots,
      total_slots: slots.length,
    });
  }
}
```

## Alteracao adicional: selectSpacedSlots no buscar_disponibilidade

O handler `buscar_disponibilidade` (para medico especifico) tambem usa `slice(0, 3)` simples em vez de `selectSpacedSlots`. Isso pode resultar em 3 horarios sequenciais (08:00, 08:10, 08:20) em vez de espacados. Vou corrigir para usar `selectSpacedSlots` tambem:

```typescript
// ANTES (linha 1248):
horarios_disponiveis: fullResult.horarios_disponiveis.slice(0, 3),

// DEPOIS:
horarios_disponiveis: selectSpacedSlots(fullResult.horarios_disponiveis, 3, 30),
```

## Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/chat-atendimento/index.ts` | Corrigir field name `slots` vs `horarios_disponiveis` no handler buscar_disponibilidade_categoria; usar `selectSpacedSlots` em vez de `slice(0,3)` nos 3 handlers |

## Resultado Esperado

- Clara mostrara exatamente 3 horarios espacados (~30min entre eles)
- Nenhum horario sera inventado (somente vindos da ferramenta)
- A regra do prompt sera respeitada porque agora os dados da ferramenta ja vem limitados

