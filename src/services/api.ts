/* eslint-disable @typescript-eslint/no-explicit-any */

import { API_BASE } from './apiBase';
import { resolveLogoUrl, resolveBgUrl, resolveTileUrl } from './mediaUtils';

async function uploadFile(endpoint: string, fieldName: string, file: File): Promise<any> {
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (res.status === 401) {
    try { window.dispatchEvent(new Event('auth:logout')); } catch { /* ignore */ }
    throw new Error('Nicht angemeldet (401) – bitte neu einloggen.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload fehlgeschlagen' }));
    throw new Error(err.error || 'Upload fehlgeschlagen');
  }
  return res.json();
}

async function requestJSON(path: string, options: RequestInit = {}) {
  const { headers, ...rest } = options as any;
  const mergedHeaders = { 'Content-Type': 'application/json', ...(headers || {}) } as HeadersInit;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...rest, headers: mergedHeaders, credentials: 'include' });
  } catch {
    throw new Error('Backend nicht erreichbar – läuft das Backend (Port 4000)?');
  }

  const tryParse = async () => {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return { message: text || null } as any;
    }
  };

  if (!response.ok) {
    const data = await tryParse();
    const status = response.status;
    const baseMsg = (data && ((data as any).message || (data as any).error)) || `Fehler ${status}`;
    const detail = data && (data as any).detail;
    const message = detail ? `${baseMsg} (${detail})` : baseMsg;
    if (status === 401) {
      try {
        window.dispatchEvent(new Event('auth:logout'));
      } catch {
        // ignore
      }
      throw new Error('Nicht angemeldet (401) – bitte neu einloggen.');
    }
    throw new Error(typeof message === 'string' ? message : 'Unbekannter Fehler');
  }

  return await tryParse();
}

/**
 * Fetch a raw Response (for binary downloads / streaming).
 * Handles auth-logout on 401 like requestJSON.
 */
