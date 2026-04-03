import { z } from "zod";

export const createPostSchema = z.object({
  socialAccountId: z.string().uuid(),
  format: z.enum(["image", "carousel", "reel", "story", "short", "long_video", "text"]),
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string()).max(30).default([]),
  mediaUrls: z.array(z.string().url()).max(10).default([]),
  assetIds: z.array(z.string().uuid()).max(10).default([]),
  scheduledAt: z.string().datetime(),
  publishMode: z.enum(["auto", "approval"]).default("approval"),
});

export const updatePostSchema = z.object({
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string()).max(30).optional(),
  scheduledAt: z.string().datetime().optional(),
  status: z
    .enum(["draft", "scheduled", "approved", "rejected"])
    .optional(),
});

export const reschedulePostSchema = z.object({
  scheduledAt: z.string().datetime(),
});

export const rejectPostSchema = z.object({
  reason: z.string().min(1, "Debes indicar el motivo del rechazo").max(500),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type RejectPostInput = z.infer<typeof rejectPostSchema>;
