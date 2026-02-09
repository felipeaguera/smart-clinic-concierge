

# Corrigir Clara: Boas-vindas Repetidas + Pausa Ignorada

## Problema 1: Clara se apresenta 3-5 vezes seguidas

### Evidencia do banco de dados

Paciente 5515996931793 (Ana Luiza):
- 09:44:19.182 - inbound: "Ana Luiza moreira de souza"
- 09:44:19.184 - inbound: "Tudo bm"
- 09:44:19.188 - inbound: "Bom dia"
- 09:44:19.202 - inbound: "Gostaria de saber..."
- 09:44:28 - Clara: "Ola Ana Luiza! Eu sou a Clara..." (1a vez)
- 09:44:29 - Clara: "Ola! Eu sou a Clara..." (2a vez)
- 09:44:31 - Clara: "Ola! Eu sou a Clara..." (3a vez)

### Causa raiz

As 4 mensagens chegaram no MESMO milissegundo (09:44:19). O Z-API despachou todas de uma vez (provavelmente uma rajada de mensagens que o paciente mandou enquanto nao estava conectado).

Cada webhook roda em paralelo. Cada um:
1. Salva sua mensagem
2. Carrega o historico (que NAO contem as respostas das outras instancias - ainda nao foram salvas)
3. Chama chat-atendimento com historico quase vazio
4. Recebe resposta de boas-vindas
5. Envia pelo Z-API

Resultado: 3-4 respostas de boas-vindas identicas.

### Correcao: Message Coalescing (debounce)

Apos salvar a mensagem inbound, esperar 2 segundos e verificar se existem mensagens MAIS NOVAS do mesmo telefone. Se sim, abortar (a instancia mais recente cuidara de tudo com o contexto completo).

```text
Fluxo com debounce:
  Msg1 chega -> salva -> espera 2s -> verifica: tem msg2,3,4 mais novas -> ABORTA
  Msg2 chega -> salva -> espera 2s -> verifica: tem msg3,4 mais novas -> ABORTA
  Msg3 chega -> salva -> espera 2s -> verifica: tem msg4 mais nova -> ABORTA
  Msg4 chega -> salva -> espera 2s -> verifica: nenhuma mais nova -> PROCESSA (com historico completo de msg1-4)
```

Apenas a ULTIMA mensagem da rajada sera processada, e ela tera todas as anteriores no contexto.

## Problema 2: Clara nao para quando humano intervem

### Analise das evidencias

A verificacao no banco mostra que nas ultimas 24h NAO ha registros de Clara respondendo APOS mensagens de secretaria (a correcao com chatLid parece estar funcionando para os casos rastreados).

Porem, existem dois problemas estruturais que podem causar falhas em situacoes especificas:

### Bug A: extractPhoneFromPayload cria telefone falso

```typescript
body.chatId?.replace("@c.us", "").replace("@lid", "")
```

Se `body.phone` for "@lid" e `body.chatId` for "72065860255807@lid", essa linha produz "72065860255807" (numero do lid sem sufixo). Esse valor NAO contem "@", entao o codigo aceita como telefone valido. Mas NAO e um telefone real - e apenas o identificador numerico do lid.

Consequencia: mensagem salva com phone="72065860255807", pausa nao encontrada (pausa esta em phone="5515996305602").

### Bug B: Handoff entry NAO salva chat_lid

Na linha 745, quando a IA pede handoff, o registro e criado SEM chat_lid:
```typescript
await supabase.from("human_handoff_queue").insert({
  phone,
  patient_name: senderName,
  status: "open",
  // chat_lid AUSENTE!
});
```

Isso significa que handoffs criados pela IA (status "open") so podem ser encontrados por phone, nao por chat_lid. Se o phone tiver problema de resolucao, a pausa nao funciona.

### Correcao

1. Remover a linha que strip @lid do chatId em extractPhoneFromPayload (evitar telefones falsos)
2. Adicionar chat_lid ao insert de handoff (linha 745)
3. Para mensagens inbound com phone @lid, resolver via mapeamento ANTES de processar

## Resumo das alteracoes

| Local no codigo | O que muda |
|-----------------|-----------|
| extractPhoneFromPayload | Remover strip de @lid do chatId para evitar telefones falsos |
| Inbound handler (apos salvar msg) | Adicionar delay de 2 segundos + verificacao de mensagens mais novas (coalescing) |
| Handoff insert (linha 745) | Adicionar chat_lid ao registro |
| Inbound handler (inicio) | Se phone contem @lid, resolver via mapeamento antes de continuar |

## Resultado esperado

- Rajadas de mensagens: apenas 1 resposta da Clara (a ultima mensagem processa tudo)
- Pausa da Clara: funciona por phone E por chat_lid, sem telefones falsos
- Handoff da IA: registro inclui chat_lid para verificacao redundante
