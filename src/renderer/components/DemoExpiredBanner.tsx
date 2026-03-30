export function DemoExpiredBanner() {
  return (
    <div className="mb-4 p-4 rounded-lg border border-status-warning/40 bg-status-warning/10">
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">⚠️</span>
        <div className="text-sm">
          <p className="font-semibold text-status-warning mb-1">Demo Period Expired</p>
          <p className="text-text-muted">
            All existing cases, data, and features remain fully accessible. Only creating new cases
            is restricted until a license key is activated.
          </p>
          <p className="text-text-muted mt-2">
            To purchase a lifetime license, contact{" "}
            <a
              href="mailto:Justin@intellect-le.com"
              className="text-accent-cyan underline hover:text-accent-cyan/80"
            >
              Justin@intellect-le.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
