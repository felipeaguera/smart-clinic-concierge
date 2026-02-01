
# Plano: Garantir que a Clara pare quando a secretária responde

## O que você configurou está CORRETO

Na sua imagem da Z-API:
- "Ao enviar" - tem URL configurada
- "Ao receber" - tem URL configurada  
- "Notificar as enviadas por mim também" - ATIVADO (toggle verde)

Isso é exatamente o que precisamos!

---

## Como funciona (explicação simples)

Imagine assim:

| Situação | O que acontece |
|----------|----------------|
| Paciente manda mensagem | Clara responde automaticamente |
| Secretária manda mensagem manual | Clara **para por 1 hora** |
| Paciente responde durante essa 1 hora | Clara **não responde** (secretária assumiu) |
| Depois de 1 hora | Clara volta a responder automaticamente |

---

## O problema identificado

Analisando os dados do banco, vi que:
- A tabela que controla a pausa tem o campo `auto_pause_until = null` para todos os registros
- Isso significa que a função de "pausar Clara" **nunca foi executada**

Duas possibilidades:
1. As mensagens `fromMe=true` não estão chegando ao webhook
2. As mensagens estão chegando mas em formato diferente do esperado

---

## A correção

Vou fazer duas melhorias no código:

### 1. Adicionar log detalhado no início do webhook

Antes de qualquer verificação, vou registrar TODOS os dados que chegam. Assim podemos ver exatamente o que a Z-API está enviando.

### 2. Melhorar a detecção de mensagens manuais

A Z-API pode enviar o `fromMe` em diferentes formatos:
- `fromMe: true` (booleano)
- `fromMe: "true"` (texto)

Vou garantir que o código reconheça ambos.

---

## Resultado esperado

Após a correção:

1. Você envia uma mensagem manual pelo WhatsApp
2. O sistema detecta e mostra no log: "MENSAGEM MANUAL DA SECRETÁRIA"
3. O sistema pausa a Clara por 1 hora para aquele número
4. Paciente responde → Clara NÃO responde
5. Após 1 hora → Clara volta automaticamente

---

## Seção Técnica

### Arquivo: `supabase/functions/zapi-webhook/index.ts`

Mudanças:
1. Adicionar log completo no início (antes de qualquer filtro)
2. Detectar `fromMe` em múltiplos formatos (boolean e string)
3. Adicionar logs mais claros para facilitar debug

### Arquivo: `supabase/functions/zapi-status/index.ts`

Mudanças:
1. Garantir que ambos webhooks estão configurados corretamente
2. Chamar o endpoint `update-notify-sent-by-me` via API para garantir que a opção está ativada (redundância de segurança)

