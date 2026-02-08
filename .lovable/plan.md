

# Reestruturar Medicina do Trabalho no Prompt da Clara

## Problemas Identificados

1. **Sem numero de secao** -- O bloco de Medicina do Trabalho (linhas 53-62) esta solto entre a secao 0 e a secao 1, sem numeracao propria. Isso faz com que a IA possa dar menos prioridade a essas regras.

2. **Secao 7 nao lista Medicina do Trabalho** -- A secao "ENCAMINHAR PARA HUMANO" (linha 317-326) nao menciona Medicina do Trabalho como motivo valido para encaminhamento, criando uma inconsistencia.

3. **Tool `encaminhar_humano` nao menciona Med. do Trabalho** -- A descricao da ferramenta (linha 1122-1123) lista convonio, desconto, etc., mas nao inclui Medicina do Trabalho, o que pode fazer a IA nao acionar a tool corretamente.

4. **Termo ambiguo "assistencial"** -- Esse keyword na lista pode causar falsos positivos com consultas medicas normais (assistenciais).

## Mudancas Planejadas

### 1. Mover Medicina do Trabalho para secao numerada propria

Remover o bloco solto das linhas 53-62 e criar uma nova **Secao 1A** (ou renumerar como parte da secao 1 - Regras Inviolaveis), posicionando-o como uma regra de alta prioridade com formato claro e numerado.

O conteudo sera:

```
1A. MEDICINA DO TRABALHO (ENCAMINHAMENTO OBRIGATORIO)

Palavras-chave: exames ocupacionais, ASO, PCMSO, PPRA, PGR,
saude ocupacional, afastamento, aptidao laboral, riscos
ocupacionais, CAT, admissional, periodico, demissional,
medicina do trabalho, saude do trabalhador.

REGRAS:
- Ao detectar qualquer uma dessas palavras-chave, Clara pode
  fazer UMA pergunta simples para confirmar o tema.
- Confirmada a relacao com Medicina do Trabalho:
  -> Chamar encaminhar_humano com motivo "Medicina do Trabalho"
  -> NAO tentar resolver, NAO pedir detalhes clinicos
  -> NAO fornecer orientacoes adicionais
```

**Nota**: O termo "assistencial" sera removido da lista de keywords por ser ambiguo.

### 2. Adicionar Medicina do Trabalho na Secao 7

Na lista de motivos para encaminhar para humano (linhas 319-326), adicionar:

```
- Medicina do Trabalho (ver Secao 1A)
```

### 3. Atualizar descricao da tool `encaminhar_humano`

Na definicao da ferramenta (linha 1122-1123), incluir Medicina do Trabalho na descricao:

```
"Encaminha para atendente humano. Usar para: convonio, desconto,
item sem preco, pedido explicito, duvida clinica, TROCA DE
HORARIO ou REAGENDAMENTO, MEDICINA DO TRABALHO."
```

## Resumo das alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/chat-atendimento/index.ts` | Remover bloco solto (linhas 53-62), criar secao 1A numerada, adicionar Med. do Trabalho na secao 7, atualizar descricao da tool |

## Resultado esperado

- A IA tratara Medicina do Trabalho como regra de alta prioridade (secao numerada)
- A secao 7 tera referencia cruzada, eliminando a inconsistencia
- A tool `encaminhar_humano` sera acionada corretamente para esses casos
- O termo "assistencial" nao causara mais falsos positivos

