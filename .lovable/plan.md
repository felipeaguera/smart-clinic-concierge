

## Plano: Configurar Login como Página Inicial + Domínio Próprio

### 1. Alterar Rotas no App.tsx

Inverter as rotas para que o login seja a página inicial:

```tsx
// src/App.tsx - Mudanças nas rotas
<Routes>
  {/* Página inicial agora é o Login */}
  <Route path="/" element={<Login />} />
  
  {/* Chat de testes movido para /atendimento */}
  <Route path="/atendimento" element={<Atendimento />} />
  
  {/* Redirecionar /login antigo para a raiz */}
  <Route path="/login" element={<Navigate to="/" replace />} />
  
  {/* ... resto das rotas admin permanecem iguais */}
</Routes>
```

### 2. Ajustar Redirecionamento no Login.tsx

Atualizar o `useEffect` que redireciona admins após login:

```tsx
// Redirecionar para /admin/medicos após login bem-sucedido
// (já está assim, não precisa mudar)
```

### 3. Conectar Domínio Próprio

Após publicar, você vai em:
- **Configurações do Projeto** → **Domains** → **Connect Domain**
- Adicionar seu domínio (ex: `seudominio.com.br`)
- Configurar os registros DNS no seu provedor:
  - **A Record**: `@` → `185.158.133.1`
  - **A Record**: `www` → `185.158.133.1`
  - **TXT Record**: `_lovable` → (valor fornecido pelo Lovable)

### Resultado Final

| URL | O que aparece |
|-----|---------------|
| `seudominio.com.br` | Tela de login com a Clara |
| `seudominio.com.br/atendimento` | Chat para testar a IA |
| `seudominio.com.br/admin/...` | Painel administrativo (após login) |

### Arquivos a Modificar

1. **`src/App.tsx`** - Reorganizar rotas

