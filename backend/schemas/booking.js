import { z } from 'zod/v4';

const emailSchema = z.string().email('Ungueltiges E-Mail-Format').max(254).transform((v) => v.trim().toLowerCase());

export const bookingSchema = z.object({
  teacherId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
  slotId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
  time: z.string().max(20).optional(),
  date: z.string().max(20).optional(),
  name: z.string().min(1, 'Name erforderlich').max(255).transform((v) => v.trim()),
  email: emailSchema,
  consent_version: z.string().min(1, 'Einwilligung ist erforderlich').max(20),
});

export const bookingRequestSchema = z.object({
  teacherId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
  requestedTime: z.string().min(1, 'Zeitfenster erforderlich').max(20).transform((v) => v.trim()),
  visitorType: z.enum(['parent', 'company'], { message: 'visitorType muss parent oder company sein' }),
  className: z.string().min(1, 'Klasse erforderlich').max(100).transform((v) => v.trim()),
  email: emailSchema,
  message: z.string().max(2000).optional().default(''),
  consent_version: z.string().min(1, 'Einwilligung ist erforderlich').max(20),
  parentName: z.string().max(255).optional(),
  studentName: z.string().max(255).optional(),
  companyName: z.string().max(255).optional(),
  traineeName: z.string().max(255).optional(),
  representativeName: z.string().max(255).optional(),
});

export const consentWithdrawSchema = z.object({
  email: emailSchema,
  module: z.enum(['elternsprechtag', 'schulsozialarbeit', 'beratungslehrer', 'choice'], {
    message: 'Gültiges Modul erforderlich (elternsprechtag, schulsozialarbeit, beratungslehrer, choice)',
  }),
});
