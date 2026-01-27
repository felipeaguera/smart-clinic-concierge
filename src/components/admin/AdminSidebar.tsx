import { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Users, FileText, Calendar, LogOut, UserCog, Plug } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeHandoffs } from "@/hooks/useRealtimeHandoffs";
import logoImage from "@/assets/logo-pilarmed-full.png";

const SUPER_ADMIN_EMAIL = "felipe_aguera@hotmail.com";

const baseMenuItems = [
  { title: "Médicos", url: "/admin/medicos", icon: Users },
  { title: "Serviços", url: "/admin/exames", icon: FileText },
  { title: "Agendamentos", url: "/admin/agendamentos", icon: Calendar },
  { title: "Integração", url: "/admin/integracao", icon: Plug },
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
  "Cuidar é mais do que tratar doenças, é respeitar pessoas.",
  "A confiança do paciente é conquistada em cada detalhe do atendimento.",
  "A medicina começa quando alguém se sente ouvido.",
  "Humanização também é tecnologia aplicada com empatia.",
  "O conhecimento salva vidas quando caminha junto com o cuidado.",
  "Cada paciente confia a você o que tem de mais valioso: sua saúde.",
  "A verdadeira excelência médica é silenciosa, constante e ética.",
  "Um bom atendimento permanece na memória muito além do diagnóstico.",
  "A escuta atenta também é uma forma de tratamento.",
  "O respeito é o primeiro medicamento de qualquer consulta.",
  "A medicina exige técnica, mas se sustenta na humanidade.",
  "Cada exame realizado carrega uma expectativa de esperança.",
  "Profissionalismo também é saber acolher o medo do outro.",
  "Um atendimento cuidadoso reduz a dor antes mesmo do tratamento.",
  "A empatia transforma protocolos em cuidado real.",
  "A precisão técnica ganha valor quando há sensibilidade humana.",
  "Um gesto simples pode mudar a experiência de um paciente inteiro.",
  "Cuidar bem é fazer o melhor, mesmo quando ninguém está olhando.",
  "A ética é o alicerce invisível da boa medicina.",
  "A confiança nasce da transparência e do respeito.",
  "Medicina é ciência aplicada à vida real.",
  "Cada paciente merece atenção única, nunca atendimento automático.",
  "O tempo dedicado ao paciente nunca é tempo perdido.",
  "A responsabilidade médica vai além do laudo ou da prescrição.",
  "A saúde é construída em cada interação humana.",
  "O cuidado começa antes do diagnóstico e continua depois dele.",
  "Um atendimento humano reduz a ansiedade e fortalece a confiança.",
  "Medicina é compromisso diário com o bem-estar do outro.",
  "A qualidade do atendimento reflete quem você é como profissional.",
  "Cada decisão clínica carrega impacto humano.",
  "A medicina exige atualização constante e sensibilidade permanente.",
  "Tratar bem é parte fundamental do tratamento.",
  "O paciente não é um número, é uma história.",
  "A atenção aos detalhes é um ato de respeito.",
  "A medicina se fortalece quando o paciente se sente seguro.",
  "O cuidado começa na forma de falar e de ouvir.",
  "A empatia aproxima, tranquiliza e cura.",
  "Um atendimento de qualidade constrói vínculos duradouros.",
  "O conhecimento técnico ganha sentido quando melhora vidas.",
  "A medicina é feita de decisões, mas também de atitudes.",
  "Cada exame realizado é uma oportunidade de fazer melhor.",
  "O cuidado humanizado melhora resultados clínicos.",
  "A excelência médica nasce da soma de ciência e compaixão.",
  "A ética orienta mesmo quando o caminho é difícil.",
  "A confiança do paciente é uma conquista diária.",
  "O cuidado verdadeiro começa pelo respeito.",
  "A medicina é um serviço à vida.",
  "O acolhimento transforma medo em tranquilidade.",
  "A dedicação profissional constrói segurança.",
  "A medicina exige firmeza, mas também sensibilidade.",
  "Cada paciente merece ser tratado com dignidade e atenção.",
  "O cuidado não termina quando o exame acaba.",
  "A comunicação clara também é um ato terapêutico.",
  "A medicina é feita de escolhas responsáveis.",
  "Um bom atendimento faz o paciente se sentir protegido.",
  "A empatia melhora a experiência e os resultados.",
  "Cuidar bem é uma decisão diária.",
  "A medicina se exerce com conhecimento e consciência.",
  "A confiança nasce quando o paciente se sente respeitado.",
  "O cuidado humano fortalece a relação médico-paciente.",
  "A atenção genuína reduz o sofrimento invisível.",
  "Cada detalhe do atendimento importa.",
  "O profissional de saúde impacta vidas todos os dias.",
  "A medicina é um exercício contínuo de responsabilidade.",
  "O respeito é essencial em qualquer etapa do cuidado.",
  "A escuta ativa é parte do diagnóstico.",
  "A qualidade do atendimento reflete compromisso com a vida.",
  "A medicina vai além do resultado, envolve experiência.",
  "O cuidado ético constrói credibilidade.",
  "Cada paciente merece clareza, cuidado e respeito.",
  "A medicina se fortalece com relações humanas saudáveis.",
  "O acolhimento reduz a distância entre profissional e paciente.",
  "O cuidado atento gera confiança imediata.",
  "A ciência orienta, a empatia aproxima.",
  "A medicina é um trabalho técnico com impacto humano profundo.",
  "A atenção ao paciente é a base da boa prática médica.",
  "Um atendimento de excelência começa pelo respeito.",
  "O cuidado verdadeiro vai além do protocolo.",
  "A responsabilidade médica exige sensibilidade e precisão.",
  "A medicina é feita de pessoas cuidando de pessoas.",
  "O compromisso com o paciente é diário.",
  "A ética é a base de toda decisão clínica.",
  "Um bom atendimento humaniza a tecnologia.",
  "O cuidado atento melhora a experiência do paciente.",
  "A medicina exige rigor técnico e empatia constante.",
  "O acolhimento cria ambientes mais seguros.",
  "A confiança do paciente começa no primeiro contato.",
  "Cada atendimento é uma oportunidade de fazer o bem.",
  "A medicina se constrói com responsabilidade e humanidade.",
  "O cuidado começa no olhar e na escuta.",
  "A medicina transforma conhecimento em cuidado real.",
  "O respeito fortalece a relação terapêutica.",
  "A excelência médica nasce da atenção contínua.",
  "O cuidado humanizado melhora a jornada do paciente.",
  "A ética sustenta a confiança em longo prazo.",
  "Cada paciente merece atenção plena.",
  "A medicina é compromisso com a vida em todas as fases.",
  "O cuidado genuíno cria impacto duradouro.",
  "A empatia também é uma competência profissional.",
  "Cuidar bem é o maior legado da medicina.",
];

