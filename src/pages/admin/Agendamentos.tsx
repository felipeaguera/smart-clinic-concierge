import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Doctor {
  id: string;
  nome: string;
}

interface ExamType {
  id: string;
  nome: string;
}

interface Appointment {
  id: string;
  doctor_id: string;
  exam_type_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  status: string;
  doctors: { nome: string };
  exam_types: { nome: string };
}

const STATUS_OPTIONS = [
  { value: 'reservado', label: 'Reservado', variant: 'secondary' as const },
  { value: 'confirmado', label: 'Confirmado', variant: 'default' as const },
  { value: 'cancelado', label: 'Cancelado', variant: 'destructive' as const },
];

export default function Agendamentos() {
  const [isOpen, setIsOpen] = useState(false);
  const [filterDoctor, setFilterDoctor] = useState<string>('');
  const [filterData, setFilterData] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  
  // Form state
  const [doctorId, setDoctorId] = useState('');
  const [examTypeId, setExamTypeId] = useState('');
  const [data, setData] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [status, setStatus] = useState('reservado');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const { data: examTypes } = useQuery({
    queryKey: ['exam_types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_types')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data as ExamType[];
    },
  });

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments', filterDoctor, filterData, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select('*, doctors(nome), exam_types(nome)')
        .order('data', { ascending: false })
        .order('hora_inicio');
      
      if (filterDoctor) {
        query = query.eq('doctor_id', filterDoctor);
      }
      if (filterData) {
        query = query.eq('data', filterData);
      }
      if (filterStatus) {
        query = query.eq('status', filterStatus);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Appointment[];
    },
  });

  const mutation = useMutation({
    mutationFn: async (input: {
      doctor_id: string;
      exam_type_id: string;
      data: string;
      hora_inicio: string;
      hora_fim: string;
      status: string;
    }) => {
      const { error } = await supabase.from('appointments').insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      toast({ title: 'Sucesso', description: 'Agendamento criado!' });
      handleClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const handleClose = () => {
    setIsOpen(false);
    setDoctorId('');
    setExamTypeId('');
    setData('');
    setHoraInicio('');
    setHoraFim('');
    setStatus('reservado');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId || !examTypeId || !data || !horaInicio || !horaFim) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    if (horaFim <= horaInicio) {
      toast({ title: 'Erro', description: 'Hora fim deve ser maior que hora início', variant: 'destructive' });
      return;
    }
    mutation.mutate({
      doctor_id: doctorId,
      exam_type_id: examTypeId,
      data,
      hora_inicio: horaInicio,
      hora_fim: horaFim,
      status,
    });
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (statusValue: string) => {
    const option = STATUS_OPTIONS.find((o) => o.value === statusValue);
    return (
      <Badge variant={option?.variant || 'secondary'}>
        {option?.label || statusValue}
      </Badge>
    );
  };

  const clearFilters = () => {
    setFilterDoctor('');
    setFilterData('');
    setFilterStatus('');
  };

  return (
    <AdminLayout title="Agendamentos">
      <div className="space-y-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Médico</Label>
                <Select value={filterDoctor} onValueChange={setFilterDoctor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
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
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={filterData}
                  onChange={(e) => setFilterData(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-medium">Lista de Agendamentos</CardTitle>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { handleClose(); setIsOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Agendamento (Manual)
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Novo Agendamento (Manual)</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Médico</Label>
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
                  <div className="space-y-2">
                    <Label>Tipo de Exame</Label>
                    <Select value={examTypeId} onValueChange={setExamTypeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o exame" />
                      </SelectTrigger>
                      <SelectContent>
                        {examTypes?.map((exam) => (
                          <SelectItem key={exam.id} value={exam.id}>
                            {exam.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={data}
                      onChange={(e) => setData(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hora Início</Label>
                      <Input
                        type="time"
                        value={horaInicio}
                        onChange={(e) => setHoraInicio(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora Fim</Label>
                      <Input
                        type="time"
                        value={horaFim}
                        onChange={(e) => setHoraFim(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={handleClose}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={mutation.isPending}>
                      {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Salvar
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Data</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Médico</TableHead>
                      <TableHead>Exame</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum agendamento encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      appointments?.map((appointment) => (
                        <TableRow key={appointment.id}>
                          <TableCell className="font-medium">{formatDate(appointment.data)}</TableCell>
                          <TableCell>{appointment.hora_inicio} - {appointment.hora_fim}</TableCell>
                          <TableCell>{appointment.doctors?.nome}</TableCell>
                          <TableCell>{appointment.exam_types?.nome}</TableCell>
                          <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
