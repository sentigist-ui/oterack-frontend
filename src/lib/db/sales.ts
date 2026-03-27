/**
 * Supabase DB API — Sales
 * Replaces localStorage Sales store.
 */
import { supabase } from "@/lib/supabase";
import type { Sale, SaleItem } from "@/types";
import type { DbSale } from "@/lib/supabase";

// ─── Mappers ──────────────────────────────────────────────────────────────────
function toDb(sale: Sale): Omit<DbSale, "created_at"> {
  return {
    id: sale.id,
    date: sale.date,
    items: sale.items,
    total_revenue: sale.totalRevenue,
    total_cost: sale.totalCost,
    gross_profit: sale.grossProfit,
    gross_margin: sale.grossMargin,
    recorded_by: sale.recordedBy,
    shift: sale.shift,
    notes: sale.notes,
  };
}

function fromDb(row: DbSale): Sale {
  return {
    id: row.id,
    date: typeof row.date === "string" ? row.date.split("T")[0] : row.date,
    items: (row.items as SaleItem[]) ?? [],
    totalRevenue: Number(row.total_revenue),
    totalCost: Number(row.total_cost),
    grossProfit: Number(row.gross_profit),
    grossMargin: Number(row.gross_margin),
    recordedBy: row.recorded_by,
    shift: row.shift as Sale["shift"],
    notes: row.notes,
  };
}

// ─── DB Operations ────────────────────────────────────────────────────────────
export const SalesDB = {
  getAll: async (): Promise<Sale[]> => {
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) { console.error("SalesDB.getAll:", error.message); return []; }
    return (data as DbSale[]).map(fromDb);
  },

  getByDate: async (date: string): Promise<Sale[]> => {
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .eq("date", date)
      .order("created_at", { ascending: false });
    if (error) { console.error("SalesDB.getByDate:", error.message); return []; }
    return (data as DbSale[]).map(fromDb);
  },

  getDateRange: async (from: string, to: string): Promise<Sale[]> => {
    const { data, error } = await supabase
      .from("sales")
      .select("*")
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false });
    if (error) { console.error("SalesDB.getDateRange:", error.message); return []; }
    return (data as DbSale[]).map(fromDb);
  },

  add: async (sale: Sale): Promise<boolean> => {
    const { error } = await supabase.from("sales").insert(toDb(sale));
    if (error) { console.error("SalesDB.add:", error.message); return false; }
    return true;
  },

  clearAll: async (): Promise<boolean> => {
    const { error } = await supabase.from("sales").delete().neq("id", "NEVER_MATCHES_anything_0");
    if (error) { console.error("SalesDB.clearAll:", error.message); return false; }
    return true;
  },
};
