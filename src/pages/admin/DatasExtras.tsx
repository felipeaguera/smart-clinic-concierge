import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Trash2, CalendarPlus, Loader2 } from 'lucide-react';

interface Doctor {
  id: string;
  nome: string;
}

interface ScheduleOpening {
  id: string;
  doctor_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo_atendimento: string;
  motivo: string | null;
  doctors?: { nome: string };
}

const TIPO_OPTIONS = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'ultrassom', label: 'Ultrassom' },
  { value: 'ambos', label: 'Ambos' },
];

// Converte minutos para time string
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Gera opções de horário das 06:00 às 22:00 em intervalos de 30 min
function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let m = 6 * 60; m <= 22 * 60; m += 30) {
    options.push(minutesToTime(m));
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

export default function DatasExtras() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);
  
  // Form state
  const [doctorId, setDoctorId] = useState('');
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFim, setHoraFim] = useState('12:00');
  const [tipoAtendimento, setTipoAtendimento] = useState('ambos');
  const [motivo, setMotivo] = useState('');

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

  // Fetch schedule openings
  const { data: openings, isLoading } = useQuery({
    queryKey: ['schedule_openings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_openings')
        .select('*, doctors(nome)')
        .order('data', { ascending: true });
      if (error) throw error;
      return data as ScheduleOpening[];
    },
  });

  // Filter openings for selected date
  const openingsForDate = useMemo(() => {
    if (!openings) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return openings.filter(o => o.data === dateStr);
  }, [openings, selectedDate]);

  // Get dates that have openings for calendar highlighting
  const datesWithOpenings = useMemo(() => {
    if (!openings) return [];
    return openings.map(o => new Date(o.data + 'T00:00:00'));
  }, [openings]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Check for duplicate - same doctor, same date, overlapping times
      const { data: existing, error: checkError } = await supabase
        .from('schedule_openings')
        .select('id, hora_inicio, hora_fim')
        .eq('doctor_id', doctorId)
        .eq('data', dateStr);
      
      if (checkError) throw checkError;
      
      // Check for overlapping time ranges
      const newStart = horaInicio;
      const newEnd = horaFim;
      
      const hasOverlap = existing?.some(opening => {
        const existStart = opening.hora_inicio.slice(0, 5);
        const existEnd = opening.hora_fim.slice(0, 5);
        // Overlap: NOT (new ends before existing starts OR new starts after existing ends)
        return !(newEnd <= existStart || newStart >= existEnd);
      });
      
      if (hasOverlap) {
        throw new Error('Já existe uma agenda extra para este médico neste horário. Exclua a existente primeiro ou escolha outro horário.');
      }
      
      const { data, error } = await supabase.from('schedule_openings').insert({
        doctor_id: doctorId,
        data: dateStr,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        tipo_atendimento: tipoAtendimento,
        motivo: motivo.trim() || null,
      }).select();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule_openings'] });
      toast({ title: 'Sucesso', description: 'Data extra criada com sucesso!' });
      setModalOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar agenda extra',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete mutation - check for existing appointments first
  const deleteMutation = useMutation({
    mutationFn: async (opening: ScheduleOpening) => {
      // Check if there are any appointments for this doctor on this date
      const { data: appointments, error: checkError } = await supabase
        .from('appointments')
        .select('id, paciente_nome')
        .eq('doctor_id', opening.doctor_id)
        .eq('data', opening.data)
        .neq('status', 'cancelado');
      
      if (checkError) throw checkError;
      
      if (appointments && appointments.length > 0) {
        const patientNames = appointments
          .map(a => a.paciente_nome || 'Paciente sem nome')
          .slice(0, 3)
          .join(', ');
        const moreText = appointments.length > 3 ? ` e mais ${appointments.length - 3}` : '';
        throw new Error(`Não é possível excluir esta agenda porque existem ${appointments.length} paciente(s) marcado(s) para este dia: ${patientNames}${moreText}`);
      }
      
      const { error } = await supabase.from('schedule_openings').delete().eq('id', opening.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule_openings'] });
      toast({ title: 'Sucesso', description: 'Data extra removida!' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Não foi possível excluir',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setDoctorId('');
    setHoraInicio('08:00');
    setHoraFim('12:00');
    setTipoAtendimento('ambos');
    setMotivo('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!doctorId) {
      toast({ title: 'Erro', description: 'Selecione um médico', variant: 'destructive' });
      return;
    }

    if (horaInicio >= horaFim) {
      toast({ title: 'Erro', description: 'O horário de início deve ser antes do fim', variant: 'destructive' });
      return;
    }

    createMutation.mutate();
  };

  const handleOpenModal = () => {
    resetForm();
    setModalOpen(true);
  };

  return (
    <AdminLayout title="Datas Extras">
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Left Column - Calendar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarPlus className="h-4 w-4" />
                Selecione a Data
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                locale={ptBR}
                className="w-full"
                modifiers={{
                  hasOpening: datesWithOpenings,
                }}
                modifiersStyles={{
                  hasOpening: {
                    backgroundColor: 'hsl(var(--primary) / 0.1)',
                    fontWeight: 'bold',
                  },
                }}
              />
            </CardContent>
          </Card>

          <Button onClick={handleOpenModal} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Abrir Agenda Extra
          </Button>
        </div>

        {/* Right Column - Openings List */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Agendas Extras em {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {openingsForDate.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Médico</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openingsForDate.map((opening) => (
                      <TableRow key={opening.id}>
                        <TableCell className="font-medium">
                          {opening.doctors?.nome || '-'}
                        </TableCell>
                        <TableCell>
                          {opening.hora_inicio.slice(0, 5)} - {opening.hora_fim.slice(0, 5)}
                        </TableCell>
                        <TableCell className="capitalize">
                          {opening.tipo_atendimento}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {opening.motivo || '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(opening)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarPlus className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhuma agenda extra para esta data.</p>
                  <p className="text-sm mt-1">Clique em "Abrir Agenda Extra" para adicionar.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* All upcoming openings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Próximas Agendas Extras</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : openings && openings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Médico</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openings
                      .filter(o => new Date(o.data) >= new Date(new Date().toDateString()))
                      .slice(0, 10)
                      .map((opening) => (
                        <TableRow 
                          key={opening.id}
                          className={isSameDay(new Date(opening.data), selectedDate) ? 'bg-primary/5' : ''}
                        >
                          <TableCell>
                            {format(new Date(opening.data + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="font-medium">
                            {opening.doctors?.nome || '-'}
                          </TableCell>
                          <TableCell>
                            {opening.hora_inicio.slice(0, 5)} - {opening.hora_fim.slice(0, 5)}
                          </TableCell>
                          <TableCell className="capitalize">
                            {opening.tipo_atendimento}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(opening)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-4 text-muted-foreground">
                  Nenhuma agenda extra cadastrada.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal para criar nova data extra */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarPlus className="h-5 w-5" />
              Abrir Agenda Extra
            </DialogTitle>
            <DialogDescription>
              Adicione um horário de atendimento para um médico em uma data específica.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Data selecionada */}
            <div className="p-3 bg-muted rounded-lg text-center">
              <span className="text-sm text-muted-foreground">Data selecionada:</span>
              <p className="font-medium">
                {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>

            {/* Médico */}
            <div className="space-y-2">
              <Label>Médico *</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o médico" />
                </SelectTrigger>
                <SelectContent>
                  {doctors?.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Horários */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início *</Label>
                <Select value={horaInicio} onValueChange={setHoraInicio}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fim *</Label>
                <Select value={horaFim} onValueChange={setHoraFim}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tipo de Atendimento */}
            <div className="space-y-2">
              <Label>Tipo de Atendimento</Label>
              <Select value={tipoAtendimento} onValueChange={setTipoAtendimento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPO_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Motivo */}
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Plantão extra, cobertura, etc."
                maxLength={100}
              />
            </div>

            {/* Ações */}
            <div className="flex gap-2 justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
