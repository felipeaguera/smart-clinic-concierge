import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Search, Calendar, Clock, User, CheckCircle, Loader2 } from 'lucide-react';

interface Doctor {
  id: string;
  nome: string;
}

interface ExamType {
  id: string;
  nome: string;
  categoria: string;
  duracao_minutos: number;
  doctor_id: string | null;
}

interface DoctorRule {
  id: string;
  doctor_id: string;
  hora_inicio: string;
  hora_fim: string;
  dia_semana: number;
  tipo_atendimento: string;
}

interface BuscarProximaVagaCardProps {
  doctors: Doctor[];
  examTypes: ExamType[];
  doctorRules: DoctorRule[];
  onNavigateToSlot: (doctorId: string, date: Date, time: string) => void;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

interface FoundSlot {
  date: Date;
  time: string;
  endTime: string;
  doctor: Doctor;
}

export function BuscarProximaVagaCard({
  doctors,
  examTypes,
  doctorRules,
  onNavigateToSlot,
}: BuscarProximaVagaCardProps) {
  const [tipoAtendimento, setTipoAtendimento] = useState<'consulta' | 'ultrassom'>('ultrassom');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('todos');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundSlot, setFoundSlot] = useState<FoundSlot | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);

  // Filtra médicos pelo tipo de atendimento
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doctor) =>
      doctorRules.some(
        (rule) =>
          rule.doctor_id === doctor.id &&
          (rule.tipo_atendimento === 'ambos' || rule.tipo_atendimento === tipoAtendimento)
      )
    );
  }, [doctors, doctorRules, tipoAtendimento]);

  // Filtra exames pelo tipo de atendimento e médico selecionado (para consultas)
  const filteredExamTypes = useMemo(() => {
    const categoria = tipoAtendimento === 'consulta' ? 'consulta' : 'ultrassom';
    return examTypes.filter((exam) => {
      const categoryMatch = exam.categoria === categoria;
      
      // Para consultas, filtra pelo médico se um foi selecionado
      if (tipoAtendimento === 'consulta' && selectedDoctorId !== 'todos') {
        return categoryMatch && exam.doctor_id === selectedDoctorId;
      }
      
      return categoryMatch;
    });
  }, [examTypes, tipoAtendimento, selectedDoctorId]);

  const selectedExam = filteredExamTypes.find((e) => e.id === selectedExamId);

  const handleSearch = async () => {
    if (!selectedExamId || !selectedExam) return;

    setIsSearching(true);
    setFoundSlot(null);
    setSearchPerformed(true);

    const examDuration = selectedExam.duracao_minutos;
    const doctorsToSearch = selectedDoctorId === 'todos' 
      ? filteredDoctors 
      : filteredDoctors.filter(d => d.id === selectedDoctorId);

    try {
      // Busca nos próximos 30 dias
      for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
        const searchDate = addDays(new Date(), dayOffset);
        const dayOfWeek = searchDate.getDay();
        const dateStr = format(searchDate, 'yyyy-MM-dd');

        for (const doctor of doctorsToSearch) {
          // Verifica regras do médico para este dia
          const rulesForDay = doctorRules.filter(
            (rule) =>
              rule.doctor_id === doctor.id &&
              rule.dia_semana === dayOfWeek &&
              (rule.tipo_atendimento === 'ambos' || rule.tipo_atendimento === tipoAtendimento)
          );

          if (rulesForDay.length === 0) continue;

          // Busca agendamentos existentes
          const { data: appointments } = await supabase
            .from('appointments')
            .select('hora_inicio, hora_fim')
            .eq('doctor_id', doctor.id)
            .eq('data', dateStr)
            .neq('status', 'cancelado');

          // Busca exceções
          const { data: exceptions } = await supabase
            .from('schedule_exceptions')
            .select('id')
            .eq('doctor_id', doctor.id)
            .eq('data', dateStr);

          if (exceptions && exceptions.length > 0) continue;

          // Encontra range do dia
          let dayStart = Infinity;
          let dayEnd = 0;
          for (const rule of rulesForDay) {
            const start = timeToMinutes(rule.hora_inicio);
            const end = timeToMinutes(rule.hora_fim);
            if (start < dayStart) dayStart = start;
            if (end > dayEnd) dayEnd = end;
          }

          // Ordena agendamentos
          const sortedApts = (appointments || []).sort(
            (a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio)
          );

          // Calcula horário mínimo (agora + 30 min se for hoje)
          let minMinutes = dayStart;
          if (dayOffset === 0) {
            const now = new Date();
            const nowMinutes = now.getHours() * 60 + now.getMinutes() + 30;
            minMinutes = Math.max(dayStart, nowMinutes);
          }

          let cursor = minMinutes;

          // Procura slot livre
          for (const apt of sortedApts) {
            const aptStart = timeToMinutes(apt.hora_inicio);
            const aptEnd = timeToMinutes(apt.hora_fim);

            if (cursor + examDuration <= aptStart) {
              // Encontrou slot!
              setFoundSlot({
                date: searchDate,
                time: minutesToTime(cursor),
                endTime: minutesToTime(cursor + examDuration),
                doctor,
              });
              setIsSearching(false);
              return;
            }

            cursor = Math.max(cursor, aptEnd);
          }

          // Verifica final do dia
          if (cursor + examDuration <= dayEnd) {
            setFoundSlot({
              date: searchDate,
              time: minutesToTime(cursor),
              endTime: minutesToTime(cursor + examDuration),
              doctor,
            });
            setIsSearching(false);
            return;
          }
        }
      }

      // Não encontrou em 30 dias
      setFoundSlot(null);
    } catch (error) {
      console.error('Erro na busca:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleNavigate = () => {
    if (foundSlot) {
      onNavigateToSlot(foundSlot.doctor.id, foundSlot.date, foundSlot.time);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="h-5 w-5" />
          Buscar Próxima Vaga
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tipo de atendimento */}
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select
            value={tipoAtendimento}
            onValueChange={(value: 'consulta' | 'ultrassom') => {
              setTipoAtendimento(value);
              setSelectedDoctorId('todos');
              setSelectedExamId('');
              setFoundSlot(null);
              setSearchPerformed(false);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="consulta">Consulta</SelectItem>
              <SelectItem value="ultrassom">Ultrassom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Médico */}
        <div className="space-y-2">
          <Label>Médico</Label>
          <Select
            value={selectedDoctorId}
            onValueChange={(value) => {
              setSelectedDoctorId(value);
              setFoundSlot(null);
              setSearchPerformed(false);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Qualquer médico</SelectItem>
              {filteredDoctors.map((doctor) => (
                <SelectItem key={doctor.id} value={doctor.id}>
                  {doctor.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Exame */}
        <div className="space-y-2">
          <Label>Exame</Label>
          <Select
            value={selectedExamId}
            onValueChange={(value) => {
              setSelectedExamId(value);
              setFoundSlot(null);
              setSearchPerformed(false);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o exame" />
            </SelectTrigger>
            <SelectContent>
              {filteredExamTypes.map((exam) => (
                <SelectItem key={exam.id} value={exam.id}>
                  {exam.nome} ({exam.duracao_minutos} min)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Botão de busca */}
        <Button
          className="w-full"
          onClick={handleSearch}
          disabled={!selectedExamId || isSearching}
        >
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Buscar Próxima Vaga
            </>
          )}
        </Button>

        {/* Resultado */}
        {searchPerformed && !isSearching && (
          <>
            {foundSlot ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Próxima vaga encontrada!</span>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(foundSlot.date, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {foundSlot.time} - {foundSlot.endTime}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{foundSlot.doctor.nome}</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleNavigate}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Ir para Agenda
                </Button>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center text-amber-800">
                <p className="font-medium">Nenhuma vaga encontrada</p>
                <p className="text-sm mt-1">
                  Não há horários disponíveis nos próximos 30 dias.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
