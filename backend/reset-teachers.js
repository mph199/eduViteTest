import { query } from './config/db.js';

async function resetTeachers() {
  try {
    console.log('Starte Lehrkräfte-Reset...');

    // 1. Alle Slots löschen
    console.log('Lösche alle Slots...');
    await query('DELETE FROM slots');
    console.log('✓ Alle Slots gelöscht');

    // 2. Alle Lehrkräfte löschen
    console.log('Lösche alle Lehrkräfte...');
    await query('DELETE FROM teachers');
    console.log('✓ Alle Lehrkräfte gelöscht');

    // 3. Sequenzen zurücksetzen
    console.log('Setze ID-Sequenzen zurück...');
    try {
      await query('ALTER SEQUENCE teachers_id_seq RESTART WITH 1');
      await query('ALTER SEQUENCE slots_id_seq RESTART WITH 1');
      console.log('✓ ID-Sequenzen zurückgesetzt');
    } catch (seqErr) {
      console.warn('⚠ Warnung: ID-Sequenzen konnten nicht automatisch zurückgesetzt werden.');
      console.warn('Führe folgende SQL-Befehle manuell aus:');
      console.warn('ALTER SEQUENCE teachers_id_seq RESTART WITH 1;');
      console.warn('ALTER SEQUENCE slots_id_seq RESTART WITH 1;');
    }

    console.log('\n✅ Reset erfolgreich abgeschlossen!');
    console.log('Alle Lehrkräfte und Slots wurden gelöscht.');
    
  } catch (error) {
    console.error('❌ Fehler beim Reset:', error);
    process.exit(1);
  }
}

// Script ausführen
resetTeachers();
