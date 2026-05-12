/**
 * LinkCaseModal — bind a chat to one or more cases. The primary binding is
 * used as the default route target for 1-button evidence saves.
 */
import { useEffect, useState } from 'react';

interface CaseRow {
  id: number;
  case_number?: string;
  case_name?: string;
  title?: string;
}

interface Props {
  chatId: number;
  onClose: () => void;
  onChanged?: (links: UcChatCaseLink[]) => void;
}

export function LinkCaseModal({ chatId, onClose, onChanged }: Props) {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [links, setLinks] = useState<UcChatCaseLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newCaseNumber, setNewCaseNumber] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [allCases, currentLinks] = await Promise.all([
          window.electronAPI.getAllCases(),
          window.electronAPI.ucChatCaseLinks(chatId),
        ]);
        if (!alive) return;
        setCases(allCases || []);
        setLinks(currentLinks || []);
      } catch (e: any) {
        if (alive) setErr(e?.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [chatId]);

  const isLinked = (caseId: number) => links.find(l => l.case_id === caseId);
  const isPrimary = (caseId: number) => links.find(l => l.case_id === caseId)?.role === 'primary';

  const link = async (caseId: number, role: 'primary' | 'secondary') => {
    try {
      const res = await window.electronAPI.ucChatLinkCase(chatId, caseId, role);
      setLinks(res);
      onChanged?.(res);
    } catch (e: any) { setErr(e?.message || String(e)); }
  };
  const unlink = async (caseId: number) => {
    try {
      const res = await window.electronAPI.ucChatUnlinkCase(chatId, caseId);
      setLinks(res);
      onChanged?.(res);
    } catch (e: any) { setErr(e?.message || String(e)); }
  };

  const createAndLink = async () => {
    const num = newCaseNumber.trim();
    if (!num) { setErr('Case number is required'); return; }
    setCreating(true);
    setErr('');
    try {
      const result: any = await window.electronAPI.createCase({
        caseNumber: num,
        caseType: 'chat',
        status: 'open',
      });
      // Handler returns { id, ...caseData } directly (typedef is misleading).
      const newId: number | undefined = result?.id ?? result?.caseId;
      if (!newId) {
        throw new Error(result?.error || 'createCase failed (no id returned)');
      }
      // Stamp default modules for chat-type cases (mirrors ChatForm.tsx)
      try {
        localStorage.setItem(`caseModules_${newId}`, JSON.stringify(['suspect', 'warrants', 'report']));
        localStorage.setItem(`caseModulesV2_${newId}`, '1');
      } catch {}
      // Refresh case list so the new one appears in the table
      const allCases = await window.electronAPI.getAllCases();
      setCases(allCases || []);
      // Auto-link: primary if none exists yet, else secondary
      const hasPrimary = links.some(l => l.role === 'primary');
      const role: 'primary' | 'secondary' = hasPrimary ? 'secondary' : 'primary';
      const updatedLinks = await window.electronAPI.ucChatLinkCase(chatId, newId, role);
      setLinks(updatedLinks);
      onChanged?.(updatedLinks);
      setShowCreate(false);
      setNewCaseNumber('');
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="rounded-xl p-6 w-[640px] max-w-[95vw] max-h-[80vh] flex flex-col"
           style={{ background: '#0F1525', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h2 className="text-lg font-semibold mb-1 text-white">Link Cases to Chat</h2>
        <p className="text-xs text-gray-400 mb-3">
          The <span style={{ color: '#a78bfa' }}>primary</span> case is the default target for 1-button evidence saves.
          A chat can have one primary and any number of secondary case tags.
        </p>
        {err && <div className="mb-3 p-2 rounded text-sm" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>{err}</div>}

        {/* New chat-case quick-create */}
        <div className="mb-3">
          {!showCreate ? (
            <button
              onClick={() => { setShowCreate(true); setErr(''); }}
              className="px-3 py-1.5 rounded text-xs font-medium"
              style={{ background: 'rgba(34,197,94,0.15)', color: '#86efac', border: '1px solid rgba(34,197,94,0.3)' }}
            >
              + New Chat Case
            </button>
          ) : (
            <div className="p-2.5 rounded flex items-center gap-2"
                 style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)' }}>
              <span className="text-xs text-gray-300 whitespace-nowrap">Case #</span>
              <input
                autoFocus
                value={newCaseNumber}
                onChange={e => setNewCaseNumber(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') void createAndLink();
                  if (e.key === 'Escape') { setShowCreate(false); setNewCaseNumber(''); }
                }}
                placeholder="e.g. 26-7240"
                className="flex-1 px-2 py-1 rounded text-sm text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                disabled={creating}
              />
              <button
                onClick={() => void createAndLink()}
                disabled={creating || !newCaseNumber.trim()}
                className="px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
                style={{ background: '#22c55e', color: '#062712' }}
              >
                {creating ? 'Creating…' : 'Create & Link'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setNewCaseNumber(''); setErr(''); }}
                disabled={creating}
                className="px-2 py-1 rounded text-xs disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#d1d5db' }}
              >
                Cancel
              </button>
            </div>
          )}
          {showCreate && (
            <div className="mt-1.5 text-[11px] text-gray-500 italic">
              Creates a chat-type case and {links.some(l => l.role === 'primary') ? 'links it as secondary' : 'sets it as primary'}.
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {loading && <div className="text-gray-400 text-sm">Loading cases…</div>}
          {!loading && cases.length === 0 && <div className="text-gray-400 text-sm">No cases found.</div>}
          {!loading && cases.map(c => {
            const linked = isLinked(c.id);
            const primary = isPrimary(c.id);
            return (
              <div key={c.id}
                   className="flex items-center justify-between p-2 rounded mb-1.5"
                   style={{ background: linked ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.03)',
                            border: linked ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-sm">
                  <div className="text-white font-medium">{c.case_number || `Case ${c.id}`}</div>
                  <div className="text-xs text-gray-400">{c.case_name || c.title || ''}</div>
                </div>
                <div className="flex gap-1">
                  {!linked && (
                    <>
                      <button onClick={() => link(c.id, 'primary')}
                              className="px-2 py-1 rounded text-xs"
                              style={{ background: '#7c3aed', color: '#fff' }}>Primary</button>
                      <button onClick={() => link(c.id, 'secondary')}
                              className="px-2 py-1 rounded text-xs"
                              style={{ background: 'rgba(255,255,255,0.06)', color: '#d1d5db' }}>Secondary</button>
                    </>
                  )}
                  {linked && !primary && (
                    <button onClick={() => link(c.id, 'primary')}
                            className="px-2 py-1 rounded text-xs"
                            style={{ background: 'rgba(124,58,237,0.4)', color: '#fff' }}>Make Primary</button>
                  )}
                  {linked && (
                    <span className="px-2 py-1 rounded text-xs"
                          style={{ background: primary ? '#7c3aed' : 'rgba(255,255,255,0.06)', color: primary ? '#fff' : '#9ca3af' }}>
                      {primary ? '★ Primary' : 'Secondary'}
                    </span>
                  )}
                  {linked && (
                    <button onClick={() => unlink(c.id)}
                            className="px-2 py-1 rounded text-xs"
                            style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>Unlink</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-3 py-1.5 rounded text-sm"
                  style={{ background: '#7c3aed', color: '#fff' }}>Done</button>
        </div>
      </div>
    </div>
  );
}
