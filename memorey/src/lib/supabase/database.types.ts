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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      canvas_vaults: {
        Row: {
          canvas_id: string
          created_at: string | null
          display_order: number | null
          show_empty_on_canvas: boolean
          vault_id: string
        }
        Insert: {
          canvas_id: string
          created_at?: string | null
          display_order?: number | null
          show_empty_on_canvas?: boolean
          vault_id: string
        }
        Update: {
          canvas_id?: string
          created_at?: string | null
          display_order?: number | null
          show_empty_on_canvas?: boolean
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canvas_vaults_canvas_id_fkey"
            columns: ["canvas_id"]
            isOneToOne: false
            referencedRelation: "canvases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_vaults_vault_id_fkey"
            columns: ["vault_id"]
            isOneToOne: false
            referencedRelation: "category_vaults"
            referencedColumns: ["id"]
          },
        ]
      }
      canvases: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          emoji: string | null
          icon_key: string | null
          id: string
          is_active: boolean | null
          master_line_color: string | null
          master_line_style: string | null
          master_node_bio: string | null
          master_node_color: string | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          emoji?: string | null
          icon_key?: string | null
          id?: string
          is_active?: boolean | null
          master_line_color?: string | null
          master_line_style?: string | null
          master_node_bio?: string | null
          master_node_color?: string | null
          name?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          emoji?: string | null
          icon_key?: string | null
          id?: string
          is_active?: boolean | null
          master_line_color?: string | null
          master_line_style?: string | null
          master_node_bio?: string | null
          master_node_color?: string | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canvases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      category_vaults: {
        Row: {
          color: string | null
          color_overrides: Json | null
          created_at: string | null
          default_card_accent: string | null
          default_card_bg: string | null
          default_card_text: string | null
          display_order: number | null
          icon: string | null
          icon_key: string | null
          id: string
          is_active: boolean | null
          is_custom: boolean | null
          is_exportable: boolean | null
          is_locked: boolean | null
          is_visible: boolean | null
          name: string
          pill_border_color: string | null
          pill_fill_bg: string | null
          pill_text_color: string | null
          pin_hash: string | null
          show_empty_in_master: boolean
          user_id: string
        }
        Insert: {
          color?: string | null
          color_overrides?: Json | null
          created_at?: string | null
          default_card_accent?: string | null
          default_card_bg?: string | null
          default_card_text?: string | null
          display_order?: number | null
          icon?: string | null
          icon_key?: string | null
          id?: string
          is_active?: boolean | null
          is_custom?: boolean | null
          is_exportable?: boolean | null
          is_locked?: boolean | null
          is_visible?: boolean | null
          name: string
          pill_border_color?: string | null
          pill_fill_bg?: string | null
          pill_text_color?: string | null
          pin_hash?: string | null
          show_empty_in_master?: boolean
          user_id: string
        }
        Update: {
          color?: string | null
          color_overrides?: Json | null
          created_at?: string | null
          default_card_accent?: string | null
          default_card_bg?: string | null
          default_card_text?: string | null
          display_order?: number | null
          icon?: string | null
          icon_key?: string | null
          id?: string
          is_active?: boolean | null
          is_custom?: boolean | null
          is_exportable?: boolean | null
          is_locked?: boolean | null
          is_visible?: boolean | null
          name?: string
          pill_border_color?: string | null
          pill_fill_bg?: string | null
          pill_text_color?: string | null
          pin_hash?: string | null
          show_empty_in_master?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_vaults_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_columns: {
        Row: {
          canvas_id: string | null
          color: string | null
          created_at: string | null
          display_order: number
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          canvas_id?: string | null
          color?: string | null
          created_at?: string | null
          display_order?: number
          id?: string
          is_default?: boolean
          name: string
          user_id: string
        }
        Update: {
          canvas_id?: string | null
          color?: string | null
          created_at?: string | null
          display_order?: number
          id?: string
          is_default?: boolean
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_columns_canvas_id_fkey"
            columns: ["canvas_id"]
            isOneToOne: false
            referencedRelation: "canvases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_columns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_nodes: {
        Row: {
          canvas_id: string | null
          confidence: number | null
          created_at: string | null
          custom_accent_color: string | null
          custom_bg_color: string | null
          custom_text_color: string | null
          embedding: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          is_active: boolean | null
          kanban_column_id: string | null
          kanban_order: number | null
          kanban_status: string | null
          node_kind_v2: string | null
          node_type: string | null
          og_description: string | null
          og_image: string | null
          og_site_name: string | null
          og_title: string | null
          pos_x: number | null
          pos_y: number | null
          source: string | null
          storage_path: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          user_id: string
          value: string
          vault_id: string
        }
        Insert: {
          canvas_id?: string | null
          confidence?: number | null
          created_at?: string | null
          custom_accent_color?: string | null
          custom_bg_color?: string | null
          custom_text_color?: string | null
          embedding?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          kanban_column_id?: string | null
          kanban_order?: number | null
          kanban_status?: string | null
          node_kind_v2?: string | null
          node_type?: string | null
          og_description?: string | null
          og_image?: string | null
          og_site_name?: string | null
          og_title?: string | null
          pos_x?: number | null
          pos_y?: number | null
          source?: string | null
          storage_path?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          value: string
          vault_id: string
        }
        Update: {
          canvas_id?: string | null
          confidence?: number | null
          created_at?: string | null
          custom_accent_color?: string | null
          custom_bg_color?: string | null
          custom_text_color?: string | null
          embedding?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_active?: boolean | null
          kanban_column_id?: string | null
          kanban_order?: number | null
          kanban_status?: string | null
          node_kind_v2?: string | null
          node_type?: string | null
          og_description?: string | null
          og_image?: string | null
          og_site_name?: string | null
          og_title?: string | null
          pos_x?: number | null
          pos_y?: number | null
          source?: string | null
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          value?: string
          vault_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_nodes_canvas_id_fkey"
            columns: ["canvas_id"]
            isOneToOne: false
            referencedRelation: "canvases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_nodes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_nodes_vault_id_fkey"
            columns: ["vault_id"]
            isOneToOne: false
            referencedRelation: "category_vaults"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memory_nodes_kanban_column_id_fkey"
            columns: ["kanban_column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      node_attachments: {
        Row: {
          created_at: string | null
          description: string | null
          file_name: string
          file_size: number | null
          file_size_bytes: number | null
          file_type: string
          file_url: string
          id: string
          is_active: boolean | null
          mime_type: string | null
          node_id: string | null
          og_description: string | null
          og_image: string | null
          og_site_name: string | null
          og_title: string | null
          source: string
          source_file_id: string | null
          storage_path: string | null
          thumbnail_url: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_name: string
          file_size?: number | null
          file_size_bytes?: number | null
          file_type: string
          file_url: string
          id?: string
          is_active?: boolean | null
          mime_type?: string | null
          node_id?: string | null
          og_description?: string | null
          og_image?: string | null
          og_site_name?: string | null
          og_title?: string | null
          source: string
          source_file_id?: string | null
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_size_bytes?: number | null
          file_type?: string
          file_url?: string
          id?: string
          is_active?: boolean | null
          mime_type?: string | null
          node_id?: string | null
          og_description?: string | null
          og_image?: string | null
          og_site_name?: string | null
          og_title?: string | null
          source?: string
          source_file_id?: string | null
          storage_path?: string | null
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_attachments_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "memory_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      node_edges: {
        Row: {
          canvas_id: string | null
          color: string | null
          created_at: string | null
          id: string
          label: string | null
          source_attachment_id: string | null
          source_node_id: string
          strength: number | null
          target_attachment_id: string | null
          target_node_id: string
          user_id: string
        }
        Insert: {
          canvas_id?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          label?: string | null
          source_attachment_id?: string | null
          source_node_id: string
          strength?: number | null
          target_attachment_id?: string | null
          target_node_id: string
          user_id: string
        }
        Update: {
          canvas_id?: string | null
          color?: string | null
          created_at?: string | null
          id?: string
          label?: string | null
          source_attachment_id?: string | null
          source_node_id?: string
          strength?: number | null
          target_attachment_id?: string | null
          target_node_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_edges_canvas_id_fkey"
            columns: ["canvas_id"]
            isOneToOne: false
            referencedRelation: "canvases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_edges_source_attachment_id_fkey"
            columns: ["source_attachment_id"]
            isOneToOne: false
            referencedRelation: "node_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "memory_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_edges_target_attachment_id_fkey"
            columns: ["target_attachment_id"]
            isOneToOne: false
            referencedRelation: "node_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "memory_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_edges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      node_history: {
        Row: {
          change_summary: string | null
          created_at: string | null
          id: string
          new_title: string
          new_value: string
          node_id: string
          old_title: string | null
          old_value: string | null
          triggered_by: string | null
          user_id: string
        }
        Insert: {
          change_summary?: string | null
          created_at?: string | null
          id?: string
          new_title: string
          new_value: string
          node_id: string
          old_title?: string | null
          old_value?: string | null
          triggered_by?: string | null
          user_id: string
        }
        Update: {
          change_summary?: string | null
          created_at?: string | null
          id?: string
          new_title?: string
          new_value?: string
          node_id?: string
          old_title?: string | null
          old_value?: string | null
          triggered_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_history_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "memory_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "node_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_proposals: {
        Row: {
          category: string
          created_at: string | null
          id: string
          status: string
          title: string
          user_id: string
          value: string
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          status?: string
          title: string
          user_id: string
          value: string
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          status?: string
          title?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_proposals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_canvas_id: string | null
          ai_use_cases: string[]
          anthropic_api_key_enc: string | null
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          full_name: string | null
          graph_edge_color: string | null
          graph_edge_style: string | null
          id: string
          master_line_color: string | null
          master_line_style: string | null
          master_node_bio: string | null
          master_node_color: string | null
          memory_goals: string[] | null
          onboarding_completed: boolean
          onboarding_step: number
          is_super_admin: boolean
          master_hidden_canvas_ids: string[]
          openai_api_key_enc: string | null
          primary_use_case: string | null
          segment: string | null
          updated_at: string | null
        }
        Insert: {
          active_canvas_id?: string | null
          ai_use_cases?: string[]
          anthropic_api_key_enc?: string | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          full_name?: string | null
          graph_edge_color?: string | null
          graph_edge_style?: string | null
          id: string
          master_line_color?: string | null
          master_line_style?: string | null
          master_node_bio?: string | null
          master_node_color?: string | null
          memory_goals?: string[] | null
          onboarding_completed?: boolean
          onboarding_step?: number
          is_super_admin?: boolean
          master_hidden_canvas_ids?: string[]
          openai_api_key_enc?: string | null
          primary_use_case?: string | null
          segment?: string | null
          updated_at?: string | null
        }
        Update: {
          active_canvas_id?: string | null
          ai_use_cases?: string[]
          anthropic_api_key_enc?: string | null
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          full_name?: string | null
          graph_edge_color?: string | null
          graph_edge_style?: string | null
          id?: string
          master_line_color?: string | null
          master_line_style?: string | null
          master_node_bio?: string | null
          master_node_color?: string | null
          memory_goals?: string[] | null
          onboarding_completed?: boolean
          onboarding_step?: number
          is_super_admin?: boolean
          master_hidden_canvas_ids?: string[]
          openai_api_key_enc?: string | null
          primary_use_case?: string | null
          segment?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_canvas_id_fkey"
            columns: ["active_canvas_id"]
            isOneToOne: false
            referencedRelation: "canvases"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          current_period_end: string | null
          plan: string | null
          dodo_customer_id: string | null
          dodo_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          current_period_end?: string | null
          plan?: string | null
          dodo_customer_id?: string | null
          dodo_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          current_period_end?: string | null
          plan?: string | null
          dodo_customer_id?: string | null
          dodo_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_events: {
        Row: {
          id: string
          user_id: string | null
          event_name: string
          event_data: Json
          page_path: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          event_name: string
          event_data?: Json
          page_path?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          event_name?: string
          event_data?: Json
          page_path?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_monthly_usage: {
        Row: {
          chat_query_count: number
          share_link_count: number
          updated_at: string
          user_id: string
          year_month: string
        }
        Insert: {
          chat_query_count?: number
          share_link_count?: number
          updated_at?: string
          user_id: string
          year_month: string
        }
        Update: {
          chat_query_count?: number
          share_link_count?: number
          updated_at?: string
          user_id?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_monthly_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_connected_nodes: {
        Args: { p_max_depth?: number; p_node_id: string; p_user_id: string }
        Returns: {
          depth: number
          node_id: string
        }[]
      }
      search_nodes: {
        Args: {
          p_limit?: number
          p_query_embedding: string
          p_user_id: string
          p_vault_ids: string[]
        }
        Returns: {
          confidence: number
          id: string
          similarity: number
          title: string
          value: string
          vault_id: string
        }[]
      }
      seed_canvas_vaults: {
        Args: { p_canvas_id: string; p_user_id: string }
        Returns: undefined
      }
      seed_default_kanban_columns: {
        Args: { p_canvas_id: string; p_user_id: string }
        Returns: undefined
      }
      seed_default_vaults: { Args: { p_user_id: string }; Returns: undefined }
      seed_default_vaults_internal: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_memory_node_counts_by_canvas: {
        Args: { p_user_id: string }
        Returns: { canvas_id: string; node_count: number }[]
      }
      admin_memory_node_counts_by_vault: {
        Args: { p_user_id: string }
        Returns: { vault_id: string; node_count: number }[]
      }
      admin_active_user_counts: {
        Args: Record<string, never>
        Returns: {
          active_7d: number
          active_30d: number
        }[]
      }
      admin_funnel_metrics: {
        Args: { p_since?: string }
        Returns: {
          total_signups: number
          completed_onboarding: number
          created_at_least_one_node: number
          created_five_plus_nodes: number
          used_search: number
          used_capture: number
          active_last_7_days_rolling: number
          upgraded_to_pro: number
        }[]
      }
      increment_usage: {
        Args: {
          p_user_id: string
          p_year_month: string
          p_field: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
