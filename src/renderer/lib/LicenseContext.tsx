import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import {
  getLicenseStatus,
  canCreateCases,
  registerDemo,
  activateLicense,
  checkForUpdate,
  type LicenseStatus,
  type RegistrationData,
} from "./licensing";

interface LicenseContextValue {
  status: LicenseStatus;
  canCreate: boolean;
  showRegistration: boolean;
  completeRegistration: (data: RegistrationData) => void;
  refresh: () => void;
  activate: (key: string) => Promise<{ success: boolean; message: string }>;
  checkUpdate: () => Promise<{
    available: boolean;
    latestVersion?: string;
    downloadUrl?: string;
    changelog?: string;
  }>;
  appVersion: string;
}

const LicenseCtx = createContext<LicenseContextValue | null>(null);

const APP_VERSION = "1.1.0"; // keep in sync with package.json

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus>(getLicenseStatus);
  const [showRegistration, setShowRegistration] = useState(false);

  useEffect(() => {
    const s = getLicenseStatus();
    setStatus(s);
    if (s.state === "unregistered") {
      setShowRegistration(true);
    }
  }, []);

  const refresh = useCallback(() => {
    const s = getLicenseStatus();
    setStatus(s);
    if (s.state === "unregistered") {
      setShowRegistration(true);
    }
  }, []);

  const completeRegistration = useCallback((_data: RegistrationData) => {
    setShowRegistration(false);
    refresh();
  }, [refresh]);

  const activate = useCallback(async (key: string) => {
    const result = await activateLicense(key);
    if (result.success) refresh();
    return result;
  }, [refresh]);

  const checkUpdate = useCallback(async () => {
    return checkForUpdate(APP_VERSION);
  }, []);

  const canCreate = canCreateCases();

  return (
    <LicenseCtx.Provider
      value={{
        status,
        canCreate,
        showRegistration,
        completeRegistration,
        refresh,
        activate,
        checkUpdate,
        appVersion: APP_VERSION,
      }}
    >
      {children}
    </LicenseCtx.Provider>
  );
}

export function useLicense(): LicenseContextValue {
  const ctx = useContext(LicenseCtx);
  if (!ctx) throw new Error("useLicense must be used within LicenseProvider");
  return ctx;
}

export { registerDemo };
export type { RegistrationData };
