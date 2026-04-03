import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(50),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  timezone: z.string().default("UTC"),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  logo_url: z.string().url().optional().nullable(),
  timezone: z.string().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email("Email inválido"),
  role: z.enum(["admin", "editor", "client", "team_member"]),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
