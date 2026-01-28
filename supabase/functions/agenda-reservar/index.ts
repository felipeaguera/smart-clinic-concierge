import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Schema de validação com Zod
const reservaSchema = z.object({
  doctor_id: z.string().uuid({ message: 'ID do médico inválido' }),
  exam_type_id: z.string().uuid({ message: 'ID do exame inválido' }),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data deve estar no formato YYYY-MM-DD' }),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, { message: 'Hora de início deve estar no formato HH:MM' }),
  hora_fim: z.string().regex(/^\d{2}:\d{2}$/, { message: 'Hora de fim deve estar no formato HH:MM' }),
  paciente_nome: z.string().trim().min(2, { message: 'Nome deve ter pelo menos 2 caracteres' }).max(100, { message: 'Nome deve ter no máximo 100 caracteres' }).optional(),
  paciente_telefone: z.string().trim().max(20, { message: 'Telefone deve ter no máximo 20 caracteres' }).optional()
})

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Apenas POST é permitido
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido. Use POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const body = await req.json()

    // Validação com Zod
    const parseResult = reservaSchema.safeParse(body)
    if (!parseResult.success) {
      console.error('Validação falhou:', parseResult.error.issues)
      return new Response(
        JSON.stringify({ 
          error: 'Dados inválidos', 
          details: parseResult.error.issues.map(i => i.message) 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { doctor_id, exam_type_id, data, hora_inicio, hora_fim, paciente_nome, paciente_telefone } = parseResult.data

    // ============================================================
    // VALIDAÇÃO CRÍTICA: Rejeitar nomes que são claramente placeholders
    // ============================================================
    const invalidPatientNames = [
      '[nome_completo_do_paciente]',
      '[nome do paciente]',
      '[nome_paciente]',
      '[nome completo]',
      '[nome]',
      'nome_completo_do_paciente',
      'nome do paciente',
      'nome_paciente',
      'nome completo',
      'paciente',
      'teste',
      'test',
      'xxx',
      'aaa',
      'placeholder',
    ]

    if (paciente_nome) {
      const normalizedName = paciente_nome.toLowerCase().trim()
      const isPlaceholder = invalidPatientNames.some(
        placeholder => normalizedName === placeholder || normalizedName.includes('[') || normalizedName.includes(']')
      )
      
      if (isPlaceholder) {
        console.error('Nome do paciente parece ser um placeholder:', paciente_nome)
        return new Response(
          JSON.stringify({ 
            error: 'Nome do paciente inválido. Por favor, informe o nome completo real do paciente.',
            code: 'INVALID_PATIENT_NAME'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log('Payload validado:', { doctor_id, exam_type_id, data, hora_inicio, hora_fim, paciente_nome: paciente_nome ? '[REDACTED]' : null, paciente_telefone: paciente_telefone ? '[REDACTED]' : null })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ============================================================
    // REEXECUTAR TODAS AS VALIDAÇÕES DA FUNÇÃO DE DISPONIBILIDADE
    // ============================================================

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

    // Verificar se o exame está ativo
    if (!examType.ativo) {
      console.error('Tipo de exame inativo:', exam_type_id)
      return new Response(
        JSON.stringify({ error: 'Tipo de exame inativo' }),
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
    const dateObj = new Date(data + 'T00:00:00')
    const diaSemana = dateObj.getDay()
    console.log('Dia da semana:', diaSemana)

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

    // 2b) Buscar schedule_openings (datas extras) para este médico nesta data
    const { data: openings, error: openingsError } = await supabase
      .from('schedule_openings')
      .select('*')
      .eq('doctor_id', doctor_id)
      .eq('data', data)

    if (openingsError) {
      console.error('Erro ao buscar schedule_openings:', openingsError)
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar datas extras' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Schedule openings encontradas:', openings)

    // Filtrar openings por tipo_atendimento compatível
    const filteredOpenings = openings?.filter(opening => 
      opening.tipo_atendimento === 'ambos' || opening.tipo_atendimento === examType.categoria
    ) || []

    console.log('Openings filtradas por tipo_atendimento:', filteredOpenings)

    // Verificar se há regras OU openings válidas
    if (filteredRules.length === 0 && filteredOpenings.length === 0) {
      console.log('Nenhuma regra ou agenda extra encontrada para este dia/tipo')
      return new Response(
        JSON.stringify({ error: 'Médico não atende neste dia ou para este tipo de exame' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Se existir exceção, retornar erro
    if (exceptions && exceptions.length > 0) {
      console.log('Existe exceção para esta data')
      return new Response(
        JSON.stringify({ error: 'Médico indisponível nesta data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4) Verificar se o horário está dentro de alguma regra OU opening válida
    const horaInicioMinutos = timeToMinutes(hora_inicio)
    const horaFimMinutos = timeToMinutes(hora_fim)

    // Verificar nas regras semanais
    const isWithinRule = filteredRules.some(rule => {
      const ruleStart = timeToMinutes(rule.hora_inicio)
      const ruleEnd = timeToMinutes(rule.hora_fim)
      // Permite que o slot COMECE até o horário limite (hora_fim)
      return horaInicioMinutos >= ruleStart && horaInicioMinutos <= ruleEnd
    })

    // Verificar nas openings (datas extras)
    const isWithinOpening = filteredOpenings.some(opening => {
      const openingStart = timeToMinutes(opening.hora_inicio)
      const openingEnd = timeToMinutes(opening.hora_fim)
      // Permite que o slot COMECE até o horário limite (hora_fim)
      return horaInicioMinutos >= openingStart && horaInicioMinutos <= openingEnd
    })

    if (!isWithinRule && !isWithinOpening) {
      console.error('Horário fora das regras/openings de atendimento:', { hora_inicio, hora_fim })
      return new Response(
        JSON.stringify({ error: 'Horário fora do período de atendimento do médico' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5) Verificar duração do exame
    const duracaoSolicitada = horaFimMinutos - horaInicioMinutos
    if (duracaoSolicitada !== examType.duracao_minutos) {
      console.error('Duração incorreta:', { duracaoSolicitada, esperada: examType.duracao_minutos })
      return new Response(
        JSON.stringify({ error: `Duração do horário não corresponde à duração do exame (${examType.duracao_minutos} minutos)` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 6) Buscar appointments existentes e verificar conflitos
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

    // Verificar conflito
    const hasConflict = appointments?.some(apt => {
      const aptStart = timeToMinutes(apt.hora_inicio)
      const aptEnd = timeToMinutes(apt.hora_fim)
      
      // Verifica sobreposição
      return !(horaFimMinutos <= aptStart || horaInicioMinutos >= aptEnd)
    })

    if (hasConflict) {
      console.error('Conflito de horário detectado')
      return new Response(
        JSON.stringify({ error: 'Horário indisponível. Selecione outro horário.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================================
    // TUDO VÁLIDO - CRIAR O AGENDAMENTO
    // ============================================================

    const { data: newAppointment, error: insertError } = await supabase
      .from('appointments')
      .insert({
        doctor_id,
        exam_type_id,
        data,
        hora_inicio,
        hora_fim,
        status: 'reservado',
        paciente_nome: paciente_nome || null,
        paciente_telefone: paciente_telefone || null
      })
      .select()
      .single()

    if (insertError) {
      console.error('Erro ao inserir appointment:', insertError)
      return new Response(
        JSON.stringify({ error: 'Erro ao criar agendamento' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Agendamento criado com sucesso:', newAppointment)

    return new Response(
      JSON.stringify({ 
        sucesso: true,
        mensagem: 'Agendamento realizado com sucesso',
        agendamento: newAppointment
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro inesperado:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Converte formato HH:MM para minutos do dia
function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(':').map(Number)
  return hours * 60 + mins
}
