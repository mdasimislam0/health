import {localVaultRequest} from './localVault.ts';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
  } = {}
): Promise<T> {
  if (options.token && options.token.startsWith('local-token:')) {
    return localVaultRequest<T>(url, options);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    return localVaultRequest<T>(url, options);
  }

  const isExpressApi = res.headers.get('x-shasthyavault-api') === '1';
  const contentType = res.headers.get('content-type') || '';

  if (
    !isExpressApi &&
    (!contentType.includes('application/json') ||
      res.status === 401 ||
      res.status === 403 ||
      res.status === 404 ||
      res.status === 405 ||
      res.status >= 500)
  ) {
    return localVaultRequest<T>(url, options);
  }

  const data = (await res.json().catch(() => null)) as (T & {error?: string}) | null;
  if (!data && !isExpressApi) {
    return localVaultRequest<T>(url, options);
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `HTTP ${res.status}`, res.status);
  }
  return (data || ({} as T)) as T;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('ফাইল পড়া যায়নি'));
    reader.readAsDataURL(file);
  });
}

export function formatBengaliDate(isoDate: string): string {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate.length === 10 ? `${isoDate}T00:00:00` : isoDate);
    return d.toLocaleDateString('bn-BD', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

export function formatBengaliDateTime(isoDateTime: string): string {
  if (!isoDateTime) return '';
  try {
    const d = new Date(isoDateTime);
    return d.toLocaleString('bn-BD', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoDateTime;
  }
}

export function formatBengaliScheduleTime(hhmm: string): string {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return hhmm;
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  const period = h < 5 ? 'রাত' : h < 12 ? 'সকাল' : h < 16 ? 'দুপুর' : h < 19 ? 'বিকাল' : 'রাত';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const bnDigits = (n: number, pad = false) => {
    const str = pad ? String(n).padStart(2, '0') : String(n);
    return str.replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
  };
  return `${period} ${bnDigits(h12)}:${bnDigits(m, true)}`;
}
