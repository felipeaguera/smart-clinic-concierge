import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TimeSlot {
  hora_inicio: string
  hora_fim: string
}

interface DoctorAvailability {
  doctor_id: string
  doctor_nome: string
  doctor_especialidade: string
  horarios_disponiveis: TimeSlot[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const exam_type_id = url.searchParams.get('exam_type_id')
    const data = url.searchParams.get('data')

    console.log('Parâmetros recebidos:', { exam_type_id, data })

    if (!exam_type_id || !data) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios: exam_type_id, data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(data)) {
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

    if (examTypeError || !examType) {
      console.error('Erro ao buscar exam_type:', examTypeError)
      return new Response(
        JSON.stringify({ error: 'Tipo de exame não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Tipo de exame encontrado:', examType)

    if (examType.categoria === 'laboratorio') {
      return new Response(
        JSON.stringify({ error: 'Este exame não utiliza agendamento.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calcular dia da semana (0 = Domingo, 1 = Segunda, etc.)
    // IMPORTANTE: Usar parse manual para evitar problemas de timezone
    // A data vem no formato YYYY-MM-DD, extraímos diretamente os componentes
    const [year, month, day] = data.split('-').map(Number)
    // Criar data ao meio-dia para evitar problemas de DST
    const dateObj = new Date(year, month - 1, day, 12, 0, 0)
    const diaSemana = dateObj.getDay()
    console.log('Dia da semana:', diaSemana, `(data: ${data})`)

    // 2) Buscar TODOS os médicos ativos
    const { data: doctors, error: doctorsError } = await supabase
      .from('doctors')
      .select('id, nome, especialidade')
      .eq('ativo', true)

    if (doctorsError || !doctors || doctors.length === 0) {
      console.error('Erro ao buscar médicos:', doctorsError)
      return new Response(
        JSON.stringify({ error: 'Nenhum médico disponível' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Médicos ativos:', doctors)

    // 3) Para cada médico, buscar disponibilidade
    const resultado: DoctorAvailability[] = []
    const duracaoMinutos = examType.duracao_minutos
    // PROMPT 3 FIX: O step agora é igual à duração do exame para gerar grade fixa
    const stepMinutos = duracaoMinutos

    for (const doctor of doctors) {
      // Buscar regras do médico para esse dia
      const { data: rules, error: rulesError } = await supabase
        .from('doctor_rules')
        .select('*')
        .eq('doctor_id', doctor.id)
        .eq('dia_semana', diaSemana)

      if (rulesError) {
        console.error(`Erro ao buscar regras do médico ${doctor.nome}:`, rulesError)
        continue
      }

      // Filtrar regras por tipo_atendimento compatível
      const filteredRules = rules?.filter(rule => 
        rule.tipo_atendimento === 'ambos' || rule.tipo_atendimento === examType.categoria
      ) || []

      // Buscar schedule_openings (agendas extras) para esta data específica
      const { data: scheduleOpenings, error: openingsError } = await supabase
        .from('schedule_openings')
        .select('*')
        .eq('doctor_id', doctor.id)
        .eq('data', data)

      if (openingsError) {
        console.error(`Erro ao buscar schedule_openings do médico ${doctor.nome}:`, openingsError)
      }

      // Filtrar schedule_openings por tipo_atendimento compatível
      const filteredOpenings = scheduleOpenings?.filter(opening => 
        opening.tipo_atendimento === 'ambos' || opening.tipo_atendimento === examType.categoria
      ) || []

      // Se não tem regras E não tem agendas extras para este dia/tipo, pular
      if (filteredRules.length === 0 && filteredOpenings.length === 0) {
        console.log(`Médico ${doctor.nome} não atende ${examType.categoria} neste dia`)
        continue
      }

      // Verificar exceções
      const { data: exceptions } = await supabase
        .from('schedule_exceptions')
        .select('*')
        .eq('doctor_id', doctor.id)
        .eq('data', data)

      if (exceptions && exceptions.length > 0) {
        console.log(`Médico ${doctor.nome} tem exceção para esta data`)
        continue
      }

      // Gerar slots das regras recorrentes
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

      // Gerar slots das agendas extras (schedule_openings)
      for (const opening of filteredOpenings) {
        const slots = generateTimeSlots(
          opening.hora_inicio,
          opening.hora_fim,
          duracaoMinutos,
          stepMinutos
        )
        allSlots.push(...slots)
      }

      // Buscar appointments existentes
      const { data: appointments } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', doctor.id)
        .eq('data', data)
        .neq('status', 'cancelado')

      // Filtrar slots disponíveis
      const availableSlots = allSlots.filter(slot => {
        return !hasConflict(slot, appointments || [])
      })

      // Filtrar horários passados se a data for hoje (timezone Brasil)
      const now = new Date()
      const brasilOffset = -3 * 60 // minutos
      const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()
      const brasilMinutes = utcMinutes + brasilOffset + (24 * 60)
      const currentMinutesBrasil = brasilMinutes % (24 * 60)
      
      const brasilDate = new Date(now.getTime() + brasilOffset * 60 * 1000)
      const todayBrasil = brasilDate.toISOString().split('T')[0]
      
      const filteredByTime = (data === todayBrasil) 
        ? availableSlots.filter(slot => timeToMinutes(slot.hora_inicio) > currentMinutesBrasil)
        : availableSlots

      const uniqueSlots = removeDuplicateSlots(filteredByTime)
      uniqueSlots.sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))

      if (uniqueSlots.length > 0) {
        resultado.push({
          doctor_id: doctor.id,
          doctor_nome: doctor.nome,
          doctor_especialidade: doctor.especialidade,
          horarios_disponiveis: uniqueSlots
        })
      }
    }

    console.log('Resultado final:', resultado)

    return new Response(
      JSON.stringify({ 
        disponibilidades: resultado,
        exam_type: {
          id: examType.id,
          nome: examType.nome,
          categoria: examType.categoria,
          duracao_minutos: examType.duracao_minutos
        },
        data
      }),
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
  
  // Permite que o último slot COMECE até o horário limite (hora_fim)
  while (currentMinutes <= endMinutes) {
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

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number)
  return hours * 60 + mins
}

function hasConflict(slot: TimeSlot, appointments: any[]): boolean {
  const slotStart = timeToMinutes(slot.hora_inicio)
  const slotEnd = timeToMinutes(slot.hora_fim)
  
  for (const apt of appointments) {
    const aptStart = timeToMinutes(apt.hora_inicio)
    const aptEnd = timeToMinutes(apt.hora_fim)
    
    if (!(slotEnd <= aptStart || slotStart >= aptEnd)) {
      return true
    }
  }
  
  return false
}

function removeDuplicateSlots(slots: TimeSlot[]): TimeSlot[] {
  const seen = new Set<string>()
  return slots.filter(slot => {
    const key = `${slot.hora_inicio}-${slot.hora_fim}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
