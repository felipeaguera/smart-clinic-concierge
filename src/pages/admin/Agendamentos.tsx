import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeAppointments } from '@/hooks/useRealtimeAppointments';
import { useRealtimeScheduleOpenings } from '@/hooks/useRealtimeScheduleOpenings';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { AgendaTimeGrid } from '@/components/admin/agenda/AgendaTimeGrid';
import { AgendaHeader } from '@/components/admin/agenda/AgendaHeader';
import { ProximosHorariosLivres } from '@/components/admin/agenda/ProximosHorariosLivres';
import { NovoAgendamentoModal } from '@/components/admin/agenda/NovoAgendamentoModal';
import { EditarAgendamentoModal } from '@/components/admin/agenda/EditarAgendamentoModal';
import { EncaixeModal } from '@/components/admin/agenda/EncaixeModal';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Stethoscope, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface ScheduleOpening {
  id: string;
  doctor_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo_atendimento: string;
}

interface ExamType {
  id: string;
  nome: string;
  categoria: string;
  duracao_minutos: number;
  doctor_id: string | null;
}

interface Appointment {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  paciente_nome?: string | null;
  paciente_telefone?: string | null;
  is_encaixe?: boolean;
  exam_types?: { id: string; nome: string; duracao_minutos: number };
}

type TipoAtendimento = 'consulta' | 'ultrassom';

