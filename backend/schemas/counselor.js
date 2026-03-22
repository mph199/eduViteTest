import { z } from 'zod/v4';

export const counselorBookingSchema = z.object({
  student_name: z.string().min(1, 'Name ist erforderlich').max(255).transform((v) => v.trim()),
  student_class: z.string().max(50).optional().nullable().transform((v) => v?.trim() || null),
  email: z.string().email('Ungueltiges E-Mail-Format').max(254).optional().nullable()
    .transform((v) => v?.trim().toLowerCase() || null),
  phone: z.string().max(50).optional().nullable().transform((v) => v?.trim() || null),
  is_urgent: z.boolean().optional().default(false),
  consent_version: z.string().min(1, 'Einwilligung ist erforderlich').max(20),
});
