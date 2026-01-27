import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/admin/ProtectedRoute";
import Login from "./pages/Login";
import Atendimento from "./pages/Atendimento";
import Medicos from "./pages/admin/Medicos";
import MedicoPerfil from "./pages/admin/MedicoPerfil";
import TiposExame from "./pages/admin/TiposExame";
import Agendamentos from "./pages/admin/Agendamentos";
import Integracao from "./pages/admin/Integracao";
import Usuarios from "./pages/admin/Usuarios";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutos
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/atendimento" element={<Atendimento />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route
              path="/admin/medicos"
              element={
                <ProtectedRoute>
                  <Medicos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/medicos/:id"
              element={
                <ProtectedRoute>
                  <MedicoPerfil />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/exames"
              element={
                <ProtectedRoute>
                  <TiposExame />
                </ProtectedRoute>
              }
            />
            {/* Redirects de rotas antigas */}
            <Route path="/admin/regras" element={<Navigate to="/admin/medicos" replace />} />
            <Route path="/admin/excecoes" element={<Navigate to="/admin/medicos" replace />} />
            <Route path="/admin/datas-extras" element={<Navigate to="/admin/medicos" replace />} />
            <Route
              path="/admin/agendamentos"
              element={
                <ProtectedRoute>
                  <Agendamentos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/integracao"
              element={
                <ProtectedRoute>
                  <Integracao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/usuarios"
              element={
                <ProtectedRoute>
                  <Usuarios />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
