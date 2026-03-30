// ChatViewer — thin wrapper that asks the main process to open a dedicated pop-out window.
// All rendering happens in that BrowserWindow; this component has no visible UI of its own.

import { useEffect, useRef } from 'react';

interface ChatViewerProps {
  filePath: string;
  title: string;
  evidenceId: number;
  onClose: () => void;
}

export function ChatViewer({ filePath, title, evidenceId, onClose }: ChatViewerProps) {
  // Guard against React 18 Strict Mode double-invoke
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    window.electronAPI.openChatViewer({ filePath, title, evidenceId });
    onClose();
  }, []);

  return null;
}
