import { z } from 'zod/v4';

export const counselorBookingSchema = z.object({
  first_name: z.string().min(1, 'Vorname ist erforderlich').max(100).transform((v) => v.trim()),
  last_name: z.string().min(1, 'Nachname ist erforderlich').max(100).transform((v) => v.trim()),
  student_class: z.string().max(50).optional().nullable().transform((v) => v?.trim() || null),
  email: z.string().email('Ungueltiges E-Mail-Format').max(254).optional().nullable()
    .transform((v) => v?.trim().toLowerCase() || null),
  phone: z.string().max(50).optional().nullable().transform((v) => v?.trim() || null)
    .refine((v) => !v || /^[+\d\s()/-]{3,50}$/.test(v), { message: 'Ungueltige Telefonnummer' }),
  consent_version: z.string().min(1, 'Einwilligung ist erforderlich').max(20),
});
