export interface KosikProduct {
  id: number;
  name: string;
  cleanName: string;
  brand: { id: number; name: string; url: string } | null;
  price: number;
  unit: string;
  url: string;
  productQuantity: { prefix: string; value: number; unit: string };
  pricePerUnit: { price: number; unit: string };
  maxInCart: number;
  unitStep: number;
  availability: { date: string; quantity: number }[];
  isSale: boolean;
  percentageDiscount: number;
  mainCategory: { id: number; name: string } | null;
}

export interface KosikSuggestResponse {
  products: { items: KosikProduct[] };
  categories: { items: unknown[] };
  brands: { items: unknown[] };
}
