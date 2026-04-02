/**
 * Choice Service – Geschaeftslogik fuer Groups, Options, Participants und Submissions.
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

// ── Submissions ─────────────────────────────────────────────────────

/**
 * Prüft ob eine Submission erlaubt ist (Group open, Zeitfenster, Participant aktiv).
 * Gibt { group, participant } bei Erfolg oder { error, status } bei Fehler zurück.
 */
export async function validateSubmissionAccess(groupId, participantId) {
  const group = await getGroupById(groupId);
  if (!group) return { error: 'Wahldach nicht gefunden', status: 404 };
  if (group.status !== 'open') return { error: 'Diese Wahl ist derzeit nicht geöffnet', status: 403 };

  // Zeitfenster prüfen (NULL = kein Limit)
  const now = new Date();
  if (group.opens_at && new Date(group.opens_at) > now) {
    return { error: 'Die Wahl ist noch nicht geöffnet', status: 403 };
  }
  if (group.closes_at && new Date(group.closes_at) < now) {
    return { error: 'Die Wahl ist bereits geschlossen', status: 403 };
  }

  const participant = await db.selectFrom('choice_participants')
    .select(['id', 'group_id', 'is_active'])
    .where('id', '=', participantId)
    .where('group_id', '=', groupId)
    .executeTakeFirst();

  if (!participant || !participant.is_active) {
    return { error: 'Teilnehmer nicht gefunden oder deaktiviert', status: 403 };
  }

  return { group, participant };
}

/**
 * Validiert die gewählten Items gegen Gruppenregeln.
 */
export function validateItems(items, group, activeOptionIds) {
  // Duplikate prüfen
  const optionIds = items.map((i) => i.option_id);
  if (new Set(optionIds).size !== optionIds.length) {
    return { error: 'Doppelte Optionen nicht erlaubt' };
  }

  // Alle Optionen müssen aktiv und zur Gruppe gehören
  for (const id of optionIds) {
    if (!activeOptionIds.has(id)) {
      return { error: 'Ungültige oder deaktivierte Option gewählt' };
    }
  }

  // Anzahl prüfen
  if (items.length < group.min_choices) {
    return { error: `Mindestens ${group.min_choices} Wahl(en) erforderlich` };
  }
  if (items.length > group.max_choices) {
    return { error: `Maximal ${group.max_choices} Wahl(en) erlaubt` };
  }

  // Ranking-Prüfung
  if (group.ranking_mode === 'required') {
    const priorities = items.map((i) => i.priority).sort((a, b) => a - b);
    const expected = Array.from({ length: items.length }, (_, i) => i + 1);
    if (priorities.join(',') !== expected.join(',')) {
      return { error: 'Prioritäten müssen lückenlos von 1 bis N vergeben werden' };
    }
  }

  return null;
}

/**
 * Lädt die aktiven Option-IDs einer Gruppe als Set.
 */
export async function getActiveOptionIds(groupId) {
  const rows = await db.selectFrom('choice_options')
    .select('id')
    .where('group_id', '=', groupId)
    .where('is_active', '=', true)
    .execute();
  return new Set(rows.map((r) => r.id));
}

/**
 * Lädt die eigene Submission eines Teilnehmers mit Items.
 */
export async function getSubmission(groupId, participantId) {
  const submission = await db.selectFrom('choice_submissions')
    .select(['id', 'group_id', 'participant_id', 'status', 'submitted_at', 'created_at', 'updated_at'])
    .where('group_id', '=', groupId)
    .where('participant_id', '=', participantId)
    .executeTakeFirst();

  if (!submission) return null;

  const items = await db.selectFrom('choice_submission_items as si')
    .innerJoin('choice_options as o', 'o.id', 'si.option_id')
    .select(['si.id', 'si.option_id', 'si.priority', 'o.title as option_title', 'o.is_active as option_active'])
    .where('si.submission_id', '=', submission.id)
    .orderBy('si.priority', 'asc')
    .execute();

  return { ...submission, items };
}

/**
 * Speichert einen Entwurf (UPSERT Submission + DELETE/INSERT Items).
 */
