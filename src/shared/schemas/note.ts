import { z } from "zod";

export const NoteCreateSchema = z.object({
  deck: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

export type NoteCreate = z.infer<typeof NoteCreateSchema>;
