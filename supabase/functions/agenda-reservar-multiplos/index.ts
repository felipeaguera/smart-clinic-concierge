import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Schema de validação para cada reserva individual
const reservaItemSchema = z.object({
  doctor_id: z.string().uuid({ message: 'ID do médico inválido' }),
  exam_type_id: z.string().uuid({ message: 'ID do exame inválido' }),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data deve estar no formato YYYY-MM-DD' }),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, { message: 'Hora de início deve estar no formato HH:MM' }),
  hora_fim: z.string().regex(/^\d{2}:\d{2}$/, { message: 'Hora de fim deve estar no formato HH:MM' }),
})

// Schema para o payload completo
const multiplosReservasSchema = z.object({
  reservas: z.array(reservaItemSchema).min(1, { message: 'Pelo menos uma reserva é obrigatória' }).max(5, { message: 'Máximo de 5 exames por vez' }),
  paciente_nome: z.string().trim().min(2, { message: 'Nome deve ter pelo menos 2 caracteres' }).max(100, { message: 'Nome deve ter no máximo 100 caracteres' }),
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
    const parseResult = multiplosReservasSchema.safeParse(body)
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

    const { reservas, paciente_nome, paciente_telefone } = parseResult.data

    console.log('Payload validado:', { 
      totalReservas: reservas.length, 
      paciente_nome: '[REDACTED]', 
      paciente_telefone: paciente_telefone ? '[REDACTED]' : null 
    })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // ============================================================
    // VALIDAÇÃO 1: Verificar se todos os exames são do mesmo dia
    // ============================================================
    const uniqueDates = [...new Set(reservas.map(r => r.data))]
    if (uniqueDates.length > 1) {
      return new Response(
        JSON.stringify({ error: 'Todos os exames devem ser agendados para o mesmo dia' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const data = reservas[0].data

    // ============================================================
    // VALIDAÇÃO 2: Verificar se os horários são consecutivos
    // ============================================================
    const sortedReservas = [...reservas].sort((a, b) => 
      timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio)
    )

    for (let i = 0; i < sortedReservas.length - 1; i++) {
      const current = sortedReservas[i]
      const next = sortedReservas[i + 1]
      
      if (timeToMinutes(current.hora_fim) !== timeToMinutes(next.hora_inicio)) {
        return new Response(
          JSON.stringify({ 
            error: 'Os horários devem ser consecutivos (fim do primeiro = início do próximo)',
            details: `Horário ${i + 1} termina às ${current.hora_fim}, mas horário ${i + 2} começa às ${next.hora_inicio}`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // ============================================================
    // VALIDAÇÃO 3: Validar cada exame individualmente
    // ============================================================
    const validatedReservas: Array<{
      reserva: typeof sortedReservas[0],
      examType: any,
      doctor: any
    }> = []

    for (const reserva of sortedReservas) {
      // Buscar exam_type
      const { data: examType, error: examTypeError } = await supabase
        .from('exam_types')
        .select('*')
        .eq('id', reserva.exam_type_id)
        .maybeSingle()

      if (examTypeError) {
        console.error('Erro ao buscar exam_type:', examTypeError)
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar tipo de exame' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!examType) {
        return new Response(
          JSON.stringify({ error: `Tipo de exame não encontrado: ${reserva.exam_type_id}` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Laboratório não pode ser agendado
      if (examType.categoria === 'laboratorio') {
        return new Response(
          JSON.stringify({ error: `Exame "${examType.nome}" é de laboratório e não utiliza agendamento` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Exame deve estar ativo
      if (!examType.ativo) {
        return new Response(
          JSON.stringify({ error: `Tipo de exame "${examType.nome}" está inativo` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validação de vínculo médico para consultas
      if (examType.categoria === 'consulta') {
        if (!examType.doctor_id) {
          return new Response(
            JSON.stringify({ error: `Consulta "${examType.nome}" não está vinculada a nenhum médico` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        if (examType.doctor_id !== reserva.doctor_id) {
          return new Response(
            JSON.stringify({ error: `Consulta "${examType.nome}" não pertence ao médico selecionado` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      // Verificar duração
      const duracaoSolicitada = timeToMinutes(reserva.hora_fim) - timeToMinutes(reserva.hora_inicio)
      if (duracaoSolicitada !== examType.duracao_minutos) {
        return new Response(
          JSON.stringify({ 
            error: `Duração incorreta para "${examType.nome}": esperado ${examType.duracao_minutos} minutos, recebido ${duracaoSolicitada}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Buscar médico
      const { data: doctor, error: doctorError } = await supabase
        .from('doctors')
        .select('*')
        .eq('id', reserva.doctor_id)
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
        return new Response(
          JSON.stringify({ error: 'Médico não encontrado ou inativo' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      validatedReservas.push({ reserva, examType, doctor })
    }

    // ============================================================
    // VALIDAÇÃO 4: Verificar regras do médico e exceções
    // ============================================================
    const dateObj = new Date(data + 'T00:00:00')
    const diaSemana = dateObj.getDay()

    // Agrupar reservas por médico para verificar regras
    const reservasPorMedico = new Map<string, typeof validatedReservas>()
    for (const item of validatedReservas) {
      const doctorId = item.reserva.doctor_id
      if (!reservasPorMedico.has(doctorId)) {
        reservasPorMedico.set(doctorId, [])
      }
      reservasPorMedico.get(doctorId)!.push(item)
    }

    for (const [doctorId, items] of reservasPorMedico) {
      // Verificar exceções
      const { data: exceptions, error: exceptionsError } = await supabase
        .from('schedule_exceptions')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('data', data)

      if (exceptionsError) {
        console.error('Erro ao buscar exceções:', exceptionsError)
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar exceções de agenda' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (exceptions && exceptions.length > 0) {
        return new Response(
          JSON.stringify({ error: `Médico ${items[0].doctor.nome} indisponível nesta data` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Buscar regras do médico
      const { data: rules, error: rulesError } = await supabase
        .from('doctor_rules')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('dia_semana', diaSemana)

      if (rulesError) {
        console.error('Erro ao buscar regras:', rulesError)
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar regras de atendimento' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verificar se cada reserva está dentro de alguma regra
      for (const item of items) {
        const filteredRules = rules?.filter(rule => 
          rule.tipo_atendimento === 'ambos' || rule.tipo_atendimento === item.examType.categoria
        ) || []

        if (filteredRules.length === 0) {
          return new Response(
            JSON.stringify({ 
              error: `Médico ${item.doctor.nome} não atende ${item.examType.categoria} neste dia` 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const horaInicioMinutos = timeToMinutes(item.reserva.hora_inicio)
        const horaFimMinutos = timeToMinutes(item.reserva.hora_fim)

        const isWithinRule = filteredRules.some(rule => {
          const ruleStart = timeToMinutes(rule.hora_inicio)
          const ruleEnd = timeToMinutes(rule.hora_fim)
          // Permite que o slot COMECE até o horário limite (hora_fim)
          return horaInicioMinutos >= ruleStart && horaInicioMinutos <= ruleEnd
        })

        if (!isWithinRule) {
          return new Response(
            JSON.stringify({ 
              error: `Horário ${item.reserva.hora_inicio}-${item.reserva.hora_fim} fora do período de atendimento de ${item.doctor.nome}` 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // ============================================================
    // VALIDAÇÃO 5: Verificar conflitos com agendamentos existentes
    // ============================================================
    for (const [doctorId, items] of reservasPorMedico) {
      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select('*')
        .eq('doctor_id', doctorId)
        .eq('data', data)
        .neq('status', 'cancelado')

      if (appointmentsError) {
        console.error('Erro ao buscar appointments:', appointmentsError)
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar agendamentos existentes' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      for (const item of items) {
        const horaInicioMinutos = timeToMinutes(item.reserva.hora_inicio)
        const horaFimMinutos = timeToMinutes(item.reserva.hora_fim)

        const hasConflict = appointments?.some(apt => {
          const aptStart = timeToMinutes(apt.hora_inicio)
          const aptEnd = timeToMinutes(apt.hora_fim)
          return !(horaFimMinutos <= aptStart || horaInicioMinutos >= aptEnd)
        })

        if (hasConflict) {
          return new Response(
            JSON.stringify({ 
              error: `Conflito de horário detectado para ${item.examType.nome} às ${item.reserva.hora_inicio}` 
            }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // ============================================================
    // TUDO VÁLIDO - CRIAR OS AGENDAMENTOS
    // ============================================================
    const createdAppointments: any[] = []

    for (const item of validatedReservas) {
      const { data: newAppointment, error: insertError } = await supabase
        .from('appointments')
        .insert({
          doctor_id: item.reserva.doctor_id,
          exam_type_id: item.reserva.exam_type_id,
          data: item.reserva.data,
          hora_inicio: item.reserva.hora_inicio,
          hora_fim: item.reserva.hora_fim,
          status: 'reservado',
          paciente_nome: paciente_nome,
          paciente_telefone: paciente_telefone || null
        })
        .select()
        .single()

      if (insertError) {
        console.error('Erro ao inserir appointment:', insertError)
        
        // Se falhou, tentar cancelar os anteriores (rollback manual)
        if (createdAppointments.length > 0) {
          console.log('Tentando rollback dos agendamentos criados...')
          for (const apt of createdAppointments) {
            await supabase
              .from('appointments')
              .update({ status: 'cancelado' })
              .eq('id', apt.id)
          }
        }

        return new Response(
          JSON.stringify({ error: 'Erro ao criar agendamento. Nenhum exame foi agendado.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      createdAppointments.push({
        ...newAppointment,
        exam_nome: item.examType.nome,
        doctor_nome: item.doctor.nome,
        preparo: item.examType.preparo,
        orientacoes: item.examType.orientacoes
      })
    }

    console.log('Agendamentos criados com sucesso:', createdAppointments.length)

    return new Response(
      JSON.stringify({ 
        sucesso: true,
        mensagem: `${createdAppointments.length} agendamento(s) realizado(s) com sucesso`,
        agendamentos: createdAppointments
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
