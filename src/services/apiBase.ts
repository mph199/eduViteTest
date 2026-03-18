/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Shared API base URL constants.
 * Separated to avoid circular imports between api.ts and mediaUtils.ts.
 */

const RAW_API_BASE =
  (import.meta as any).env?.VITE_API_URL || '/api';

export const API_BASE = String(RAW_API_BASE).replace(/\/+$/, '');
export const BACKEND_BASE = API_BASE.replace(/\/api$/, '');
