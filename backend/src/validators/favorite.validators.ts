import { z } from "zod";

export const addFavoriteSchema = z.object({
  productId: z.string().min(1),
});
