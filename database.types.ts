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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          name: string
          profile_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          name: string
          profile_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          name?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "categories_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      menuItem: {
        Row: {
          category: string | null
          category_id: string | null
          createdAt: string | null
          description: string | null
          displayOrder: number | null
          id: string
          image: string | null
          isActive: boolean
          name: string
          price: number
          profile_id: string | null
          updatedAt: string | null
        }
        Insert: {
          category?: string | null
          category_id?: string | null
          createdAt?: string | null
          description?: string | null
          displayOrder?: number | null
          id?: string
          image?: string | null
          isActive?: boolean
          name: string
          price: number
          profile_id?: string | null
          updatedAt?: string | null
        }
        Update: {
          category?: string | null
          category_id?: string | null
          createdAt?: string | null
          description?: string | null
          displayOrder?: number | null
          id?: string
          image?: string | null
          isActive?: boolean
          name?: string
          price?: number
          profile_id?: string | null
          updatedAt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menuItem_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menuItem_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "menuItem_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      order: {
        Row: {
          actual_pickup_time: string | null
          createdat: string | null
          estimated_pickup_time: string | null
          notes: string | null
          order_id: string
          phoneNumber: string | null
          profile_id: string | null
          status: Database["public"]["Enums"]["kakao_order"] | null
          totalAmount: number | null
          updated_at: string | null
        }
        Insert: {
          actual_pickup_time?: string | null
          createdat?: string | null
          estimated_pickup_time?: string | null
          notes?: string | null
          order_id?: string
          phoneNumber?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["kakao_order"] | null
          totalAmount?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_pickup_time?: string | null
          createdat?: string | null
          estimated_pickup_time?: string | null
          notes?: string | null
          order_id?: string
          phoneNumber?: string | null
          profile_id?: string | null
          status?: Database["public"]["Enums"]["kakao_order"] | null
          totalAmount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "order_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["profile_id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          from_status: string | null
          id: string
          notes: string | null
          order_id: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["order_id"]
          },
        ]
      }
      orderitem: {
        Row: {
          id: string
          menuItemId: string | null
          orderId: string | null
          price: number
          quantity: number
        }
        Insert: {
          id?: string
          menuItemId?: string | null
          orderId?: string | null
          price: number
          quantity: number
        }
        Update: {
          id?: string
          menuItemId?: string | null
          orderId?: string | null
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "orderitem_menuItemId_fkey"
            columns: ["menuItemId"]
            isOneToOne: false
            referencedRelation: "menuItem"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orderitem_orderId_fkey"
            columns: ["orderId"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["order_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          customernumber: string | null
          default_prep_time_minutes: number | null
          email: string | null
          name: string | null
          profile_id: string
          role: Database["public"]["Enums"]["user_role"]
          store_description: string | null
          store_image: string | null
          storename: string | null
          storenumber: string | null
        }
        Insert: {
          created_at?: string
          customernumber?: string | null
          default_prep_time_minutes?: number | null
          email?: string | null
          name?: string | null
          profile_id: string
          role?: Database["public"]["Enums"]["user_role"]
          store_description?: string | null
          store_image?: string | null
          storename?: string | null
          storenumber?: string | null
        }
        Update: {
          created_at?: string
          customernumber?: string | null
          default_prep_time_minutes?: number | null
          email?: string | null
          name?: string | null
          profile_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          store_description?: string | null
          store_image?: string | null
          storename?: string | null
          storenumber?: string | null
        }
        Relationships: []
      }
      store_hours: {
        Row: {
          close_time: string | null
          created_at: string | null
          day_of_week: number
          id: string
          is_closed: boolean | null
          open_time: string | null
          profile_id: string | null
          updated_at: string | null
        }
        Insert: {
          close_time?: string | null
          created_at?: string | null
          day_of_week: number
          id?: string
          is_closed?: boolean | null
          open_time?: string | null
          profile_id?: string | null
          updated_at?: string | null
        }
        Update: {
          close_time?: string | null
          created_at?: string | null
          day_of_week?: number
          id?: string
          is_closed?: boolean | null
          open_time?: string | null
          profile_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_hours_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "store_hours_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_stores"
            referencedColumns: ["profile_id"]
          },
        ]
      }
    }
    Views: {
      public_stores: {
        Row: {
          default_prep_time_minutes: number | null
          name: string | null
          profile_id: string | null
          store_description: string | null
          store_image: string | null
          storename: string | null
          storenumber: string | null
        }
        Insert: {
          default_prep_time_minutes?: number | null
          name?: string | null
          profile_id?: string | null
          store_description?: string | null
          store_image?: string | null
          storename?: string | null
          storenumber?: string | null
        }
        Update: {
          default_prep_time_minutes?: number | null
          name?: string | null
          profile_id?: string | null
          store_description?: string | null
          store_image?: string | null
          storename?: string | null
          storenumber?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      kakao_order:
        | "PENDING"
        | "ACCEPT"
        | "CANCEL"
        | "PREPARING"
        | "READY"
        | "COMPLETED"
        | "REFUNDED"
      user_role: "customer" | "owner" | "admin"
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
      kakao_order: [
        "PENDING",
        "ACCEPT",
        "CANCEL",
        "PREPARING",
        "READY",
        "COMPLETED",
        "REFUNDED",
      ],
      user_role: ["customer", "owner", "admin"],
    },
  },
} as const
