import { db } from '../../../db/database.js';

export async function listTeachers() {
  return db.selectFrom('teachers')
    .select(['id', 'first_name', 'last_name', 'name', 'salutation', 'subject', 'available_from', 'available_until'])
    .orderBy('last_name')
    .orderBy('first_name')
    .execute();
}

export async function getTeacherById(teacherId) {
  return db.selectFrom('teachers')
    .select(['id', 'name'])
    .where('id', '=', teacherId)
    .executeTakeFirst() ?? null;
}
