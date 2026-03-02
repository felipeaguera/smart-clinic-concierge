

# Remover Dr. Klauber e encaminhar ginecologia/obstetrícia para humano

## Alterações em `supabase/functions/chat-atendimento/index.ts`

### 1. Nova regra inviolável (após seção 1A, ~linha 69)

Adicionar seção **1B. GINECOLOGIA / OBSTETRÍCIA / DR. KLAUBER** com regras idênticas à medicina do trabalho:

- Palavras-chave: Dr. Klauber, ginecologia, ginecologista, obstetrícia, obstetra, preventivo ginecológico, pré-natal, papanicolau
- Ao detectar → confirmar com UMA pergunta → chamar `encaminhar_humano` com motivo "Ginecologia/Obstetrícia"
- NÃO agendar, NÃO buscar disponibilidade, NÃO informar preços

### 2. Remover referências ao Dr. Klauber

- **Linha 138**: Trocar exemplo "quero com Dr. Klauber" por "quero com Dr. Felipe"
- **Linha 404**: Remover exemplo do Dr. Klauber, substituir por outro médico

### 3. Remover/ajustar upsell obstétrico (linhas 143-170)

Como obstetrícia agora vai para humano, a seção de **Upsell Obstétrico** (seção 3) deve ser removida ou convertida em instrução de encaminhamento. Se o paciente pedir ultrassom obstétrico → encaminhar para humano junto com ginecologia.

### 4. Ajustar exemplos de consulta ginecológica (linhas 134-135)

Remover exemplo "consulta gineco" / "Consulta Ginecológica" da seção de desambiguação, já que agora isso vai para humano.

### 5. Atualizar descrição da tool `encaminhar_humano` (linha 1138)

Adicionar "GINECOLOGIA, OBSTETRÍCIA, DR. KLAUBER" à lista de motivos.

### Resultado

Clara não agenda, não busca horários, não informa preços para nada relacionado ao Dr. Klauber, ginecologia ou obstetrícia — encaminha direto para humano.

