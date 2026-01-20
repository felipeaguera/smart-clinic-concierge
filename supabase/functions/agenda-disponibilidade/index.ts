import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TimeSlot {
  hora_inicio: string
  hora_fim: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const doctor_id = url.searchParams.get('doctor_id')
    const exam_type_id = url.searchParams.get('exam_type_id')
    const data = url.searchParams.get('data')

    console.log('Parâmetros recebidos:', { doctor_id, exam_type_id, data })

    // Validar parâmetros obrigatórios
    if (!doctor_id || !exam_type_id || !data) {
      console.error('Parâmetros faltando:', { doctor_id, exam_type_id, data })
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: doctor_id, exam_type_id, data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validar formato da data
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(data)) {
      console.error('Formato de data inválido:', data)
      return new Response(
        JSON.stringify({ error: 'Formato de data inválido. Use YYYY-MM-DD' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1) Buscar exam_type
    const { data: examType, error: examTypeError } = await supabase
      .from('exam_types')
      .select('*')
      .eq('id', exam_type_id)
      .maybeSingle()

    if (examTypeError) {
      console.error('Erro ao buscar exam_type:', examTypeError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar tipo de exame' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!examType) {
      console.error('Tipo de exame não encontrado:', exam_type_id)
      return new Response(
        JSON.stringify({ error: 'Tipo de exame não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Tipo de exame encontrado:', examType)

    // Se categoria = 'laboratorio' → retornar erro
    if (examType.categoria === 'laboratorio') {
      console.log('Exame de laboratório não utiliza agendamento')
      return new Response(
        JSON.stringify({ error: 'Este exame não utiliza agendamento.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // VALIDAÇÃO: Se for consulta, verificar vínculo médico-serviço
    if (examType.categoria === 'consulta') {
      if (!examType.doctor_id) {
        console.error('Consulta sem médico vinculado:', exam_type_id)
        return new Response(
          JSON.stringify({ error: 'Esta consulta não está vinculada a nenhum médico' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (examType.doctor_id !== doctor_id) {
        console.error('Consulta não pertence ao médico:', { exam_doctor_id: examType.doctor_id, requested_doctor_id: doctor_id })
        return new Response(
          JSON.stringify({ error: 'Esta consulta não pertence ao médico selecionado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Verificar se o médico existe e está ativo
    const { data: doctor, error: doctorError } = await supabase
      .from('doctors')
      .select('*')
      .eq('id', doctor_id)
      .eq('ativo', true)
      .maybeSingle()

    if (doctorError) {
      console.error('Erro ao buscar médico:', doctorError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar médico' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!doctor) {
      console.error('Médico não encontrado ou inativo:', doctor_id)
      return new Response(
        JSON.stringify({ error: 'Médico não encontrado ou inativo' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Médico encontrado:', doctor)

    // Calcular dia da semana (0 = Domingo, 1 = Segunda, etc.)
    // IMPORTANTE: Usar parse manual para evitar problemas de timezone
    // A data vem no formato YYYY-MM-DD, extraímos diretamente os componentes
    const [year, month, day] = data.split('-').map(Number)
    // Criar data ao meio-dia para evitar problemas de DST
    const dateObj = new Date(year, month - 1, day, 12, 0, 0)
    const diaSemana = dateObj.getDay()
    console.log('Dia da semana:', diaSemana, `(data: ${data}, year: ${year}, month: ${month}, day: ${day})`)

    // 2) Buscar regras do médico para esse dia
    const { data: rules, error: rulesError } = await supabase
      .from('doctor_rules')
      .select('*')
      .eq('doctor_id', doctor_id)
      .eq('dia_semana', diaSemana)

    if (rulesError) {
      console.error('Erro ao buscar regras:', rulesError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar regras de atendimento' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Regras encontradas:', rules)

    // Filtrar regras por tipo_atendimento compatível
    const filteredRules = rules?.filter(rule => 
      rule.tipo_atendimento === 'ambos' || rule.tipo_atendimento === examType.categoria
    ) || []

    console.log('Regras filtradas por tipo_atendimento:', filteredRules)

    if (filteredRules.length === 0) {
      console.log('Nenhuma regra de atendimento encontrada para este dia/tipo')
      return new Response(
        JSON.stringify({ 
          horarios_disponiveis: [],
          mensagem: 'Médico não atende neste dia ou para este tipo de exame'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3) Buscar exceções para este médico nesta data
    const { data: exceptions, error: exceptionsError } = await supabase
      .from('schedule_exceptions')
      .select('*')
      .eq('doctor_id', doctor_id)
      .eq('data', data)

    if (exceptionsError) {
      console.error('Erro ao buscar exceções:', exceptionsError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar exceções de agenda' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Exceções encontradas:', exceptions)

    // Se existir exceção, retornar lista vazia
    if (exceptions && exceptions.length > 0) {
      console.log('Existe exceção para esta data')
      return new Response(
        JSON.stringify({ 
          horarios_disponiveis: [],
          mensagem: 'Médico indisponível nesta data'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4) Gerar blocos de horário possíveis
    // PROMPT 3 FIX: O step agora é igual à duração do exame para gerar grade fixa
    // Ex: agenda 14:00, duração 20min → 14:00, 14:20, 14:40, 15:00...
    const duracaoMinutos = examType.duracao_minutos
    const stepMinutos = duracaoMinutos // Grade fixa baseada na duração

    const allSlots: TimeSlot[] = []

    for (const rule of filteredRules) {
      const slots = generateTimeSlots(
        rule.hora_inicio,
        rule.hora_fim,
        duracaoMinutos,
        stepMinutos
      )
      allSlots.push(...slots)
    }

    console.log('Slots gerados:', allSlots)

    // 5) Buscar appointments existentes (não cancelados)
    const { data: appointments, error: appointmentsError } = await supabase
      .from('appointments')
      .select('*')
      .eq('doctor_id', doctor_id)
      .eq('data', data)
      .neq('status', 'cancelado')

    if (appointmentsError) {
      console.error('Erro ao buscar appointments:', appointmentsError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar agendamentos existentes' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Appointments existentes:', appointments)

    // 6) Remover slots que conflitam com appointments existentes
    const availableSlots = allSlots.filter(slot => {
      return !hasConflict(slot, appointments || [])
    })

    // Remover duplicatas e ordenar
    const uniqueSlots = removeDuplicateSlots(availableSlots)
    uniqueSlots.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))

    console.log('Slots disponíveis:', uniqueSlots)

    return new Response(
      JSON.stringify({ horarios_disponiveis: uniqueSlots }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro inesperado:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Gera slots de horário baseado no intervalo da regra e duração do exame
function generateTimeSlots(
  horaInicio: string,
  horaFim: string,
  duracaoMinutos: number,
  stepMinutos: number
): TimeSlot[] {
  const slots: TimeSlot[] = []
  
  const [startHour, startMin] = horaInicio.split(':').map(Number)
  const [endHour, endMin] = horaFim.split(':').map(Number)
  
  let currentMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  
  while (currentMinutes + duracaoMinutos <= endMinutes) {
    const slotStart = minutesToTime(currentMinutes)
    const slotEnd = minutesToTime(currentMinutes + duracaoMinutos)
    
    slots.push({
      hora_inicio: slotStart,
      hora_fim: slotEnd
    })
    
    currentMinutes += stepMinutos
  }
  
  return slots
}

// Converte minutos do dia para formato HH:MM
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

// Converte formato HH:MM para minutos do dia
function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number)
  return hours * 60 + mins
}

// Verifica se há conflito entre um slot e os appointments existentes
function hasConflict(slot: TimeSlot, appointments: any[]): boolean {
  const slotStart = timeToMinutes(slot.hora_inicio)
  const slotEnd = timeToMinutes(slot.hora_fim)
  
  for (const apt of appointments) {
    const aptStart = timeToMinutes(apt.hora_inicio)
    const aptEnd = timeToMinutes(apt.hora_fim)
    
    // Verifica sobreposição: não há conflito apenas se um termina antes do outro começar
    if (!(slotEnd <= aptStart || slotStart >= aptEnd)) {
      return true
    }
  }
  
  return false
}

// Remove slots duplicados
function removeDuplicateSlots(slots: TimeSlot[]): TimeSlot[] {
  const seen = new Set<string>()
  return slots.filter(slot => {
    const key = `${slot.hora_inicio}-${slot.hora_fim}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
