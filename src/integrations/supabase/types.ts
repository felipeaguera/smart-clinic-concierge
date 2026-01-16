export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          created_at: string
          data: string
          doctor_id: string
          exam_type_id: string
          hora_fim: string
          hora_inicio: string
          id: string
          is_encaixe: boolean
          paciente_nome: string | null
          paciente_telefone: string | null
          status: string
        }
        Insert: {
          created_at?: string
          data: string
          doctor_id: string
          exam_type_id: string
          hora_fim: string
          hora_inicio: string
          id?: string
          is_encaixe?: boolean
          paciente_nome?: string | null
          paciente_telefone?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          data?: string
          doctor_id?: string
          exam_type_id?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          is_encaixe?: boolean
          paciente_nome?: string | null
          paciente_telefone?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_exam_type_id_fkey"
            columns: ["exam_type_id"]
            isOneToOne: false
            referencedRelation: "exam_types"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_rules: {
        Row: {
          created_at: string
          dia_semana: number
          doctor_id: string
          hora_fim: string
          hora_inicio: string
          id: string
          tipo_atendimento: string
        }
        Insert: {
          created_at?: string
          dia_semana: number
          doctor_id: string
          hora_fim: string
          hora_inicio: string
          id?: string
          tipo_atendimento?: string
        }
        Update: {
          created_at?: string
          dia_semana?: number
          doctor_id?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          tipo_atendimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_rules_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          ativo: boolean
          created_at: string
          especialidade: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          especialidade: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          especialidade?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      exam_types: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          currency: string
          duracao_minutos: number
          has_price: boolean
          id: string
          nome: string
          orientacoes: string | null
          preparo: string | null
          price_private: number | null
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          currency?: string
          duracao_minutos: number
          has_price?: boolean
          id?: string
          nome: string
          orientacoes?: string | null
          preparo?: string | null
          price_private?: number | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          currency?: string
          duracao_minutos?: number
          has_price?: boolean
          id?: string
          nome?: string
          orientacoes?: string | null
          preparo?: string | null
          price_private?: number | null
        }
        Relationships: []
      }
      schedule_exceptions: {
        Row: {
          created_at: string
          data: string
          doctor_id: string
          id: string
          motivo: string | null
        }
        Insert: {
          created_at?: string
          data: string
          doctor_id: string
          id?: string
          motivo?: string | null
        }
        Update: {
          created_at?: string
          data?: string
          doctor_id?: string
          id?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_exceptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_openings: {
        Row: {
          created_at: string
          data: string
          doctor_id: string
          hora_fim: string
          hora_inicio: string
          id: string
          motivo: string | null
          tipo_atendimento: string
        }
        Insert: {
          created_at?: string
          data: string
          doctor_id: string
          hora_fim: string
          hora_inicio: string
          id?: string
          motivo?: string | null
          tipo_atendimento?: string
        }
        Update: {
          created_at?: string
          data?: string
          doctor_id?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          motivo?: string | null
          tipo_atendimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_openings_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      agenda_publica: {
        Row: {
          data: string | null
          doctor_id: string | null
          duracao_minutos: number | null
          hora_fim: string | null
          hora_inicio: string | null
          id: string | null
          is_encaixe: boolean | null
          status: string | null
          tipo_atendimento: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
