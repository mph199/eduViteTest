/**
 * Choice Service – Geschaeftslogik fuer Groups und Options.
 *
 * Phase 1: CRUD fuer Groups und Options (Admin).
 */

import { db } from '../../../db/database.js';

// ── Erlaubte Statusuebergaenge ──────────────────────────────────────

const STATUS_TRANSITIONS = {
  draft: ['open'],
  open: ['closed'],
  closed: ['archived', 'open'],
  archived: [],
};

// ── Groups ──────────────────────────────────────────────────────────

export async function listGroups() {
  const rows = await db.selectFrom('choice_groups')
    .select([
      'id', 'title', 'status', 'min_choices', 'max_choices',
      'ranking_mode', 'opens_at', 'closes_at', 'created_at', 'updated_at',
    ])
    .orderBy('created_at', 'desc')
    .execute();
  return rows;
}

export async function getGroupById(id) {
  const row = await db.selectFrom('choice_groups')
    .select([
      'id', 'title', 'description', 'status', 'min_choices', 'max_choices',
      'ranking_mode', 'allow_edit_after_submit', 'opens_at', 'closes_at',
      'created_by', 'created_at', 'updated_at',
    ])
    .where('id', '=', id)
    .executeTakeFirst();
  return row || null;
}

export async function createGroup(data, userId) {
  const row = await db.insertInto('choice_groups')
    .values({
      title: data.title,
      description: data.description || null,
      min_choices: data.min_choices,
      max_choices: data.max_choices,
      ranking_mode: data.ranking_mode,
      allow_edit_after_submit: data.allow_edit_after_submit,
      opens_at: data.opens_at || null,
      closes_at: data.closes_at || null,
      created_by: userId,
    })
    .returning(['id', 'title', 'status', 'created_at'])
    .executeTakeFirst();
  return row;
}

export async function updateGroup(id, data) {
  const fields = {};
  if (data.title !== undefined) fields.title = data.title;
  if (data.description !== undefined) fields.description = data.description;
  if (data.min_choices !== undefined) fields.min_choices = data.min_choices;
  if (data.max_choices !== undefined) fields.max_choices = data.max_choices;
  if (data.ranking_mode !== undefined) fields.ranking_mode = data.ranking_mode;
  if (data.allow_edit_after_submit !== undefined) fields.allow_edit_after_submit = data.allow_edit_after_submit;
  if (data.opens_at !== undefined) fields.opens_at = data.opens_at;
  if (data.closes_at !== undefined) fields.closes_at = data.closes_at;
  fields.updated_at = new Date();

  const row = await db.updateTable('choice_groups')
    .set(fields)
    .where('id', '=', id)
    .returning(['id', 'title', 'status', 'updated_at'])
    .executeTakeFirst();
  return row || null;
}

export async function changeGroupStatus(id, newStatus) {
  const group = await getGroupById(id);
  if (!group) return { error: 'Wahldach nicht gefunden', status: 404 };

  const allowed = STATUS_TRANSITIONS[group.status];
  if (!allowed || !allowed.includes(newStatus)) {
    return {
      error: `Statuswechsel von "${group.status}" nach "${newStatus}" nicht erlaubt`,
      status: 400,
    };
  }

  const row = await db.updateTable('choice_groups')
    .set({ status: newStatus, updated_at: new Date() })
    .where('id', '=', id)
    .returning(['id', 'status', 'updated_at'])
    .executeTakeFirst();
  return { data: row };
}

// ── Options ─────────────────────────────────────────────────────────

export async function listOptions(groupId) {
  const rows = await db.selectFrom('choice_options')
    .select(['id', 'group_id', 'title', 'description', 'sort_order', 'is_active', 'created_at'])
    .where('group_id', '=', groupId)
    .orderBy('sort_order', 'asc')
    .orderBy('title', 'asc')
    .execute();
  return rows;
}

export async function createOption(groupId, data) {
  const row = await db.insertInto('choice_options')
    .values({
      group_id: groupId,
      title: data.title,
      description: data.description || null,
      sort_order: data.sort_order ?? 0,
    })
    .returning(['id', 'group_id', 'title', 'sort_order', 'is_active', 'created_at'])
    .executeTakeFirst();
  return row;
}

export async function updateOption(id, data) {
  const fields = {};
  if (data.title !== undefined) fields.title = data.title;
  if (data.description !== undefined) fields.description = data.description;
  if (data.sort_order !== undefined) fields.sort_order = data.sort_order;
  if (data.is_active !== undefined) fields.is_active = data.is_active;

  const row = await db.updateTable('choice_options')
    .set(fields)
    .where('id', '=', id)
    .returning(['id', 'group_id', 'title', 'description', 'sort_order', 'is_active'])
    .executeTakeFirst();
  return row || null;
}

export async function deactivateOption(id) {
  const row = await db.updateTable('choice_options')
    .set({ is_active: false })
    .where('id', '=', id)
    .returning(['id', 'is_active'])
    .executeTakeFirst();
  return row || null;
}

// ── Participants ────────────────────────────────────────────────────

export async function listParticipants(groupId) {
  const rows = await db.selectFrom('choice_participants')
    .select([
      'id', 'group_id', 'first_name', 'last_name', 'email',
      'audience_label', 'is_active', 'created_at',
    ])
    .where('group_id', '=', groupId)
    .orderBy('last_name', 'asc')
    .orderBy('first_name', 'asc')
    .execute();
  return rows;
}

export async function getExistingEmails(groupId) {
  const rows = await db.selectFrom('choice_participants')
    .select('email')
    .where('group_id', '=', groupId)
    .execute();
  return new Set(rows.map((r) => r.email.toLowerCase()));
}

export async function createParticipant(groupId, data) {
  const row = await db.insertInto('choice_participants')
    .values({
      group_id: groupId,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      audience_label: data.audience_label || null,
    })
    .returning([
      'id', 'group_id', 'first_name', 'last_name', 'email',
      'audience_label', 'is_active', 'created_at',
    ])
    .executeTakeFirst();
  return row;
}

export async function bulkInsertParticipants(groupId, participants) {
  const BATCH_SIZE = 100;
  const inserted = [];

  await db.transaction().execute(async (trx) => {
    for (let i = 0; i < participants.length; i += BATCH_SIZE) {
      const batch = participants.slice(i, i + BATCH_SIZE).map((p) => ({
        group_id: groupId,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        audience_label: p.audience_label || null,
      }));

      const rows = await trx.insertInto('choice_participants')
        .values(batch)
        .returning(['id', 'first_name', 'last_name', 'email', 'audience_label'])
        .execute();
      inserted.push(...rows);
    }
  });

  return inserted;
}

export async function updateParticipant(id, data) {
  const fields = {};
  if (data.first_name !== undefined) fields.first_name = data.first_name;
  if (data.last_name !== undefined) fields.last_name = data.last_name;
  if (data.email !== undefined) fields.email = data.email;
  if (data.audience_label !== undefined) fields.audience_label = data.audience_label;

  if (!Object.keys(fields).length) return null;

  const row = await db.updateTable('choice_participants')
    .set(fields)
    .where('id', '=', id)
    .returning([
      'id', 'group_id', 'first_name', 'last_name', 'email',
      'audience_label', 'is_active',
    ])
    .executeTakeFirst();
  return row || null;
}

export async function deactivateParticipant(id) {
  const row = await db.updateTable('choice_participants')
    .set({ is_active: false })
    .where('id', '=', id)
    .returning(['id', 'is_active'])
    .executeTakeFirst();
  return row || null;
}
