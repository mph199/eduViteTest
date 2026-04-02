/**
 * Zod-Schemas fuer das Choice-Modul (Differenzierungswahl).
 *
 * Validiert Admin-Eingaben fuer Groups, Options und Statuswechsel.
 */

import { z } from 'zod/v4';

// ── Group Schemas ───────────────────────────────────────────────────

export const choiceGroupCreateSchema = z.object({
  title: z.string().min(1, 'Titel erforderlich').max(255).transform((v) => v.trim()),
  description: z.string().max(5000).optional().nullable().transform((v) => v?.trim() || null),
  min_choices: z.number().int().min(1).max(20).default(1),
  max_choices: z.number().int().min(1).max(20).default(1),
  ranking_mode: z.enum(['none', 'required']).default('none'),
  allow_edit_after_submit: z.boolean().default(true),
  opens_at: z.string().datetime({ offset: true }).optional().nullable(),
  closes_at: z.string().datetime({ offset: true }).optional().nullable(),
}).refine(
  (data) => data.min_choices <= data.max_choices,
  { message: 'min_choices darf nicht gr\u00f6\u00dfer als max_choices sein' },
);

export const choiceGroupUpdateSchema = z.object({
  title: z.string().min(1, 'Titel erforderlich').max(255).transform((v) => v.trim()).optional(),
  description: z.string().max(5000).nullable().transform((v) => v?.trim() || null).optional(),
  min_choices: z.number().int().min(1).max(20).optional(),
  max_choices: z.number().int().min(1).max(20).optional(),
  ranking_mode: z.enum(['none', 'required']).optional(),
  allow_edit_after_submit: z.boolean().optional(),
  opens_at: z.string().datetime({ offset: true }).nullable().optional(),
  closes_at: z.string().datetime({ offset: true }).nullable().optional(),
}).refine(
  (data) => {
    if (data.min_choices != null && data.max_choices != null) {
      return data.min_choices <= data.max_choices;
    }
    return true;
  },
  { message: 'min_choices darf nicht gr\u00f6\u00dfer als max_choices sein' },
);

export const choiceGroupStatusSchema = z.object({
  status: z.enum(['draft', 'open', 'closed', 'archived'], {
    message: 'Gueltiger Status: draft, open, closed, archived',
  }),
});

// ── Option Schemas ──────────────────────────────────────────────────

export const choiceOptionCreateSchema = z.object({
  title: z.string().min(1, 'Titel erforderlich').max(255).transform((v) => v.trim()),
  description: z.string().max(2000).optional().nullable().transform((v) => v?.trim() || null),
  sort_order: z.number().int().min(0).default(0),
});

export const choiceOptionUpdateSchema = z.object({
  title: z.string().min(1, 'Titel erforderlich').max(255).transform((v) => v.trim()).optional(),
  description: z.string().max(2000).nullable().transform((v) => v?.trim() || null).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});
