import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
        .select('id, hora_inicio, hora_fim, status, paciente_nome, paciente_telefone, is_encaixe, exam_types(id, nome, duracao_minutos)')
        .eq('doctor_id', selectedDoctorId)
        .eq('data', format(selectedDate, 'yyyy-MM-dd'));
      
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!selectedDoctorId,
  });

  // Filter doctors based on type
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
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-6">
        {/* Left Column - Calendar and Filters */}
        <div className="space-y-4">
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
                  />
                </CardContent>
              </Card>

              <AgendaTimeGrid
                doctorRules={selectedDoctorRules}
                appointments={appointments || []}
                selectedDate={selectedDate}
                tipoAtendimento={tipoAtendimento}
                onSlotClick={handleSlotClick}
                onAppointmentClick={handleAppointmentClick}
                isLoading={isLoadingAppointments}
              />
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
