/**
 * ChatTray — Global slide-out for UC chat operations.
 *
 * Peer to ResourceDrawer. Lives in Layout so it's accessible from any screen.
 *
 *   ┌─────────────────────────────────────────┐
 *   │ Header: persona switcher, discreet mode │
 *   ├──────┬──────────────────────────┬───────┤
 *   │ Chat │  Active Chat BV          │ Cheat │
 *   │ Dock │  (one of many)           │ Sheet │
 *   │      │                          │       │
 *   └──────┴──────────────────────────┴───────┘
 *
 * Mutex with ResourceDrawer via 'pulse:tray-open' custom event.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PersonaEditor } from './PersonaEditor';
import { AddChatModal } from './AddChatModal';
import { LinkCaseModal } from './LinkCaseModal';
import { ChatPhotoPanel } from './ChatPhotoPanel';

const TRAY_ID = 'uc-chat';

export function ChatTray() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [personas, setPersonas] = useState<UcPersona[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<number | null>(null);
  const [chats, setChats] = useState<UcChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [discreet, setDiscreet] = useState(false);

  const [showPersonaEditor, setShowPersonaEditor] = useState<Partial<UcPersona> | null>(null);
  const [showAddChat, setShowAddChat] = useState(false);
  const [showLinkCase, setShowLinkCase] = useState(false);

  const [capturing, setCapturing] = useState<null | 'pdf' | 'html'>(null);
  const [bannerErr, setBannerErr] = useState('');
  // Set by external modals (e.g. DownloadCaptureModal) via the
  // `pulse:bv-suspend` / `pulse:bv-resume` window events. While true, the
  // rAF positioning loop is short-circuited so the native chat BV doesn't
  // paint over modal dialogs.
  const [bvSuspended, setBvSuspended] = useState(false);

  const bvMountRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const bvCreatedRef = useRef<Set<number>>(new Set());

  /* ── Data loading ─────────────────────────────────────── */
  const refreshPersonas = useCallback(async () => {
    try {
      const list = await window.electronAPI.ucPersonaList();
      setPersonas(list);
      if (list.length && (activePersonaId === null || !list.find(p => p.id === activePersonaId))) {
        setActivePersonaId(list[0].id);
      }
    } catch {}
  }, [activePersonaId]);

  const refreshChats = useCallback(async () => {
    try {
      // Only show chats belonging to the active persona. Switching personas
      // re-runs this effect (see useEffect below) so the dock filters live.
      // When no persona is selected (first-run / empty state) we show none.
      const list = activePersonaId != null
        ? await window.electronAPI.ucChatList({ personaId: activePersonaId })
        : [];
      setChats(list);
      // If the active chat doesn't belong to this persona, clear selection
      // so the BV/cheat sheet don't keep showing stale info.
      setActiveChatId(prev => (prev != null && list.find(c => c.id === prev)) ? prev : null);
    } catch {}
  }, [activePersonaId]);

  useEffect(() => {
    refreshPersonas();
    window.electronAPI.ucDiscreetModeGet().then(setDiscreet).catch(() => {});
  }, [refreshPersonas]);

  // Re-pull chats every time the active persona changes (initial load too).
  useEffect(() => {
    refreshChats();
  }, [refreshChats]);

  /* ── Mutex with ResourceDrawer ────────────────────────── */
  useEffect(() => {
    const onOther = (ev: any) => {
      if (!ev?.detail) return;
      if (ev.detail.tray !== TRAY_ID && open) setOpen(false);
    };
    window.addEventListener('pulse:tray-open', onOther);
    return () => window.removeEventListener('pulse:tray-open', onOther);
  }, [open]);

  /* ── BV positioning ───────────────────────────────────── */
  const positionActiveBV = useCallback(() => {
    if (!activeChatId) return;
    const el = bvMountRef.current;
    if (!el || !window.electronAPI) return;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 20) return;
    window.electronAPI.ucChatBvSetBounds(activeChatId, {
      x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height),
    });
    window.electronAPI.ucChatBvSetVisible(activeChatId, true);
  }, [activeChatId]);

  const hideActiveBV = useCallback(() => {
    if (!activeChatId || !window.electronAPI) return;
    window.electronAPI.ucChatBvSetVisible(activeChatId, false);
  }, [activeChatId]);

  // Continuous reposition while tray is open.
  // Suppress while any modal is open — the chat BV is a native OS layer
  // that would otherwise sit on top of LinkCaseModal / AddChatModal /
  // PersonaEditor / DownloadCaptureModal / etc. `bvSuspended` is flipped
  // by the global `pulse:bv-suspend` / `pulse:bv-resume` events so
  // capture/route modals owned by Layout.tsx also benefit.
  const anyModalOpen = !!(showPersonaEditor || showAddChat || showLinkCase || bvSuspended);
  const shouldShowBV = open && !!activeChatId && !anyModalOpen;

  // Single source of truth for BV visibility.
  // The rAF loop below only RUNS while `shouldShowBV` is true — it positions
  // and shows. Anything that flips `shouldShowBV` to false triggers this
  // effect to issue an explicit hide IPC, with no race against the rAF
  // tick (the rAF effect is also keyed on the same deps and stops first).
  useEffect(() => {
    if (!activeChatId) return;
    if (!shouldShowBV) {
      try { window.electronAPI.ucChatBvSetVisible(activeChatId, false); } catch {}
    }
    // Showing is handled by the rAF positioning loop so bounds are set
    // before visibility flips on.
  }, [shouldShowBV, activeChatId]);

  useEffect(() => {
    if (!shouldShowBV) return;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      positionActiveBV();
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [shouldShowBV, positionActiveBV]);

  // Defensive: hide all known BVs on mount AND unmount.
  // Main-process BVs survive renderer HMR remounts, so a previous instance
  // can leave a chat BV attached to mainWindow with stale bounds (visible
  // even though the new React tree thinks the tray is closed). Calling
  // hideAll on mount clears any such orphans.
  useEffect(() => {
    try { window.electronAPI?.ucChatBvHideAll(); } catch {}
    return () => {
      try { window.electronAPI?.ucChatBvHideAll(); } catch {}
    };
  }, []);

  /* ── Switch active chat: create BV if needed ──────────── */
  const switchToChat = useCallback(async (chatId: number) => {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    // Hide whatever's currently active
    if (activeChatId && activeChatId !== chatId) {
      window.electronAPI.ucChatBvSetVisible(activeChatId, false);
    }
    setActiveChatId(chatId);

    if (!bvCreatedRef.current.has(chatId)) {
      bvCreatedRef.current.add(chatId);
      const url = chat.platform_url || '';
      try {
        await window.electronAPI.ucChatBvCreate(chatId, chat.persona_id, url);
      } catch (e: any) {
        setBannerErr(`Failed to open chat: ${e?.message || e}`);
      }
    }

    // Mark read
    try {
      await window.electronAPI.ucChatMarkRead(chatId);
      refreshChats();
    } catch {}
  }, [chats, activeChatId, refreshChats]);

  /* ── Alert subscription ───────────────────────────────── */
  useEffect(() => {
    const off = window.electronAPI.ucOnAlert((_payload) => {
      refreshChats();
    });
    return off;
  }, [refreshChats]);

  // Toast click → open tray + switch chat.
  useEffect(() => {
    const onOpenChat = (ev: any) => {
      const id = ev?.detail?.chatId;
      if (!id) return;
      if (!open) {
        setOpen(true);
        window.dispatchEvent(new CustomEvent('pulse:tray-open', { detail: { tray: TRAY_ID } }));
      }
      setTimeout(() => switchToChat(id), 30);
    };
    window.addEventListener('pulse:uc-open-chat', onOpenChat);
    return () => window.removeEventListener('pulse:uc-open-chat', onOpenChat);
  }, [open, switchToChat]);

  /* ── BV suspend/resume (modals) ───────────────────────── */
  // External modals broadcast `pulse:bv-suspend` / `pulse:bv-resume` to ask
  // every BV-hosting tray to drop its native layer so DOM modals can be
  // seen. We mirror that into React state so the rAF positioning loop
  // (which would otherwise re-show the BV on the next frame) also halts.
  useEffect(() => {
    const suspend = () => setBvSuspended(true);
    const resume = () => setBvSuspended(false);
    window.addEventListener('pulse:bv-suspend', suspend);
    window.addEventListener('pulse:bv-resume', resume);
    return () => {
      window.removeEventListener('pulse:bv-suspend', suspend);
      window.removeEventListener('pulse:bv-resume', resume);
    };
  }, []);

  /* ── Toolbar actions ──────────────────────────────────── */
  const onToggleTray = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) {
      // Notify ResourceDrawer to close.
      window.dispatchEvent(new CustomEvent('pulse:tray-open', { detail: { tray: TRAY_ID } }));
    }
  };

  const onCapture = async (kind: 'pdf' | 'html') => {
    setBannerErr('');
    if (!activeChatId) { setBannerErr('No active chat — open one first.'); return; }
    setCapturing(kind);
    try {
      // Re-use the same resource-capture-* IPC by tagging it with the chat id.
      // Task 6 wires this end-to-end; for now we just stage the file.
      const result = kind === 'pdf'
        ? await (window.electronAPI as any).resourceCapturePdf?.(`uc_chat_${activeChatId}`)
        : await (window.electronAPI as any).resourceCaptureHtml?.(`uc_chat_${activeChatId}`);
      if (!result?.success) setBannerErr(result?.error || `${kind.toUpperCase()} capture failed`);
    } catch (e: any) {
      setBannerErr(e?.message || String(e));
    } finally {
      setCapturing(null);
    }
  };

  const onReload = () => {
    if (activeChatId) window.electronAPI.ucChatBvReload(activeChatId);
  };

  const onArchiveActive = async () => {
    if (!activeChatId) return;
    if (!confirm('Archive this chat? (preserves history & evidence trail; can be unarchived later)')) return;
    try {
      await window.electronAPI.ucChatArchive(activeChatId);
      window.electronAPI.ucChatBvDestroy(activeChatId);
      bvCreatedRef.current.delete(activeChatId);
      setActiveChatId(null);
      refreshChats();
    } catch (e: any) { setBannerErr(e?.message || String(e)); }
  };

  const toggleDiscreet = async () => {
    const next = !discreet;
    try { await window.electronAPI.ucDiscreetModeSet(next); setDiscreet(next); } catch {}
  };

  /* ── Render ───────────────────────────────────────────── */
  const activeChat = chats.find(c => c.id === activeChatId) || null;
  const activePersona = personas.find(p => p.id === (activeChat?.persona_id ?? activePersonaId)) || null;
  const totalUnread = chats.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  // Linked-case banner: when the active chat has a primary_case_id, pull the
  // case row so we can show case # / title / status across the top. Re-runs
  // whenever the active chat changes OR its case binding changes (e.g. after
  // LinkCaseModal saves and refreshes the chat list).
  const [linkedCase, setLinkedCase] = useState<any | null>(null);
  useEffect(() => {
    const caseId = activeChat?.primary_case_id;
    if (!caseId) { setLinkedCase(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const c = await window.electronAPI.getCase(caseId);
        if (!cancelled) setLinkedCase(c || null);
      } catch { if (!cancelled) setLinkedCase(null); }
    })();
    return () => { cancelled = true; };
  }, [activeChat?.id, activeChat?.primary_case_id]);

  return (
    <>
      {/* FAB */}
      <button
        onClick={onToggleTray}
        className="fixed z-[9998] w-12 h-12 rounded-xl flex items-center justify-center"
        style={{
          bottom: 24, right: 84, // sit to the left of ResourceDrawer's FAB
          background: 'rgba(124,58,237,0.15)',
          border: '1.5px solid rgba(124,58,237,0.6)',
          color: '#a78bfa',
          backdropFilter: 'blur(8px)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        title="UC Chat Operations"
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 0 32px rgba(124,58,237,0.55), 0 0 12px rgba(124,58,237,0.3)';
        }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {totalUnread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 rounded-full font-bold flex items-center justify-center border-2"
                style={{ width: 18, height: 18, fontSize: 10, background: '#ef4444', color: '#fff', borderColor: '#0B1120' }}>
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {/* Drawer */}
      <div
        className="fixed z-[9997] flex flex-col"
        style={{
          top: 0, right: 0, bottom: 0,
          width: open ? (expanded ? '100vw' : '85vw') : 0,
          maxWidth: '100vw',
          background: '#0B1120',
          borderLeft: open ? '1px solid rgba(124,58,237,0.3)' : 'none',
          transition: 'width 0.22s ease',
          overflow: 'hidden',
        }}
      >
        {open && (
          <>
            {/* ── Header bar ───────────────────────── */}
            <div className="flex items-center gap-3 px-4 py-2"
                 style={{ background: 'rgba(124,58,237,0.08)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-sm font-semibold" style={{ color: '#c4b5fd' }}>UC Chat Operations</span>

              {/* Persona switcher */}
              <select
                className="px-2 py-1 rounded text-xs text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                value={activePersonaId ?? ''}
                onChange={e => setActivePersonaId(parseInt(e.target.value, 10) || null)}
              >
                {personas.length === 0 && <option value="">(no personas)</option>}
                {personas.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
              <button onClick={() => setShowPersonaEditor({})}
                      className="px-2 py-1 rounded text-xs"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#d1d5db' }}>+ Persona</button>
              {activePersona && (
                <button onClick={() => setShowPersonaEditor(activePersona)}
                        className="px-2 py-1 rounded text-xs"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>Edit</button>
              )}

              <div className="flex-1" />

              <button onClick={toggleDiscreet}
                      className="px-2 py-1 rounded text-xs"
                      style={{
                        background: discreet ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
                        color: discreet ? '#fbbf24' : '#9ca3af',
                        border: discreet ? '1px solid rgba(245,158,11,0.5)' : '1px solid transparent',
                      }}
                      title="Hide alert content from on-screen toasts">
                {discreet ? '🔒 Discreet ON' : 'Discreet'}
              </button>

              <button onClick={() => setExpanded(e => !e)}
                      className="px-2 py-1 rounded text-xs"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#d1d5db' }}>
                {expanded ? '⤡ Shrink' : '⤢ Expand'}
              </button>
              <button onClick={() => setOpen(false)}
                      className="px-2 py-1 rounded text-xs"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#d1d5db' }}>✕ Close</button>
            </div>

            {bannerErr && (
              <div className="px-4 py-1.5 text-xs"
                   style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
                {bannerErr}
                <button onClick={() => setBannerErr('')} className="ml-2 opacity-60 hover:opacity-100">✕</button>
              </div>
            )}

            {/* ── Body ─────────────────────────────── */}
            <div className="flex-1 flex min-h-0">
              {/* Left rail: chat dock */}
              <div className="w-64 flex flex-col"
                   style={{ borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="px-3 py-2 flex items-center justify-between"
                     style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <span className="text-xs uppercase tracking-wide text-gray-500">Active Chats</span>
                  <button onClick={() => setShowAddChat(true)}
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ background: '#7c3aed', color: '#fff' }}>+ Chat</button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {chats.length === 0 && (
                    <div className="p-4 text-xs text-gray-500 text-center">
                      No active chats. Click <span style={{ color: '#a78bfa' }}>+ Chat</span> to start one.
                    </div>
                  )}
                  {chats.map(c => {
                    const active = c.id === activeChatId;
                    return (
                      <button key={c.id} onClick={() => switchToChat(c.id)}
                              className="w-full px-3 py-2 text-left flex items-start gap-2"
                              style={{
                                background: active ? 'rgba(124,58,237,0.15)' : 'transparent',
                                borderLeft: active ? '3px solid #a78bfa' : '3px solid transparent',
                              }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold uppercase shrink-0"
                             style={{ background: 'rgba(124,58,237,0.3)', color: '#c4b5fd' }}>
                          {(c.persona_name || '?').slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 uppercase">{c.platform}</span>
                            {c.unread_count > 0 && (
                              <span className="rounded-full px-1.5 text-[10px] font-bold"
                                    style={{ background: '#ef4444', color: '#fff', minWidth: 16, textAlign: 'center' }}>
                                {c.unread_count > 9 ? '9+' : c.unread_count}
                              </span>
                            )}
                            {c.primary_case_id && (
                              <span className="text-[10px] px-1 rounded"
                                    style={{ background: 'rgba(34,197,94,0.15)', color: '#86efac' }}>Case #{c.primary_case_id}</span>
                            )}
                          </div>
                          <div className="text-sm text-white truncate">{c.suspect_handle || c.suspect_display_name || '(no handle)'}</div>
                          <div className="text-[11px] text-gray-500 truncate">{c.persona_name}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Center pane: BV mount + toolbar */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Linked case banner — only when this chat is bound to a case */}
                {activeChat && linkedCase && (
                  <div
                    className="px-3 py-1.5 flex items-center gap-2 text-xs"
                    style={{
                      background: 'rgba(34,197,94,0.10)',
                      borderBottom: '1px solid rgba(34,197,94,0.25)',
                      color: '#bbf7d0',
                    }}
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-semibold tracking-wide">Case #{linkedCase.case_number || linkedCase.id}</span>
                    {linkedCase.title && (
                      <>
                        <span className="opacity-60">·</span>
                        <span className="truncate" style={{ color: '#dcfce7' }}>{linkedCase.title}</span>
                      </>
                    )}
                    {linkedCase.status && (
                      <>
                        <span className="opacity-60">·</span>
                        <span className="uppercase opacity-80">{linkedCase.status}</span>
                      </>
                    )}
                    <div className="flex-1" />
                    <button
                      onClick={() => setShowLinkCase(true)}
                      className="px-2 py-0.5 rounded text-[10px] font-medium"
                      style={{ background: 'rgba(34,197,94,0.18)', color: '#86efac', border: '1px solid rgba(34,197,94,0.35)' }}
                      title="Change linked case"
                    >Change</button>
                  </div>
                )}

                {/* Toolbar */}
                <div className="px-3 py-1.5 flex items-center gap-2"
                     style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                  {activeChat ? (
                    <>
                      <div className="text-sm text-white">{activeChat.suspect_handle || '(no handle)'}</div>
                      <span className="text-xs text-gray-500">on {activeChat.platform}</span>
                      <span className="text-xs text-gray-500">·</span>
                      <span className="text-xs text-gray-500">as {activeChat.persona_name}</span>
                      <div className="flex-1" />
                      <ToolbarBtn label="↩ Reload" onClick={onReload} />
                      <ToolbarBtn label="🔗 Link Case" onClick={() => setShowLinkCase(true)} />
                      <ToolbarBtn label={capturing === 'pdf' ? '…' : '📄 PDF'} onClick={() => onCapture('pdf')} />
                      <ToolbarBtn label={capturing === 'html' ? '…' : '🗎 HTML'} onClick={() => onCapture('html')} />
                      <ToolbarBtn label="🗄 Archive" onClick={onArchiveActive} />
                    </>
                  ) : (
                    <span className="text-sm text-gray-500">Select a chat from the dock — or create one with + Chat.</span>
                  )}
                </div>
                {/* BV mount */}
                <div ref={bvMountRef} className="flex-1 relative"
                     style={{ background: '#000' }}>
                  {!activeChat && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
                      No active chat. Pick one from the dock.
                    </div>
                  )}
                </div>
              </div>

              {/* Right rail: cheat sheet */}
              {activePersona && (
                <div className="w-72 flex flex-col"
                     style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                  <div className="px-3 py-2"
                       style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span className="text-xs uppercase tracking-wide text-gray-500">Persona Cheat Sheet</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
                    <CheatRow label="Name" value={activePersona.display_name} />
                    <CheatRow label="Displayed Age" value={activePersona.displayed_age ?? '—'} />
                    <CheatRow label="Gender" value={activePersona.gender || '—'} />
                    <CheatRow label="Hometown" value={activePersona.hometown || '—'} />
                    <CheatRow label="Bio" value={activePersona.bio || '—'} multiline />
                    <CheatRow label="Backstory" value={activePersona.backstory || '—'} multiline />
                    {activePersona.notes && (
                      <div className="mt-3 p-2 rounded text-xs"
                           style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fcd34d' }}>
                        <div className="text-[10px] uppercase mb-1 opacity-70">Officer Notes</div>
                        {activePersona.notes}
                      </div>
                    )}
                  </div>
                  {/* Photo library — copy-to-clipboard for the active chat */}
                  <ChatPhotoPanel personaId={activePersona.id} chatId={activeChatId} />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showPersonaEditor !== null && (
        <PersonaEditor
          persona={showPersonaEditor}
          onClose={() => setShowPersonaEditor(null)}
          onSaved={() => { refreshPersonas(); }}
        />
      )}
      {showAddChat && (
        <AddChatModal
          personas={personas}
          defaultPersonaId={activePersonaId ?? undefined}
          onClose={() => setShowAddChat(false)}
          onCreated={(chat) => { refreshChats().then(() => switchToChat(chat.id)); }}
        />
      )}
      {showLinkCase && activeChatId && (
        <LinkCaseModal
          chatId={activeChatId}
          onClose={() => setShowLinkCase(false)}
          onChanged={() => refreshChats()}
        />
      )}
    </>
  );
}

function ToolbarBtn({ label, onClick, color }: { label: string; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick}
            className="px-2 py-1 rounded text-xs"
            style={{
              background: color ? `${color}22` : 'rgba(255,255,255,0.06)',
              color: color || '#d1d5db',
              border: color ? `1px solid ${color}55` : '1px solid transparent',
            }}>
      {label}
    </button>
  );
}

function CheatRow({ label, value, multiline }: { label: string; value: any; multiline?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-0.5">{label}</div>
      <div className={multiline ? 'text-xs text-gray-200 whitespace-pre-wrap' : 'text-sm text-gray-200'}>
        {value}
      </div>
    </div>
  );
}
