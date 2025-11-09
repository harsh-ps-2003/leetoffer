import { z } from "zod";

export const LeetCodePostSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  vote_count: z.number(),
  comment_count: z.number(),
  view_count: z.number(),
  creation_date: z.date(),
});

export type LeetCodePost = z.infer<typeof LeetCodePostSchema>;
