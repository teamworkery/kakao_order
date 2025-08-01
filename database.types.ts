export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)";
  };
  public: {
    Tables: {
      menuItem: {
        Row: {
          category: string | null;
          createdAt: string | null;
          description: string | null;
          id: string;
          image: string | null;
          isActive: boolean;
          name: string;
          price: number;
          profile_id: string | null;
          updatedAt: string | null;
        };
        Insert: {
          category?: string | null;
          createdAt?: string | null;
          description?: string | null;
          id?: string;
          image?: string | null;
          isActive?: boolean;
          name: string;
          price: number;
          profiles?: string | null;
          updatedAt?: string | null;
        };
        Update: {
          category?: string | null;
          createdAt?: string | null;
          description?: string | null;
          id?: string;
          image?: string | null;
          isActive?: boolean;
          name?: string;
          price?: number;
          profiles?: string | null;
          updatedAt?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "menuItem_profiles_fkey";
            columns: ["profiles"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["profiles_id"];
          }
        ];
      };
      order: {
        Row: {
          createdat: string | null;
          id: string;
          phoneNumber: string | null;
          profiles: string | null;
          status: string | null;
          totalAmount: number | null;
        };
        Insert: {
          createdat?: string | null;
          id?: string;
          phoneNumber?: string | null;
          profiles?: string | null;
          status?: string | null;
          totalAmount?: number | null;
        };
        Update: {
          createdat?: string | null;
          id?: string;
          phoneNumber?: string | null;
          profiles?: string | null;
          status?: string | null;
          totalAmount?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_profiles_fkey";
            columns: ["profiles"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["profiles_id"];
          }
        ];
      };
      orderitem: {
        Row: {
          id: string;
          menuitemid: string | null;
          orderid: string | null;
          price: number;
          quantity: number;
        };
        Insert: {
          id?: string;
          menuitemid?: string | null;
          orderid?: string | null;
          price: number;
          quantity: number;
        };
        Update: {
          id?: string;
          menuitemid?: string | null;
          orderid?: string | null;
          price?: number;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orderitem_menuitemid_fkey";
            columns: ["menuitemid"];
            isOneToOne: false;
            referencedRelation: "menuItem";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orderitem_orderid_fkey";
            columns: ["orderid"];
            isOneToOne: false;
            referencedRelation: "order";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          name: string | null;
          profiles_id: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          name?: string | null;
          profiles_id: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          name?: string | null;
          profiles_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
      DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
