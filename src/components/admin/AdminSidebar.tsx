import { useLocation } from 'react-router-dom';
import { Users, FileText, Calendar, LogOut, UserCog } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
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

const SUPER_ADMIN_EMAIL = 'felipe_aguera@hotmail.com';

const baseMenuItems = [
  { title: 'Médicos', url: '/admin/medicos', icon: Users },
  { title: 'Serviços', url: '/admin/exames', icon: FileText },
  { title: 'Agendamentos', url: '/admin/agendamentos', icon: Calendar },
];

export function AdminSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  
  // Verificar se é o Super Admin
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;
  
  // Montar menu com item de usuários condicional
  const menuItems = isSuperAdmin 
    ? [...baseMenuItems, { title: 'Usuários', url: '/admin/usuarios', icon: UserCog }]
    : baseMenuItems;
  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-primary">
            <span className="text-lg font-bold text-sidebar-primary-foreground">C</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-sidebar-foreground">Clínica Admin</h2>
            <p className="text-xs text-sidebar-foreground/60">Painel de Controle</p>
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
