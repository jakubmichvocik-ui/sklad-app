export type Warehouse = { id: string; name: string };
export type Location = { id: string; warehouse_id: string; code: string; name: string | null };

export type Product = {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  unit: string | null;
  selling_price: number | null;
  min_stock: number | null;
  active: boolean | null;
};