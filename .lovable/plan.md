# Plano: Clara pedir telefone além do nome para agendamentos

## ✅ IMPLEMENTADO

### Resumo
Clara agora pede nome + telefone antes de confirmar agendamentos.

### Alterações Realizadas

| Arquivo | Alteração |
|---------|-----------|
| `chat-atendimento/index.ts` | Regra 9 atualizada para pedir nome + telefone |
| `chat-atendimento/index.ts` | Tool `reservar_horario` com parâmetro `paciente_telefone` obrigatório |
| `chat-atendimento/index.ts` | Tool `reservar_multiplos_horarios` com parâmetro `paciente_telefone` obrigatório |
| `chat-atendimento/index.ts` | Chamadas para `agenda-reservar` e `agenda-reservar-multiplos` passam o telefone |

### Fluxo de Conversa
```
Paciente: "Quero marcar consulta amanhã às 8h"
Clara: "Perfeito! Vou reservar às 08:00. Qual é o seu nome completo?"
Paciente: "Maria da Silva"
Clara: "Obrigada, Maria! E qual é o seu telefone com DDD?"
Paciente: "15 99999-1234"
Clara: [chama reservar_horario com nome + telefone]
Clara: "Pronto! ✅ Agendamento confirmado para Maria da Silva..."
```

### Status
- ✅ System prompt atualizado
- ✅ Tools atualizadas  
- ✅ Chamadas API passam telefone
- ✅ Deploy realizado

