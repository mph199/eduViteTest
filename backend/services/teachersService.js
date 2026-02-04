import { supabase } from '../config/supabase.js';

export async function listTeachers() {
  // Public endpoint: do not expose private fields (e.g. teacher email)
  // During migrations, some columns might not exist yet; keep endpoint resilient.
  const attempt = async (select) => {
    const { data, error } = await supabase
      .from('teachers')
      .select(select)
      .order('id');
    return { data, error };
  };

  const withSalutation = await attempt('id, name, salutation, subject, system, room');
  if (!withSalutation.error) return withSalutation.data;

  // Fallback (pre-salutation schema)
  const withoutSalutation = await attempt('id, name, subject, system, room');
  if (withoutSalutation.error) throw withoutSalutation.error;
  return withoutSalutation.data;
}

export async function getTeacherById(id) {
  const { data, error } = await supabase.from('teachers').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}
