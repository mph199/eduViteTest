import { z } from 'zod/v4';

export const loginSchema = z.object({
  username: z.string().min(1, 'Benutzername erforderlich').max(255),
  password: z.string().min(1, 'Passwort erforderlich').max(1024, 'Passwort zu lang'),
});
