

# Vincular Ecocardiograma ao Dr. Antônio + Filtro bidirecional

## Problema

Hoje a função `agenda-disponibilidade-categoria` busca **todos** os médicos ativos para qualquer ultrassom. Precisamos de dois filtros:

1. **Ecocardiograma** → mostrar **somente** Dr. Antônio Calvilho
2. **Outros ultrassons** → **não** mostrar Dr. Antônio Calvilho

## Alterações

### 1. Vincular no banco de dados
UPDATE `exam_types` SET `doctor_id` = `'2ea9f66f-...'` WHERE `id` = `'7a3630c4-...'` (ECOCARDIOGRAMA)

### 2. Ajustar `agenda-disponibilidade-categoria/index.ts` (linhas 84-88)

Lógica atual:
```
Busca TODOS os médicos ativos
```

Nova lógica:
```text
Se examType.doctor_id existe:
  → buscar APENAS esse médico (caso do Ecocardiograma)
Senão:
  → buscar todos os médicos ativos
  → EXCLUIR médicos que são "especialistas exclusivos"
    (ou seja, que têm algum exam_type da mesma categoria
     vinculado a eles via doctor_id)
```

Isso garante que o Dr. Antônio:
- **Aparece** quando o paciente busca Ecocardiograma
- **Não aparece** quando busca qualquer outro ultrassom

### 3. Mesma lógica no `agenda-disponibilidade/index.ts`
Verificar se essa função também precisa do filtro (ela é usada para consultas com médico específico, então provavelmente já está OK).

