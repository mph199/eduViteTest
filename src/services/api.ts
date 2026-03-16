/* eslint-disable @typescript-eslint/no-explicit-any */

const RAW_API_BASE =
  (import.meta as any).env?.VITE_API_URL || '/api';
const API_BASE = String(RAW_API_BASE).replace(/\/+$/, '');
const BACKEND_BASE = API_BASE.replace(/\/api$/, '');

async function uploadFile(endpoint: string, fieldName: string, file: File): Promise<any> {
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
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
    const message = (data && ((data as any).message || (data as any).error)) || `Fehler ${status}`;
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
  async health() {
    return requestJSON('/health');
  },

  // Auth endpoints
  auth: {
    async login(username: string, password: string) {
      return requestJSON('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    },
    async verify() {
      try {
        const data = await requestJSON('/auth/verify', {});
        return data || { authenticated: false } as any;
      } catch {
        return { authenticated: false } as any;
      }
    },
    async logout() {
      return requestJSON('/auth/logout', { method: 'DELETE' });
    },
  },

  // Admin endpoints
  admin: {
    async getBookings() {
      const res = await requestJSON('/admin/bookings', {});
      return (res && (res as any).bookings) || [];
    },
    async cancelBooking(bookingId: number, cancellationMessage: string) {
      return requestJSON(`/admin/bookings/${bookingId}`, {
        method: 'DELETE',

        body: JSON.stringify({ cancellationMessage }),
      });
    },
    async getTeachers() {
      const res = await requestJSON('/admin/teachers', {});
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
      return requestJSON(`/admin/teachers/${teacherId}/bl`, {});
    },
    async importTeachersCSV(file: File) {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${API_BASE}/admin/teachers/import-csv`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error((data as any)?.error || `Fehler ${response.status}`);
      }
      return data;
    },
    async getSlots() {
      return requestJSON('/admin/slots', {});
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
      const res = await requestJSON('/admin/events', {});
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
      return requestJSON(`/admin/events/${eventId}/stats`, {});
    },
    async generateEventSlots(eventId: number, payload: any) {
      return requestJSON(`/admin/events/${eventId}/generate-slots`, {
        method: 'POST',

        body: JSON.stringify(payload),
      });
    },

    // Feedback (anonymous)
    async listFeedback() {
      const res = await requestJSON('/admin/feedback', {});
      return (res && (res as any).feedback) || [];
    },

    async deleteFeedback(id: number) {
      const safeId = encodeURIComponent(String(id));
      return requestJSON(`/admin/feedback/${safeId}`, { method: 'DELETE'});
    },

    // Users / Roles
    async getUsers() {
      const res = await requestJSON('/admin/users', {});
      return (res && (res as any).users) || [];
    },
    async updateUserRole(id: number, role: string) {
      const res = await requestJSON(`/admin/users/${id}`, {
        method: 'PATCH',

        body: JSON.stringify({ role }),
      });
      return (res && (res as any).user) || null;
    },
    async updateUserModules(id: number, modules: string[]) {
      return requestJSON(`/admin/users/${id}/modules`, {
        method: 'PUT',

        body: JSON.stringify({ modules }),
      });
    },
  },

  // Teacher endpoints
  teacher: {
    async getBookings() {
      const res = await requestJSON('/teacher/bookings', {});
      return (res && (res as any).bookings) || [];
    },
    async getSlots() {
      const res = await requestJSON('/teacher/slots', {});
      return (res && (res as any).slots) || [];
    },
    async getInfo() {
      const res = await requestJSON('/teacher/info', {});
      return (res && (res as any).teacher) || null;
    },
    async updateRoom(room: string | null) {
      const payload = { room };
      const res = await requestJSON('/teacher/room', {
        method: 'PUT',

        body: JSON.stringify(payload),
      });
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
      const res = await requestJSON('/teacher/requests', {});
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

    async submitFeedback(message: string) {
      return requestJSON('/teacher/feedback', {
        method: 'POST',

        body: JSON.stringify({ message }),
      });
    },
  },

  // Beratungslehrer (counselor) endpoints
  bl: {
    async getProfile() {
      return requestJSON('/bl/counselor/profile', {});
    },
    async getSchedule() {
      return requestJSON('/bl/counselor/schedule', {});
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
      return requestJSON(`/bl/counselor/appointments${query ? `?${query}` : ''}`, {});
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
    // Admin-only
    async getAdminCounselors() {
      return requestJSON('/bl/admin/counselors', {});
    },
    async getAdminTopics() {
      return requestJSON('/bl/admin/topics', {});
    },
    async createTopic(payload: { name: string; description?: string; sort_order?: number }) {
      return requestJSON('/bl/admin/topics', {
        method: 'POST',

        body: JSON.stringify(payload),
      });
    },
    async updateTopic(id: number, payload: { name: string; description?: string; sort_order?: number; active?: boolean }) {
      return requestJSON(`/bl/admin/topics/${encodeURIComponent(id)}`, {
        method: 'PUT',

        body: JSON.stringify(payload),
      });
    },
    async getAdminAppointments(counselorId: number, dateFrom: string, dateUntil: string) {
      return requestJSON(`/bl/admin/appointments?counselor_id=${encodeURIComponent(counselorId)}&date_from=${encodeURIComponent(dateFrom)}&date_until=${encodeURIComponent(dateUntil)}`, {});
    },
    async deleteAppointments(ids: number[]) {
      return requestJSON('/bl/admin/appointments', {
        method: 'DELETE',

        body: JSON.stringify({ ids }),
      });
    },
    async getAdminCounselorSchedule(counselorId: number) {
      return requestJSON(`/bl/admin/counselors/${encodeURIComponent(counselorId)}/schedule`, {});
    },
  },

  // Schulsozialarbeit (SSW) endpoints
  ssw: {
    // Admin
    async getAdminCounselors() {
      return requestJSON('/ssw/admin/counselors', {});
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
    async getAdminCategories() {
      return requestJSON('/ssw/admin/categories', {});
    },
    async createCategory(payload: { name: string; description?: string; icon?: string; sort_order?: number }) {
      return requestJSON('/ssw/admin/categories', {
        method: 'POST',

        body: JSON.stringify(payload),
      });
    },
    async updateCategory(id: number, payload: { name: string; description?: string; icon?: string; sort_order?: number; active?: boolean }) {
      return requestJSON(`/ssw/admin/categories/${encodeURIComponent(id)}`, {
        method: 'PUT',

        body: JSON.stringify(payload),
      });
    },
    async getAdminStats() {
      return requestJSON('/ssw/admin/stats', {});
    },
    async getAdminAppointments(counselorId: number, dateFrom: string, dateUntil: string) {
      return requestJSON(`/ssw/admin/appointments?counselor_id=${encodeURIComponent(counselorId)}&date_from=${encodeURIComponent(dateFrom)}&date_until=${encodeURIComponent(dateUntil)}`, {});
    },
    async deleteAppointments(ids: number[]) {
      return requestJSON('/ssw/admin/appointments', {
        method: 'DELETE',

        body: JSON.stringify({ ids }),
      });
    },
    async getAdminCounselorSchedule(counselorId: number) {
      return requestJSON(`/ssw/admin/counselors/${encodeURIComponent(counselorId)}/schedule`, {});
    },
    async updateAdminCounselorSchedule(counselorId: number, schedule: { weekday: number; start_time: string; end_time: string; active: boolean }[]) {
      return requestJSON(`/ssw/admin/counselors/${encodeURIComponent(counselorId)}/schedule`, {
        method: 'PUT',

        body: JSON.stringify({ schedule }),
      });
    },
    // Counselor self-service
    async getAppointments(params: { date?: string } = {}) {
      const qs = new URLSearchParams();
      if (params.date) qs.set('date', params.date);
      const query = qs.toString();
      return requestJSON(`/ssw/counselor/appointments${query ? `?${query}` : ''}`, {});
    },
    async generateSlots(counselorId: number, dateFrom: string, dateUntil: string) {
      return requestJSON(`/ssw/admin/counselors/${encodeURIComponent(counselorId)}/generate-slots`, {
        method: 'POST',

        body: JSON.stringify({ date_from: dateFrom, date_until: dateUntil }),
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

  // Superadmin endpoints
  superadmin: {
    async getEmailBranding() {
      return requestJSON('/superadmin/email-branding', {});
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
    /** Resolve a relative upload path to a full URL for preview */
    resolveLogoUrl(logoUrl: string): string {
      if (!logoUrl) return '';
      if (logoUrl.startsWith('http')) return logoUrl;
      if (logoUrl.startsWith('/')) return `${BACKEND_BASE}${logoUrl}`;
      return `${BACKEND_BASE}/uploads/logos/${logoUrl}`;
    },
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
    /** Resolve a background image path to a full URL */
    resolveBgUrl(bgUrl: string): string {
      if (!bgUrl) return '';
      if (bgUrl.startsWith('http')) return bgUrl;
      if (bgUrl.startsWith('/')) return `${BACKEND_BASE}${bgUrl}`;
      return `${BACKEND_BASE}/uploads/bg/${bgUrl}`;
    },
    /** Resolve a tile image path to a full URL */
    resolveTileUrl(tileUrl: string): string {
      if (!tileUrl) return '';
      if (tileUrl.startsWith('http')) return tileUrl;
      if (tileUrl.startsWith('/')) return `${BACKEND_BASE}${tileUrl}`;
      return `${BACKEND_BASE}/uploads/tiles/${tileUrl}`;
    },
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
  },
};

export { API_BASE };
export default api;