async function requestRaw(path: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${API_BASE}${path}`, { ...options, credentials: 'include' });
  if (response.status === 401) {
    try { window.dispatchEvent(new Event('auth:logout')); } catch { /* ignore */ }
    throw new Error('Nicht angemeldet (401) – bitte neu einloggen.');
  }
  if (!response.ok) throw new Error(`Fehler ${response.status}`);
  return response;
}

/**
 * Like requestJSON but does NOT dispatch auth:logout on 401.
 * Used for public endpoints (choice session) that have separate auth.
 */
async function requestPublicJSON(path: string, options: RequestInit = {}) {
  const { headers, ...rest } = options;
  const mergedHeaders = { 'Content-Type': 'application/json', ...((headers as Record<string, string>) || {}) } as HeadersInit;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...rest, headers: mergedHeaders, credentials: 'include' });
  } catch {
    throw new Error('Backend nicht erreichbar');
  }

  const tryParse = async () => {
    const text = await response.text();
    try { return text ? JSON.parse(text) : null; } catch { return { message: text || null } as any; }
  };

  if (!response.ok) {
    const data = await tryParse();
    const message = (data && ((data as any).message || (data as any).error)) || `Fehler ${response.status}`;
    throw Object.assign(new Error(typeof message === 'string' ? message : 'Unbekannter Fehler'), { status: response.status });
  }

  return await tryParse();
}

/**
 * Shared admin methods for counselor modules (BL / SSW).
 * Avoids duplication of getAdminAppointments, deleteAppointments, getAdminCounselorSchedule.
 */
function counselorAdminApi(prefix: string) {
  return {
    async getAdminAppointments(counselorId: number, dateFrom: string, dateUntil: string) {
      return requestJSON(`/${prefix}/admin/appointments?counselor_id=${encodeURIComponent(counselorId)}&date_from=${encodeURIComponent(dateFrom)}&date_until=${encodeURIComponent(dateUntil)}`);
    },
    async deleteAppointments(ids: number[]) {
      return requestJSON(`/${prefix}/admin/appointments`, {
        method: 'DELETE',
        body: JSON.stringify({ ids }),
      });
    },
    async getAdminCounselorSchedule(counselorId: number) {
      return requestJSON(`/${prefix}/admin/counselors/${encodeURIComponent(counselorId)}/schedule`);
    },
  };
}

const api = {
  // Public endpoints
  events: {
    async getActive() {
      return requestJSON('/events/active');
    },
    async getUpcoming() {
      return requestJSON('/events/upcoming');
    },
  },
  bookings: {
    async verifyEmail(token: string) {
      const safe = encodeURIComponent(String(token || ''));
      return requestJSON(`/bookings/verify/${safe}`);
    },
  },
  async getTeachers() {
    const res = await requestJSON('/teachers');
    return (res && (res as any).teachers) || [];
  },
  async getSlots(teacherId: number, eventId?: number | null) {
    const ev = eventId ? `&eventId=${encodeURIComponent(String(eventId))}` : '';
    const res = await requestJSON(`/slots?teacherId=${encodeURIComponent(String(teacherId))}${ev}`);
    return (res && (res as any).slots) || [];
  },
  async createBooking(slotId: number, formData: any) {
    return requestJSON('/bookings', {
      method: 'POST',
      body: JSON.stringify({ slotId, ...formData }),
    });
  },

  async createBookingRequest(teacherId: number, requestedTime: string, formData: any) {
    return requestJSON('/booking-requests', {
      method: 'POST',
      body: JSON.stringify({ teacherId, requestedTime, ...formData }),
    });
  },
  // Auth endpoints
  auth: {
    async login(username: string, password: string) {
      return requestJSON('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
    },
    async verify() {
      try {
        const data = await requestJSON('/auth/verify');
        return data || { authenticated: false } as any;
      } catch {
        return { authenticated: false } as any;
      }
    },
    async logout() {
      return requestJSON('/auth/logout', { method: 'DELETE' });
    },
    async getProviders() {
      try {
        const res = await requestJSON('/auth/providers');
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
  },

  // Admin endpoints
  admin: {
    async getBookings() {
      const res = await requestJSON('/admin/bookings');
      return (res && (res as any).bookings) || [];
    },
    async cancelBooking(bookingId: number, cancellationMessage: string) {
      return requestJSON(`/admin/bookings/${bookingId}`, {
        method: 'DELETE',
        body: JSON.stringify({ cancellationMessage }),
      });
    },
    async getTeachers() {
      const res = await requestJSON('/admin/teachers');
      return (res && (res as any).teachers) || [];
    },
    async createTeacher(payload: any) {
      return requestJSON('/admin/teachers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async updateTeacher(id: number, payload: any) {
      return requestJSON(`/admin/teachers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    async deleteTeacher(id: number) {
      return requestJSON(`/admin/teachers/${id}`, { method: 'DELETE'});
    },
    async getTeacherBL(teacherId: number) {
      return requestJSON(`/admin/teachers/${teacherId}/bl`);
    },
    async getTeacherSSW(teacherId: number) {
      return requestJSON(`/admin/teachers/${teacherId}/ssw`);
    },
    async importTeachersCSV(file: File) {
      return uploadFile('/admin/teachers/import-csv', 'file', file);
    },
    async getSlots() {
      return requestJSON('/admin/slots');
    },
    async createSlot(payload: any) {
      return requestJSON('/admin/slots', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async updateSlot(id: number, payload: any) {
      return requestJSON(`/admin/slots/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    async deleteSlot(id: number) {
      return requestJSON(`/admin/slots/${id}`, { method: 'DELETE'});
    },
    async generateTeacherSlots(id: number) {
      return requestJSON(`/admin/teachers/${id}/generate-slots`, { method: 'POST'});
    },
    async resetTeacherLogin(id: number) {
      return requestJSON(`/admin/teachers/${id}/reset-login`, { method: 'PUT'});
    },

    // Events
    async getEvents() {
      const res = await requestJSON('/admin/events');
      return (res && (res as any).events) || [];
    },
    async createEvent(payload: any) {
      return requestJSON('/admin/events', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async updateEvent(id: number, patch: any) {
      return requestJSON(`/admin/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
    },
    async deleteEvent(id: number) {
      return requestJSON(`/admin/events/${id}`, { method: 'DELETE'});
    },
    async getEventStats(eventId: number) {
      return requestJSON(`/admin/events/${eventId}/stats`);
    },
    async generateEventSlots(eventId: number, payload: any) {
      return requestJSON(`/admin/events/${eventId}/generate-slots`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    // Users / Roles
    async getUsers() {
      const res = await requestJSON('/admin/users');
      return (res && (res as any).users) || [];
    },
    async updateUserRole(id: number, role: string) {
      const res = await requestJSON(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      return (res && (res as any).user) || null;
    },
    async updateUserModules(id: number, modules: string[], force = false) {
      // 409 = conflict (counselor has appointments) — return data instead of throwing
      const response = await fetch(`${API_BASE}/admin/users/${id}/modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ modules, force }),
      });
      const data = await response.json();
      if (response.status === 409) return data;
      if (response.status === 401) {
        try { window.dispatchEvent(new Event('auth:logout')); } catch { /* ignore */ }
        throw new Error('Nicht angemeldet (401) – bitte neu einloggen.');
      }
      if (!response.ok) throw new Error(data?.error || `Fehler ${response.status}`);
      return data;
    },
    async getUserAdminAccess(id: number) {
      return requestJSON(`/admin/users/${id}/admin-access`);
    },
    async updateUserAdminAccess(id: number, adminModules: string[]) {
      return requestJSON(`/admin/users/${id}/admin-access`, {
        method: 'PUT',
        body: JSON.stringify({ adminModules }),
      });
    },
  },

  // Teacher endpoints
  teacher: {
    async getBookings() {
      const res = await requestJSON('/teacher/bookings');
      return (res && (res as any).bookings) || [];
    },
    async getSlots() {
      const res = await requestJSON('/teacher/slots');
      return (res && (res as any).slots) || [];
    },
    async getInfo() {
      const res = await requestJSON('/teacher/info');
      return (res && (res as any).teacher) || null;
    },
    async cancelBooking(bookingId: number, cancellationMessage: string) {
      return requestJSON(`/teacher/bookings/${bookingId}`, {
        method: 'DELETE',
        body: JSON.stringify({ cancellationMessage }),
      });
    },
    async acceptBooking(bookingId: number) {
      return requestJSON(`/teacher/bookings/${bookingId}/accept`, { method: 'PUT'});
    },

    async getRequests() {
      const res = await requestJSON('/teacher/requests');
      return (res && (res as any).requests) || [];
    },

    async acceptRequest(requestId: number, payload?: { times?: string[]; teacherMessage?: string }) {
      const safeId = encodeURIComponent(String(requestId));
      return requestJSON(`/teacher/requests/${safeId}/accept`, {
        method: 'PUT',
        body: JSON.stringify(payload || {}),
      });
    },

    async declineRequest(requestId: number) {
      const safeId = encodeURIComponent(String(requestId));
      return requestJSON(`/teacher/requests/${safeId}/decline`, {
        method: 'PUT',
        body: JSON.stringify({}),
      });
    },
    async changePassword(currentPassword: string, newPassword: string) {
      return requestJSON('/teacher/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },

    async getCalendarToken() {
      return requestJSON('/teacher/calendar-token');
    },
    async createCalendarToken() {
      return requestJSON('/teacher/calendar-token', { method: 'POST' });
    },
    async rotateCalendarToken() {
      return requestJSON('/teacher/calendar-token/rotate', { method: 'POST' });
    },
    async deleteCalendarToken() {
      return requestJSON('/teacher/calendar-token', { method: 'DELETE' });
    },
  },

  // Beratungslehrer (counselor) endpoints
  bl: {
    async getProfile() {
      return requestJSON('/bl/counselor/profile');
    },
    async getSchedule() {
      return requestJSON('/bl/counselor/schedule');
    },
    async updateSchedule(schedule: { weekday: number; start_time: string; end_time: string; active: boolean }[]) {
      return requestJSON('/bl/counselor/schedule', {
        method: 'PUT',
        body: JSON.stringify({ schedule }),
      });
    },
    async getAppointments(params: { date_from?: string; date_until?: string; status?: string } = {}) {
      const qs = new URLSearchParams();
      if (params.date_from) qs.set('date_from', params.date_from);
      if (params.date_until) qs.set('date_until', params.date_until);
      if (params.status) qs.set('status', params.status);
      const query = qs.toString();
      return requestJSON(`/bl/counselor/appointments${query ? `?${query}` : ''}`);
    },
    async generateSlots(counselorId: number, dateFrom: string, dateUntil: string) {
      return requestJSON('/bl/counselor/generate-slots', {
        method: 'POST',
        body: JSON.stringify({ counselor_id: counselorId, date_from: dateFrom, date_until: dateUntil }),
      });
    },
    async confirmAppointment(id: number) {
      return requestJSON(`/bl/counselor/appointments/${encodeURIComponent(id)}/confirm`, {
        method: 'PUT',
      });
    },
    async cancelAppointment(id: number) {
      return requestJSON(`/bl/counselor/appointments/${encodeURIComponent(id)}/cancel`, {
        method: 'PUT',
      });
    },
    // Calendar token
    async getCalendarToken() {
      return requestJSON('/bl/counselor/calendar-token');
    },
    async createCalendarToken() {
      return requestJSON('/bl/counselor/calendar-token', { method: 'POST' });
    },
    async rotateCalendarToken() {
      return requestJSON('/bl/counselor/calendar-token/rotate', { method: 'POST' });
    },
    async deleteCalendarToken() {
      return requestJSON('/bl/counselor/calendar-token', { method: 'DELETE' });
    },
    // Admin-only
    async getAdminCounselors() {
      return requestJSON('/bl/admin/counselors');
    },
    ...counselorAdminApi('bl'),
  },

  // Schulsozialarbeit (SSW) endpoints
  ssw: {
    // Admin
    async getAdminCounselors() {
      return requestJSON('/ssw/admin/counselors');
    },
    async createCounselor(payload: any) {
      return requestJSON('/ssw/admin/counselors', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async updateCounselor(id: number, payload: any) {
      return requestJSON(`/ssw/admin/counselors/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    async deleteCounselor(id: number) {
      return requestJSON(`/ssw/admin/counselors/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
    // Calendar token
    async getCalendarToken() {
      return requestJSON('/ssw/counselor/calendar-token');
    },
    async createCalendarToken() {
      return requestJSON('/ssw/counselor/calendar-token', { method: 'POST' });
    },
    async rotateCalendarToken() {
      return requestJSON('/ssw/counselor/calendar-token/rotate', { method: 'POST' });
    },
    async deleteCalendarToken() {
      return requestJSON('/ssw/counselor/calendar-token', { method: 'DELETE' });
    },
    ...counselorAdminApi('ssw'),
    async updateAdminCounselorSchedule(counselorId: number, schedule: { weekday: number; start_time: string; end_time: string; active: boolean }[]) {
      return requestJSON(`/ssw/admin/counselors/${encodeURIComponent(counselorId)}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({ schedule }),
      });
    },
    // Counselor self-service
    async getProfile() {
      return requestJSON('/ssw/counselor/profile');
    },
    async getSchedule() {
      return requestJSON('/ssw/counselor/schedule');
    },
    async updateSchedule(schedule: { weekday: number; start_time: string; end_time: string; active: boolean }[]) {
      return requestJSON('/ssw/counselor/schedule', {
        method: 'PUT',
        body: JSON.stringify({ schedule }),
      });
    },
    async getAppointments(params: { date?: string; date_from?: string; date_until?: string; status?: string } = {}) {
      const qs = new URLSearchParams();
      if (params.date) qs.set('date', params.date);
      if (params.date_from) qs.set('date_from', params.date_from);
      if (params.date_until) qs.set('date_until', params.date_until);
      if (params.status) qs.set('status', params.status);
      const query = qs.toString();
      return requestJSON(`/ssw/counselor/appointments${query ? `?${query}` : ''}`);
    },
    async generateSlots(counselorId: number, dateFrom: string, dateUntil: string) {
      return requestJSON(`/ssw/admin/counselors/${encodeURIComponent(counselorId)}/generate-slots`, {
        method: 'POST',
        body: JSON.stringify({ date_from: dateFrom, date_until: dateUntil }),
      });
    },
    async counselorGenerateSlots(counselorId: number, dateFrom: string, dateUntil: string) {
      return requestJSON('/ssw/counselor/generate-slots', {
        method: 'POST',
        body: JSON.stringify({ counselor_id: counselorId, date_from: dateFrom, date_until: dateUntil }),
      });
    },
    async confirmAppointment(id: number) {
      return requestJSON(`/ssw/counselor/appointments/${encodeURIComponent(id)}/confirm`, {
        method: 'PUT',
      });
    },
    async cancelAppointment(id: number) {
      return requestJSON(`/ssw/counselor/appointments/${encodeURIComponent(id)}/cancel`, {
        method: 'PUT',
      });
    },
  },

  // Choice (Differenzierungswahl) – Admin endpoints
  choice: {
    // Groups
    async listGroups() {
      const res = await requestJSON('/choice/admin/groups');
      return Array.isArray(res) ? res : [];
    },
    async getGroup(id: string) {
      return requestJSON(`/choice/admin/groups/${encodeURIComponent(id)}`);
    },
    async createGroup(payload: Record<string, unknown>) {
      return requestJSON('/choice/admin/groups', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async updateGroup(id: string, payload: Record<string, unknown>) {
      return requestJSON(`/choice/admin/groups/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    async changeGroupStatus(id: string, status: string) {
      return requestJSON(`/choice/admin/groups/${encodeURIComponent(id)}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
    },
    // Options
    async listOptions(groupId: string) {
      const res = await requestJSON(`/choice/admin/groups/${encodeURIComponent(groupId)}/options`);
      return Array.isArray(res) ? res : [];
    },
    async createOption(groupId: string, payload: { title: string; description?: string; sort_order?: number }) {
      return requestJSON(`/choice/admin/groups/${encodeURIComponent(groupId)}/options`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async updateOption(id: string, payload: Record<string, unknown>) {
      return requestJSON(`/choice/admin/options/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    async deactivateOption(id: string) {
      return requestJSON(`/choice/admin/options/${encodeURIComponent(id)}/deactivate`, {
        method: 'POST',
      });
    },
    // Participants
    async listParticipants(groupId: string) {
      const res = await requestJSON(`/choice/admin/groups/${encodeURIComponent(groupId)}/participants`);
      return Array.isArray(res) ? res : [];
    },
    async createParticipant(groupId: string, payload: { first_name: string; last_name: string; email: string; audience_label?: string }) {
      return requestJSON(`/choice/admin/groups/${encodeURIComponent(groupId)}/participants`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async importParticipantsCSV(groupId: string, file: File) {
      return uploadFile(`/choice/admin/groups/${encodeURIComponent(groupId)}/participants`, 'file', file);
    },
    async updateParticipant(id: string, payload: Record<string, unknown>) {
      return requestJSON(`/choice/admin/participants/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    async deactivateParticipant(id: string) {
      return requestJSON(`/choice/admin/participants/${encodeURIComponent(id)}/deactivate`, {
        method: 'POST',
      });
    },
    // Submissions
    async listSubmissions(groupId: string) {
      const res = await requestJSON(`/choice/admin/groups/${encodeURIComponent(groupId)}/submissions`);
      return Array.isArray(res) ? res : [];
    },
    async exportSubmissionsCSV(groupId: string) {
      return requestRaw(`/choice/admin/groups/${encodeURIComponent(groupId)}/submissions?format=csv`);
    },
    // Invite
    async sendInvites(groupId: string) {
      return requestJSON(`/choice/admin/groups/${encodeURIComponent(groupId)}/invite`, {
        method: 'POST',
      });
    },
  },

  // Choice – Public endpoints (choice_session cookie, no admin auth)
  choicePublic: {
    async verify(token: string) {
      return requestPublicJSON('/choice/public/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    },
    async requestAccess(email: string, groupId: string) {
      return requestPublicJSON('/choice/public/request-access', {
        method: 'POST',
        body: JSON.stringify({ email, groupId }),
      });
    },
    async getGroup(groupId: string) {
      return requestPublicJSON(`/choice/public/groups/${encodeURIComponent(groupId)}`);
    },
    async getSubmission(groupId: string) {
      return requestPublicJSON(`/choice/public/groups/${encodeURIComponent(groupId)}/submission`);
    },
    async saveDraft(groupId: string, items: { option_id: string; priority: number }[]) {
      return requestPublicJSON(`/choice/public/groups/${encodeURIComponent(groupId)}/submission/draft`, {
        method: 'PUT',
        body: JSON.stringify({ items }),
      });
    },
    async submit(groupId: string, items: { option_id: string; priority: number }[]) {
      return requestPublicJSON(`/choice/public/groups/${encodeURIComponent(groupId)}/submission/submit`, {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
    },
  },

  // Superadmin endpoints
  superadmin: {
    async getEmailBranding() {
      return requestJSON('/superadmin/email-branding');
    },
    async updateEmailBranding(payload: {
      school_name: string;
      logo_url: string;
      primary_color: string;
      footer_text: string;
    }) {
      return requestJSON('/superadmin/email-branding', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    async sendPreviewEmail(to: string) {
      return requestJSON('/superadmin/email-branding/preview', {
        method: 'POST',
        body: JSON.stringify({ to }),
      });
    },
    async uploadLogo(file: File) {
      return uploadFile('/superadmin/logo', 'logo', file);
    },
    resolveLogoUrl,
    // ── Site Branding ──────────────────────────────────
    async getSiteBranding() {
      return requestJSON('/superadmin/site-branding');
    },
    async updateSiteBranding(payload: Record<string, unknown>) {
      return requestJSON('/superadmin/site-branding', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    async uploadTileImage(file: File): Promise<{ tile_url: string }> {
      return uploadFile('/superadmin/tile-image', 'tile', file);
    },
    // ── Text Branding ─────────────────────────────────
    async getTextBranding() {
      return requestJSON('/superadmin/text-branding');
    },
    async updateTextBranding(payload: Record<string, unknown>) {
      return requestJSON('/superadmin/text-branding', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    async uploadBgImage(file: File): Promise<{ bg_url: string }> {
      return uploadFile('/superadmin/bg-image', 'bg', file);
    },
    resolveBgUrl,
    resolveTileUrl,
    // ── Module Configuration ──────────────────────────
    /** All modules (superadmin only) */
    async getModuleConfig(): Promise<{ module_id: string; enabled: boolean }[]> {
      const res = await requestJSON('/superadmin/modules');
      return Array.isArray(res) ? res : [];
    },
    /** Only enabled modules (public, no auth required) */
    async getEnabledModules(): Promise<{ module_id: string; enabled: boolean }[]> {
      const res = await requestJSON('/superadmin/modules/enabled');
      return Array.isArray(res) ? res : [];
    },
    async setModuleEnabled(moduleId: string, enabled: boolean) {
      return requestJSON(`/superadmin/modules/${encodeURIComponent(moduleId)}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
    },
    // ── OAuth Provider Management ─────────────────────
    async getOAuthProviders() {
      const res = await requestJSON('/superadmin/oauth/providers');
      return Array.isArray(res) ? res : [];
    },
    async createOAuthProvider(payload: Record<string, unknown>) {
      return requestJSON('/superadmin/oauth/providers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    async updateOAuthProvider(id: number, payload: Record<string, unknown>) {
      return requestJSON(`/superadmin/oauth/providers/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    },
    async deleteOAuthProvider(id: number) {
      return requestJSON(`/superadmin/oauth/providers/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
  },

  // Flow – Kollaborationsformat
  flow: {
    async getDashboard() {
      return requestJSON('/flow/dashboard');
    },
    async getBildungsgaenge() {
      const res = await requestJSON('/flow/bildungsgaenge');
      return res || [];
    },
    async getBildungsgang(id: number) {
      return requestJSON(`/flow/bildungsgaenge/${id}`);
    },
    async createArbeitspaket(bildungsgangId: number, data: {
      titel: string; istZustand: string; sollZustand: string;
      beteiligteBeschreibung: string;
    }) {
      return requestJSON(`/flow/bildungsgaenge/${bildungsgangId}/arbeitspakete`, {
        method: 'POST', body: JSON.stringify(data),
      });
    },
    async getArbeitspaket(id: number) {
      return requestJSON(`/flow/arbeitspakete/${id}`);
    },
    async updateArbeitspaket(id: number, data: Record<string, unknown>) {
      return requestJSON(`/flow/arbeitspakete/${id}`, {
        method: 'PATCH', body: JSON.stringify(data),
      });
    },
    async updateArbeitspaketStatus(id: number, status: string) {
      return requestJSON(`/flow/arbeitspakete/${id}/status`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      });
    },
    async deleteArbeitspaket(id: number) {
      return requestJSON(`/flow/arbeitspakete/${id}`, { method: 'DELETE' });
    },
    async abschliessenArbeitspaket(id: number, data: {
      abschlussZusammenfassung: string; reflexion?: string | null;
    }) {
      return requestJSON(`/flow/arbeitspakete/${id}/abschliessen`, {
        method: 'POST', body: JSON.stringify(data),
      });
    },
    async wiederaufnehmenArbeitspaket(id: number) {
      return requestJSON(`/flow/arbeitspakete/${id}/wiederaufnehmen`, { method: 'POST' });
    },
    async getMitglieder(paketId: number) {
      const res = await requestJSON(`/flow/arbeitspakete/${paketId}/mitglieder`);
      return res || [];
    },
    async addMitglied(paketId: number, userId: number, rolle: string) {
      return requestJSON(`/flow/arbeitspakete/${paketId}/mitglieder`, {
        method: 'POST', body: JSON.stringify({ userId, rolle }),
      });
    },
    async updateMitgliedRolle(paketId: number, userId: number, rolle: string) {
      return requestJSON(`/flow/arbeitspakete/${paketId}/mitglieder/${userId}`, {
        method: 'PATCH', body: JSON.stringify({ rolle }),
      });
    },
    async removeMitglied(paketId: number, userId: number) {
      return requestJSON(`/flow/arbeitspakete/${paketId}/mitglieder/${userId}`, { method: 'DELETE' });
    },
    async getAufgaben(paketId: number) {
      const res = await requestJSON(`/flow/arbeitspakete/${paketId}/aufgaben`);
      return res || [];
    },
    async createAufgabe(paketId: number, data: {
      titel: string; beschreibung?: string; zustaendig: number;
      deadline?: string | null; tagungId?: number | null;
    }) {
      return requestJSON(`/flow/arbeitspakete/${paketId}/aufgaben`, {
        method: 'POST', body: JSON.stringify(data),
      });
    },
    async updateAufgabe(id: number, data: Record<string, unknown>) {
      return requestJSON(`/flow/aufgaben/${id}`, {
        method: 'PATCH', body: JSON.stringify(data),
      });
    },
    async updateAufgabeStatus(id: number, status: string) {
      return requestJSON(`/flow/aufgaben/${id}/status`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      });
    },
    async deleteAufgabe(id: number) {
      return requestJSON(`/flow/aufgaben/${id}`, { method: 'DELETE' });
    },
    async getMeineAufgaben(filter?: { status?: string; ueberfaellig?: boolean }) {
      const params = new URLSearchParams();
      if (filter?.status) params.set('status', filter.status);
      if (filter?.ueberfaellig) params.set('ueberfaellig', 'true');
      const qs = params.toString();
      const res = await requestJSON(`/flow/aufgaben/meine${qs ? '?' + qs : ''}`);
      return res || [];
    },
    async getTagungen(paketId: number) {
      const res = await requestJSON(`/flow/arbeitspakete/${paketId}/tagungen`);
      return res || [];
    },
    async createTagung(paketId: number, data: {
      titel: string; startAt: string; endAt?: string | null;
      raum?: string | null; teilnehmende: number[];
    }) {
      return requestJSON(`/flow/arbeitspakete/${paketId}/tagungen`, {
        method: 'POST', body: JSON.stringify(data),
      });
    },
    async getTagung(id: number) {
      return requestJSON(`/flow/tagungen/${id}`);
    },
    async updateTagung(id: number, data: Record<string, unknown>) {
      return requestJSON(`/flow/tagungen/${id}`, {
        method: 'PATCH', body: JSON.stringify(data),
      });
    },
    async addAgendaPunkt(tagungId: number, data: {
      titel: string; beschreibung?: string; referenzierteAufgabeId?: number | null;
    }) {
      return requestJSON(`/flow/tagungen/${tagungId}/agenda`, {
        method: 'POST', body: JSON.stringify(data),
      });
    },
    async dokumentiereAgendaPunkt(tagungId: number, punktId: number, data: {
      ergebnis?: string; entscheidung?: string;
    }) {
      return requestJSON(`/flow/tagungen/${tagungId}/agenda/${punktId}`, {
        method: 'PATCH', body: JSON.stringify(data),
      });
    },
    async createAufgabeAusAgenda(tagungId: number, punktId: number, data: {
      titel: string; zustaendig: number; deadline?: string | null;
    }) {
      return requestJSON(`/flow/tagungen/${tagungId}/agenda/${punktId}/aufgaben`, {
        method: 'POST', body: JSON.stringify(data),
      });
    },
    async getDateien(paketId: number) {
      const res = await requestJSON(`/flow/arbeitspakete/${paketId}/dateien`);
      return res || [];
    },
    async addDateiMetadaten(paketId: number, data: {
      name: string; originalName: string; mimeType: string;
      groesse: number; externalUrl?: string;
    }) {
      return requestJSON(`/flow/arbeitspakete/${paketId}/dateien`, {
        method: 'POST', body: JSON.stringify(data),
      });
    },
    async deleteDatei(id: number) {
      return requestJSON(`/flow/dateien/${id}`, { method: 'DELETE' });
    },
    async getAbteilungsPakete() {
      const res = await requestJSON('/flow/abteilung/arbeitspakete');
      return res || [];
    },
    // Admin: Verfuegbare User
    async adminGetUsers() {
      const res = await requestJSON('/flow/admin/users');
      return Array.isArray(res) ? res : [];
    },
    // Admin: Bildungsgang-Verwaltung
    async adminGetBildungsgaenge() {
      const res = await requestJSON('/flow/admin/bildungsgaenge');
      return Array.isArray(res) ? res : [];
    },
    async adminCreateBildungsgang(data: { name: string; erlaubtMitgliedernPaketErstellung?: boolean }) {
      return requestJSON('/flow/admin/bildungsgaenge', {
        method: 'POST', body: JSON.stringify(data),
      });
    },
    async adminGetBildungsgangMitglieder(bildungsgangId: number) {
      const res = await requestJSON(`/flow/admin/bildungsgaenge/${bildungsgangId}/mitglieder`);
      return Array.isArray(res) ? res : [];
    },
    async adminAddBildungsgangMitglied(bildungsgangId: number, userId: number, rolle: string) {
      return requestJSON(`/flow/admin/bildungsgaenge/${bildungsgangId}/mitglieder`, {
        method: 'POST', body: JSON.stringify({ userId, rolle }),
      });
    },
    async adminUpdateBildungsgangMitgliedRolle(bildungsgangId: number, userId: number, rolle: string) {
      return requestJSON(`/flow/admin/bildungsgaenge/${bildungsgangId}/mitglieder/${userId}`, {
        method: 'PATCH', body: JSON.stringify({ rolle }),
      });
    },
    async adminRemoveBildungsgangMitglied(bildungsgangId: number, userId: number) {
      return requestJSON(`/flow/admin/bildungsgaenge/${bildungsgangId}/mitglieder/${userId}`, { method: 'DELETE' });
    },
    async getAktivitaeten(paketId: number) {
      const res = await requestJSON(`/flow/arbeitspakete/${paketId}/aktivitaeten`);
      return res || [];
    },
  },

  // Data Subject / DSGVO (Art. 15-21)
  dataSubject: {
    async search(email: string) {
      return requestJSON(`/admin/data-subject/search?email=${encodeURIComponent(email)}`);
    },
    async exportData(email: string, format: 'json' | 'csv' = 'json') {
      return requestRaw(`/admin/data-subject/export?email=${encodeURIComponent(email)}&format=${format}`);
    },
    async deleteData(email: string) {
      return requestJSON(`/admin/data-subject?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
    },
    async correctData(email: string, corrections: Record<string, string>) {
      return requestJSON(`/admin/data-subject?email=${encodeURIComponent(email)}`, {
        method: 'PATCH',
        body: JSON.stringify({ corrections }),
      });
    },
    async restrict(email: string, restricted: boolean) {
      return requestJSON(`/admin/data-subject/restrict?email=${encodeURIComponent(email)}`, {
        method: 'POST',
        body: JSON.stringify({ restricted }),
      });
    },
    async getAuditLog(params: { from?: string; to?: string; action?: string; table?: string; page?: number; limit?: number } = {}) {
      const searchParams = new URLSearchParams();
      if (params.from) searchParams.set('from', params.from);
      if (params.to) searchParams.set('to', params.to);
      if (params.action) searchParams.set('action', params.action);
      if (params.table) searchParams.set('table', params.table);
      if (params.page) searchParams.set('page', String(params.page));
      if (params.limit) searchParams.set('limit', String(params.limit));
      return requestJSON(`/admin/audit-log?${searchParams.toString()}`);
    },
    async exportAuditLog(from?: string, to?: string) {
      const searchParams = new URLSearchParams({ format: 'csv' });
      if (from) searchParams.set('from', from);
      if (to) searchParams.set('to', to);
      return requestRaw(`/admin/audit-log/export?${searchParams.toString()}`);
    },
  },
};

export { requestJSON };
export default api;