export default function Agendamentos() {
  const queryClient = useQueryClient();
  const [tipoAtendimento, setTipoAtendimento] = useState<TipoAtendimento>('consulta');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState('');
  const [slotEndTime, setSlotEndTime] = useState('');
  const [availableMinutes, setAvailableMinutes] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [encaixeModalOpen, setEncaixeModalOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

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

  // Fetch schedule openings for selected doctor and date (for the grid)
  const { data: scheduleOpenings } = useQuery({
    queryKey: ['schedule_openings', selectedDoctorId, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!selectedDoctorId) return [];
      const { data, error } = await supabase
        .from('schedule_openings')
        .select('*')
        .eq('doctor_id', selectedDoctorId)
        .eq('data', format(selectedDate, 'yyyy-MM-dd'));
      if (error) throw error;
      return data as ScheduleOpening[];
    },
    enabled: !!selectedDoctorId,
  });

  // Fetch ALL future schedule openings for selected doctor (for ProximosHorariosLivres)
  const { data: doctorFutureOpenings } = useQuery({
    queryKey: ['doctor_future_openings', selectedDoctorId],
    queryFn: async () => {
      if (!selectedDoctorId) return [];
      const { data, error } = await supabase
        .from('schedule_openings')
        .select('id, data, hora_inicio, hora_fim, tipo_atendimento')
        .eq('doctor_id', selectedDoctorId)
        .gte('data', format(new Date(), 'yyyy-MM-dd'));
      if (error) throw error;
      return data as { id: string; data: string; hora_inicio: string; hora_fim: string; tipo_atendimento: string }[];
    },
    enabled: !!selectedDoctorId,
  });

  // Fetch ALL schedule openings to know which doctors have extra dates
  const { data: allScheduleOpenings } = useQuery({
    queryKey: ['all_schedule_openings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_openings')
        .select('doctor_id, tipo_atendimento')
        .gte('data', format(new Date(), 'yyyy-MM-dd'));
      if (error) throw error;
      return data as { doctor_id: string; tipo_atendimento: string }[];
    },
  });

  // Fetch schedule exceptions (days off)
  const { data: scheduleExceptions } = useQuery({
    queryKey: ['schedule_exceptions', selectedDoctorId, format(selectedDate, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!selectedDoctorId) return [];
      const { data, error } = await supabase
        .from('schedule_exceptions')
        .select('*')
        .eq('doctor_id', selectedDoctorId)
        .eq('data', format(selectedDate, 'yyyy-MM-dd'));
      if (error) throw error;
      return data;
    },
    enabled: !!selectedDoctorId,
  });

  // Check if selected date has an exception
  const hasException = scheduleExceptions && scheduleExceptions.length > 0;
  const exceptionReason = hasException ? scheduleExceptions[0].motivo : null;

  // Fetch exam types
  const { data: examTypes } = useQuery({
    queryKey: ['exam_types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_types')
        .select('id, nome, categoria, duracao_minutos, doctor_id')
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
        .select('id, hora_inicio, hora_fim, status, paciente_nome, paciente_telefone, is_encaixe, exam_types(id, nome, duracao_minutos)')
        .eq('doctor_id', selectedDoctorId)
        .eq('data', format(selectedDate, 'yyyy-MM-dd'));
      
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!selectedDoctorId,
  });

  // Realtime subscription para sincronização entre secretárias
  useRealtimeAppointments(selectedDoctorId, format(selectedDate, 'yyyy-MM-dd'));
  useRealtimeScheduleOpenings(selectedDoctorId || null, format(selectedDate, 'yyyy-MM-dd'));

  // Filter doctors based on type (includes doctors with rules OR schedule_openings)
  const filteredDoctors = useMemo(() => {
    if (!doctors || !doctorRules) return [];
    
    return doctors.filter((doctor) => {
      // Check if doctor has rules for this type
      const rules = doctorRules.filter((r) => r.doctor_id === doctor.id);
      const hasMatchingRules = rules.some(
        (rule) =>
          rule.tipo_atendimento === 'ambos' || rule.tipo_atendimento === tipoAtendimento
      );
      
      // Check if doctor has schedule_openings for this type (doctors without fixed days)
      const hasMatchingOpenings = allScheduleOpenings?.some(
        (opening) =>
          opening.doctor_id === doctor.id &&
          (opening.tipo_atendimento === 'ambos' || opening.tipo_atendimento === tipoAtendimento)
      );
      
      return hasMatchingRules || hasMatchingOpenings;
    });
  }, [doctors, doctorRules, allScheduleOpenings, tipoAtendimento]);

  // Selected doctor rules
  const selectedDoctorRules = useMemo(() => {
    if (!doctorRules || !selectedDoctorId) return [];
    return doctorRules.filter((r) => r.doctor_id === selectedDoctorId);
  }, [doctorRules, selectedDoctorId]);

  const selectedDoctor = doctors?.find((d) => d.id === selectedDoctorId);

  // Count appointments for the day (excluding cancelled)
  const appointmentCount = useMemo(() => {
    if (!appointments) return 0;
    return appointments.filter(apt => apt.status !== 'cancelado').length;
  }, [appointments]);

  // Handlers
  const handleTipoChange = (tipo: TipoAtendimento) => {
    setTipoAtendimento(tipo);
    setSelectedDoctorId('');
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
  const handleGoToToday = () => setSelectedDate(new Date());
  const handleEncaixe = () => setEncaixeModalOpen(true);

  const handleNewAppointment = () => {
    // Find first available slot
    const dayOfWeek = selectedDate.getDay();
    const rulesForDay = selectedDoctorRules.filter(
      (rule) =>
        rule.dia_semana === dayOfWeek &&
        (rule.tipo_atendimento === 'ambos' || rule.tipo_atendimento === tipoAtendimento)
    );

    if (rulesForDay.length > 0) {
      const earliestRule = rulesForDay.sort((a, b) => 
        a.hora_inicio.localeCompare(b.hora_inicio)
      )[0];
      
      setSelectedTime(earliestRule.hora_inicio);
      setSlotEndTime(earliestRule.hora_fim);
      
      // Calculate available minutes
      const [startH, startM] = earliestRule.hora_inicio.split(':').map(Number);
      const [endH, endM] = earliestRule.hora_fim.split(':').map(Number);
      setAvailableMinutes((endH * 60 + endM) - (startH * 60 + startM));
      
      setModalOpen(true);
    }
  };

  const handleProximoHorarioClick = (date: Date, time: string) => {
    setSelectedDate(date);
    // Find end time based on rules
    const dayOfWeek = date.getDay();
    const rulesForDay = selectedDoctorRules.filter(
      (rule) =>
        rule.dia_semana === dayOfWeek &&
        (rule.tipo_atendimento === 'ambos' || rule.tipo_atendimento === tipoAtendimento)
    );

    if (rulesForDay.length > 0) {
      const latestEnd = rulesForDay.reduce((max, rule) => 
        rule.hora_fim > max ? rule.hora_fim : max
      , '00:00');
      
      const [timeH, timeM] = time.split(':').map(Number);
      const [endH, endM] = latestEnd.split(':').map(Number);
      const available = (endH * 60 + endM) - (timeH * 60 + timeM);
      
      setSelectedTime(time);
      setSlotEndTime(latestEnd);
      setAvailableMinutes(available);
      setModalOpen(true);
    }
  };

  return (
    <AdminLayout title="Agenda Visual">
      <div className={cn("grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-6", compactMode && "print-agenda")}>
        {/* Left Column - Calendar and Filters */}
        <div className="space-y-4 calendar-sidebar no-print">
          {/* Mini Calendar */}
          <Card>
            <CardContent className="p-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={ptBR}
                className="w-full"
              />
            </CardContent>
          </Card>

          {/* Type and Doctor Selectors */}
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Toggle Tipo */}
              <div className="flex gap-2">
                <Button
                  variant={tipoAtendimento === 'consulta' ? 'default' : 'outline'}
                  onClick={() => handleTipoChange('consulta')}
                  className="flex-1"
                  size="sm"
                >
                  <Stethoscope className="h-4 w-4 mr-1" />
                  Consulta
                </Button>
                <Button
                  variant={tipoAtendimento === 'ultrassom' ? 'default' : 'outline'}
                  onClick={() => handleTipoChange('ultrassom')}
                  className="flex-1"
                  size="sm"
                >
                  <Activity className="h-4 w-4 mr-1" />
                  Ultrassom
                </Button>
              </div>

              {/* Doctor Selector */}
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
            </CardContent>
          </Card>
        </div>

        {/* Center Column - Schedule Grid */}
        <div className="space-y-4">
          {selectedDoctorId ? (
            <>
              <Card>
                <CardContent className="p-4">
                  <AgendaHeader
                    selectedDate={selectedDate}
                    onPrevDay={handlePrevDay}
                    onNextDay={handleNextDay}
                    onGoToToday={handleGoToToday}
                    onNewAppointment={handleNewAppointment}
                    onEncaixe={handleEncaixe}
                    doctorName={selectedDoctor?.nome}
                    tipoAtendimento={tipoAtendimento}
                    appointmentCount={appointmentCount}
                    compactMode={compactMode}
                    onCompactModeChange={setCompactMode}
                  />
                </CardContent>
              </Card>

              {hasException ? (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center text-amber-600">
                      <p className="text-lg font-medium">⚠️ Médico indisponível nesta data</p>
                      <p className="text-sm mt-1 text-muted-foreground">
                        {exceptionReason || 'Exceção de agenda cadastrada (folga, férias, curso, etc.)'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <AgendaTimeGrid
                  doctorRules={selectedDoctorRules}
                  scheduleOpenings={scheduleOpenings || []}
                  appointments={appointments || []}
                  selectedDate={selectedDate}
                  compactMode={compactMode}
                  tipoAtendimento={tipoAtendimento}
                  onSlotClick={handleSlotClick}
                  onAppointmentClick={handleAppointmentClick}
                  isLoading={isLoadingAppointments}
                />
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-16">
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

        {/* Right Column - Next Available Slots */}
        <div className="space-y-4">
          {selectedDoctorId && (
            <ProximosHorariosLivres
              doctorId={selectedDoctorId}
              doctorRules={selectedDoctorRules}
              scheduleOpenings={doctorFutureOpenings || []}
              tipoAtendimento={tipoAtendimento}
              currentDate={selectedDate}
              onSlotClick={handleProximoHorarioClick}
            />
          )}
        </div>
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

      {/* Modal de Encaixe */}
      {selectedDoctor && (
        <EncaixeModal
          isOpen={encaixeModalOpen}
          onClose={() => setEncaixeModalOpen(false)}
          selectedDate={selectedDate}
          doctor={selectedDoctor}
          tipoAtendimento={tipoAtendimento}
          examTypes={examTypes || []}
        />
      )}
    </AdminLayout>
  );
}