export async function saveDraft(groupId, participantId, items, group) {
  return db.transaction().execute(async (trx) => {
    // Bestehende Submission prüfen (mit Lock)
    const existing = await trx.selectFrom('choice_submissions')
      .select(['id', 'status'])
      .where('group_id', '=', groupId)
      .where('participant_id', '=', participantId)
      .forUpdate()
      .executeTakeFirst();

    // allow_edit_after_submit Guard
    if (existing?.status === 'submitted' && !group.allow_edit_after_submit) {
      throw Object.assign(new Error('Abgabe bereits eingereicht und Bearbeitung gesperrt'), { statusCode: 409 });
    }

    // UPSERT Submission – bei bereits eingereichten Abgaben Status beibehalten
    const keepStatus = existing?.status === 'submitted';
    const submission = await trx.insertInto('choice_submissions')
      .values({
        group_id: groupId,
        participant_id: participantId,
        status: 'draft',
      })
      .onConflict((oc) => oc.columns(['group_id', 'participant_id']).doUpdateSet({
        ...(keepStatus ? {} : { status: 'draft' }),
        updated_at: new Date(),
      }))
      .returning(['id', 'status', 'submitted_at', 'updated_at'])
      .executeTakeFirst();

    // Bestehende Items löschen
    await trx.deleteFrom('choice_submission_items')
      .where('submission_id', '=', submission.id)
      .execute();

    // Neue Items einfügen
    if (items.length > 0) {
      await trx.insertInto('choice_submission_items')
        .values(items.map((item) => ({
          submission_id: submission.id,
          option_id: item.option_id,
          priority: item.priority,
        })))
        .execute();
    }

    return submission;
  });
}

/**
 * Gibt eine Wahl final ab (UPSERT mit status=submitted).
 * Prüft allow_edit_after_submit bei bereits eingereichten Abgaben.
 */
export async function submitChoices(groupId, participantId, items, group) {
  return db.transaction().execute(async (trx) => {
    // Bestehende Submission prüfen (mit Lock)
    const existing = await trx.selectFrom('choice_submissions')
      .select(['id', 'status', 'submitted_at'])
      .where('group_id', '=', groupId)
      .where('participant_id', '=', participantId)
      .forUpdate()
      .executeTakeFirst();

    // allow_edit_after_submit Guard
    if (existing?.status === 'submitted' && !group.allow_edit_after_submit) {
      throw Object.assign(new Error('Abgabe bereits eingereicht und Bearbeitung gesperrt'), { statusCode: 409 });
    }

    const now = new Date();
    const submittedAt = existing?.submitted_at || now;

    // UPSERT Submission
    const submission = await trx.insertInto('choice_submissions')
      .values({
        group_id: groupId,
        participant_id: participantId,
        status: 'submitted',
        submitted_at: now,
      })
      .onConflict((oc) => oc.columns(['group_id', 'participant_id']).doUpdateSet({
        status: 'submitted',
        submitted_at: existing?.status === 'submitted' ? submittedAt : now,
        updated_at: now,
      }))
      .returning(['id', 'status', 'submitted_at', 'updated_at'])
      .executeTakeFirst();

    // Items ersetzen
    await trx.deleteFrom('choice_submission_items')
      .where('submission_id', '=', submission.id)
      .execute();

    await trx.insertInto('choice_submission_items')
      .values(items.map((item) => ({
        submission_id: submission.id,
        option_id: item.option_id,
        priority: item.priority,
      })))
      .execute();

    return submission;
  });
}

/**
 * Lädt alle Submissions einer Gruppe (Admin-Export).
 */
export async function listSubmissions(groupId) {
  const submissions = await db.selectFrom('choice_submissions as s')
    .innerJoin('choice_participants as p', 'p.id', 's.participant_id')
    .select([
      's.id', 's.status', 's.submitted_at', 's.updated_at',
      'p.id as participant_id', 'p.first_name', 'p.last_name',
      'p.email', 'p.audience_label',
    ])
    .where('s.group_id', '=', groupId)
    .orderBy('p.last_name', 'asc')
    .orderBy('p.first_name', 'asc')
    .execute();

  if (!submissions.length) return [];

  const submissionIds = submissions.map((s) => s.id);
  const items = await db.selectFrom('choice_submission_items as si')
    .innerJoin('choice_options as o', 'o.id', 'si.option_id')
    .select(['si.submission_id', 'si.option_id', 'si.priority', 'o.title as option_title'])
    .where('si.submission_id', 'in', submissionIds)
    .orderBy('si.priority', 'asc')
    .execute();

  // Items nach submission_id gruppieren
  const itemsBySubmission = new Map();
  for (const item of items) {
    if (!itemsBySubmission.has(item.submission_id)) {
      itemsBySubmission.set(item.submission_id, []);
    }
    itemsBySubmission.get(item.submission_id).push(item);
  }

  return submissions.map((s) => ({
    ...s,
    items: itemsBySubmission.get(s.id) || [],
  }));
}
