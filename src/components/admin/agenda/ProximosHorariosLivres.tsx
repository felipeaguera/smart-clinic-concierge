import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Loader2 } from 'lucide-react';

interface DoctorRule {
  id: string;
  hora_inicio: string;
  hora_fim: string;
  dia_semana: number;
  tipo_atendimento: string;
}

interface ScheduleOpening {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo_atendimento: string;
}

interface DayGroup {
  date: Date;
  slots: string[];
}

interface ProximosHorariosLivresProps {
  doctorId: string;
  doctorRules: DoctorRule[];
  scheduleOpenings?: ScheduleOpening[];
  tipoAtendimento: 'consulta' | 'ultrassom';
  currentDate: Date;
  onSlotClick: (date: Date, time: string) => void;
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

export function ProximosHorariosLivres({
  doctorId,
  doctorRules,
  scheduleOpenings = [],
  tipoAtendimento,
  currentDate,
  onSlotClick,
}: ProximosHorariosLivresProps) {
  const [loading, setLoading] = useState(false);
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);

  useEffect(() => {
    async function fetchFreeSlots() {
      if (!doctorId) return;
      
      setLoading(true);
      const groups: DayGroup[] = [];
      
      try {
        // Search next 7 days
        for (let i = 0; i < 7 && groups.length < 3; i++) {
          const searchDate = addDays(currentDate, i);
          const dayOfWeek = searchDate.getDay();
          const dateStr = format(searchDate, 'yyyy-MM-dd');

          // Check rules for this day (recurring rules)
          const rulesForDay = doctorRules.filter(
            (rule) =>
              rule.dia_semana === dayOfWeek &&
              (rule.tipo_atendimento === 'ambos' || rule.tipo_atendimento === tipoAtendimento)
          );

          // Check schedule_openings (agendas extras) for this specific date
          const openingsForDay = scheduleOpenings.filter(
            (opening) =>
              opening.data === dateStr &&
              (opening.tipo_atendimento === 'ambos' || opening.tipo_atendimento === tipoAtendimento)
          );

          // If no rules AND no openings for this day, skip
          if (rulesForDay.length === 0 && openingsForDay.length === 0) continue;

          // Check exceptions
          const { data: exceptions } = await supabase
            .from('schedule_exceptions')
            .select('id')
            .eq('doctor_id', doctorId)
            .eq('data', dateStr);

          if (exceptions && exceptions.length > 0) continue;

          // Get appointments
          const { data: appointments } = await supabase
            .from('appointments')
            .select('hora_inicio, hora_fim')
            .eq('doctor_id', doctorId)
            .eq('data', dateStr)
            .neq('status', 'cancelado');

          // Combine rules + openings to find day range
          let dayStart = Infinity;
          let dayEnd = 0;
          
          // From recurring rules
          for (const rule of rulesForDay) {
            const start = timeToMinutes(rule.hora_inicio);
            const end = timeToMinutes(rule.hora_fim);
            if (start < dayStart) dayStart = start;
            if (end > dayEnd) dayEnd = end;
          }
          
          // From schedule openings (agendas extras)
          for (const opening of openingsForDay) {
            const start = timeToMinutes(opening.hora_inicio);
            const end = timeToMinutes(opening.hora_fim);
            if (start < dayStart) dayStart = start;
            if (end > dayEnd) dayEnd = end;
          }

          // Calculate minimum time (now + 30 min if today)
          let minMinutes = dayStart;
          if (i === 0) {
            const now = new Date();
            const nowMinutes = now.getHours() * 60 + now.getMinutes() + 30;
            minMinutes = Math.max(dayStart, nowMinutes);
            minMinutes = Math.ceil(minMinutes / 10) * 10; // Round up to 10 min
          }

          // Sort appointments
          const sortedApts = (appointments || []).sort(
            (a, b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio)
          );

          // Find free slots
          const freeSlots: string[] = [];
          
          // Permite que o último slot COMECE até o horário limite (hora_fim)
          for (let min = minMinutes; min <= dayEnd && freeSlots.length < 8; min += 10) {
            // Check if this time is occupied
            const isOccupied = sortedApts.some(apt => {
              const aptStart = timeToMinutes(apt.hora_inicio);
              const aptEnd = timeToMinutes(apt.hora_fim);
              return min >= aptStart && min < aptEnd;
            });

            // Check if within work hours (from rules)
            const isWithinRules = rulesForDay.some(rule => {
              const ruleStart = timeToMinutes(rule.hora_inicio);
              const ruleEnd = timeToMinutes(rule.hora_fim);
              return min >= ruleStart && min <= ruleEnd;
            });

            // Check if within schedule openings (agendas extras)
            const isWithinOpenings = openingsForDay.some(opening => {
              const openingStart = timeToMinutes(opening.hora_inicio);
              const openingEnd = timeToMinutes(opening.hora_fim);
              return min >= openingStart && min <= openingEnd;
            });

            // Slot is available if within rules OR openings, and not occupied
            if (!isOccupied && (isWithinRules || isWithinOpenings)) {
              freeSlots.push(minutesToTime(min));
            }
          }

          if (freeSlots.length > 0) {
            groups.push({ date: searchDate, slots: freeSlots });
          }
        }
      } catch (error) {
        console.error('Error fetching free slots:', error);
      } finally {
        setLoading(false);
        setDayGroups(groups);
      }
    }

    fetchFreeSlots();
  }, [doctorId, doctorRules, scheduleOpenings, tipoAtendimento, currentDate]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Próximos Horários Livres
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : dayGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum horário disponível nos próximos dias.
          </p>
        ) : (
          dayGroups.map((group) => (
            <div key={format(group.date, 'yyyy-MM-dd')} className="space-y-2">
              <div className="text-sm">
                <span className="font-medium capitalize">
                  {format(group.date, 'EEEE', { locale: ptBR })}
                </span>
                <br />
                <span className="text-muted-foreground">
                  {format(group.date, "dd/MM/yyyy")}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.slots.map((time) => (
                  <Badge
                    key={time}
                    variant="outline"
                    className="cursor-pointer hover:bg-emerald-100 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
                    onClick={() => onSlotClick(group.date, time)}
                  >
                    {time}
                  </Badge>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
