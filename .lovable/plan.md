

# Plano: Agenda Compacta e Otimizada para Impressão

## Problema Atual

| Aspecto | Valor Atual | Impacto |
|---------|-------------|---------|
| Altura mínima por slot | 44px | Agenda muito longa verticalmente |
| Slots de continuação | Mostram linha para cada 10min | Ocupa espaço desnecessário |
| Padding dos cards | py-1.5 px-2.5 | Espaço generoso demais |
| Estilos de impressão | Nenhum | Imprime elementos desnecessários |

## Solução Proposta

### 1. Colapsar Slots de Continuação

Em vez de mostrar uma linha visual para cada 10 minutos de continuação, mostrar apenas:
- O card do agendamento no slot inicial (com altura proporcional à duração)
- OU usar um sistema de "spanning" onde o card ocupa visualmente múltiplas linhas

**Opção recomendada**: Manter slots de 10 minutos mas **não renderizar linha para continuações** - apenas o card inicial "cresce" visualmente.

### 2. Reduzir Alturas e Espaçamentos

| Componente | Atual | Proposta |
|------------|-------|----------|
| Altura mínima do slot | 44px | 32px |
| Padding do card (full) | py-1.5 px-2.5 | py-1 px-2 |
| Padding do card (compact) | py-1 px-1.5 | py-0.5 px-1 |
| Min-height do card | 40px | 28px |
| Coluna de horário | w-16 | w-14 |
| Fonte do horário | text-xs | text-[11px] |

### 3. Adicionar Modo de Visualização "Compacto"

Criar um toggle no header da agenda:
- **Normal**: Layout atual (para uso no dia-a-dia)
- **Compacto**: Layout reduzido (para impressão ou visualização rápida)

### 4. Estilos para Impressão (@media print)

Adicionar CSS específico para impressão:
- Ocultar sidebar, calendário lateral, botões de ação
- Focar apenas na grade de horários
- Usar fonte menor
- Remover cores de fundo desnecessárias
- Adicionar botão "Imprimir" no header

### 5. Simplificar Cards na Versão Compacta

Versão compacta do card:
- Mostrar apenas: **horário + nome + procedimento** (em uma linha)
- Remover ícones decorativos
- Usar cores de borda para indicar status

## Alterações Técnicas

### Arquivo: `AgendaTimeGrid.tsx`

1. Adicionar prop `compactMode?: boolean`
2. Ajustar `min-h-[44px]` para `min-h-[32px]` quando compacto
3. Não renderizar linhas de continuação em modo compacto (apenas mostrar o card inicial maior)

### Arquivo: `AgendaAppointmentCard.tsx`

1. Adicionar prop `printMode?: boolean`
2. Criar versão ultra-compacta para impressão:
```tsx
// Modo compacto para impressão - uma única linha
<div className="flex items-center gap-2 py-0.5 px-1 text-xs">
  <span className="font-medium">{hora_inicio}</span>
  <span className="truncate">{patientName}</span>
  <span className="text-muted-foreground truncate">{examName}</span>
</div>
```

### Arquivo: `AgendaHeader.tsx`

1. Adicionar toggle "Modo Compacto"
2. Adicionar botão "Imprimir"

### Arquivo: `Agendamentos.tsx`

1. Adicionar estado `compactMode`
2. Passar para componentes filhos

### Arquivo: `index.css`

Adicionar estilos de impressão:
```css
@media print {
  /* Ocultar elementos não essenciais */
  .no-print,
  [data-sidebar],
  .calendar-sidebar { display: none !important; }
  
  /* Ajustar layout para página inteira */
  .print-agenda { 
    width: 100% !important;
    margin: 0 !important;
  }
  
  /* Fontes menores */
  .print-compact { font-size: 10px !important; }
}
```

## Fluxo de Implementação

| Passo | Descrição |
|-------|-----------|
| 1 | Adicionar estilos de impressão no `index.css` |
| 2 | Adicionar prop `compactMode` e toggle no header |
| 3 | Ajustar `AgendaTimeGrid` para modo compacto |
| 4 | Criar versão print-friendly do `AgendaAppointmentCard` |
| 5 | Adicionar botão de imprimir que abre diálogo do navegador |
| 6 | Testar impressão e ajustar espaçamentos |

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Slots por hora | 6 linhas (10min cada) | Mesmo, mas mais compactos |
| Altura total da agenda | ~600px+ | ~400px |
| Impressão | Cortada/ilegível | Cabe em 1-2 páginas A4 |
| Legibilidade | Boa | Mantida (nome + procedimento visíveis) |

## Visualização Comparativa

**Antes (uma consulta de 30min ocupa 3 linhas):**
```
08:00 | [Maria Silva - Consulta Ginecológica - 30min]
08:10 | ↑ Maria
08:20 | ↑ Maria
08:30 | [Livre]
```

**Depois (mesma consulta em modo compacto):**
```
08:00 | Maria Silva | Consulta | 30min
08:30 | + Livre
```

Ou com card de altura proporcional:
```
08:00 |╔══════════════════════════════╗
      |║ Maria Silva - Consulta 30min ║
08:30 |╚══════════════════════════════╝
      | + Livre
```