// Retorna saudação baseada na hora do dia
const getSaudacao = () => {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
};

export function AdminSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { pendingCount } = useRealtimeHandoffs();

  // Frase aleatória mantida durante a sessão
  const fraseMotivacional = useMemo(() => {
    return frasesMotivacionais[Math.floor(Math.random() * frasesMotivacionais.length)];
  }, []);

  // Buscar nome do perfil
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("nome").eq("id", user?.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  // Extrai primeiro nome ou usa parte do email
  const primeiroNome = profile?.nome?.split(" ")[0] || user?.email?.split("@")[0]?.split(".")[0];

  // Capitaliza primeira letra
  const nomeFormatado = primeiroNome ? primeiroNome.charAt(0).toUpperCase() + primeiroNome.slice(1).toLowerCase() : "";

  // Verificar se é o Super Admin
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  // Montar menu com item de usuários condicional
  const menuItems = isSuperAdmin
    ? [...baseMenuItems, { title: "Usuários", url: "/admin/usuarios", icon: UserCog }]
    : baseMenuItems;

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex flex-col gap-4">
          {/* Logo Pilar Med */}
          <div className="flex items-center justify-center py-2">
            <img src={logoImage} alt="Pilar Med - Medicina Especializada" className="h-10 w-auto" />
          </div>

          {/* Saudação e Frase Motivacional */}
          <div className="bg-sidebar-accent/50 rounded-lg p-3">
            <p className="text-sm font-medium text-sidebar-foreground">
              {getSaudacao()}, {nomeFormatado}! 👋
            </p>
            <p className="text-xs text-sidebar-foreground/70 mt-1 italic leading-relaxed">"{fraseMotivacional}"</p>
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
                      {item.title === "Integração" && pendingCount > 0 && (
                        <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-xs">
                          {pendingCount}
                        </Badge>
                      )}
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
          <div className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</div>
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
