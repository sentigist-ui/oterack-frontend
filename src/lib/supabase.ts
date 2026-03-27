// Supabase client — kept as a stub. App uses localStorage for all data.
// This file exists to avoid import errors in db/ helpers.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string || "https://placeholder.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string || "placeholder";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Type helpers for DB rows ─────────────────────────────────────────────────
export type DbIngredient = {
  id: string;
  name: string;
  unit: string;
  cost_per_unit: number;
  current_quantity: number;
  min_quantity: number;
  category: string;
  supplier_id?: string;
  last_updated: string;
  created_at: string;
};

export type DbRecipe = {
  id: string;
  name: string;
  category: string;
  sub_category: string;
  portion_size: string;
  selling_price: number;
  ingredients: unknown;
  total_cost: number;
  food_cost_percent: number;
  suggested_price: number;
  preparation_time: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type DbSale = {
  id: string;
  date: string;
  items: unknown;
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
  gross_margin: number;
  recorded_by: string;
  shift: string;
  notes?: string;
  created_at: string;
};

export type DbStockMovement = {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  ingredient_unit: string;
  quantity: number;
  type: string;
  user_id: string;
  user_name: string;
  approved_by?: string;
  from_location?: string;
  to_location?: string;
  reason?: string;
  reference?: string;
  timestamp: string;
  unit_cost: number;
  total_cost: number;
  is_flagged: boolean;
  flag_reason?: string;
  created_at: string;
};
