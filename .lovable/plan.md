

## Plano: Corrigir Geração do QR Code Z-API

### Problema Identificado

A Edge Function `zapi-status` atual usa apenas o endpoint `/qr-code/image`, que retorna o QR Code apenas se a sessão já foi iniciada. Para gerar um novo QR Code, é necessário **chamar ativamente** o endpoint `/connect` da Z-API.

**Confirmação dos Secrets**:
Sim, os secrets estão configurados corretamente conforme a imagem:
- **ZAPI_INSTANCE_ID**: `3EDDF0215D68C15FC4920203B614D70E`
- **ZAPI_TOKEN**: `AC8BC988CE25D949C131BD67`

---

### Solução

Modificar a Edge Function `zapi-status` para seguir o fluxo correto da Z-API:

```text
1. Chamar GET /status → verificar se connected
2. Se NÃO connected:
   a. Chamar GET /connect → iniciar sessão e obter QR
   b. Retornar o QR Code recebido
3. Se connected:
   a. Retornar { connected: true }
```

---

### Mudanças Técnicas

#### Arquivo: `supabase/functions/zapi-status/index.ts`

**Antes:**
```javascript
// Verificava status
// Se não conectado, buscava /qr-code/image (passivo)
```

**Depois:**
```javascript
// 1. Verificar status via GET /status
const statusUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/status`;

// 2. Se desconectado, chamar GET /connect para iniciar sessão
const connectUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}/connect`;

// 3. A resposta de /connect contém o QR Code diretamente
// Possíveis formatos de resposta:
//   - { value: "base64...", base64: true }
//   - { qrcode: "texto ou base64" }
//   - Imagem binária
```

**Lógica de tratamento da resposta:**
1. Tentar parsear como JSON
2. Se JSON, extrair `value` (base64) ou `qrcode`
3. Se binário (image/png), converter para base64
4. Sempre retornar prefixo `data:image/png;base64,...`

**Tratamento de erros:**
- Se `/connect` falhar, exibir mensagem clara no frontend
- Logar erro detalhado para debug

---

### Fluxo Completo Atualizado

```text
┌─────────────────────────────────────────────────────────────┐
│  Usuário abre /admin/integracao                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Frontend chama zapi-status                              │
│  2. Edge Function:                                          │
│     a. GET /status → { connected: false }                   │
│     b. GET /connect → retorna QR Code                       │
│     c. Retorna { connected: false, qrCodeBase64: "..." }    │
│  3. Frontend exibe QR Code                                  │
│  4. Usuário escaneia com WhatsApp                           │
│  5. Polling a cada 15s detecta connected = true             │
│  6. Frontend mostra "Conectado"                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/functions/zapi-status/index.ts` | MODIFICAR | Usar endpoint `/connect` ao invés de `/qr-code/image` |

---

### Observações Importantes

1. **Sem client_token**: A Z-API usa apenas `instanceId` e `token` para autenticação da API. O `client_token` é usado apenas para validar webhooks, não para chamadas de API.

2. **Formato do QR**: O endpoint `/connect` pode retornar o QR em diferentes formatos. A implementação tratará todos os cenários.

3. **Mensagem de erro**: Se houver falha na Z-API, o frontend exibirá a mensagem de erro específica recebida.

4. **Polling mantido**: O polling de 15 segundos continua funcionando para detectar quando a conexão for estabelecida.

