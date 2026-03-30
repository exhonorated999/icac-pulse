/**
 * Licensing service for ICAC P.U.L.S.E.
 *
 * Stores registration / license data in localStorage.
 * All HTTP calls go to the Intellect Unified Dashboard API.
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE =
  localStorage.getItem("icac_api_base") ||
  "https://intellect-unified-dashboard-production.up.railway.app";

const PRODUCT_SLUG = "icac-pulse";

const STORAGE_KEYS = {
  REGISTRATION: "icac_registration",
  LICENSE: "icac_license",
  ACTIVATED_KEY: "icac_activated_key",
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegistrationData {
  customerId: number;
  apiKey: string;
  name: string;
  agency: string;
  email: string;
  address: string;
  registeredAt: string;
  demoExpiresAt: string;
}

export interface LicenseInfo {
  key: string;
  type: string;
  expiresAt: string | null;
}

export type LicenseState =
  | "unregistered"
  | "demo_active"
  | "demo_expired"
  | "licensed";

export interface LicenseStatus {
  state: LicenseState;
  registration: RegistrationData | null;
  license: LicenseInfo | null;
  activatedKey: string | null;
  demoDaysLeft: number;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Read current license state from localStorage (synchronous, offline). */
export function getLicenseStatus(): LicenseStatus {
  const registration = loadJson<RegistrationData>(STORAGE_KEYS.REGISTRATION);
  const license = loadJson<LicenseInfo>(STORAGE_KEYS.LICENSE);
  const activatedKey = localStorage.getItem(STORAGE_KEYS.ACTIVATED_KEY);

  if (!registration) {
    return { state: "unregistered", registration: null, license: null, activatedKey: null, demoDaysLeft: -1 };
  }

  if (activatedKey) {
    return { state: "licensed", registration, license, activatedKey, demoDaysLeft: -1 };
  }

  // Demo — check expiry
  const expiresAt = registration.demoExpiresAt ? new Date(registration.demoExpiresAt) : null;
  if (expiresAt) {
    const now = new Date();
    const msLeft = expiresAt.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000));
    if (daysLeft <= 0) {
      return { state: "demo_expired", registration, license, activatedKey: null, demoDaysLeft: 0 };
    }
    return { state: "demo_active", registration, license, activatedKey: null, demoDaysLeft: daysLeft };
  }

  return { state: "demo_active", registration, license, activatedKey: null, demoDaysLeft: 60 };
}

/** Whether the user is allowed to create new cases right now. */
export function canCreateCases(): boolean {
  const s = getLicenseStatus();
  return s.state !== "demo_expired" && s.state !== "unregistered";
}

/** Register for a demo — calls POST /api/register */
export async function registerDemo(data: {
  name: string;
  agency: string;
  email: string;
  address: string;
}): Promise<RegistrationData> {
  const res = await fetch(`${API_BASE}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: data.name.trim(),
      company: data.agency.trim(),
      contact_email: data.email.trim(),
      address: data.address.trim(),
      product_slug: PRODUCT_SLUG,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Registration failed" }));
    throw new Error(err.detail || "Registration failed");
  }

  const body = await res.json();

  const regData: RegistrationData = {
    customerId: body.customer_id,
    apiKey: body.api_key,
    name: data.name.trim(),
    agency: data.agency.trim(),
    email: data.email.trim(),
    address: data.address.trim(),
    registeredAt: new Date().toISOString(),
    demoExpiresAt: body.expires_at,
  };

  saveJson(STORAGE_KEYS.REGISTRATION, regData);
  saveJson(STORAGE_KEYS.LICENSE, {
    key: body.license_key,
    type: body.license_type,
    expiresAt: body.expires_at,
  });

  return regData;
}

/** Activate a purchased license key — calls POST /api/license/activate */
export async function activateLicense(licenseKey: string): Promise<{
  success: boolean;
  message: string;
  licenseType?: string;
}> {
  const registration = loadJson<RegistrationData>(STORAGE_KEYS.REGISTRATION);
  if (!registration) {
    return { success: false, message: "Not registered — please register first." };
  }

  const res = await fetch(`${API_BASE}/api/license/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": registration.apiKey,
    },
    body: JSON.stringify({
      license_key: licenseKey,
      product_slug: PRODUCT_SLUG,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Activation failed" }));
    return { success: false, message: err.detail || "Invalid license key" };
  }

  const body = await res.json();

  localStorage.setItem(STORAGE_KEYS.ACTIVATED_KEY, licenseKey);
  saveJson(STORAGE_KEYS.LICENSE, {
    key: licenseKey,
    type: body.license_type,
    expiresAt: body.expires_at,
  });

  return { success: true, message: body.message, licenseType: body.license_type };
}

/** Validate existing license against server */
export async function validateLicense(): Promise<{ valid: boolean; message: string }> {
  const registration = loadJson<RegistrationData>(STORAGE_KEYS.REGISTRATION);
  const license = loadJson<LicenseInfo>(STORAGE_KEYS.LICENSE);
  if (!registration || !license) {
    return { valid: false, message: "Not registered" };
  }

  try {
    const res = await fetch(`${API_BASE}/api/license/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": registration.apiKey,
      },
      body: JSON.stringify({
        license_key: license.key,
        product_slug: PRODUCT_SLUG,
      }),
    });

    if (!res.ok) return { valid: false, message: "Server error" };
    const body = await res.json();
    return { valid: body.valid, message: body.message };
  } catch {
    const status = getLicenseStatus();
    return {
      valid: status.state === "demo_active" || status.state === "licensed",
      message: "Offline — using cached license data",
    };
  }
}

/** Check for updates — calls GET /api/updates/{slug}/latest */
export async function checkForUpdate(currentVersion: string): Promise<{
  available: boolean;
  latestVersion?: string;
  downloadUrl?: string;
  changelog?: string;
}> {
  try {
    const res = await fetch(
      `${API_BASE}/api/updates/${PRODUCT_SLUG}/latest?current_version=${encodeURIComponent(currentVersion)}`
    );
    if (!res.ok) return { available: false };
    const body = await res.json();
    return {
      available: body.update_available,
      latestVersion: body.latest_version,
      downloadUrl: body.download_url ? `${API_BASE}${body.download_url}` : undefined,
      changelog: body.changelog,
    };
  } catch {
    return { available: false };
  }
}

export function getApiBase(): string { return API_BASE; }
export function getProductSlug(): string { return PRODUCT_SLUG; }
