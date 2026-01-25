import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Users, FileText, Calendar, LogOut, UserCog } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import logoImage from '@/assets/logo-pilarmed-full.png';

const SUPER_ADMIN_EMAIL = 'felipe_aguera@hotmail.com';

const baseMenuItems = [
  { title: 'Médicos', url: '/admin/medicos', icon: Users },
  { title: 'Serviços', url: '/admin/exames', icon: FileText },
  { title: 'Agendamentos', url: '/admin/agendamentos', icon: Calendar },
];

// Frases motivacionais sobre medicina
const frasesMotivacionais = [
  "Cuidar de pessoas é a mais nobre das missões.",
  "Cada paciente atendido é uma vida transformada.",
  "A medicina é a arte de curar com ciência e coração.",
  "Seu trabalho hoje faz diferença na vida de alguém.",
  "Atrás de cada consulta, há uma história que merece atenção.",
  "A saúde começa com um atendimento humano e dedicado.",
  "Você é parte essencial da jornada de cuidado dos pacientes.",
  "Pequenos gestos de acolhimento salvam vidas.",
  "A excelência no atendimento começa com você.",
  "Cada dia é uma nova oportunidade de fazer o bem.",
  "O cuidado genuíno transforma a experiência do paciente.",
  "Sua dedicação inspira confiança e esperança.",
  "Na medicina, cada detalhe importa.",
  "Juntos, construímos saúde e bem-estar.",
  "O acolhimento é o primeiro passo da cura.",
];

// Retorna saudação baseada na hora do dia
const getSaudacao = () => {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
};

export function AdminSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  
  // Frase aleatória mantida durante a sessão
  const fraseMotivacional = useMemo(() => {
    return frasesMotivacionais[Math.floor(Math.random() * frasesMotivacionais.length)];
  }, []);

  // Buscar nome do perfil
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('nome')
        .eq('id', user?.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Extrai primeiro nome ou usa parte do email
  const primeiroNome = profile?.nome?.split(' ')[0] 
    || user?.email?.split('@')[0]?.split('.')[0];

  // Capitaliza primeira letra
  const nomeFormatado = primeiroNome 
    ? primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase()
    : '';
  
  // Verificar se é o Super Admin
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;
  
  // Montar menu com item de usuários condicional
  const menuItems = isSuperAdmin 
    ? [...baseMenuItems, { title: 'Usuários', url: '/admin/usuarios', icon: UserCog }]
    : baseMenuItems;

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex flex-col gap-4">
          {/* Logo Pilar Med */}
          <div className="flex items-center justify-center py-2">
            <img 
              src={logoImage} 
              alt="Pilar Med - Medicina Especializada" 
              className="h-10 w-auto"
            />
          </div>
          
          {/* Saudação e Frase Motivacional */}
          <div className="bg-sidebar-accent/50 rounded-lg p-3">
            <p className="text-sm font-medium text-sidebar-foreground">
              {getSaudacao()}, {nomeFormatado}! 👋
            </p>
            <p className="text-xs text-sidebar-foreground/70 mt-1 italic leading-relaxed">
              "{fraseMotivacional}"
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            Gestão
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex flex-col gap-3">
          <div className="text-xs text-sidebar-foreground/60 truncate">
            {user?.email}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={signOut}
            className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
