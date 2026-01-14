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
import TiposExame from "./pages/admin/TiposExame";
import RegrasAtendimento from "./pages/admin/RegrasAtendimento";
import ExcecoesAgenda from "./pages/admin/ExcecoesAgenda";
import DatasExtras from "./pages/admin/DatasExtras";
import Agendamentos from "./pages/admin/Agendamentos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Atendimento />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/admin/medicos"
              element={
                <ProtectedRoute>
                  <Medicos />
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
            <Route
              path="/admin/regras"
              element={
                <ProtectedRoute>
                  <RegrasAtendimento />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/excecoes"
              element={
                <ProtectedRoute>
                  <ExcecoesAgenda />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/datas-extras"
              element={
                <ProtectedRoute>
                  <DatasExtras />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/agendamentos"
              element={
                <ProtectedRoute>
                  <Agendamentos />
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
