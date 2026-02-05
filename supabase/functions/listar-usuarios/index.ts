import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
};

// Super admin email is now stored in environment variable for security
const SUPER_ADMIN_EMAIL = Deno.env.get('SUPER_ADMIN_EMAIL') || '';

serve(async (req) => {
  // Handle CORS preflight for all methods including DELETE
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente admin para todas as operações
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verificar o token do usuário
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Erro ao verificar usuário:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é o Super Admin (email configurado via secret)
    if (!SUPER_ADMIN_EMAIL || user.email !== SUPER_ADMIN_EMAIL) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas o administrador principal pode gerenciar usuários.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE - Remover usuário pendente
    if (req.method === 'DELETE') {
      const { userId } = await req.json();
      
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'ID do usuário é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se não é o super admin tentando se deletar
      if (userId === user.id) {
        return new Response(
          JSON.stringify({ error: 'Você não pode remover sua própria conta' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Deletar o usuário do auth (também remove da user_roles por cascade)
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (deleteError) {
        console.error('Erro ao deletar usuário:', deleteError);
        return new Response(
          JSON.stringify({ error: 'Erro ao remover usuário' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET - Listar usuários
    // Listar todos os usuários do auth
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('Erro ao listar usuários:', authError);
      return new Response(
        JSON.stringify({ error: 'Erro ao listar usuários' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar roles existentes
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      console.error('Erro ao buscar roles:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar roles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar perfis (nomes) dos usuários
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, nome');

    if (profilesError) {
      console.error('Erro ao buscar perfis:', profilesError);
      // Não é fatal, continua sem os nomes
    }

    // Mapear roles por user_id
    const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
    
    // Mapear nomes por user_id
    const profilesMap = new Map(profiles?.map(p => [p.id, p.nome]) || []);

    // Formatar resposta
    const usuarios = authUsers.users.map(u => ({
      id: u.id,
      email: u.email,
      nome: profilesMap.get(u.id) || null,
      created_at: u.created_at,
      role: rolesMap.get(u.id) || null,
      is_super_admin: u.email === SUPER_ADMIN_EMAIL,
    }));

    // Separar em pendentes e ativos
    const pendentes = usuarios.filter(u => !u.role && !u.is_super_admin);
    const ativos = usuarios.filter(u => u.role || u.is_super_admin);

    return new Response(
      JSON.stringify({ pendentes, ativos }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
