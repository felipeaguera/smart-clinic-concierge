import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AgendaGrid } from '@/components/admin/agenda/AgendaGrid';
import { NovoAgendamentoModal } from '@/components/admin/agenda/NovoAgendamentoModal';
import { EditarAgendamentoModal } from '@/components/admin/agenda/EditarAgendamentoModal';
import { cn } from '@/lib/utils';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight, Stethoscope, Activity } from 'lucide-react';

interface Doctor {
  id: string;
  nome: string;
}

interface DoctorRule {
  id: string;
  doctor_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  tipo_atendimento: string;
}

interface ExamType {
  id: string;
  nome: string;
  categoria: string;
  duracao_minutos: number;
}

interface Appointment {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  paciente_nome?: string | null;
  paciente_telefone?: string | null;
  exam_types?: { id: string; nome: string; duracao_minutos: number };
}

type TipoAtendimento = 'consulta' | 'ultrassom';

export default function Agendamentos() {
  const [tipoAtendimento, setTipoAtendimento] = useState<TipoAtendimento>('consulta');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState('');
  const [slotEndTime, setSlotEndTime] = useState('');
  const [availableMinutes, setAvailableMinutes] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Fetch doctors
  const { data: doctors } = useQuery({
    queryKey: ['doctors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctors')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data as Doctor[];
    },
  });

  // Fetch doctor rules
  const { data: doctorRules } = useQuery({
    queryKey: ['doctor_rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctor_rules')
        .select('*');
      if (error) throw error;
      return data as DoctorRule[];
    },
  });

  // Fetch exam types
  const { data: examTypes } = useQuery({
    queryKey: ['exam_types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_types')
        .select('id, nome, categoria, duracao_minutos')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data as ExamType[];
    },
  });

  // Fetch appointments for selected doctor and date
  const { data: appointments, isLoading: isLoadingAppointments } = useQuery({
    queryKey: ['appointments', selectedDoctorId, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!selectedDoctorId) return [];
      
      const { data, error } = await supabase
        .from('appointments')
        .select('id, hora_inicio, hora_fim, status, paciente_nome, paciente_telefone, exam_types(id, nome, duracao_minutos)')
        .eq('doctor_id', selectedDoctorId)
        .eq('data', format(selectedDate, 'yyyy-MM-dd'));
      
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!selectedDoctorId,
  });

  // Filtra médicos baseado no tipo de atendimento e suas regras
  const filteredDoctors = useMemo(() => {
    if (!doctors || !doctorRules) return [];
    
    return doctors.filter((doctor) => {
      const rules = doctorRules.filter((r) => r.doctor_id === doctor.id);
      return rules.some(
        (rule) =>
          rule.tipo_atendimento === 'ambos' || rule.tipo_atendimento === tipoAtendimento
      );
    });
  }, [doctors, doctorRules, tipoAtendimento]);

  // Regras do médico selecionado
  const selectedDoctorRules = useMemo(() => {
    if (!doctorRules || !selectedDoctorId) return [];
    return doctorRules.filter((r) => r.doctor_id === selectedDoctorId);
  }, [doctorRules, selectedDoctorId]);

  const selectedDoctor = doctors?.find((d) => d.id === selectedDoctorId);

  // Handlers
  const handleTipoChange = (tipo: TipoAtendimento) => {
    setTipoAtendimento(tipo);
    setSelectedDoctorId(''); // Reset doctor when changing type
  };

  const handleSlotClick = (time: string, available: number, endTime: string) => {
    setSelectedTime(time);
    setSlotEndTime(endTime);
    setAvailableMinutes(available);
    setModalOpen(true);
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setEditModalOpen(true);
  };

  const handlePrevDay = () => setSelectedDate(subDays(selectedDate, 1));
  const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));

  return (
    <AdminLayout title="Agenda Visual">
      <div className="space-y-6">
        {/* Seletor de Tipo */}
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Toggle Tipo de Atendimento */}
              <div className="flex gap-2">
                <Button
                  variant={tipoAtendimento === 'consulta' ? 'default' : 'outline'}
                  onClick={() => handleTipoChange('consulta')}
                  className="flex-1 sm:flex-none"
                >
                  <Stethoscope className="h-4 w-4 mr-2" />
                  Consulta
                </Button>
                <Button
                  variant={tipoAtendimento === 'ultrassom' ? 'default' : 'outline'}
                  onClick={() => handleTipoChange('ultrassom')}
                  className="flex-1 sm:flex-none"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Ultrassom
                </Button>
              </div>

              {/* Seletor de Médico */}
              <div className="flex-1 max-w-xs">
                <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o médico" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDoctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agenda */}
        {selectedDoctorId && (
          <Card className="glass-card">
            <CardHeader className="pb-4">
              {/* Navegação de Data */}
              <div className="flex items-center justify-between">
                <Button variant="outline" size="icon" onClick={handlePrevDay}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'min-w-[240px] justify-center text-center font-medium',
                        !selectedDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setCalendarOpen(false);
                        }
                      }}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Button variant="outline" size="icon" onClick={handleNextDay}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <CardTitle className="text-center mt-4 text-lg">
                Agenda de {selectedDoctor?.nome} - {tipoAtendimento === 'consulta' ? 'Consultas' : 'Ultrassom'}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <AgendaGrid
                doctorRules={selectedDoctorRules}
                appointments={appointments || []}
                selectedDate={selectedDate}
                tipoAtendimento={tipoAtendimento}
                onSlotClick={handleSlotClick}
                onAppointmentClick={handleAppointmentClick}
                isLoading={isLoadingAppointments}
              />
            </CardContent>
          </Card>
        )}

        {/* Mensagem quando nenhum médico selecionado */}
        {!selectedDoctorId && (
          <Card className="glass-card">
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium">Selecione um médico</p>
                <p className="text-sm mt-1">
                  Escolha o tipo de atendimento e um médico para visualizar a agenda.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de Novo Agendamento */}
      {selectedDoctor && (
        <NovoAgendamentoModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          slotEndTime={slotEndTime}
          availableMinutes={availableMinutes}
          doctor={selectedDoctor}
          tipoAtendimento={tipoAtendimento}
          examTypes={examTypes || []}
        />
      )}

      {/* Modal de Editar Agendamento */}
      {selectedDoctor && (
        <EditarAgendamentoModal
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          doctor={selectedDoctor}
          selectedDate={selectedDate}
          tipoAtendimento={tipoAtendimento}
        />
      )}
    </AdminLayout>
  );
}
