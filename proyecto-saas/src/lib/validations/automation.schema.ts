import { z } from "zod";

const timeSlotSchema = z.object({
  hour: z.number().min(0).max(23),
  minute: z.number().min(0).max(59).default(0),
});

export const createRuleSchema = z.object({
  socialAccountId: z.string().uuid(),
  name: z.string().min(2).max(100),
  postsPerDay: z.number().min(1).max(20).optional(),
  postsPerWeek: z.number().min(1).max(50).optional(),
  allowedDays: z.array(z.number().min(0).max(6)).min(1),
  timeSlots: z.array(timeSlotSchema).min(1).max(10),
  formats: z.array(
    z.enum(["image", "carousel", "reel", "story", "short", "long_video", "text"])
  ).min(1),
  publishMode: z.enum(["auto", "approval"]).default("approval"),
  aiPromptId: z.string().uuid().optional(),
});

export const createAiPromptSchema = z.object({
  name: z.string().min(2).max(100),
  promptText: z.string().min(10).max(2000),
  platform: z.enum(["instagram", "facebook", "youtube"]).optional(),
  format: z.enum(["image", "carousel", "reel", "story", "short", "long_video", "text"]).optional(),
  tone: z.string().max(50).optional(),
  language: z.string().default("es"),
  useHashtags: z.boolean().default(true),
  useEmojis: z.boolean().default(true),
  isTemplate: z.boolean().default(false),
});

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type CreateAiPromptInput = z.infer<typeof createAiPromptSchema>;
