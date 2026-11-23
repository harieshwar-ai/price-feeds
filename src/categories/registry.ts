import { GPU_CATEGORY_ID, type CommodityCategoryId } from "./gpu-schema.js";

export interface CategoryDefinition {
  id: CommodityCategoryId;
  label: string;
  description: string;
}

const CATEGORIES: CategoryDefinition[] = [
  {
    id: GPU_CATEGORY_ID,
    label: "Graphics cards (GPU)",
    description: "Discrete GPUs — GeForce RTX and similar.",
  },
];

export function listCategories(): CategoryDefinition[] {
  return [...CATEGORIES];
}

export function getCategory(id: CommodityCategoryId): CategoryDefinition {
  const cat = CATEGORIES.find((c) => c.id === id);
  if (!cat) throw new Error(`Unknown category: ${id}`);
  return cat;
}