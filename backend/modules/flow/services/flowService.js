/**
 * Re-export index for flow domain services.
 * Maintains backward compatibility for `import * as flowService from './flowService.js'`.
 */
export { erstelleAktivitaet } from './flowHelpers.js';
export {
    getBildungsgaengeForUser,
    getBildungsgangDetail,
    getAllBildungsgaenge,
    createBildungsgang,
    getBildungsgangMitglieder,
    addBildungsgangMitglied,
    updateBildungsgangMitgliedRolle,
    removeBildungsgangMitglied,
} from './bildungsgangService.js';
export {
    createArbeitspaket,
    getArbeitspaketDetail,
    updateArbeitspaket,
    updateArbeitspaketStatus,
    deleteArbeitspaket,
    abschliessenArbeitspaket,
    wiederaufnehmenArbeitspaket,
    getMitglieder,
    addMitglied,
    updateMitgliedRolle,
    removeMitglied,
    getDashboardDaten,
    getAbteilungsUebersicht,
    getAktivitaeten,
} from './arbeitspaketService.js';
export {
    getAufgaben,
    createAufgabe,
    updateAufgabe,
    updateAufgabeStatus,
    deleteAufgabe,
    getMeineAufgaben,
} from './aufgabeService.js';
export {
    getTagungen,
    createTagung,
    getTagungDetail,
    updateTagung,
    deleteTagung,
    addAgendaPunkt,
    dokumentiereAgendaPunkt,
    getDateien,
    addDateiMetadaten,
    deleteDatei,
} from './tagungService.js';
