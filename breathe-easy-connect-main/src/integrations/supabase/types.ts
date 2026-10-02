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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      adherence_records: {
        Row: {
          care_plan_id: string | null
          completion_ratio: number
          created_at: string
          id: string
          patient_id: string
          scheduled_for: string
          session_id: string | null
          status: Database["public"]["Enums"]["adherence_status"]
        }
        Insert: {
          care_plan_id?: string | null
          completion_ratio?: number
          created_at?: string
          id?: string
          patient_id: string
          scheduled_for?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["adherence_status"]
        }
        Update: {
          care_plan_id?: string | null
          completion_ratio?: number
          created_at?: string
          id?: string
          patient_id?: string
          scheduled_for?: string
          session_id?: string | null
          status?: Database["public"]["Enums"]["adherence_status"]
        }
        Relationships: [
          {
            foreignKeyName: "adherence_records_care_plan_id_fkey"
            columns: ["care_plan_id"]
            isOneToOne: false
            referencedRelation: "care_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adherence_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adherence_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "nebulization_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          device_id: string | null
          id: string
          message: string
          patient_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          status: Database["public"]["Enums"]["alert_status"]
          threshold: number | null
          type: string
          value: number | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          message: string
          patient_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          threshold?: number | null
          type: string
          value?: number | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          message?: string
          patient_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          status?: Database["public"]["Enums"]["alert_status"]
          threshold?: number | null
          type?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          id: string
          meta: Json | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          id?: string
          meta?: Json | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      battery_telemetry: {
        Row: {
          cell_temperature: number | null
          charging: boolean
          current: number | null
          device_id: string | null
          fluid_level: number | null
          id: number
          patient_id: string
          percentage: number | null
          power: number | null
          recorded_at: string
          source: string
          voltage: number | null
        }
        Insert: {
          cell_temperature?: number | null
          charging?: boolean
          current?: number | null
          device_id?: string | null
          fluid_level?: number | null
          id?: number
          patient_id: string
          percentage?: number | null
          power?: number | null
          recorded_at?: string
          source?: string
          voltage?: number | null
        }
        Update: {
          cell_temperature?: number | null
          charging?: boolean
          current?: number | null
          device_id?: string | null
          fluid_level?: number | null
          id?: number
          patient_id?: string
          percentage?: number | null
          power?: number | null
          recorded_at?: string
          source?: string
          voltage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "battery_telemetry_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battery_telemetry_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plans: {
        Row: {
          created_at: string
          doctor_id: string | null
          dosage: string
          duration_minutes: number
          end_date: string | null
          frequency_per_day: number
          id: string
          instructions: string | null
          medication: string
          patient_id: string
          start_date: string
          status: Database["public"]["Enums"]["care_plan_status"]
          time_slots: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          doctor_id?: string | null
          dosage: string
          duration_minutes?: number
          end_date?: string | null
          frequency_per_day?: number
          id?: string
          instructions?: string | null
          medication: string
          patient_id: string
          start_date?: string
          status?: Database["public"]["Enums"]["care_plan_status"]
          time_slots?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string | null
          dosage?: string
          duration_minutes?: number
          end_date?: string | null
          frequency_per_day?: number
          id?: string
          instructions?: string | null
          medication?: string
          patient_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["care_plan_status"]
          time_slots?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_plans_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      caregiver_notes: {
        Row: {
          author_id: string | null
          caregiver_id: string | null
          created_at: string
          id: string
          note: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          caregiver_id?: string | null
          created_at?: string
          id?: string
          note: string
          patient_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          caregiver_id?: string | null
          created_at?: string
          id?: string
          note?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_notes_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caregiver_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      caregiver_patient_assignments: {
        Row: {
          caregiver_id: string
          created_at: string
          id: string
          patient_id: string
        }
        Insert: {
          caregiver_id: string
          created_at?: string
          id?: string
          patient_id: string
        }
        Update: {
          caregiver_id?: string
          created_at?: string
          id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "caregiver_patient_assignments_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "caregivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caregiver_patient_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      caregivers: {
        Row: {
          created_at: string
          full_name: string
          id: string
          relation: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          relation?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          relation?: string
          user_id?: string | null
        }
        Relationships: []
      }
      clinical_notes: {
        Row: {
          created_at: string
          doctor_id: string | null
          id: string
          note: string
          patient_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          doctor_id?: string | null
          id?: string
          note: string
          patient_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string | null
          id?: string
          note?: string
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      device_commands: {
        Row: {
          acked_at: string | null
          command: string
          created_at: string
          device_id: string | null
          id: string
          issued_by: string | null
          patient_id: string
          session_id: string | null
          state: Database["public"]["Enums"]["command_state"]
        }
        Insert: {
          acked_at?: string | null
          command: string
          created_at?: string
          device_id?: string | null
          id?: string
          issued_by?: string | null
          patient_id: string
          session_id?: string | null
          state?: Database["public"]["Enums"]["command_state"]
        }
        Update: {
          acked_at?: string | null
          command?: string
          created_at?: string
          device_id?: string | null
          id?: string
          issued_by?: string | null
          patient_id?: string
          session_id?: string | null
          state?: Database["public"]["Enums"]["command_state"]
        }
        Relationships: [
          {
            foreignKeyName: "device_commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_commands_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_commands_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "nebulization_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          cloud_connected: boolean
          device_code: string
          firmware: string
          fluid_level: number
          id: string
          last_seen_at: string | null
          mqtt_connected: boolean
          nebulizer_state: string
          patient_id: string | null
          registered_at: string
          status: Database["public"]["Enums"]["device_status"]
        }
        Insert: {
          cloud_connected?: boolean
          device_code: string
          firmware?: string
          fluid_level?: number
          id?: string
          last_seen_at?: string | null
          mqtt_connected?: boolean
          nebulizer_state?: string
          patient_id?: string | null
          registered_at?: string
          status?: Database["public"]["Enums"]["device_status"]
        }
        Update: {
          cloud_connected?: boolean
          device_code?: string
          firmware?: string
          fluid_level?: number
          id?: string
          last_seen_at?: string | null
          mqtt_connected?: boolean
          nebulizer_state?: string
          patient_id?: string | null
          registered_at?: string
          status?: Database["public"]["Enums"]["device_status"]
        }
        Relationships: [
          {
            foreignKeyName: "devices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      doctor_patient_assignments: {
        Row: {
          created_at: string
          doctor_id: string
          id: string
          patient_id: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          id?: string
          patient_id: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          id?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_patient_assignments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_patient_assignments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          created_at: string
          full_name: string
          id: string
          specialty: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          specialty?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          specialty?: string
          user_id?: string | null
        }
        Relationships: []
      }
      environmental_telemetry: {
        Row: {
          ambient_temperature: number | null
          aqi: number | null
          device_id: string | null
          humidity: number | null
          id: number
          patient_id: string
          recorded_at: string
          simulated: boolean
          source: string
        }
        Insert: {
          ambient_temperature?: number | null
          aqi?: number | null
          device_id?: string | null
          humidity?: number | null
          id?: number
          patient_id: string
          recorded_at?: string
          simulated?: boolean
          source?: string
        }
        Update: {
          ambient_temperature?: number | null
          aqi?: number | null
          device_id?: string | null
          humidity?: number | null
          id?: number
          patient_id?: string
          recorded_at?: string
          simulated?: boolean
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "environmental_telemetry_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "environmental_telemetry_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      fluid_refills: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          level_after: number
          note: string | null
          patient_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          level_after?: number
          note?: string | null
          patient_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          level_after?: number
          note?: string | null
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fluid_refills_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fluid_refills_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      health_telemetry: {
        Row: {
          body_temperature: number | null
          bpm: number | null
          device_id: string | null
          id: number
          patient_id: string
          recorded_at: string
          source: string
          spo2: number | null
        }
        Insert: {
          body_temperature?: number | null
          bpm?: number | null
          device_id?: string | null
          id?: number
          patient_id: string
          recorded_at?: string
          source?: string
          spo2?: number | null
        }
        Update: {
          body_temperature?: number | null
          bpm?: number | null
          device_id?: string | null
          id?: number
          patient_id?: string
          recorded_at?: string
          source?: string
          spo2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "health_telemetry_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_telemetry_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      nebulization_sessions: {
        Row: {
          care_plan_id: string | null
          created_at: string
          device_id: string | null
          dosage: string | null
          elapsed_seconds: number
          ended_at: string | null
          id: string
          medication: string | null
          patient_id: string
          prescribed_seconds: number
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
        }
        Insert: {
          care_plan_id?: string | null
          created_at?: string
          device_id?: string | null
          dosage?: string | null
          elapsed_seconds?: number
          ended_at?: string | null
          id?: string
          medication?: string | null
          patient_id: string
          prescribed_seconds?: number
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Update: {
          care_plan_id?: string | null
          created_at?: string
          device_id?: string | null
          dosage?: string | null
          elapsed_seconds?: number
          ended_at?: string | null
          id?: string
          medication?: string | null
          patient_id?: string
          prescribed_seconds?: number
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nebulization_sessions_care_plan_id_fkey"
            columns: ["care_plan_id"]
            isOneToOne: false
            referencedRelation: "care_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nebulization_sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nebulization_sessions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          patient_id: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          patient_id?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          patient_id?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          alerts_enabled: boolean
          battery_low_threshold: number
          bpm_high_threshold: number
          bpm_low_threshold: number
          bpm_low_warn: number
          condition: string | null
          created_at: string
          date_of_birth: string | null
          deleted_at: string | null
          full_name: string
          id: string
          mrn: string
          offline_after_minutes: number
          sex: string | null
          spo2_threshold: number
          temp_threshold: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          alerts_enabled?: boolean
          battery_low_threshold?: number
          bpm_high_threshold?: number
          bpm_low_threshold?: number
          bpm_low_warn?: number
          condition?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          full_name: string
          id?: string
          mrn: string
          offline_after_minutes?: number
          sex?: string | null
          spo2_threshold?: number
          temp_threshold?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          alerts_enabled?: boolean
          battery_low_threshold?: number
          bpm_high_threshold?: number
          bpm_low_threshold?: number
          bpm_low_warn?: number
          condition?: string | null
          created_at?: string
          date_of_birth?: string | null
          deleted_at?: string | null
          full_name?: string
          id?: string
          mrn?: string
          offline_after_minutes?: number
          sex?: string | null
          spo2_threshold?: number
          temp_threshold?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          language: string
          notify_email: boolean
          phone: string | null
          theme: string
          updated_at: string
          voice_alerts: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          language?: string
          notify_email?: boolean
          phone?: string | null
          theme?: string
          updated_at?: string
          voice_alerts?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          language?: string
          notify_email?: boolean
          phone?: string | null
          theme?: string
          updated_at?: string
          voice_alerts?: boolean
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          format: string
          id: string
          kind: string
          patient_id: string
          payload: Json | null
          range_end: string | null
          range_start: string | null
          requested_by: string | null
        }
        Insert: {
          created_at?: string
          format?: string
          id?: string
          kind?: string
          patient_id: string
          payload?: Json | null
          range_end?: string | null
          range_start?: string | null
          requested_by?: string | null
        }
        Update: {
          created_at?: string
          format?: string
          id?: string
          kind?: string
          patient_id?: string
          payload?: Json | null
          range_end?: string | null
          range_start?: string | null
          requested_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      sos_events: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          id: string
          patient_id: string
          resolved_at: string | null
          resolved_by: string | null
          source: string
          status: Database["public"]["Enums"]["alert_status"]
          vitals: Json | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          patient_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: Database["public"]["Enums"]["alert_status"]
          vitals?: Json | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          id?: string
          patient_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: Database["public"]["Enums"]["alert_status"]
          vitals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sos_events_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
      [_ in never]: never
    }
    Functions: {
      can_view_patient: { Args: { _patient_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      owns_patient: { Args: { _patient_id: string }; Returns: boolean }
    }
    Enums: {
      adherence_status: "completed" | "partial" | "missed" | "scheduled"
      alert_severity: "critical" | "warning" | "info"
      alert_status: "active" | "acknowledged" | "resolved"
      app_role: "patient" | "doctor" | "caregiver" | "admin" | "super_admin"
      care_plan_status: "draft" | "published" | "paused" | "ended"
      command_state: "sent" | "acked" | "failed"
      device_status: "online" | "offline" | "maintenance" | "disabled"
      session_status:
        | "pending"
        | "starting"
        | "running"
        | "paused"
        | "completed"
        | "stopped"
        | "failed"
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
      adherence_status: ["completed", "partial", "missed", "scheduled"],
      alert_severity: ["critical", "warning", "info"],
      alert_status: ["active", "acknowledged", "resolved"],
      app_role: ["patient", "doctor", "caregiver", "admin", "super_admin"],
      care_plan_status: ["draft", "published", "paused", "ended"],
      command_state: ["sent", "acked", "failed"],
      device_status: ["online", "offline", "maintenance", "disabled"],
      session_status: [
        "pending",
        "starting",
        "running",
        "paused",
        "completed",
        "stopped",
        "failed",
      ],
    },
  },
} as const
