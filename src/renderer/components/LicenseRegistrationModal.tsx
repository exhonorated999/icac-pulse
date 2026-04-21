import { useState, useEffect } from "react";
import { registerDemo, type RegistrationData } from "../lib/LicenseContext";
import { skipRegistrationOffline } from "../lib/licensing";

interface Props {
  onComplete: (data: RegistrationData) => void;
}

export function LicenseRegistrationModal({ onComplete }: Props) {
  const [name, setName] = useState("");
  const [agency, setAgency] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const handleContinueOffline = () => {
    skipRegistrationOffline();
    // Simulate a minimal registration so the app unblocks
    onComplete({
      customerId: 0,
      apiKey: '',
      name: 'Offline User',
      agency: 'Unknown',
      email: '',
      address: '',
      registeredAt: new Date().toISOString(),
      demoExpiresAt: '',
    });
  };

  const handleSubmit = async () => {
    setError("");
    if (!name.trim() || !agency.trim() || !email.trim()) {
      setError("Name, Agency, and Email are required.");
      return;
    }
    setLoading(true);
    try {
      const data = await registerDemo({ name, agency, email, address });
      setSuccess(true);
      setTimeout(() => onComplete(data), 1500);
    } catch (err: any) {
      setError(err.message || "Registration failed. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-panel border border-accent-cyan/30 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-accent-cyan mb-1">ICAC P.U.L.S.E.</h1>
          <p className="text-text-muted text-sm">
            Prosecutorial Unified Logging &amp; Scheduling Engine
          </p>
          <p className="text-text-muted text-xs mt-2">
            Register to begin your <strong className="text-status-success">60-day free trial</strong>. All features included.
          </p>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">✅</div>
            <p className="text-status-success font-semibold text-lg">Registration Complete</p>
            <p className="text-text-muted text-sm mt-1">Your 60-day demo is now active.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-text-primary focus:border-accent-cyan focus:outline-none"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Agency / Organization *</label>
                <input
                  type="text"
                  value={agency}
                  onChange={e => setAgency(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-text-primary focus:border-accent-cyan focus:outline-none"
                  placeholder="County Sheriff's Office"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-text-primary focus:border-accent-cyan focus:outline-none"
                  placeholder="john@agency.gov"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">Agency Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-lg px-3 py-2 text-text-primary focus:border-accent-cyan focus:outline-none"
                  placeholder="123 Main St, City, State 12345"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-accent-pink/10 border border-accent-pink/30 rounded-lg text-accent-pink text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="mt-6 w-full py-3 bg-accent-cyan hover:bg-accent-cyan/80 text-background font-bold rounded-lg transition disabled:opacity-50"
            >
              {loading ? "Registering..." : "Start 60-Day Free Trial"}
            </button>

            {/* Offline fallback */}
            {(isOffline || error.toLowerCase().includes('connection') || error.toLowerCase().includes('failed to fetch') || error.toLowerCase().includes('network')) && (
              <button
                onClick={handleContinueOffline}
                className="mt-3 w-full py-2.5 bg-transparent border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 rounded-lg transition text-sm"
              >
                Continue Offline (No Internet Detected)
              </button>
            )}

            <p className="text-center text-text-muted text-xs mt-4">
              After your trial, all existing data and features remain accessible.
              Only creating new cases is restricted until a license is activated.
              <br />
              {isOffline && (
                <>
                  <span className="text-status-warning block mt-1">
                    ⚠ No internet connection detected. You can continue offline — case management features will work normally. Registration will be prompted when connectivity is restored.
                  </span>
                  <br />
                </>
              )}
              <span className="text-accent-cyan">
                Contact{" "}
                <a href="mailto:Justin@intellect-le.com" className="underline">
                  Justin@intellect-le.com
                </a>{" "}
                for licensing inquiries.
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
