import { app, BrowserWindow, BrowserView, ipcMain, dialog, protocol, globalShortcut, session, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';
import { spawn } from 'child_process';
import { initDatabase, getDatabase, getRawDatabase, closeDatabase, saveDatabase, getCasesPath, setCasesPath, getUserDataPath } from './database';
import { generateHardwareId, verifyHardwareId } from './hardware';
import * as fileManager from './fileManager';
import { parseNCMECPDF } from './pdfParser';
import { verifyEmail } from './emailVerifier';
import { IPC_CHANNELS } from '../shared/types';
import { initSecurityDb, isUserRegistered, registerUser, loginUser, changePassword, getCurrentUser } from './security';
import { isPortableMode } from './usbFingerprint';
import { FieldSecurityManager } from './fieldSecurity';

let mainWindow: BrowserWindow | null = null;
let fieldSecurity: FieldSecurityManager | null = null;
let mediaPlayerWindow: BrowserWindow | null = null;

// Flock Safety BrowserView
let flockBrowserView: BrowserView | null = null;
let flockViewVisible = false;
let lastFlockBounds: { x: number; y: number; width: number; height: number } | null = null;

// TLO / TransUnion BrowserView
let tloBrowserView: BrowserView | null = null;
let tloViewVisible = false;
let lastTloBounds: { x: number; y: number; width: number; height: number } | null = null;

// ICAC Cops BrowserView
let icaccopsBrowserView: BrowserView | null = null;
let icaccopsViewVisible = false;
let lastIcaccopsBounds: { x: number; y: number; width: number; height: number } | null = null;

// GridCop BrowserView
let gridcopBrowserView: BrowserView | null = null;
let gridcopViewVisible = false;
let lastGridcopBounds: { x: number; y: number; width: number; height: number } | null = null;

// Vigilant LPR BrowserView
let vigilantBrowserView: BrowserView | null = null;
let vigilantViewVisible = false;
let lastVigilantBounds: { x: number; y: number; width: number; height: number } | null = null;

// Thomson Reuters CLEAR BrowserView
let trclearBrowserView: BrowserView | null = null;
let trclearViewVisible = false;
let lastTrclearBounds: { x: number; y: number; width: number; height: number } | null = null;

// Accurint (LexisNexis) BrowserView
let accurintBrowserView: BrowserView | null = null;
let accurintViewVisible = false;
let lastAccurintBounds: { x: number; y: number; width: number; height: number } | null = null;

// BYOA (Bring Your Own Application) dynamic BrowserViews
interface ByoaEntry { view: BrowserView; visible: boolean; bounds: { x: number; y: number; width: number; height: number } | null; url: string; }
const byoaViews = new Map<string, ByoaEntry>();



// Load secrets from file into environment at startup
function loadSecretsIntoEnv() {
  try {
    const configPath = path.join(getUserDataPath(), 'secrets.json');
    if (fs.existsSync(configPath)) {
      const secrets = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      // Load all secrets into process.env
      Object.keys(secrets).forEach(key => {
        process.env[key] = secrets[key];
      });
    }
  } catch (error) {
    // Silently fail - secrets file might not exist yet
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0B1120',
    title: 'ICAC P.U.L.S.E.',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    },
    titleBarStyle: 'default',
    icon: path.join(__dirname, '../../build/icon.ico'),
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    // In dev mode, electron-vite serves on a port (usually 5173, but could be different)
    const devServerUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173';
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from the out directory
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Ensure web content gets focus so first click registers on inputs
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow?.focus();
    mainWindow?.webContents.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // ── Flock Safety BrowserView (persistent, survives SPA navigations) ──
  flockBrowserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:flock',
    },
  });
  mainWindow.addBrowserView(flockBrowserView);
  flockBrowserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  flockBrowserView.setAutoResize({ width: false, height: false });
  flockBrowserView.webContents.on('did-finish-load', () => {
    if (!flockViewVisible && mainWindow) mainWindow.webContents.focus();
    flockBrowserView!.webContents.insertCSS(
      '::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#0d1117}::-webkit-scrollbar-thumb{background:#30363d;border-radius:4px}'
    ).catch(() => {});
    // Auto-fill credentials on Flock login page
    const url = flockBrowserView!.webContents.getURL();
    if (url.includes('auth0.com') || url.includes('/login') || url.includes('/authorize')) {
      mainWindow?.webContents.executeJavaScript(
        `JSON.stringify({ email: localStorage.getItem('flockEmail') || '', password: localStorage.getItem('flockPassword') || '' })`
      ).then((json: string) => {
        const creds = JSON.parse(json);
        if (creds.email || creds.password) {
          flockBrowserView!.webContents.executeJavaScript(`
            (function(){
              function fill(){
                const emailInput=document.querySelector('input[name="email"],input[name="username"],input[type="email"]');
                const passInput=document.querySelector('input[name="password"],input[type="password"]');
                function setVal(el,val){if(!el||!val)return;const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,val);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
                setVal(emailInput,${JSON.stringify(creds.email)});setVal(passInput,${JSON.stringify(creds.password)});
              }
              setTimeout(fill,500);setTimeout(fill,1500);
            })();
          `).catch(() => {});
        }
      }).catch(() => {});
    }
  });

  // ── TLO / TransUnion BrowserView ──
  tloBrowserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:tlo',
    },
  });
  mainWindow.addBrowserView(tloBrowserView);
  tloBrowserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  tloBrowserView.setAutoResize({ width: false, height: false });
  tloBrowserView.webContents.on('did-finish-load', () => {
    if (!tloViewVisible && mainWindow) mainWindow.webContents.focus();
    tloBrowserView!.webContents.insertCSS(
      '::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#0d1117}::-webkit-scrollbar-thumb{background:#30363d;border-radius:4px}'
    ).catch(() => {});
    // Auto-fill credentials on TLO login page
    const url = tloBrowserView!.webContents.getURL();
    if (url.includes('tlo.com') && (url.includes('login') || url.includes('Login') || url === 'https://tloxp.tlo.com/' || url.includes('Account'))) {
      mainWindow?.webContents.executeJavaScript(
        `JSON.stringify({ username: localStorage.getItem('tloUsername') || '', password: localStorage.getItem('tloPassword') || '' })`
      ).then((json: string) => {
        const creds = JSON.parse(json);
        if (creds.username || creds.password) {
          tloBrowserView!.webContents.executeJavaScript(`
            (function(){
              function fill(){
                const userInput=document.querySelector('input[name="Username"],input[name="username"],input[name="email"],input[type="email"],input[id*="user"],input[id*="User"]');
                const passInput=document.querySelector('input[name="Password"],input[name="password"],input[type="password"]');
                function setVal(el,val){if(!el||!val)return;const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,val);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
                setVal(userInput,${JSON.stringify(creds.username)});setVal(passInput,${JSON.stringify(creds.password)});
              }
              setTimeout(fill,500);setTimeout(fill,1500);
            })();
          `).catch(() => {});
        }
      }).catch(() => {});
    }
  });

  // ── ICAC Cops BrowserView ──
  icaccopsBrowserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:icaccops',
    },
  });
  mainWindow.addBrowserView(icaccopsBrowserView);
  icaccopsBrowserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  icaccopsBrowserView.setAutoResize({ width: false, height: false });
  icaccopsBrowserView.webContents.on('did-finish-load', () => {
    if (!icaccopsViewVisible && mainWindow) mainWindow.webContents.focus();
    icaccopsBrowserView!.webContents.insertCSS(
      '::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#0d1117}::-webkit-scrollbar-thumb{background:#30363d;border-radius:4px}'
    ).catch(() => {});
    // Auto-fill credentials on ICACCops login page
    const url = icaccopsBrowserView!.webContents.getURL();
    if (url.includes('icaccops.com') && (url.includes('login') || url.includes('Login') || url.includes('users'))) {
      mainWindow?.webContents.executeJavaScript(
        `JSON.stringify({ username: localStorage.getItem('icaccopsUsername') || '', password: localStorage.getItem('icaccopsPassword') || '' })`
      ).then((json: string) => {
        const creds = JSON.parse(json);
        if (creds.username || creds.password) {
          icaccopsBrowserView!.webContents.executeJavaScript(`
            (function(){
              function fill(){
                const userInput=document.querySelector('input[name="Username"],input[name="username"],input[name="email"],input[type="email"],input[id*="user"],input[id*="User"],input[id*="Email"],input[name="Email"]');
                const passInput=document.querySelector('input[name="Password"],input[name="password"],input[type="password"]');
                function setVal(el,val){if(!el||!val)return;const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,val);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
                setVal(userInput,${JSON.stringify(creds.username)});setVal(passInput,${JSON.stringify(creds.password)});
              }
              setTimeout(fill,500);setTimeout(fill,1500);
            })();
          `).catch(() => {});
        }
      }).catch(() => {});
    }
  });

  // ── GridCop BrowserView ──
  gridcopBrowserView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:gridcop',
    },
  });
  mainWindow.addBrowserView(gridcopBrowserView);
  gridcopBrowserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  gridcopBrowserView.setAutoResize({ width: false, height: false });
  gridcopBrowserView.webContents.on('did-finish-load', () => {
    if (!gridcopViewVisible && mainWindow) mainWindow.webContents.focus();
    gridcopBrowserView!.webContents.insertCSS(
      '::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#0d1117}::-webkit-scrollbar-thumb{background:#30363d;border-radius:4px}'
    ).catch(() => {});
    // Auto-fill credentials on GridCop login page
    const url = gridcopBrowserView!.webContents.getURL();
    if (url.includes('gridcop.com') && (url.includes('login') || url.includes('Login') || url.includes('cb-login'))) {
      mainWindow?.webContents.executeJavaScript(
        `JSON.stringify({ username: localStorage.getItem('gridcopUsername') || '', password: localStorage.getItem('gridcopPassword') || '' })`
      ).then((json: string) => {
        const creds = JSON.parse(json);
        if (creds.username || creds.password) {
          gridcopBrowserView!.webContents.executeJavaScript(`
            (function(){
              function fill(){
                const userInput=document.querySelector('input[name="Username"],input[name="username"],input[name="email"],input[type="email"],input[id*="user"],input[id*="User"],input[id*="Email"],input[name="Email"]');
                const passInput=document.querySelector('input[name="Password"],input[name="password"],input[type="password"]');
                function setVal(el,val){if(!el||!val)return;const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,val);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
                setVal(userInput,${JSON.stringify(creds.username)});setVal(passInput,${JSON.stringify(creds.password)});
              }
              setTimeout(fill,500);setTimeout(fill,1500);
            })();
          `).catch(() => {});
        }
      }).catch(() => {});
    }
  });

  // ── Vigilant LPR BrowserView ──
  vigilantBrowserView = new BrowserView({
    webPreferences: { nodeIntegration: false, contextIsolation: true, partition: 'persist:vigilant' },
  });
  mainWindow.addBrowserView(vigilantBrowserView);
  vigilantBrowserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  vigilantBrowserView.setAutoResize({ width: false, height: false });
  vigilantBrowserView.webContents.on('did-finish-load', () => {
    if (!vigilantViewVisible && mainWindow) mainWindow.webContents.focus();
    vigilantBrowserView!.webContents.insertCSS(
      '::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#0d1117}::-webkit-scrollbar-thumb{background:#30363d;border-radius:4px}'
    ).catch(() => {});
    const url = vigilantBrowserView!.webContents.getURL();
    if (url.includes('Login') || url.includes('login') || url.includes('Auth')) {
      mainWindow?.webContents.executeJavaScript(
        `JSON.stringify({ u: localStorage.getItem('vigilantUsername') || '', p: localStorage.getItem('vigilantPassword') || '' })`
      ).then((json: string) => {
        const creds = JSON.parse(json);
        if (creds.u || creds.p) {
          vigilantBrowserView!.webContents.executeJavaScript(`
            (function(){
              function fill(){
                const userInput=document.querySelector('input[name="Username"],input[name="username"],input[name="email"],input[type="email"],input[id*="user"],input[id*="User"],input[id*="login"],input[id*="Login"]');
                const passInput=document.querySelector('input[name="Password"],input[name="password"],input[type="password"]');
                function setVal(el,val){if(!el||!val)return;const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,val);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
                setVal(userInput,${JSON.stringify(creds.u)});setVal(passInput,${JSON.stringify(creds.p)});
              }
              setTimeout(fill,500);setTimeout(fill,1500);
            })();
          `).catch(() => {});
        }
      }).catch(() => {});
    }
  });

  // ── Thomson Reuters CLEAR BrowserView ──
  trclearBrowserView = new BrowserView({
    webPreferences: { nodeIntegration: false, contextIsolation: true, partition: 'persist:trclear' },
  });
  mainWindow.addBrowserView(trclearBrowserView);
  trclearBrowserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  trclearBrowserView.setAutoResize({ width: false, height: false });
  trclearBrowserView.webContents.on('did-finish-load', () => {
    if (!trclearViewVisible && mainWindow) mainWindow.webContents.focus();
    trclearBrowserView!.webContents.insertCSS(
      '::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#0d1117}::-webkit-scrollbar-thumb{background:#30363d;border-radius:4px}'
    ).catch(() => {});
    const url = trclearBrowserView!.webContents.getURL();
    if (url.includes('signon') || url.includes('login') || url.includes('Login') || url.includes('auth')) {
      mainWindow?.webContents.executeJavaScript(
        `JSON.stringify({ u: localStorage.getItem('trclearUsername') || '', p: localStorage.getItem('trclearPassword') || '' })`
      ).then((json: string) => {
        const creds = JSON.parse(json);
        if (creds.u || creds.p) {
          trclearBrowserView!.webContents.executeJavaScript(`
            (function(){
              function fill(){
                const userInput=document.querySelector('input[name="username"],input[name="Username"],input[name="email"],input[type="email"],input[id*="user"],input[id*="User"],input[id*="email"]');
                const passInput=document.querySelector('input[name="password"],input[name="Password"],input[type="password"]');
                function setVal(el,val){if(!el||!val)return;const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,val);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
                setVal(userInput,${JSON.stringify(creds.u)});setVal(passInput,${JSON.stringify(creds.p)});
              }
              setTimeout(fill,500);setTimeout(fill,1500);
            })();
          `).catch(() => {});
        }
      }).catch(() => {});
    }
  });

  // ── Accurint (LexisNexis) BrowserView ──
  accurintBrowserView = new BrowserView({
    webPreferences: { nodeIntegration: false, contextIsolation: true, partition: 'persist:accurint' },
  });
  mainWindow.addBrowserView(accurintBrowserView);
  accurintBrowserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  accurintBrowserView.setAutoResize({ width: false, height: false });
  accurintBrowserView.webContents.on('did-finish-load', () => {
    if (!accurintViewVisible && mainWindow) mainWindow.webContents.focus();
    accurintBrowserView!.webContents.insertCSS(
      '::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#0d1117}::-webkit-scrollbar-thumb{background:#30363d;border-radius:4px}'
    ).catch(() => {});
    const url = accurintBrowserView!.webContents.getURL();
    if (url.includes('accurint.com') && (url.includes('login') || url.includes('Login') || url.includes('signon') || url.includes('auth') || url.includes('/app/bps/main'))) {
      mainWindow?.webContents.executeJavaScript(
        `JSON.stringify({ u: localStorage.getItem('accurintUsername') || '', p: localStorage.getItem('accurintPassword') || '' })`
      ).then((json: string) => {
        const creds = JSON.parse(json);
        if (creds.u || creds.p) {
          accurintBrowserView!.webContents.executeJavaScript(`
            (function(){
              function fill(){
                const userInput=document.querySelector('input[name="username"],input[name="Username"],input[name="email"],input[type="email"],input[id*="user"],input[id*="User"],input[id*="email"]');
                const passInput=document.querySelector('input[name="password"],input[name="Password"],input[type="password"]');
                function setVal(el,val){if(!el||!val)return;const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,val);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
                setVal(userInput,${JSON.stringify(creds.u)});setVal(passInput,${JSON.stringify(creds.p)});
              }
              setTimeout(fill,500);setTimeout(fill,1500);
            })();
          `).catch(() => {});
        }
      }).catch(() => {});
    }
  });

  // Reposition BrowserViews on window resize
  mainWindow.on('resize', () => {
    if (flockViewVisible && lastFlockBounds && flockBrowserView) flockBrowserView.setBounds(lastFlockBounds);
    if (tloViewVisible && lastTloBounds && tloBrowserView) tloBrowserView.setBounds(lastTloBounds);
    if (icaccopsViewVisible && lastIcaccopsBounds && icaccopsBrowserView) icaccopsBrowserView.setBounds(lastIcaccopsBounds);
    if (gridcopViewVisible && lastGridcopBounds && gridcopBrowserView) gridcopBrowserView.setBounds(lastGridcopBounds);
    if (vigilantViewVisible && lastVigilantBounds && vigilantBrowserView) vigilantBrowserView.setBounds(lastVigilantBounds);
    if (trclearViewVisible && lastTrclearBounds && trclearBrowserView) trclearBrowserView.setBounds(lastTrclearBounds);
    if (accurintViewVisible && lastAccurintBounds && accurintBrowserView) accurintBrowserView.setBounds(lastAccurintBounds);
    // BYOA views
    byoaViews.forEach((entry) => {
      if (entry.visible && entry.bounds) entry.view.setBounds(entry.bounds);
    });
  });

  // Grant permissions for both default session and the media player partition
  const allowedPerms = ['geolocation', 'media', 'mediaKeySystem', 'notifications', 'fullscreen'];

  const setupPermissions = (ses: Electron.Session) => {
    ses.setPermissionRequestHandler((_webContents, permission, callback) => {
      callback(allowedPerms.includes(permission));
    });
    ses.setPermissionCheckHandler((_webContents, permission) => {
      return allowedPerms.includes(permission);
    });
  };

  setupPermissions(session.defaultSession);
  setupPermissions(session.fromPartition('persist:media'));
}

app.whenReady().then(async () => {
  // Register custom protocol for serving case files
  protocol.registerFileProtocol('icac-case-file', (request, callback) => {
    const url = request.url.replace('icac-case-file://', '');
    const filePath = fileManager.getAbsolutePath(url);
    callback({ path: filePath });
  });

  // Initialize database
  await initDatabase();
  
  // Initialize security database (for portable USB binding)
  initSecurityDb();
  
  // Load API keys and secrets into environment
  loadSecretsIntoEnv();

  // Initialize field security module
  fieldSecurity = new FieldSecurityManager(getUserDataPath());
  
  // Register IPC handlers
  registerIPCHandlers();
  
  // Create window
  createWindow();

  // Boss key: Ctrl+Alt+M toggles media player visibility in renderer
  globalShortcut.register('CommandOrControl+Alt+M', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('toggle-media-player');
    }
  });
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
  closeDatabase();
});

/**
 * Helper function to count files in a directory recursively
 */
function countFiles(dirPath: string): number {
  let count = 0;
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const stat = fs.statSync(itemPath);
    
    if (stat.isDirectory()) {
      count += countFiles(itemPath);
    } else {
      count++;
    }
  }
  
  return count;
}

/**
 * Helper function to copy directory recursively with progress callback
 */
function copyDirectoryRecursive(
  source: string, 
  destination: string, 
  progressCallback?: (currentFile: string, filesProcessed: number) => void
): number {
  let filesProcessed = 0;
  
  // Create destination directory
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }
  
  const items = fs.readdirSync(source);
  
  for (const item of items) {
    const sourcePath = path.join(source, item);
    const destPath = path.join(destination, item);
    const stat = fs.statSync(sourcePath);
    
    if (stat.isDirectory()) {
      filesProcessed += copyDirectoryRecursive(sourcePath, destPath, progressCallback);
    } else {
      fs.copyFileSync(sourcePath, destPath);
      filesProcessed++;
      
      if (progressCallback) {
        progressCallback(item, filesProcessed);
      }
    }
  }
  
  return filesProcessed;
}

/**
 * Parse .eml or .mbox email content into structured objects
 */
function parseEmailContent(raw: string, fileName: string): any[] {
  const emails: any[] = [];
  // Split mbox by "From " delimiter; single .eml has no such delimiter
  const chunks = fileName.endsWith('.mbox')
    ? raw.split(/^From /m).filter(c => c.trim())
    : [raw];

  for (const chunk of chunks) {
    const headerEnd = chunk.indexOf('\r\n\r\n') !== -1
      ? chunk.indexOf('\r\n\r\n')
      : chunk.indexOf('\n\n');
    if (headerEnd === -1) continue;

    const headerBlock = chunk.substring(0, headerEnd);
    const body = chunk.substring(headerEnd).trim();

    const getHeader = (name: string): string => {
      const re = new RegExp(`^${name}:\\s*(.+(?:\\n\\s+.+)*)`, 'mi');
      const m = headerBlock.match(re);
      return m ? m[1].replace(/\n\s+/g, ' ').trim() : '';
    };

    // Extract IPs from headers (Received lines)
    const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    const allIps = (headerBlock.match(ipRegex) || []).filter(ip => {
      return !ip.startsWith('10.') && !ip.startsWith('192.168.') && !ip.startsWith('127.');
    });
    const uniqueIps = [...new Set(allIps)];

    // Basic attachment detection from Content-Type boundaries
    const attachments: string[] = [];
    const nameMatches = body.matchAll(/name="?([^"\r\n;]+)"?/gi);
    for (const m of nameMatches) {
      if (m[1] && !m[1].includes('/')) attachments.push(m[1]);
    }

    emails.push({
      messageId: getHeader('Message-ID').replace(/[<>]/g, ''),
      from: getHeader('From'),
      to: getHeader('To'),
      cc: getHeader('Cc'),
      subject: getHeader('Subject'),
      date: getHeader('Date') || new Date().toISOString(),
      bodyText: body.substring(0, 50000),
      bodyHtml: '',
      headersRaw: headerBlock.substring(0, 20000),
      ipAddresses: uniqueIps,
      attachments
    });
  }
  return emails;
}

/**
 * Register all IPC handlers
 */
function registerIPCHandlers() {
  const db = getDatabase();
  
  // ========== User/Auth ==========
  
  ipcMain.handle(IPC_CHANNELS.REGISTER_USER, async (_event, username: string) => {
    const hardwareId = generateHardwareId();
    
    db.run(`
      INSERT INTO users (username, hardware_id) 
      VALUES (?, ?)
    `, [username, hardwareId]);
    
    saveDatabase();
    
    const result = db.exec('SELECT last_insert_rowid() as id')[0];
    const id = result.values[0][0];
    
    return {
      id,
      username,
      hardwareId,
      createdAt: new Date().toISOString()
    };
  });
  
  ipcMain.handle(IPC_CHANNELS.GET_CURRENT_USER, async () => {
    const result = db.exec('SELECT * FROM users LIMIT 1');
    
    if (!result.length || !result[0].values.length) {
      return null;
    }
    
    const row = result[0].values[0];
    const columns = result[0].columns;
    const user = {
      id: row[columns.indexOf('id')],
      username: row[columns.indexOf('username')],
      hardware_id: row[columns.indexOf('hardware_id')],
      created_at: row[columns.indexOf('created_at')],
      last_login: row[columns.indexOf('last_login')]
    };
    
    // Update last login
    db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    saveDatabase();
    
    return {
      id: user.id,
      username: user.username,
      hardwareId: user.hardware_id,
      createdAt: user.created_at,
      lastLogin: user.last_login
    };
  });
  
  ipcMain.handle(IPC_CHANNELS.VERIFY_HARDWARE, async () => {
    try {
      const result = db.exec('SELECT hardware_id FROM users LIMIT 1');
      
      if (!result.length || !result[0].values.length) {
        return true; // No user registered yet
      }
      
      const hardwareId = result[0].values[0][0] as string;
      return verifyHardwareId(hardwareId);
    } catch (error) {
      // safeLog('Hardware verification error:', error);
      return true; // On error, allow registration
    }
  });
  
  // ========== Security (USB Binding for Portable Mode) ==========
  
  ipcMain.handle(IPC_CHANNELS.IS_PORTABLE_MODE, async () => {
    try {
      return isPortableMode();
    } catch (error) {
      console.error('Error checking portable mode:', error);
      return false;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.IS_USER_REGISTERED, async () => {
    try {
      return isUserRegistered();
    } catch (error) {
      console.error('Error checking registration:', error);
      return false;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.REGISTER_SECURE_USER, async (_event, username: string, password: string) => {
    try {
      const user = await registerUser(username, password);
      return user;
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.message || String(error));
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.LOGIN_USER, async (_event, username: string, password: string) => {
    try {
      const user = await loginUser(username, password);
      return user;
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || String(error));
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.CHANGE_PASSWORD, async (_event, username: string, currentPassword: string, newPassword: string) => {
    try {
      await changePassword(username, currentPassword, newPassword);
      return { success: true };
    } catch (error: any) {
      console.error('Change password error:', error);
      throw new Error(error.message || String(error));
    }
  });
  
  // ========== Cases ==========
  
  ipcMain.handle(IPC_CHANNELS.CREATE_CASE, async (_event, caseData) => {
    // safeLog('============ CREATE_CASE HANDLER CALLED ============');
    try {
      // safeLog('CREATE_CASE called with:', caseData);
      const user = db.prepare('SELECT id FROM users LIMIT 1').get() as { id: number };
      // safeLog('User found:', user);
      
      const stmt = db.prepare(`
        INSERT INTO cases (case_number, case_type, status, user_id)
        VALUES (?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        caseData.caseNumber,
        caseData.caseType,
        caseData.status || 'open',
        user.id
      );
      
      // safeLog('Insert result:', result);
      
      // WORKAROUND: sql.js lastInsertRowid returns 0, but the INSERT works
      // Query for the case by case_number instead
      const verifyStmt = db.prepare('SELECT * FROM cases WHERE case_number = ?');
      const verifyResult = verifyStmt.get(caseData.caseNumber);
      // safeLog('Verification query result:', verifyResult);
      
      if (!verifyResult) {
        throw new Error('Case was not saved to database');
      }
      
      const caseId = verifyResult.id;
      // safeLog('Case created with ID:', caseId);
      
      // Create case directory structure
      fileManager.createCaseDirectory(caseData.caseNumber);
      
      const returnValue = { id: caseId, ...caseData };
      // safeLog('Returning from CREATE_CASE:', returnValue);
      return returnValue;
    } catch (error) {
      // safeLog('CREATE_CASE error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.GET_CASE, async (_event, caseId: number) => {
    try {
      // safeLog('GET_CASE called with caseId:', caseId);
      const stmt = db.prepare(`
        SELECT * FROM cases WHERE id = ?
      `);
      
      const caseRow = stmt.get(caseId);
      // safeLog('GET_CASE result:', caseRow);
      
      if (!caseRow) {
        // safeLog('Case not found');
        return null;
      }
      
      return caseRow;
    } catch (error) {
      // safeLog('GET_CASE error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.GET_ALL_CASES, async () => {
    const stmt = db.prepare(`
      SELECT * FROM cases ORDER BY created_at DESC
    `);
    
    return stmt.all();
  });
  
  ipcMain.handle(IPC_CHANNELS.UPDATE_CASE, async (_event, caseId: number, updates: any) => {
    const stmt = db.prepare(`
      UPDATE cases 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(updates.status, caseId);
    
    return { success: true };
  });
  
  ipcMain.handle(IPC_CHANNELS.DELETE_CASE, async (_event, caseId: number) => {
    const caseRow = db.prepare('SELECT case_number FROM cases WHERE id = ?').get(caseId) as { case_number: string };
    
    if (caseRow) {
      // Delete case directory
      fileManager.deleteDirectory(caseRow.case_number);
    }
    
    const stmt = db.prepare('DELETE FROM cases WHERE id = ?');
    stmt.run(caseId);
    
    return { success: true };
  });
  
  ipcMain.handle(IPC_CHANNELS.EXPORT_CASE, async (_event, caseId: number) => {
    const caseRow = db.prepare('SELECT case_number FROM cases WHERE id = ?').get(caseId) as { case_number: string };
    
    if (!caseRow) {
      throw new Error('Case not found');
    }
    
    // Open folder selection dialog
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Export Location'
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }
    
    fileManager.exportCase(caseRow.case_number, result.filePaths[0]);
    
    return { success: true };
  });
  
  // ========== CyberTip Data ==========
  
  ipcMain.handle(IPC_CHANNELS.SAVE_CYBERTIP_DATA, async (_event, data) => {
    try {
      // safeLog('SAVE_CYBERTIP_DATA called with:', data);
      
      // Validate required fields
      if (!data.cybertipNumber) {
        throw new Error('CyberTipline number is required');
      }
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO cybertip_data 
        (case_id, cybertip_number, report_date, occurrence_date, reporting_company, 
         priority_level, date_received_utc, ncmec_folder_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        data.caseId,
        data.cybertipNumber,
        data.reportDate || '',
        data.occurrenceDate || null,
        data.reportingCompany || '',
        data.priorityLevel || null,
        data.dateReceivedUtc || null,
        data.ncmecFolderPath || null
      );
      
      // safeLog('SAVE_CYBERTIP_DATA insert result:', result);
    } catch (error) {
      // safeLog('SAVE_CYBERTIP_DATA error:', error);
      throw error;
    }
    
    // Save identifiers
    if (data.identifiers && data.identifiers.length > 0) {
      const idStmt = db.prepare(`
        INSERT INTO cybertip_identifiers (case_id, identifier_type, identifier_value)
        VALUES (?, ?, ?)
      `);
      
      for (const identifier of data.identifiers) {
        idStmt.run(data.caseId, identifier.type, identifier.value);
      }
    }
    
    // Save files
    if (data.files && data.files.length > 0) {
      const fileStmt = db.prepare(`
        INSERT INTO cybertip_files (case_id, filename, ip_address, datetime, officer_description)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      for (const file of data.files) {
        fileStmt.run(
          data.caseId,
          file.filename,
          file.ipAddress,
          file.datetime,
          file.officerDescription
        );
      }
    }
    
    return { success: true };
  });
  
  ipcMain.handle(IPC_CHANNELS.GET_CYBERTIP_DATA, async (_event, caseId: number) => {
    try {
      // safeLog('GET_CYBERTIP_DATA called with caseId:', caseId);
      const stmt = db.prepare(`
        SELECT * FROM cybertip_data WHERE case_id = ?
      `);
      
      const result = stmt.get(caseId);
      // safeLog('GET_CYBERTIP_DATA result:', result);
      return result;
    } catch (error) {
      // safeLog('GET_CYBERTIP_DATA error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.SAVE_CYBERTIP_IDENTIFIER, async (_event, data) => {
    const stmt = db.prepare(`
      INSERT INTO cybertip_identifiers (case_id, identifier_type, identifier_value, platform, provider)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      data.caseId, 
      data.identifierType, 
      data.identifierValue,
      data.platform || null,
      data.provider || null
    );
    
    return { success: true };
  });
  
  ipcMain.handle(IPC_CHANNELS.GET_CYBERTIP_IDENTIFIERS, async (_event, caseId: number) => {
    const stmt = db.prepare(`
      SELECT * FROM cybertip_identifiers WHERE case_id = ?
    `);
    
    return stmt.all(caseId);
  });
  
  ipcMain.handle(IPC_CHANNELS.DELETE_CYBERTIP_IDENTIFIER, async (_event, id: number) => {
    const stmt = db.prepare(`
      DELETE FROM cybertip_identifiers WHERE id = ?
    `);
    
    stmt.run(id);
    
    return { success: true };
  });

  // Update provider field on an existing identifier
  ipcMain.handle('update-identifier-provider', async (_event, id: number, provider: string) => {
    const stmt = db.prepare(`
      UPDATE cybertip_identifiers SET provider = ? WHERE id = ?
    `);
    stmt.run(provider, id);
    return { success: true };
  });
  
  // ========== Chat Identifiers ==========
  
  ipcMain.handle(IPC_CHANNELS.SAVE_CHAT_IDENTIFIER, async (_event, data) => {
    const stmt = db.prepare(`
      INSERT INTO chat_identifiers (case_id, identifier_type, identifier_value, platform, provider)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      data.caseId, 
      data.identifierType, 
      data.identifierValue,
      data.platform || null,
      data.provider || null
    );
    
    return { success: true };
  });
  
  ipcMain.handle(IPC_CHANNELS.GET_CHAT_IDENTIFIERS, async (_event, caseId: number) => {
    const stmt = db.prepare(`
      SELECT * FROM chat_identifiers WHERE case_id = ?
    `);
    
    return stmt.all(caseId);
  });
  
  ipcMain.handle(IPC_CHANNELS.DELETE_CHAT_IDENTIFIER, async (_event, id: number) => {
    const stmt = db.prepare(`
      DELETE FROM chat_identifiers WHERE id = ?
    `);
    
    stmt.run(id);
    
    return { success: true };
  });
  
  // ========== Other Identifiers ==========
  
  ipcMain.handle(IPC_CHANNELS.SAVE_OTHER_IDENTIFIER, async (_event, data) => {
    const stmt = db.prepare(`
      INSERT INTO other_identifiers (case_id, identifier_type, identifier_value, platform, provider)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      data.caseId, 
      data.identifierType, 
      data.identifierValue,
      data.platform || null,
      data.provider || null
    );
    
    return { success: true };
  });
  
  ipcMain.handle(IPC_CHANNELS.GET_OTHER_IDENTIFIERS, async (_event, caseId: number) => {
    const stmt = db.prepare(`
      SELECT * FROM other_identifiers WHERE case_id = ?
    `);
    
    return stmt.all(caseId);
  });
  
  ipcMain.handle(IPC_CHANNELS.DELETE_OTHER_IDENTIFIER, async (_event, id: number) => {
    const stmt = db.prepare(`
      DELETE FROM other_identifiers WHERE id = ?
    `);
    
    stmt.run(id);
    
    return { success: true };
  });
  
  ipcMain.handle(IPC_CHANNELS.SAVE_CYBERTIP_FILE, async (_event, data) => {
    const stmt = db.prepare(`
      INSERT INTO cybertip_files (case_id, filename, ip_address, datetime, officer_description, file_path, ncmec_filename, csam_description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      data.caseId,
      data.filename || null,
      data.ipAddress || null,
      data.datetime || null,
      data.officerDescription || null,
      data.filePath || null,
      data.ncmecFilename || null,
      data.csamDescription || null
    );
    
    return { success: true };
  });
  
  ipcMain.handle(IPC_CHANNELS.GET_CYBERTIP_FILES, async (_event, caseId: number) => {
    const stmt = db.prepare(`
      SELECT * FROM cybertip_files WHERE case_id = ?
    `);
    
    return stmt.all(caseId);
  });
  
  ipcMain.handle(IPC_CHANNELS.DELETE_CYBERTIP_FILE, async (_event, fileId: number) => {
    const stmt = db.prepare('DELETE FROM cybertip_files WHERE id = ?');
    stmt.run(fileId);
    return { success: true };
  });
  
  // ========== P2P Data ==========
  
  ipcMain.handle(IPC_CHANNELS.GET_P2P_DATA, async (_event, caseId: number) => {
    try {
      // safeLog('GET_P2P_DATA called for case:', caseId);
      const stmt = db.prepare('SELECT * FROM p2p_data WHERE case_id = ? LIMIT 1');
      const p2pData = stmt.get(caseId);
      // safeLog('GET_P2P_DATA result:', p2pData);
      return p2pData || null;
    } catch (error) {
      // safeLog('GET_P2P_DATA error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.SAVE_P2P_DATA, async (_event, data) => {
    try {
      // safeLog('SAVE_P2P_DATA called with:', data);
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO p2p_data 
        (case_id, download_date, platform, suspect_ip, ip_provider, download_folder_path)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        data.caseId,
        data.downloadDate || null,
        data.platform || null,
        data.suspectIp || null,
        data.ipProvider || null,
        data.downloadFolderPath || null
      );
      
      // safeLog('SAVE_P2P_DATA success');
      return { success: true };
    } catch (error) {
      // safeLog('SAVE_P2P_DATA error:', error);
      throw error;
    }
  });

  // ========== P2P Tools ==========
  
  ipcMain.handle(IPC_CHANNELS.ARIN_LOOKUP, async (_event, ipAddress: string) => {
    try {
      // safeLog('ARIN_LOOKUP called for IP:', ipAddress);
      
      const https = require('https');
      
      return new Promise((resolve) => {
        const options = {
          hostname: 'whois.arin.net',
          port: 443,
          path: `/rest/ip/${ipAddress}`,
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        };
        
        const req = https.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              
              // Extract relevant information from ARIN response
              const net = jsonData.net;
              if (net) {
                const orgRef = net.orgRef;
                const netBlocks = net.netBlocks?.netBlock;
                
                let netRange = '';
                if (netBlocks) {
                  const block = Array.isArray(netBlocks) ? netBlocks[0] : netBlocks;
                  netRange = `${block.startAddress?.$} - ${block.endAddress?.$}`;
                }
                
                resolve({
                  success: true,
                  provider: orgRef?.['@name'] || 'Unknown',
                  organization: orgRef?.['@name'] || 'Unknown',
                  network: net.name?.$,
                  netRange: netRange
                });
              } else {
                resolve({
                  success: false,
                  error: 'No network information found'
                });
              }
            } catch (parseError) {
              // safeLog('ARIN parse error:', parseError);
              resolve({
                success: false,
                error: 'Failed to parse ARIN response'
              });
            }
          });
        });
        
        req.on('error', (error) => {
          // safeLog('ARIN request error:', error);
          resolve({
            success: false,
            error: error.message
          });
        });
        
        req.end();
      });
    } catch (error) {
      // safeLog('ARIN_LOOKUP error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.PING_IP, async (_event, ipAddress: string) => {
    try {
      // safeLog('PING_IP called for IP:', ipAddress);
      
      const { exec } = require('child_process');
      const isWindows = process.platform === 'win32';
      
      // Windows: ping -n 4 (4 packets)
      // Linux/Mac: ping -c 4 (4 packets)
      const pingCommand = isWindows 
        ? `ping -n 4 ${ipAddress}`
        : `ping -c 4 ${ipAddress}`;
      
      return new Promise((resolve) => {
        exec(pingCommand, (error, stdout, stderr) => {
          // safeLog('Ping output:', stdout);
          
          if (error && !stdout.includes('Reply from') && !stdout.includes('bytes from')) {
            resolve({
              success: true,
              alive: false,
              host: ipAddress,
              output: stdout + stderr,
              error: 'Host is not responding'
            });
            return;
          }
          
          // Parse ping results
          const lines = stdout.split('\n');
          let alive = false;
          let avgTime = undefined;
          let packetLoss = undefined;
          
          // Check if we got replies
          if (isWindows) {
            alive = stdout.includes('Reply from') || stdout.includes('Approximate round trip times');
            
            // Extract average time: "Average = 23ms"
            const avgMatch = stdout.match(/Average\s*=\s*(\d+)ms/i);
            if (avgMatch) {
              avgTime = parseInt(avgMatch[1]);
            }
            
            // Extract packet loss: "(25% loss)"
            const lossMatch = stdout.match(/\((\d+)%\s*loss\)/i);
            if (lossMatch) {
              packetLoss = parseInt(lossMatch[1]);
            }
          } else {
            alive = stdout.includes('bytes from');
            
            // Extract average time from summary line
            const avgMatch = stdout.match(/min\/avg\/max[^\d]*=\s*[\d.]+\/([\d.]+)\/([\d.]+)/);
            if (avgMatch) {
              avgTime = parseFloat(avgMatch[1]);
            }
            
            // Extract packet loss
            const lossMatch = stdout.match(/(\d+)%\s*packet\s*loss/i);
            if (lossMatch) {
              packetLoss = parseInt(lossMatch[1]);
            }
          }
          
          resolve({
            success: true,
            alive: alive,
            host: ipAddress,
            avgTime: avgTime,
            packetLoss: packetLoss,
            output: stdout
          });
        });
      });
    } catch (error) {
      // safeLog('PING_IP error:', error);
      return {
        success: false,
        alive: false,
        host: ipAddress,
        error: error.message
      };
    }
  });

  // ========== Phone Tools ==========
  
  ipcMain.handle(IPC_CHANNELS.CARRIER_LOOKUP, async (_event, phoneNumber: string) => {
    try {
      // Get API key from environment/config (user must set this)
      const apiKey = process.env.VERIPHONE_API_KEY;
      
      if (!apiKey) {
        return {
          success: false,
          error: 'Veriphone API key not configured. Please add your API key in Settings.'
        };
      }
      
      const https = require('https');
      
      // Format phone number for Veriphone
      // Remove all non-digit characters
      let cleanPhone = phoneNumber.replace(/\D/g, '');
      
      // If it's a 10-digit US number, add +1 prefix
      if (cleanPhone.length === 10) {
        cleanPhone = '+1' + cleanPhone;
      } 
      // If it's 11 digits starting with 1, add + prefix
      else if (cleanPhone.length === 11 && cleanPhone.startsWith('1')) {
        cleanPhone = '+' + cleanPhone;
      }
      // If it doesn't start with +, assume US and add +1
      else if (!cleanPhone.startsWith('+') && cleanPhone.length > 0) {
        cleanPhone = '+1' + cleanPhone;
      }
      
      return new Promise((resolve) => {
        const url = `https://api.veriphone.io/v2/verify?phone=${encodeURIComponent(cleanPhone)}&key=${apiKey}`;
        
        https.get(url, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              
              // Check for API errors
              if (jsonData.error) {
                resolve({
                  success: false,
                  error: jsonData.error
                });
                return;
              }
              
              if (jsonData.phone_valid) {
                resolve({
                  success: true,
                  carrier: jsonData.carrier || 'Unknown',
                  lineType: jsonData.phone_type || 'Unknown',
                  location: jsonData.phone_region || '',
                  countryCode: jsonData.country_code || '',
                  valid: true,
                  formattedNumber: jsonData.international_number || phoneNumber
                });
              } else {
                resolve({
                  success: false,
                  error: 'Invalid phone number'
                });
              }
            } catch (parseError) {
              resolve({
                success: false,
                error: 'Failed to parse response from Veriphone'
              });
            }
          });
        }).on('error', (error) => {
          resolve({
            success: false,
            error: error.message
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // ========== Geocoding ==========
  
  ipcMain.handle(IPC_CHANNELS.GEOCODE_ADDRESS, async (_event, data: { address: string; suspectId: number }) => {
    try {
      const https = require('https');
      const { address, suspectId } = data;
      
      // Use OpenStreetMap Nominatim API (free, no API key required)
      // User-Agent is required by Nominatim usage policy
      const encodedAddress = encodeURIComponent(address);
      const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`;
      
      return new Promise((resolve) => {
        const options = {
          headers: {
            'User-Agent': 'ICAC-PULSE/1.0 (Law Enforcement Case Management)'
          }
        };
        
        https.get(url, options, (res) => {
          let responseData = '';
          
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(responseData);
              
              if (jsonData && jsonData.length > 0) {
                const location = jsonData[0];
                const latitude = parseFloat(location.lat);
                const longitude = parseFloat(location.lon);
                
                // Save coordinates to database
                const db = getDatabase();
                const stmt = db.prepare(`
                  UPDATE suspects 
                  SET latitude = ?, longitude = ?, geocoded_date = ? 
                  WHERE id = ?
                `);
                
                const geocodedDate = new Date().toISOString();
                stmt.run(latitude, longitude, geocodedDate, suspectId);
                
                resolve({
                  success: true,
                  latitude,
                  longitude,
                  displayName: location.display_name || address
                });
              } else {
                resolve({
                  success: false,
                  error: 'Address not found. Please verify the address and try again.'
                });
              }
            } catch (parseError) {
              resolve({
                success: false,
                error: 'Failed to parse geocoding response'
              });
            }
          });
        }).on('error', (error) => {
          resolve({
            success: false,
            error: error.message
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // ========== Secrets/API Keys ==========
  
  ipcMain.handle(IPC_CHANNELS.GET_SECRET, async (_event, keyName: string) => {
    try {
      const configPath = path.join(getUserDataPath(), 'secrets.json');
      
      // Try to load from secrets file
      if (fs.existsSync(configPath)) {
        try {
          const secrets = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          if (secrets[keyName]) {
            // Also set in process.env for current session
            process.env[keyName] = secrets[keyName];
            return secrets[keyName];
          }
        } catch (parseError) {
          // Invalid JSON, continue
        }
      }
      
      // Fall back to environment variable
      return process.env[keyName] || null;
    } catch (error) {
      return null;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.SET_SECRET, async (_event, keyName: string, value: string) => {
    try {
      const configPath = path.join(getUserDataPath(), 'secrets.json');
      
      // Load existing secrets
      let secrets: Record<string, string> = {};
      if (fs.existsSync(configPath)) {
        try {
          secrets = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch (parseError) {
          // Invalid JSON, start fresh
          secrets = {};
        }
      }
      
      // Update or delete secret
      if (value && value.trim()) {
        secrets[keyName] = value;
      } else {
        delete secrets[keyName];
      }
      
      // Save to file
      fs.writeFileSync(configPath, JSON.stringify(secrets, null, 2), 'utf-8');
      
      // Also store in environment for current session
      process.env[keyName] = value;
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
  
  // ========== Chat Data ==========
  
  ipcMain.handle(IPC_CHANNELS.GET_CHAT_DATA, async (_event, caseId: number) => {
    try {
      // safeLog('GET_CHAT_DATA called for case:', caseId);
      const stmt = db.prepare('SELECT * FROM chat_data WHERE case_id = ? LIMIT 1');
      const chatData = stmt.get(caseId);
      
      // Parse identifiers JSON if it exists
      if (chatData && chatData.identifiers) {
        chatData.identifiers = JSON.parse(chatData.identifiers);
      }
      
      // safeLog('GET_CHAT_DATA result:', chatData);
      return chatData || null;
    } catch (error) {
      // safeLog('GET_CHAT_DATA error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.SAVE_CHAT_DATA, async (_event, data) => {
    try {
      // safeLog('SAVE_CHAT_DATA called with:', data);
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO chat_data 
        (case_id, initial_contact_date, platform, identifiers)
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run(
        data.caseId,
        data.initialContactDate || null,
        data.platform || null,
        JSON.stringify(data.identifiers || [])
      );
      
      // safeLog('SAVE_CHAT_DATA success');
      return { success: true };
    } catch (error) {
      // safeLog('SAVE_CHAT_DATA error:', error);
      throw error;
    }
  });
  
  // ========== Other Data ==========
  
  ipcMain.handle(IPC_CHANNELS.GET_OTHER_DATA, async (_event, caseId: number) => {
    try {
      // safeLog('GET_OTHER_DATA called for case:', caseId);
      const stmt = db.prepare('SELECT * FROM other_data WHERE case_id = ? LIMIT 1');
      const otherData = stmt.get(caseId);
      // safeLog('GET_OTHER_DATA result:', otherData);
      return otherData || null;
    } catch (error) {
      // safeLog('GET_OTHER_DATA error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.SAVE_OTHER_DATA, async (_event, data) => {
    try {
      // safeLog('SAVE_OTHER_DATA called with:', data);
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO other_data 
        (case_id, case_type_description)
        VALUES (?, ?)
      `);
      
      stmt.run(
        data.caseId,
        data.caseTypeDescription || null
      );
      
      // safeLog('SAVE_OTHER_DATA success');
      return { success: true };
    } catch (error) {
      // safeLog('SAVE_OTHER_DATA error:', error);
      throw error;
    }
  });
  
  // ========== Warrants ==========
  
  ipcMain.handle(IPC_CHANNELS.ADD_WARRANT, async (_event, warrant) => {
    try {
      // safeLog('ADD_WARRANT called with:', warrant);
      
      const stmt = db.prepare(`
        INSERT INTO warrants 
        (case_id, company_name, date_issued, date_served, date_due, received, 
         date_received, warrant_pdf_path, return_files_path, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        warrant.case_id,
        warrant.company_name || '',
        warrant.date_issued || null,
        warrant.date_served || null,
        warrant.date_due || null,
        warrant.received ? 1 : 0,
        warrant.date_received || null,
        warrant.warrant_pdf_path || null,
        warrant.return_files_path || null,
        warrant.notes || null
      );
      
      // safeLog('Warrant added with ID:', result.lastInsertRowid);
      return { id: result.lastInsertRowid, ...warrant };
    } catch (error) {
      // safeLog('ADD_WARRANT error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.UPDATE_WARRANT, async (_event, warrantId: number, updates: any) => {
    try {
      // safeLog('UPDATE_WARRANT called with ID:', warrantId, 'updates:', updates);
      
      const fields: string[] = [];
      const values: any[] = [];
      
      // Handle all possible update fields
      if (updates.company_name !== undefined) {
        fields.push('company_name = ?');
        values.push(updates.company_name);
      }
      if (updates.date_issued !== undefined) {
        fields.push('date_issued = ?');
        values.push(updates.date_issued);
      }
      if (updates.date_served !== undefined) {
        fields.push('date_served = ?');
        values.push(updates.date_served || null);
      }
      if (updates.date_due !== undefined) {
        fields.push('date_due = ?');
        values.push(updates.date_due);
      }
      if (updates.received !== undefined) {
        fields.push('received = ?');
        values.push(updates.received ? 1 : 0);
      }
      if (updates.date_received !== undefined) {
        fields.push('date_received = ?');
        values.push(updates.date_received || null);
      }
      if (updates.warrant_pdf_path !== undefined) {
        fields.push('warrant_pdf_path = ?');
        values.push(updates.warrant_pdf_path || null);
      }
      if (updates.return_files_path !== undefined) {
        fields.push('return_files_path = ?');
        values.push(updates.return_files_path || null);
      }
      if (updates.notes !== undefined) {
        fields.push('notes = ?');
        values.push(updates.notes || null);
      }
      
      if (fields.length === 0) {
        // safeLog('No fields to update');
        return { success: true };
      }
      
      values.push(warrantId);
      
      const stmt = db.prepare(`
        UPDATE warrants SET ${fields.join(', ')} WHERE id = ?
      `);
      
      stmt.run(...values);
      
      // safeLog('Warrant updated successfully');
      return { success: true };
    } catch (error) {
      // safeLog('UPDATE_WARRANT error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.GET_WARRANTS, async (_event, caseId: number) => {
    const stmt = db.prepare('SELECT * FROM warrants WHERE case_id = ? ORDER BY date_issued DESC');
    return stmt.all(caseId);
  });
  
  ipcMain.handle(IPC_CHANNELS.DELETE_WARRANT, async (_event, warrantId: number) => {
    const stmt = db.prepare('DELETE FROM warrants WHERE id = ?');
    stmt.run(warrantId);
    return { success: true };
  });
  
  // ========== Dashboard Stats ==========
  
  ipcMain.handle(IPC_CHANNELS.GET_DASHBOARD_STATS, async () => {
    try {
      // safeLog('GET_DASHBOARD_STATS called');
      
      // Use raw database to avoid DBWrapper issues
      const rawDb = getRawDatabase();
      
      // Total cases
      const totalCasesResult = rawDb.exec('SELECT COUNT(*) as count FROM cases');
      const totalCases = totalCasesResult.length > 0 ? totalCasesResult[0].values[0][0] : 0;
      // safeLog('Total cases:', totalCases);
      
      // Cases by type
      const casesByTypeResult = rawDb.exec('SELECT case_type, COUNT(*) as count FROM cases GROUP BY case_type');
      // safeLog('Cases by type result:', casesByTypeResult);
      
      const typeStats: any = {
        cybertip: 0,
        p2p: 0,
        chat: 0,
        other: 0
      };
      
      if (casesByTypeResult.length > 0) {
        const columns = casesByTypeResult[0].columns; // ['case_type', 'count']
        casesByTypeResult[0].values.forEach(row => {
          const caseType = row[0] as string; // First column is case_type
          const count = row[1] as number;    // Second column is count
          typeStats[caseType] = count;
        });
      }
      // safeLog('Type stats:', typeStats);
      
      // Cases by status
      const casesByStatusResult = rawDb.exec('SELECT status, COUNT(*) as count FROM cases GROUP BY status');
      // safeLog('Cases by status result:', casesByStatusResult);
      
      const statusStats: any = {
        open: 0,
        warrants_issued: 0,
        ready_residential: 0,
        arrest: 0,
        closed_no_arrest: 0,
        referred: 0
      };
      
      if (casesByStatusResult.length > 0) {
        casesByStatusResult[0].values.forEach(row => {
          const status = row[0] as string;
          const count = row[1] as number;
          statusStats[status] = count;
        });
      }
      // safeLog('Status stats:', statusStats);
      
      // Overdue warrants
      const overdueWarrantsResult = rawDb.exec(`
        SELECT 
          w.id,
          w.case_id,
          c.case_number,
          w.company_name,
          w.date_due,
          CAST(julianday('now') - julianday(w.date_due) AS INTEGER) as days_overdue
        FROM warrants w
        JOIN cases c ON w.case_id = c.id
        WHERE w.received = 0 AND date(w.date_due) < date('now')
        ORDER BY w.date_due ASC
      `);
      
      const overdueWarrants: any[] = [];
      if (overdueWarrantsResult.length > 0) {
        const columns = overdueWarrantsResult[0].columns;
        // safeLog('Overdue warrant columns:', columns);
        overdueWarrantsResult[0].values.forEach(row => {
          const warrant: any = {};
          columns.forEach((col, idx) => {
            warrant[col] = row[idx];
          });
          overdueWarrants.push(warrant);
        });
      }
      // safeLog('Overdue warrants:', overdueWarrants.length);
      if (overdueWarrants.length > 0) {
        // safeLog('First overdue warrant:', JSON.stringify(overdueWarrants[0], null, 2));
      }
      
      // Warrants written this month
      const warrantsThisMonthResult = rawDb.exec(`
        SELECT COUNT(*) as count 
        FROM warrants 
        WHERE strftime('%Y-%m', date_issued) = strftime('%Y-%m', 'now')
      `);
      const warrantsThisMonth = warrantsThisMonthResult.length > 0 ? warrantsThisMonthResult[0].values[0][0] : 0;
      // safeLog('Warrants this month:', warrantsThisMonth);
      
      // New cases this month
      const newCasesThisMonthResult = rawDb.exec(`
        SELECT COUNT(*) as count 
        FROM cases 
        WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
      `);
      const newCasesThisMonth = newCasesThisMonthResult.length > 0 ? newCasesThisMonthResult[0].values[0][0] : 0;
      // safeLog('New cases this month:', newCasesThisMonth);
      
      // DEBUG: Log status stats before creating final stats object
      console.log('=== STATUS STATS DEBUG ===');
      console.log('closed_no_arrest:', statusStats.closed_no_arrest, 'type:', typeof statusStats.closed_no_arrest);
      console.log('arrest:', statusStats.arrest, 'type:', typeof statusStats.arrest);
      console.log('referred:', statusStats.referred, 'type:', typeof statusStats.referred);
      
      // Calculate closed count with safe defaults
      const closedCount = (statusStats.closed_no_arrest || 0) + (statusStats.arrest || 0) + (statusStats.referred || 0);
      console.log('Calculated closed count:', closedCount);
      
      const stats = {
        total: totalCases as number,
        cybertip: typeStats.cybertip || 0,
        p2p: typeStats.p2p || 0,
        chat: typeStats.chat || 0,
        other: typeStats.other || 0,
        active: statusStats.open || 0,
        warrantsIssued: statusStats.warrants_issued || 0,
        readyResidential: statusStats.ready_residential || 0,
        arrests: statusStats.arrest || 0,
        closed: closedCount, // Include arrested and transferred cases in closed count
        transferred: statusStats.referred || 0,
        warrantsThisMonth: warrantsThisMonth as number,
        newCasesThisMonth: newCasesThisMonth as number,
        overdueWarrants: overdueWarrants
      };
      
      console.log('=== FINAL STATS OBJECT ===');
      console.log('closed value:', stats.closed, 'type:', typeof stats.closed);
      console.log('Full stats object:', JSON.stringify(stats, null, 2));
      
      // safeLog('=== FINAL STATS OBJECT ===');
      // safeLog('Total:', stats.total);
      // safeLog('CyberTip:', stats.cybertip);
      // safeLog('P2P:', stats.p2p);
      // safeLog('Chat:', stats.chat);
      // safeLog('Other:', stats.other);
      // safeLog('Active:', stats.active);
      // safeLog('Warrants Issued:', stats.warrantsIssued);
      // safeLog('Ready Residential:', stats.readyResidential);
      // safeLog('Arrests:', stats.arrests);
      // safeLog('Closed:', stats.closed);
      // safeLog('Transferred:', stats.transferred);
      // safeLog('Warrants This Month:', stats.warrantsThisMonth);
      // safeLog('New Cases This Month:', stats.newCasesThisMonth);
      // safeLog('Overdue Warrants:', stats.overdueWarrants.length);
      // safeLog('=== RETURNING STATS ===');
      // safeLog(JSON.stringify(stats, null, 2));
      
      return stats;
    } catch (error) {
      // safeLog('GET_DASHBOARD_STATS error:', error);
      throw error;
    }
  });

  // ========== Generate Dashboard Report ==========
  
  ipcMain.handle(IPC_CHANNELS.GENERATE_DASHBOARD_REPORT, async (_event, data: { dateFrom: string, dateTo: string }) => {
    try {
      // safeLog('GENERATE_DASHBOARD_REPORT called with:', data);
      const { dateFrom, dateTo } = data;
      
      // Get raw database for this handler
      const rawDb = getRawDatabase();
      const db = getDatabase();
      
      const user = db.prepare('SELECT * FROM users LIMIT 1').get() as any;
      
      // Get all cases and filter in JavaScript
      // safeLog('Querying all cases for date range:', dateFrom, 'to', dateTo);
      
      // Use raw database exec to avoid any DBWrapper issues
      const casesResult = rawDb.exec('SELECT * FROM cases');
      // safeLog('Cases query result:', casesResult);
      
      const allCases: any[] = [];
      if (casesResult.length > 0) {
        const columns = casesResult[0].columns;
        // safeLog('Case columns:', columns);
        casesResult[0].values.forEach(row => {
          const obj: any = {};
          columns.forEach((col, idx) => {
            obj[col] = row[idx];
          });
          allCases.push(obj);
        });
      }
      // safeLog('Total cases:', allCases.length);
      
      if (allCases.length > 0) {
        // safeLog('Sample case keys:', Object.keys(allCases[0]));
        // safeLog('Sample case data:', allCases[0]);
      }
      
      // Filter by date range in JavaScript
      const fromDate = new Date(dateFrom);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // Include entire end date
      
      // Date filtering with debug info if needed
      
      const casesInRange = allCases.filter(c => {
        // Try different possible date field names
        const dateField = c.created_at || c.createdAt || c.created || c.date_created;
        if (!dateField) {
          console.warn('No date field found in case:', c);
          return false;
        }
        const caseDate = new Date(dateField);
        
        return caseDate >= fromDate && caseDate <= toDate;
      });
      // safeLog('Cases in range:', casesInRange.length);
      
      const totalNewCases = casesInRange.length;
      
      // Cases by status in range
      const arrestsInRange = casesInRange.filter(c => c.status === 'arrest').length;
      const closedInRange = casesInRange.filter(c => c.status === 'closed_no_arrest').length;
      
      // Warrants added in range
      const warrantsResult = rawDb.exec('SELECT * FROM warrants');
      const allWarrants: any[] = [];
      if (warrantsResult.length > 0) {
        const columns = warrantsResult[0].columns;
        warrantsResult[0].values.forEach(row => {
          const obj: any = {};
          columns.forEach((col, idx) => {
            obj[col] = row[idx];
          });
          allWarrants.push(obj);
        });
      }
      
      const warrantsInDateRange = allWarrants.filter(w => {
        const warrantDate = new Date(w.date_issued);
        return warrantDate >= fromDate && warrantDate <= toDate;
      });
      const warrantsInRange = { count: warrantsInDateRange.length };
      
      // Public Outreach in range
      const outreachResult = rawDb.exec('SELECT * FROM public_outreach');
      const allOutreach: any[] = [];
      if (outreachResult.length > 0) {
        const columns = outreachResult[0].columns;
        outreachResult[0].values.forEach(row => {
          const obj: any = {};
          columns.forEach((col, idx) => {
            obj[col] = row[idx];
          });
          allOutreach.push(obj);
        });
      }
      
      const outreachInDateRange = allOutreach.filter(o => {
        const outreachDate = new Date(o.date);
        return outreachDate >= fromDate && outreachDate <= toDate;
      });
      
      const totalOutreachEvents = outreachInDateRange.length;
      const publicOutreachEvents = outreachInDateRange.filter(o => o.is_law_enforcement === 0).length;
      const leoTrainingEvents = outreachInDateRange.filter(o => o.is_law_enforcement === 1).length;
      const totalIndividualsTrained = outreachInDateRange.reduce((sum, o) => sum + (o.num_attendees || 0), 0);
      
      // Cases by type in range
      const casesByType = {
        cybertip: casesInRange.filter(c => c.case_type === 'cybertip').length,
        p2p: casesInRange.filter(c => c.case_type === 'p2p').length,
        chat: casesInRange.filter(c => c.case_type === 'chat').length,
        other: casesInRange.filter(c => c.case_type === 'other').length
      };
      
      // Cases by status in range
      const casesByStatus = {
        open: casesInRange.filter(c => c.status === 'open').length,
        warrants_issued: casesInRange.filter(c => c.status === 'warrants_issued').length,
        ready_residential: casesInRange.filter(c => c.status === 'ready_residential').length,
        arrest: arrestsInRange,
        closed_no_arrest: closedInRange,
        referred: casesInRange.filter(c => c.status === 'referred').length
      };
      
      // Create HTML for report
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #0B1120 0%, #1a2332 100%);
      color: #E0E0FF;
      padding: 40px;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: linear-gradient(135deg, #121A2C 0%, #1a2332 100%);
      border: 2px solid #00D4FF;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 0 40px rgba(0, 212, 255, 0.3);
    }
    
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 2px solid #00D4FF;
    }
    
    .logo {
      font-size: 36px;
      font-weight: bold;
      background: linear-gradient(135deg, #00D4FF 0%, #FF2A6D 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 10px;
      text-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
    }
    
    .subtitle {
      color: #94A3C0;
      font-size: 14px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    
    .date-range {
      text-align: center;
      font-size: 20px;
      color: #00D4FF;
      margin-bottom: 30px;
      padding: 15px;
      background: rgba(0, 212, 255, 0.1);
      border-radius: 8px;
      border: 1px solid rgba(0, 212, 255, 0.3);
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background: linear-gradient(135deg, rgba(0, 212, 255, 0.05) 0%, rgba(0, 212, 255, 0.1) 100%);
      border: 1px solid rgba(0, 212, 255, 0.3);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    
    .stat-card.pink {
      background: linear-gradient(135deg, rgba(255, 42, 109, 0.05) 0%, rgba(255, 42, 109, 0.1) 100%);
      border-color: rgba(255, 42, 109, 0.3);
    }
    
    .stat-card.yellow {
      background: linear-gradient(135deg, rgba(255, 184, 0, 0.05) 0%, rgba(255, 184, 0, 0.1) 100%);
      border-color: rgba(255, 184, 0, 0.3);
    }
    
    .stat-card.green {
      background: linear-gradient(135deg, rgba(57, 255, 160, 0.05) 0%, rgba(57, 255, 160, 0.1) 100%);
      border-color: rgba(57, 255, 160, 0.3);
    }
    
    .stat-value {
      font-size: 48px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .stat-card .stat-value { color: #00D4FF; }
    .stat-card.pink .stat-value { color: #FF2A6D; }
    .stat-card.yellow .stat-value { color: #FFB800; }
    .stat-card.green .stat-value { color: #39FFA0; }
    
    .stat-label {
      color: #94A3C0;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section-title {
      color: #00D4FF;
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(0, 212, 255, 0.3);
    }
    
    .breakdown-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
    }
    
    .breakdown-item {
      background: rgba(0, 212, 255, 0.05);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 8px;
      padding: 15px;
      text-align: center;
    }
    
    .breakdown-value {
      font-size: 28px;
      font-weight: bold;
      color: #00D4FF;
      margin-bottom: 5px;
    }
    
    .breakdown-label {
      color: #94A3C0;
      font-size: 12px;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid rgba(0, 212, 255, 0.3);
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #94A3C0;
      font-size: 12px;
    }
    
    .footer-left {
      text-align: left;
    }
    
    .footer-right {
      text-align: right;
    }
    
    @media print {
      body {
        background: white;
      }
      
      .container {
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo">ICAC P.U.L.S.E.</div>
      <div class="subtitle">Dashboard Report</div>
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(0, 212, 255, 0.2);">
        <div style="color: #94A3C0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Officer</div>
        <div style="color: #00D4FF; font-size: 18px; font-weight: bold; margin-top: 5px;">${user?.username || 'Unknown Officer'}</div>
      </div>
    </div>
    
    <!-- Date Range -->
    <div class="date-range">
      Report Period: ${new Date(dateFrom).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - ${new Date(dateTo).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
    </div>
    
    <!-- Key Metrics -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${totalNewCases}</div>
        <div class="stat-label">New Cases</div>
      </div>
      
      <div class="stat-card yellow">
        <div class="stat-value">${warrantsInRange.count}</div>
        <div class="stat-label">Warrants Issued</div>
      </div>
      
      <div class="stat-card pink">
        <div class="stat-value">${arrestsInRange}</div>
        <div class="stat-label">Arrests Made</div>
      </div>
      
      <div class="stat-card green">
        <div class="stat-value">${closedInRange}</div>
        <div class="stat-label">Cases Closed</div>
      </div>
    </div>
    
    <!-- Case Type Breakdown -->
    <div class="section">
      <div class="section-title">Case Type Distribution</div>
      <div class="breakdown-grid">
        <div class="breakdown-item">
          <div class="breakdown-value">${casesByType.cybertip}</div>
          <div class="breakdown-label">CyberTip</div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-value">${casesByType.p2p}</div>
          <div class="breakdown-label">P2P</div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-value">${casesByType.chat}</div>
          <div class="breakdown-label">Chat</div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-value">${casesByType.other}</div>
          <div class="breakdown-label">Other</div>
        </div>
      </div>
    </div>
    
    <!-- Status Breakdown -->
    <div class="section" style="page-break-before: always;">
      <div class="section-title">Case Status Distribution</div>
      <div class="breakdown-grid">
        <div class="breakdown-item">
          <div class="breakdown-value">${casesByStatus.open}</div>
          <div class="breakdown-label">Open</div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-value">${casesByStatus.warrants_issued}</div>
          <div class="breakdown-label">Waiting Warrants</div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-value">${casesByStatus.ready_residential}</div>
          <div class="breakdown-label">Ready Residential</div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-value">${casesByStatus.arrest}</div>
          <div class="breakdown-label">Arrested</div>
        </div>
      </div>
    </div>
    
    <!-- Public Outreach Section -->
    <div class="section">
      <div class="section-title">Public Outreach & Training</div>
      <div class="breakdown-grid">
        <div class="breakdown-item">
          <div class="breakdown-value">${totalOutreachEvents}</div>
          <div class="breakdown-label">Total Events</div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-value">${publicOutreachEvents}</div>
          <div class="breakdown-label">Public Outreach</div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-value">${leoTrainingEvents}</div>
          <div class="breakdown-label">LE Training</div>
        </div>
        <div class="breakdown-item">
          <div class="breakdown-value">${totalIndividualsTrained}</div>
          <div class="breakdown-label">Total Attendees</div>
        </div>
      </div>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <div class="footer-left">
        Prepared by: ${user?.username || 'Unknown Officer'}
      </div>
      <div class="footer-right">
        ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  </div>
</body>
</html>
      `;
      
      // Create a hidden window to render HTML and print to PDF
      const { BrowserWindow } = require('electron');
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });
      
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      
      // Wait a bit for rendering
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate PDF
      const pdfData = await printWindow.webContents.printToPDF({
        printBackground: true,
        margins: {
          top: 0.5,
          bottom: 0.5,
          left: 0.5,
          right: 0.5
        }
      });
      
      // Save PDF
      const dateStr = `${dateFrom}_to_${dateTo}`.replace(/\//g, '-');
      const fileName = `Dashboard_Report_${dateStr}.pdf`;
      
      // Use Electron's app.getPath to get the Downloads folder
      const downloadsPath = app.getPath('downloads');
      const filePath = path.join(downloadsPath, fileName);
      
      // safeLog('Saving PDF to:', filePath);
      // safeLog('Downloads path resolved as:', downloadsPath);
      
      // Write the PDF file
      fs.writeFileSync(filePath, pdfData);
      
      // Verify file was written
      if (!fs.existsSync(filePath)) {
        throw new Error(`Failed to write PDF file: ${filePath}`);
      }
      
      // safeLog('PDF saved successfully, size:', fs.statSync(filePath).size, 'bytes');
      
      // Close the print window
      printWindow.close();
      
      // Open the folder containing the PDF
      const { shell } = require('electron');
      shell.showItemInFolder(filePath);
      
      // safeLog('Opened folder for:', filePath);
      
      return { success: true, filePath };
    } catch (error) {
      // safeLog('Failed to generate dashboard report:', error);
      throw error;
    }
  });

  // ========== Search ==========
  
  ipcMain.handle(IPC_CHANNELS.SEARCH_CASES, async (_event, query: string) => {
    try {
      // safeLog('SEARCH_CASES called with query:', query);
      
      const searchTerm = `%${query}%`;
      const results: any = {
        cases: [],
        identifiers: [],
        suspects: []
      };
      
      // Search cases by case number
      const casesStmt = db.prepare(`
        SELECT * FROM cases 
        WHERE case_number LIKE ? 
        ORDER BY created_at DESC
        LIMIT 50
      `);
      results.cases = casesStmt.all(searchTerm);
      
      // Search CyberTip identifiers (email, username, IP, phone)
      const identifiersStmt = db.prepare(`
        SELECT i.*, c.case_number 
        FROM cybertip_identifiers i
        JOIN cases c ON i.case_id = c.id
        WHERE i.identifier_value LIKE ?
        LIMIT 50
      `);
      results.identifiers = identifiersStmt.all(searchTerm);
      
      // Search suspects by name, phone, address
      const suspectsStmt = db.prepare(`
        SELECT s.*, c.case_number 
        FROM suspects s
        JOIN cases c ON s.case_id = c.id
        WHERE s.name LIKE ? 
          OR s.phone LIKE ? 
          OR s.address LIKE ?
        LIMIT 50
      `);
      results.suspects = suspectsStmt.all(searchTerm, searchTerm, searchTerm);
      
      // Search complete
      return results;
    } catch (error) {
      // safeLog('SEARCH_CASES error:', error);
      throw error;
    }
  });
  
  // ========== Settings ==========
  
  ipcMain.handle(IPC_CHANNELS.GET_CASES_PATH, async () => {
    return getCasesPath();
  });

  ipcMain.handle(IPC_CHANNELS.CHANGE_CASES_PATH, async (_event, newPath: string) => {
    try {
      // safeLog('CHANGE_CASES_PATH called with:', newPath);
      
      // Validate the new path exists
      if (!fs.existsSync(newPath)) {
        throw new Error('Selected path does not exist');
      }
      
      // Check write permissions by trying to create a test file
      const testFile = path.join(newPath, '.icac_test');
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
      } catch (error) {
        throw new Error('No write permission for selected path');
      }
      
      return { success: true, newPath };
    } catch (error) {
      // safeLog('CHANGE_CASES_PATH error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MIGRATE_CASE_FILES, async (event, data: { oldPath: string, newPath: string }) => {
    try {
      // safeLog('MIGRATE_CASE_FILES called:', data);
      const { oldPath, newPath } = data;
      
      // Ensure new path exists
      if (!fs.existsSync(newPath)) {
        fs.mkdirSync(newPath, { recursive: true });
      }
      
      // Get list of all case folders
      const caseFolders = fs.readdirSync(oldPath).filter(item => {
        const itemPath = path.join(oldPath, item);
        return fs.statSync(itemPath).isDirectory();
      });
      
      // safeLog(`Found ${caseFolders.length} case folders to migrate`);
      
      // Copy each case folder
      let copiedFolders = 0;
      let totalFiles = 0;
      
      for (const caseFolder of caseFolders) {
        const sourcePath = path.join(oldPath, caseFolder);
        const destPath = path.join(newPath, caseFolder);
        
        // Count files for progress
        const fileCount = countFiles(sourcePath);
        totalFiles += fileCount;
        
        // safeLog(`Copying case folder: ${caseFolder} (${fileCount} files)`);
        
        // Copy directory recursively
        copyDirectoryRecursive(sourcePath, destPath, (currentFile, filesProcessed) => {
          // Send progress update
          event.sender.send('migration-progress', {
            currentFolder: caseFolder,
            foldersCompleted: copiedFolders,
            totalFolders: caseFolders.length,
            currentFile: currentFile,
            filesProcessed: filesProcessed,
            totalFiles: totalFiles,
            percentage: Math.round((filesProcessed / totalFiles) * 100)
          });
        });
        
        copiedFolders++;
      }
      
      // Update the config to use new path
      setCasesPath(newPath);
      
      // safeLog(`Migration complete: ${copiedFolders} folders, ${totalFiles} files`);
      
      return { 
        success: true, 
        foldersCopied: copiedFolders,
        filesCopied: totalFiles 
      };
    } catch (error) {
      // safeLog('MIGRATE_CASE_FILES error:', error);
      throw error;
    }
  });

  // ========== Window Management ==========
  
  ipcMain.handle(IPC_CHANNELS.RESTORE_WINDOW_FOCUS, async () => {
    try {
      const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (window) {
        // Blur then refocus to "reset" the window's focus state
        window.blur();
        setTimeout(() => {
          window.focus();
          window.webContents.focus();
        }, 50);
      }
      return { success: true };
    } catch (error) {
      // safeLog('Failed to restore window focus:', error);
      return { success: false, error };
    }
  });

  // ========== Export DA Case ==========
  
  // Case Transfer - Export Complete Case
  ipcMain.handle(IPC_CHANNELS.GET_EXPORT_SIZE, async (_event, caseId: number) => {
    try {
      const { calculateExportSize } = require('./caseExporter');
      const size = await calculateExportSize(caseId);
      return { success: true, size };
    } catch (error: any) {
      // safeLog('GET_EXPORT_SIZE error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT_COMPLETE_CASE, async (_event, data: any) => {
    try {
      // safeLog('EXPORT_COMPLETE_CASE called for case:', data.caseId);
      const { caseId, password } = data;
      
      // Get case info for default filename
      const db = getDatabase();
      const caseStmt = db.prepare('SELECT case_number FROM cases WHERE id = ?');
      const caseInfo = caseStmt.get(caseId);
      
      if (!caseInfo) {
        throw new Error('Case not found');
      }
      
      const defaultFilename = `Case_${caseInfo.case_number}_Transfer.pulse`;
      
      // Ask user where to save
      const result = await dialog.showSaveDialog({
        title: 'Save PULSE Case File',
        defaultPath: defaultFilename,
        filters: [
          { name: 'PULSE Case Files', extensions: ['pulse'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        buttonLabel: 'Export'
      });
      
      // Restore focus
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
      }
      
      if (result.canceled || !result.filePath) {
        return { success: false, cancelled: true };
      }
      
      const outputPath = result.filePath;
      
      // Import exporter and run export
      const { exportCompleteCase } = require('./caseExporter');
      
      const exportResult = await exportCompleteCase({
        caseId,
        password,
        outputPath,
        onProgress: (progress: any) => {
          // Send progress to renderer
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('export-progress', progress);
          }
        }
      });
      
      if (exportResult.success) {
        // Open folder
        require('electron').shell.showItemInFolder(outputPath);
      }
      
      return exportResult;
      
    } catch (error: any) {
      // safeLog('EXPORT_COMPLETE_CASE error:', error);
      return { success: false, error: error.message };
    }
  });

  // Case Transfer - Import Complete Case
  ipcMain.handle(IPC_CHANNELS.VALIDATE_IMPORT_FILE, async (_event, data: any) => {
    try {
      const { filePath, password } = data;
      const { validateImportFile } = require('./caseImporter');
      
      const result = await validateImportFile(filePath, password);
      return result;
      
    } catch (error: any) {
      // safeLog('VALIDATE_IMPORT_FILE error:', error);
      return { valid: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_COMPLETE_CASE, async (_event, data: any) => {
    try {
      // safeLog('IMPORT_COMPLETE_CASE called');
      const { filePath, password } = data;
      
      // Import importer and run import
      const { importCompleteCase } = require('./caseImporter');
      
      const importResult = await importCompleteCase({
        filePath,
        password,
        onProgress: (progress: any) => {
          // Send progress to renderer
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('import-progress', progress);
          }
        }
      });
      
      return importResult;
      
    } catch (error: any) {
      // safeLog('IMPORT_COMPLETE_CASE error:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT_DA_CASE, async (_event, data: any) => {
    try {
      // safeLog('EXPORT_DA_CASE called for case:', data.caseId);
      
      const { caseId, caseNumber, caseType, exportOptions } = data;
      
      // Ask user to select export destination
      const result = await dialog.showOpenDialog({
        title: 'Select Export Destination (USB Drive, External Drive, etc.)',
        properties: ['openDirectory'],
        buttonLabel: 'Select Destination'
      });
      
      // Restore focus to main window after dialog closes
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
      }
      
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, cancelled: true };
      }
      
      const exportDestination = result.filePaths[0];
      const exportFolderName = `Case_${caseNumber}_DA_Export`;
      const exportPath = path.join(exportDestination, exportFolderName);
      
      // Create export folder
      if (fs.existsSync(exportPath)) {
        const overwrite = await dialog.showMessageBox({
          type: 'warning',
          buttons: ['Cancel', 'Overwrite'],
          defaultId: 0,
          title: 'Folder Exists',
          message: `A folder named "${exportFolderName}" already exists at this location.`,
          detail: 'Do you want to overwrite it?'
        });
        
        // Restore focus to main window after dialog closes
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.focus();
        }
        
        if (overwrite.response === 0) {
          return { success: false, cancelled: true };
        }
        
        // Delete existing folder
        fs.rmSync(exportPath, { recursive: true, force: true });
      }
      
      fs.mkdirSync(exportPath, { recursive: true });
      
      let filesCount = 0;
      const casePath = path.join(getCasesPath(), caseNumber);
      
      // Helper function to copy directory recursively
      const copyDirectory = (src: string, dest: string) => {
        if (!fs.existsSync(src)) return;
        
        fs.mkdirSync(dest, { recursive: true });
        const entries = fs.readdirSync(src, { withFileTypes: true });
        
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          
          if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
            filesCount++;
          }
        }
      };
      
      // 1. Export CyberTip files (if CyberTip case and selected)
      if (caseType === 'cybertip' && exportOptions.cybertip) {
        const cybertipSrc = path.join(casePath, 'cybertip');
        if (fs.existsSync(cybertipSrc)) {
          const cybertipDest = path.join(exportPath, '1_CyberTip_Files');
          copyDirectory(cybertipSrc, cybertipDest);
          // safeLog('Exported CyberTip files');
        }
      }
      
      // 2. Export Warrants (PDFs and return folders) if selected
      if (exportOptions.warrants) {
        const warrantsSrc = path.join(casePath, 'warrants');
        if (fs.existsSync(warrantsSrc)) {
          const warrantsDest = path.join(exportPath, '2_Search_Warrants');
          copyDirectory(warrantsSrc, warrantsDest);
          // safeLog('Exported warrants');
        }
      }
      
      // 3. Export Case Notes if selected
      if (exportOptions.notes) {
        const notes = db.prepare('SELECT * FROM case_notes WHERE case_id = ? ORDER BY created_at ASC').all(caseId);
        if (notes && notes.length > 0) {
          const notesDest = path.join(exportPath, '3_Case_Notes');
          fs.mkdirSync(notesDest, { recursive: true });
          
          // Create a text file with all notes
          let notesContent = `Case Notes - Case ${caseNumber}\n`;
          notesContent += `Generated: ${new Date().toLocaleString()}\n`;
          notesContent += `Total Notes: ${notes.length}\n`;
          notesContent += `${'='.repeat(80)}\n\n`;
          
          notes.forEach((note: any, index: number) => {
            const noteDate = new Date(note.created_at).toLocaleString();
            notesContent += `Note #${index + 1} - ${noteDate}\n`;
            notesContent += `${'-'.repeat(80)}\n`;
            notesContent += `${note.content}\n\n`;
          });
          
          fs.writeFileSync(path.join(notesDest, 'Case_Notes.txt'), notesContent, 'utf-8');
          filesCount++;
          // safeLog('Exported case notes');
        }
      }
      
      // 4. Export Evidence files and folders if selected
      if (exportOptions.evidence) {
        const evidenceSrc = path.join(casePath, 'evidence');
        if (fs.existsSync(evidenceSrc)) {
          const evidenceDest = path.join(exportPath, '4_Evidence');
          copyDirectory(evidenceSrc, evidenceDest);
          // safeLog('Exported evidence');
        }
      }
      
      // Create README file
      const readmeContent = `ICAC P.U.L.S.E. - District Attorney Case Export
${'='.repeat(80)}

Case Number: ${caseNumber}
Case Type: ${caseType.toUpperCase()}
Export Date: ${new Date().toLocaleString()}
Exported By: ${db.prepare('SELECT username FROM users LIMIT 1').get()?.username || 'Unknown'}

${'='.repeat(80)}

Contents of this export:

${caseType === 'cybertip' ? '1. CyberTip Files - NCMEC CyberTipline report and associated files\n' : ''}2. Search Warrants - All warrant PDFs and return data folders
3. Case Notes - Chronological case notes in text format
4. Evidence - All evidence files and folders uploaded to the case

${'='.repeat(80)}

IMPORTANT NOTES:

1. This export contains law enforcement sensitive information
2. Handle according to your agency's data security policies
3. All file timestamps and metadata are preserved
4. Folder structure matches original case organization
5. This is a complete export suitable for prosecution review

${'='.repeat(80)}

For questions about this export, contact the investigating officer.
`;
      
      fs.writeFileSync(path.join(exportPath, 'README.txt'), readmeContent, 'utf-8');
      filesCount++;
      
      // Open the export folder
      require('electron').shell.showItemInFolder(exportPath);
      
      // safeLog(`DA Case export completed: ${exportPath}`);
      // safeLog(`Total files exported: ${filesCount}`);
      
      return { 
        success: true, 
        exportPath,
        filesCount
      };
      
    } catch (error) {
      // safeLog('EXPORT_DA_CASE error:', error);
      throw error;
    }
  });
  
  // ========== File Operations ==========
  
  ipcMain.handle('open-file-dialog', async (_event, options) => {
    const result = await dialog.showOpenDialog(options);
    
    // Restore focus to main window after dialog closes
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
    
    return { canceled: result.canceled, filePaths: result.filePaths };
  });
  
  ipcMain.handle('open-folder-dialog', async (_event, options) => {
    const result = await dialog.showOpenDialog({ ...options, properties: ['openDirectory'] });
    
    // Restore focus to main window after dialog closes
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
    
    return { canceled: result.canceled, filePaths: result.filePaths };
  });

  ipcMain.handle('save-folder-dialog', async (_event, options) => {
    const result = await dialog.showOpenDialog({ ...options, properties: ['openDirectory'] });
    
    // Restore focus to main window after dialog closes
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
    }
    
    return { canceled: result.canceled, filePaths: result.filePaths };
  });
  
  ipcMain.handle(IPC_CHANNELS.UPLOAD_FILE, async (event, options) => {
    try {
      const { sourcePath, caseNumber, category, filename } = options;
      // safeLog('UPLOAD_FILE called:', { sourcePath, caseNumber, category, filename });
      
      // Ensure case directory exists before uploading
      // safeLog('Creating case directory for:', caseNumber);
      fileManager.createCaseDirectory(caseNumber);
      
      // Check if sourcePath is a file or directory
      const fs = require('fs');
      
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source path does not exist: ${sourcePath}`);
      }
      
      const stats = fs.statSync(sourcePath);
      
      let relativePath;
      if (stats.isDirectory()) {
        // safeLog('Source is a directory, using copyFolderToCase');
        
        // Copy with progress callback
        relativePath = fileManager.copyFolderToCase(
          sourcePath, 
          caseNumber, 
          category, 
          filename,
          (progress) => {
            // Send progress update to renderer
            event.sender.send('upload-progress', {
              current: progress.current,
              total: progress.total,
              currentFile: progress.currentFile,
              percentage: Math.round((progress.current / progress.total) * 100)
            });
          }
        );
      } else {
        // safeLog('Source is a file, using copyFileToCase');
        relativePath = fileManager.copyFileToCase(sourcePath, caseNumber, category, filename);
        
        // Send completion for single file
        event.sender.send('upload-progress', {
          current: 1,
          total: 1,
          currentFile: filename || path.basename(sourcePath),
          percentage: 100
        });
      }
      
      // safeLog('File/folder copied to:', relativePath);
      return { relativePath, success: true };
    } catch (error) {
      // safeLog('UPLOAD_FILE error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.OPEN_FILE_LOCATION, async (_event, relativePath: string) => {
    fileManager.openFileLocation(relativePath);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.GET_FILE_PATH, async (_event, relativePath: string) => {
    const absolutePath = fileManager.getAbsolutePath(relativePath);
    return absolutePath;
  });
  
  ipcMain.handle(IPC_CHANNELS.PARSE_NCMEC_PDF, async (_event, pdfPath: string, password?: string) => {
    const parsedData = await parseNCMECPDF(pdfPath, password);
    return parsedData;
  });

  // Copy CyberTip PDF into the case's cybertip directory
  ipcMain.handle('copy-cybertip-pdf', async (_event, sourcePath: string, caseNumber: string) => {
    try {
      const relativePath = fileManager.copyFileToCase(sourcePath, caseNumber, 'cybertip');
      return { success: true, relativePath };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  // ========== Suspects ==========
  
  ipcMain.handle(IPC_CHANNELS.GET_SUSPECT, async (_event, caseId: number) => {
    try {
      // safeLog('GET_SUSPECT called for case:', caseId);
      const stmt = db.prepare('SELECT * FROM suspects WHERE case_id = ? LIMIT 1');
      const suspect = stmt.get(caseId);
      // safeLog('GET_SUSPECT result:', suspect);
      
      return suspect || null;
    } catch (error) {
      // safeLog('GET_SUSPECT error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.SAVE_SUSPECT, async (_event, suspectData: any) => {
    try {
      // safeLog('SAVE_SUSPECT called with:', suspectData);
      
      // Check if suspect exists
      const checkStmt = db.prepare('SELECT id FROM suspects WHERE case_id = ? LIMIT 1');
      const existing = checkStmt.get(suspectData.case_id);
      
      if (existing) {
        // Update existing
        const suspectId = existing.id;
        // safeLog('Updating existing suspect:', suspectId);
        
        const updateStmt = db.prepare(`
          UPDATE suspects SET
            first_name = ?,
            last_name = ?,
            name = ?,
            dob = ?,
            drivers_license = ?,
            address = ?,
            phone = ?,
            phone_carrier = ?,
            phone_line_type = ?,
            phone_location = ?,
            workplace = ?,
            place_of_work = ?,
            height = ?,
            weight = ?,
            hair_color = ?,
            eye_color = ?,
            scars_marks_tattoos = ?,
            vehicle_make = ?,
            vehicle_model = ?,
            vehicle_color = ?,
            license_plate = ?,
            has_weapons = ?,
            firearms_info = ?,
            firearms_pdf_path = ?,
            criminal_history = ?,
            criminal_history_pdf_path = ?
          WHERE id = ?
        `);
        
        updateStmt.run(
          suspectData.first_name || null,
          suspectData.last_name || null,
          suspectData.name || null,
          suspectData.dob || null,
          suspectData.drivers_license || null,
          suspectData.address || null,
          suspectData.phone || null,
          suspectData.phone_carrier || null,
          suspectData.phone_line_type || null,
          suspectData.phone_location || null,
          suspectData.workplace || null,
          suspectData.place_of_work || null,
          suspectData.height || null,
          suspectData.weight || null,
          suspectData.hair_color || null,
          suspectData.eye_color || null,
          suspectData.scars_marks_tattoos || null,
          suspectData.vehicle_make || null,
          suspectData.vehicle_model || null,
          suspectData.vehicle_color || null,
          suspectData.license_plate || null,
          suspectData.has_weapons ? 1 : 0,
          suspectData.firearms_info || null,
          suspectData.firearms_pdf_path || null,
          suspectData.criminal_history || null,
          suspectData.criminal_history_pdf_path || null,
          suspectId
        );
        
        // Query back the updated record to return complete data
        const verifyStmt = db.prepare('SELECT * FROM suspects WHERE id = ?');
        const updated = verifyStmt.get(suspectId);
        // safeLog('Updated suspect:', updated);
        
        return updated;
      } else {
        // Insert new
        // safeLog('Inserting new suspect for case:', suspectData.case_id);
        
        const insertStmt = db.prepare(`
          INSERT INTO suspects 
          (case_id, first_name, last_name, name, dob, drivers_license, address, phone, phone_carrier, phone_line_type, phone_location,
           workplace, place_of_work, height, weight, hair_color, eye_color, scars_marks_tattoos,
           vehicle_make, vehicle_model, vehicle_color, license_plate, has_weapons,
           firearms_info, firearms_pdf_path, criminal_history, criminal_history_pdf_path)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        insertStmt.run(
          suspectData.case_id,
          suspectData.first_name || null,
          suspectData.last_name || null,
          suspectData.name || null,
          suspectData.dob || null,
          suspectData.drivers_license || null,
          suspectData.address || null,
          suspectData.phone || null,
          suspectData.phone_carrier || null,
          suspectData.phone_line_type || null,
          suspectData.phone_location || null,
          suspectData.workplace || null,
          suspectData.place_of_work || null,
          suspectData.height || null,
          suspectData.weight || null,
          suspectData.hair_color || null,
          suspectData.eye_color || null,
          suspectData.scars_marks_tattoos || null,
          suspectData.vehicle_make || null,
          suspectData.vehicle_model || null,
          suspectData.vehicle_color || null,
          suspectData.license_plate || null,
          suspectData.has_weapons ? 1 : 0,
          suspectData.firearms_info || null,
          suspectData.firearms_pdf_path || null,
          suspectData.criminal_history || null,
          suspectData.criminal_history_pdf_path || null
        );
        
        // Query back the inserted record by case_id
        const verifyStmt = db.prepare('SELECT * FROM suspects WHERE case_id = ? LIMIT 1');
        const inserted = verifyStmt.get(suspectData.case_id);
        // safeLog('Inserted suspect:', inserted);
        
        return inserted;
      }
    } catch (error) {
      // safeLog('SAVE_SUSPECT error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.ADD_SUSPECT_PHOTO, async (_event, photoData: any) => {
    try {
      // safeLog('ADD_SUSPECT_PHOTO called with:', photoData);
      
      const stmt = db.prepare(`
        INSERT INTO suspect_photos (suspect_id, photo_path, photo_type, description)
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run(
        photoData.suspect_id,
        photoData.photo_path || null,
        photoData.photo_type || 'suspect',
        photoData.description || null
      );
      
      // Query back the inserted photo
      const verifyStmt = db.prepare('SELECT * FROM suspect_photos WHERE suspect_id = ? AND photo_path = ? LIMIT 1');
      const inserted = verifyStmt.get(photoData.suspect_id, photoData.photo_path);
      // safeLog('Inserted photo:', inserted);
      
      return inserted;
    } catch (error) {
      // safeLog('ADD_SUSPECT_PHOTO error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.GET_SUSPECT_PHOTOS, async (_event, suspectId: number) => {
    try {
      // safeLog('GET_SUSPECT_PHOTOS called for suspect:', suspectId);
      const stmt = db.prepare('SELECT * FROM suspect_photos WHERE suspect_id = ? ORDER BY created_at DESC');
      const photos = stmt.all(suspectId);
      // safeLog('GET_SUSPECT_PHOTOS result:', photos);
      
      return photos || [];
    } catch (error) {
      // safeLog('GET_SUSPECT_PHOTOS error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.DELETE_SUSPECT_PHOTO, async (_event, photoId: number) => {
    try {
      db.run('DELETE FROM suspect_photos WHERE id = ?', [photoId]);
      return { success: true };
    } catch (error) {
      // safeLog('DELETE_SUSPECT_PHOTO error:', error);
      throw error;
    }
  });

  // Return suspect photos with base64 data embedded (for PDF generation in renderer)
  ipcMain.handle(IPC_CHANNELS.GET_SUSPECT_PHOTOS_BASE64, async (_event, suspectId: number) => {
    try {
      const photos = db.prepare('SELECT * FROM suspect_photos WHERE suspect_id = ? ORDER BY photo_type, created_at').all(suspectId) as any[];
      return (photos || []).map((p: any) => {
        let photoData = '';
        try {
          if (p.photo_path) {
            const fullPath = path.join(getCasesPath(), p.photo_path);
            if (fs.existsSync(fullPath)) {
              const buf = fs.readFileSync(fullPath);
              const ext = path.extname(p.photo_path).toLowerCase();
              const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
              photoData = `data:${mime};base64,${buf.toString('base64')}`;
            }
          }
        } catch { /* skip unreadable */ }
        return { ...p, photo_data: photoData };
      });
    } catch (error) {
      throw error;
    }
  });

  // ========== Export Suspect PDF ==========
  
  // Helper: generates suspect PDF as a Buffer (reused by ops plan export)
  async function generateSuspectPdfBuffer(caseId: number, caseNumber: string): Promise<Buffer | null> {
    console.log('generateSuspectPdfBuffer called:', caseId, caseNumber);
    const user = db.prepare('SELECT * FROM users LIMIT 1').get() as any;
    const suspect = db.prepare('SELECT * FROM suspects WHERE case_id = ?').get(caseId) as any;
    console.log('Suspect found:', suspect ? suspect.id : 'null');
    if (!suspect) return null;

    const weapons = db.prepare('SELECT * FROM weapons WHERE suspect_id = ?').all(suspect.id) as any[];
    const photos = db.prepare('SELECT * FROM suspect_photos WHERE suspect_id = ? ORDER BY photo_type, created_at').all(suspect.id) as any[];
    const suspectPhotos = photos.filter(p => p.photo_type === 'suspect');
    const vehiclePhotos = photos.filter(p => p.photo_type === 'vehicle');
    const residencePhotos = photos.filter(p => p.photo_type === 'residence');

    const getImageBase64 = (photoPath: string | null | undefined) => {
      try {
        if (!photoPath) return '';
        const fullPath = path.join(getCasesPath(), photoPath);
        const imageBuffer = fs.readFileSync(fullPath);
        const base64 = imageBuffer.toString('base64');
        const ext = path.extname(photoPath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
        return `data:${mimeType};base64,${base64}`;
      } catch { return ''; }
    };
      
      // Create HTML
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #0B1120 0%, #1a2332 100%);
      color: #E0E0FF;
      padding: 20px;
    }
    
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: linear-gradient(135deg, #121A2C 0%, #1a2332 100%);
      border: 2px solid #FF2A6D;
      border-radius: 16px;
      padding: 30px;
      box-shadow: 0 0 40px rgba(255, 42, 109, 0.3);
    }
    
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #FF2A6D;
    }
    
    .logo {
      font-size: 32px;
      font-weight: bold;
      background: linear-gradient(135deg, #00D4FF 0%, #FF2A6D 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }
    
    .subtitle {
      color: #94A3C0;
      font-size: 12px;
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    
    .case-banner {
      background: linear-gradient(135deg, rgba(255, 42, 109, 0.1) 0%, rgba(255, 42, 109, 0.2) 100%);
      border: 1px solid rgba(255, 42, 109, 0.3);
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      margin-bottom: 20px;
    }
    
    .case-number {
      font-size: 24px;
      font-weight: bold;
      color: #FF2A6D;
    }
    
    .alert-banner {
      background: linear-gradient(135deg, rgba(255, 42, 109, 0.2) 0%, rgba(255, 42, 109, 0.3) 100%);
      border: 2px solid #FF2A6D;
      border-radius: 8px;
      padding: 15px;
      text-align: center;
      margin-bottom: 20px;
    }
    
    .alert-title {
      font-size: 18px;
      font-weight: bold;
      color: #FF2A6D;
      margin-bottom: 5px;
    }
    
    .alert-text {
      color: #E0E0FF;
      font-size: 14px;
    }
    
    .section {
      margin-bottom: 30px;
    }
    
    .section-title {
      color: #00D4FF;
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(0, 212, 255, 0.3);
      display: flex;
      align-items: center;
      gap: 10px;
      page-break-after: avoid;
    }
    
    .section-icon {
      font-size: 24px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 0;
    }
    
    .info-item {
      background: rgba(0, 212, 255, 0.05);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 8px;
      padding: 10px 12px;
      page-break-inside: avoid;
    }
    
    .info-label {
      color: #94A3C0;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5px;
    }
    
    .info-value {
      color: #E0E0FF;
      font-size: 15px;
      font-weight: 600;
    }
    
    .weapons-list {
      background: rgba(255, 42, 109, 0.05);
      border: 1px solid rgba(255, 42, 109, 0.3);
      border-radius: 8px;
      padding: 15px;
    }
    
    .weapon-item {
      color: #E0E0FF;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 42, 109, 0.2);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .weapon-item:last-child {
      border-bottom: none;
    }
    
    .weapon-bullet {
      color: #FF2A6D;
      font-weight: bold;
    }
    
    .photos-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-top: 15px;
    }
    
    .photo-card {
      background: rgba(0, 212, 255, 0.05);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 8px;
      overflow: hidden;
    }
    
    .photo-img {
      width: 100%;
      height: 200px;
      object-fit: cover;
      display: block;
    }
    
    .photo-caption {
      padding: 8px;
      font-size: 11px;
      color: #94A3C0;
      text-align: center;
    }
    
    .residence-photos-grid {
      grid-template-columns: repeat(4, 1fr);
    }
    
    .residence-photos-grid .photo-img {
      height: 150px;
    }
    
    .no-data {
      color: #94A3C0;
      font-style: italic;
      text-align: center;
      padding: 20px;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 42, 109, 0.3);
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #94A3C0;
      font-size: 11px;
    }
    
    .page-break {
      page-break-before: always;
    }
    
    @media print {
      body {
        background: white;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo">ICAC P.U.L.S.E.</div>
      <div class="subtitle">Suspect Intelligence Report</div>
    </div>
    
    <!-- Case Number -->
    <div class="case-banner">
      <div class="case-number">CASE ${caseNumber}</div>
    </div>
    
    <!-- Alert Banner -->
    <div class="alert-banner">
      <div class="alert-title">⚠️ LAW ENFORCEMENT SENSITIVE ⚠️</div>
      <div class="alert-text">This document contains confidential suspect information for authorized personnel only</div>
    </div>
    
    <!-- Suspect Description -->
    <div class="section">
      <div class="section-title">
        <span class="section-icon">👤</span>
        <span>Suspect Description</span>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">First Name</div>
          <div class="info-value">${suspect.first_name || 'Unknown'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Last Name</div>
          <div class="info-value">${suspect.last_name || 'Unknown'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Date of Birth</div>
          <div class="info-value">${suspect.dob || 'Unknown'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Phone Number</div>
          <div class="info-value">${suspect.phone || 'Unknown'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Driver's License</div>
          <div class="info-value">${suspect.drivers_license || 'Unknown'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Height</div>
          <div class="info-value">${suspect.height || 'Unknown'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Weight</div>
          <div class="info-value">${suspect.weight || 'Unknown'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Hair Color</div>
          <div class="info-value">${suspect.hair_color || 'Unknown'}</div>
        </div>
      </div>
      <div class="info-grid" style="margin-top: 12px;">
        <div class="info-item">
          <div class="info-label">Eye Color</div>
          <div class="info-value">${suspect.eye_color || 'Unknown'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Scars / Marks / Tattoos</div>
          <div class="info-value">${suspect.scars_marks_tattoos || 'None'}</div>
        </div>
      </div>
    </div>
    
    <!-- Residential Information -->
    <div class="section">
      <div class="section-title">
        <span class="section-icon">🏠</span>
        <span>Residential Information</span>
      </div>
      <div class="info-grid">
        <div class="info-item" style="grid-column: 1 / -1;">
          <div class="info-label">Address</div>
          <div class="info-value">${suspect.address || 'Unknown'}</div>
        </div>
        <div class="info-item" style="grid-column: 1 / -1;">
          <div class="info-label">Place of Work</div>
          <div class="info-value">${suspect.place_of_work || 'Unknown'}</div>
        </div>
      </div>
    </div>
    
    <!-- Vehicle Information -->
    <div class="section">
      <div class="section-title">
        <span class="section-icon">🚗</span>
        <span>Vehicle Information</span>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Make</div>
          <div class="info-value">${suspect.vehicle_make || 'Unknown'}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Model</div>
          <div class="info-value">${suspect.vehicle_model || 'Unknown'}</div>
        </div>
        <div class="info-item" style="grid-column: 1 / -1;">
          <div class="info-label">Color</div>
          <div class="info-value">${suspect.vehicle_color || 'Unknown'}</div>
        </div>
        <div class="info-item" style="grid-column: 1 / -1;">
          <div class="info-label">License Plate</div>
          <div class="info-value">${suspect.license_plate || 'Unknown'}</div>
        </div>
      </div>
    </div>
    
    <!-- Registered Firearms -->
    <div class="section">
      <div class="section-title">
        <span class="section-icon">🔫</span>
        <span>Registered Firearms</span>
      </div>
      ${(() => {
        const hasPdf = !!suspect.firearms_pdf_path;
        let entries: any[] = [];
        try { entries = suspect.firearms_info ? JSON.parse(suspect.firearms_info) : []; if (!Array.isArray(entries)) entries = []; } catch { entries = []; }
        if (entries.length === 0 && !hasPdf) return '<div class="no-data">No registered firearms</div>';
        let html = '';
        if (entries.length > 0) {
          html += '<div class="weapons-list">';
          entries.forEach((f: any) => {
            html += '<div class="weapon-item"><span class="weapon-bullet">▸</span><span>';
            html += f.make_model || 'Unknown';
            if (f.calibre) html += ' — ' + f.calibre;
            if (f.serial_number) html += ' — S/N: ' + f.serial_number;
            html += '</span></div>';
          });
          html += '</div>';
        }
        if (hasPdf) {
          html += '<div style="margin-top: 10px; padding: 8px 12px; background: rgba(255, 167, 38, 0.1); border: 1px solid rgba(255, 167, 38, 0.3); border-radius: 6px; color: #FFA726; font-size: 13px; font-style: italic;">📎 See Attached — Firearms document appended to this report</div>';
        }
        return html;
      })()}
    </div>
    
    <!-- Criminal History -->
    <div class="section">
      <div class="section-title">
        <span class="section-icon">📋</span>
        <span>Criminal History</span>
      </div>
      ${(() => {
        const hasPdf = !!suspect.criminal_history_pdf_path;
        let entries: any[] = [];
        try { entries = suspect.criminal_history ? JSON.parse(suspect.criminal_history) : []; if (!Array.isArray(entries)) entries = []; } catch { entries = []; }
        if (entries.length === 0 && !hasPdf) return '<div class="no-data">No criminal history recorded</div>';
        let html = '';
        if (entries.length > 0) {
          html += '<div class="weapons-list">';
          entries.forEach((c: any) => {
            html += '<div class="weapon-item" style="flex-direction: column; align-items: flex-start; gap: 2px;">';
            html += '<div style="font-weight: 600;">' + (c.offense || 'Unknown offense') + '</div>';
            const meta: string[] = [];
            if (c.date) meta.push(c.date);
            if (c.case_number) meta.push('#' + c.case_number);
            if (meta.length) html += '<div style="font-size: 12px; color: #94A3C0;">' + meta.join(' · ') + '</div>';
            if (c.sentence) html += '<div style="font-size: 12px; color: #94A3C0;">Sentence: ' + c.sentence + '</div>';
            if (c.notes) html += '<div style="font-size: 11px; color: #6B7A94; font-style: italic; margin-top: 2px;">' + c.notes + '</div>';
            html += '</div>';
          });
          html += '</div>';
        }
        if (hasPdf) {
          html += '<div style="margin-top: 10px; padding: 8px 12px; background: rgba(255, 42, 109, 0.1); border: 1px solid rgba(255, 42, 109, 0.3); border-radius: 6px; color: #FF2A6D; font-size: 13px; font-style: italic;">📎 See Attached — Criminal history document appended to this report</div>';
        }
        return html;
      })()}
    </div>
    
    ${weapons.length > 0 ? `
    <!-- Weapons Registry -->
    <div class="section">
      <div class="section-title">
        <span class="section-icon">⚠️</span>
        <span>Weapons Registry - CAUTION</span>
      </div>
      <div class="weapons-list">
        ${weapons.map(w => `
          <div class="weapon-item">
            <span class="weapon-bullet">▸</span>
            <span>${w.description}</span>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    ${suspectPhotos.length > 0 ? `
    <!-- Suspect Photos -->
    <div class="section">
      <div class="section-title">
        <span class="section-icon">📸</span>
        <span>Suspect Photographs</span>
      </div>
      <div class="photos-grid">
        ${suspectPhotos.map(photo => `
          <div class="photo-card">
            <img src="${getImageBase64(photo.photo_path)}" class="photo-img" alt="Suspect photo">
            <div class="photo-caption">Suspect Photo</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    ${vehiclePhotos.length > 0 ? `
    <div class="section page-break">
      <div class="section-title">
        <span class="section-icon">🚗</span>
        <span>Vehicle Photographs</span>
      </div>
      <div class="photos-grid">
        ${vehiclePhotos.map(photo => `
          <div class="photo-card">
            <img src="${getImageBase64(photo.photo_path)}" class="photo-img" alt="Vehicle photo">
            <div class="photo-caption">Vehicle Photo</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    ${residencePhotos.length > 0 ? `
    <div class="section ${vehiclePhotos.length === 0 ? 'page-break' : ''}">
      <div class="section-title">
        <span class="section-icon">🏠</span>
        <span>Residence Photographs</span>
      </div>
      <div class="photos-grid residence-photos-grid">
        ${residencePhotos.map(photo => `
          <div class="photo-card">
            <img src="${getImageBase64(photo.photo_path)}" class="photo-img" alt="Residence photo">
            <div class="photo-caption">Residence Photo</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    <!-- Footer -->
    <div class="footer">
      <div>Prepared by: ${user?.username || 'Unknown Officer'}</div>
      <div>${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
  </div>
</body>
</html>
      `;
      
      // Create hidden window for PDF
      const { BrowserWindow } = require('electron');
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false // Allow data URLs
        }
      });
      
      // Write HTML to temp file instead of using data URL (more reliable)
      const os = require('os');
      const tempHtmlPath = path.join(os.tmpdir(), `suspect_export_${Date.now()}.html`);
      fs.writeFileSync(tempHtmlPath, html, 'utf-8');
      
      await printWindow.loadFile(tempHtmlPath);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for images to load
      
      // Clean up temp file after loading
      try {
        fs.unlinkSync(tempHtmlPath);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      // Generate PDF
      const pdfData = await printWindow.webContents.printToPDF({
        printBackground: true,
        margins: {
          top: 0.4,
          bottom: 0.4,
          left: 0.4,
          right: 0.4
        }
      });
      
      // Build final buffer — merge with attachment PDFs if present
      const attachPdfs: string[] = [];
      if (suspect.firearms_pdf_path) {
        const fullPath = path.join(getCasesPath(), suspect.firearms_pdf_path);
        if (fs.existsSync(fullPath)) attachPdfs.push(fullPath);
      }
      if (suspect.criminal_history_pdf_path) {
        const fullPath = path.join(getCasesPath(), suspect.criminal_history_pdf_path);
        if (fs.existsSync(fullPath)) attachPdfs.push(fullPath);
      }

      let finalBuffer: Buffer;
      if (attachPdfs.length > 0) {
        try {
          const { PDFDocument } = require('pdf-lib');
          const mergedPdf = await PDFDocument.create();
          const mainDoc = await PDFDocument.load(pdfData);
          const mainPages = await mergedPdf.copyPages(mainDoc, mainDoc.getPageIndices());
          mainPages.forEach((p: any) => mergedPdf.addPage(p));
          for (const attachPath of attachPdfs) {
            try {
              const attachBytes = fs.readFileSync(attachPath);
              const attachDoc = await PDFDocument.load(attachBytes, { ignoreEncryption: true });
              const attachPages = await mergedPdf.copyPages(attachDoc, attachDoc.getPageIndices());
              attachPages.forEach((p: any) => mergedPdf.addPage(p));
            } catch (mergeErr) { safeLog('Failed to merge attached PDF:', attachPath, mergeErr); }
          }
          const mergedBytes = await mergedPdf.save();
          finalBuffer = Buffer.from(mergedBytes);
        } catch (mergeErr) {
          console.log('PDF merge failed, returning report without attachments:', mergeErr);
          finalBuffer = Buffer.from(pdfData);
        }
      } else {
        finalBuffer = Buffer.from(pdfData);
      }

      printWindow.close();
      return finalBuffer;
  }

  ipcMain.handle(IPC_CHANNELS.EXPORT_SUSPECT_PDF, async (_event, caseId: number, caseNumber: string) => {
    try {
      const pdfBuffer = await generateSuspectPdfBuffer(caseId, caseNumber);
      if (!pdfBuffer) throw new Error('No suspect data found for this case');

      const fileName = `Case_${caseNumber}_Suspect_Report.pdf`;
      const downloadsPath = app.getPath('downloads');
      const filePath = path.join(downloadsPath, fileName);
      fs.writeFileSync(filePath, pdfBuffer);

      if (!fs.existsSync(filePath)) throw new Error(`Failed to save PDF file: ${filePath}`);

      const { shell } = require('electron');
      shell.showItemInFolder(filePath);
      setTimeout(() => { shell.openPath(downloadsPath); }, 100);

      return { success: true, filePath };
    } catch (error) {
      throw error;
    }
  });
  
  // ========== Operations Plans ==========
  
  ipcMain.handle(IPC_CHANNELS.GET_OPS_PLAN, async (_event, caseId: number) => {
    try {
      const stmt = db.prepare('SELECT * FROM operations_plans WHERE case_id = ? LIMIT 1');
      const opPlan = stmt.get(caseId);
      return opPlan || null;
    } catch (error) {
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.SAVE_OPS_PLAN, async (_event, opPlanData: any) => {
    try {
      const checkStmt = db.prepare('SELECT id FROM operations_plans WHERE case_id = ? LIMIT 1');
      const existing = checkStmt.get(opPlanData.case_id);
      
      const cols = [
        'plan_pdf_path', 'approved', 'approver_name', 'approval_date', 'execution_date',
        'date', 'time', 'report_number', 'case_agent', 'operation_type',
        'location', 'briefing_location', 'fortifications', 'cameras', 'dogs', 'children',
        'notifications', 'comms', 'hospital', 'rally_point',
        'suspect_info', 'case_summary',
        'tactical_plan', 'pursuit_plan', 'medical_plan', 'barricade_plan', 'contingency_plan',
        'directions', 'location_photos', 'route_data',
      ];

      const vals = cols.map(c => {
        if (c === 'approved') return opPlanData[c] ? 1 : 0;
        if (c === 'operation_type' && typeof opPlanData[c] === 'object') return JSON.stringify(opPlanData[c]);
        if (c === 'location_photos' && typeof opPlanData[c] === 'object') return JSON.stringify(opPlanData[c]);
        if (c === 'route_data' && typeof opPlanData[c] === 'object') return JSON.stringify(opPlanData[c]);
        return opPlanData[c] || null;
      });
      
      if (existing) {
        const opPlanId = existing.id;
        const setClause = cols.map(c => `${c} = ?`).join(', ');
        db.prepare(`UPDATE operations_plans SET ${setClause} WHERE id = ?`).run(...vals, opPlanId);
        saveDatabase();
        return { id: opPlanId, ...opPlanData };
      } else {
        const placeholders = cols.map(() => '?').join(', ');
        db.prepare(`INSERT INTO operations_plans (case_id, ${cols.join(', ')}) VALUES (?, ${placeholders})`).run(opPlanData.case_id, ...vals);
        saveDatabase();
        const inserted = db.prepare('SELECT * FROM operations_plans WHERE case_id = ? LIMIT 1').get(opPlanData.case_id);
        return inserted;
      }
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_OPS_ENTRY_TEAM, async (_event, opsPlanId: number) => {
    try {
      const rows = db.prepare('SELECT * FROM ops_entry_team WHERE ops_plan_id = ? ORDER BY sort_order').all(opsPlanId);
      return rows || [];
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_OPS_ENTRY_TEAM, async (_event, opsPlanId: number, team: any[]) => {
    try {
      db.prepare('DELETE FROM ops_entry_team WHERE ops_plan_id = ?').run(opsPlanId);
      const insertStmt = db.prepare('INSERT INTO ops_entry_team (ops_plan_id, name, assignment, vehicle, call_sign, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
      team.forEach((m, i) => {
        insertStmt.run(opsPlanId, m.name || null, m.assignment || null, m.vehicle || null, m.callSign || null, i);
      });
      saveDatabase();
      return true;
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_OPS_RESIDENTS, async (_event, opsPlanId: number) => {
    try {
      const rows = db.prepare('SELECT * FROM ops_other_residents WHERE ops_plan_id = ? ORDER BY sort_order').all(opsPlanId);
      return rows || [];
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_OPS_RESIDENTS, async (_event, opsPlanId: number, residents: any[]) => {
    try {
      db.prepare('DELETE FROM ops_other_residents WHERE ops_plan_id = ?').run(opsPlanId);
      const insertStmt = db.prepare('INSERT INTO ops_other_residents (ops_plan_id, name, dob, photo, has_firearms, firearms, has_crim_history, crim_history, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      residents.forEach((r, i) => {
        insertStmt.run(opsPlanId, r.name || null, r.dob || null, r.photo || null, r.hasFirearms ? 1 : 0, r.firearms || null, r.hasCrimHistory ? 1 : 0, r.crimHistory || null, i);
      });
      saveDatabase();
      return true;
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT_OPS_PLAN_PDF, async (_event, data: any) => {
    try {
      const { dialog, BrowserWindow, shell } = require('electron');
      const result = await dialog.showSaveDialog({
        title: 'Export Operations Plan',
        defaultPath: `OPS_Plan_${data.caseNumber || 'export'}.pdf`,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      });
      if (result.canceled || !result.filePath) return { success: false };

      // Restore focus
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();

      // Create a hidden window to render HTML then print to PDF
      const printWin = new BrowserWindow({ show: false, width: 816, height: 1056, webPreferences: { offscreen: true } });
      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(data.html)}`);
      // Wait for images to load
      await new Promise(resolve => setTimeout(resolve, 1500));
      const opsPdfBuffer = await printWin.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        margins: { marginType: 'none' },
      });
      printWin.close();

      // If appendSuspectPdf is requested, generate the full suspect PDF and merge
      const numericCaseId = typeof data.caseId === 'string' ? parseInt(data.caseId, 10) : data.caseId;
      console.log('Ops plan export: appendSuspectPdf=', data.appendSuspectPdf, 'caseId=', numericCaseId);
      if (data.appendSuspectPdf && numericCaseId) {
        try {
          console.log('Generating suspect PDF buffer...');
          const suspectPdfBuffer = await generateSuspectPdfBuffer(numericCaseId, data.caseNumber || '');
          console.log('Suspect PDF buffer result:', suspectPdfBuffer ? `${suspectPdfBuffer.length} bytes` : 'null');
          if (suspectPdfBuffer) {
            const { PDFDocument } = require('pdf-lib');
            const mergedPdf = await PDFDocument.create();

            // Add ops plan pages
            const opsDoc = await PDFDocument.load(opsPdfBuffer);
            const opsPages = await mergedPdf.copyPages(opsDoc, opsDoc.getPageIndices());
            opsPages.forEach((p: any) => mergedPdf.addPage(p));

            // Append full suspect PDF (already includes photos + attachment PDFs)
            const suspDoc = await PDFDocument.load(suspectPdfBuffer);
            const suspPages = await mergedPdf.copyPages(suspDoc, suspDoc.getPageIndices());
            suspPages.forEach((p: any) => mergedPdf.addPage(p));

            const mergedBytes = await mergedPdf.save();
            fs.writeFileSync(result.filePath, Buffer.from(mergedBytes));
          } else {
            fs.writeFileSync(result.filePath, opsPdfBuffer);
          }
        } catch (mergeErr) {
          console.log('Ops plan + suspect PDF merge failed:', mergeErr);
          fs.writeFileSync(result.filePath, opsPdfBuffer);
        }
      } else {
        fs.writeFileSync(result.filePath, opsPdfBuffer);
      }

      // Show the file in explorer
      shell.showItemInFolder(result.filePath);
      return { success: true, filePath: result.filePath };
    } catch (error) {
      throw error;
    }
  });
  
  // ========== Reports ==========
  
  ipcMain.handle(IPC_CHANNELS.GET_REPORT, async (_event, caseId: number) => {
    try {
      // safeLog('GET_REPORT called for case:', caseId);
      const stmt = db.prepare('SELECT * FROM case_reports WHERE case_id = ? LIMIT 1');
      const report = stmt.get(caseId);
      // safeLog('GET_REPORT result:', report);
      
      return report || null;
    } catch (error) {
      // safeLog('GET_REPORT error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.SAVE_REPORT, async (_event, reportData: any) => {
    try {
      // safeLog('SAVE_REPORT called with case_id:', reportData.case_id);
      
      // Check if report exists
      const checkStmt = db.prepare('SELECT id FROM case_reports WHERE case_id = ? LIMIT 1');
      const existing = checkStmt.get(reportData.case_id);
      
      if (existing) {
        // Update existing
        const reportId = existing.id;
        // safeLog('Updating existing report:', reportId);
        
        const updateStmt = db.prepare(`
          UPDATE case_reports SET
            content = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        
        updateStmt.run(
          reportData.content || '',
          reportId
        );
        
        return { id: reportId, ...reportData };
      } else {
        // Insert new
        // safeLog('Inserting new report for case:', reportData.case_id);
        
        const insertStmt = db.prepare(`
          INSERT INTO case_reports (case_id, content)
          VALUES (?, ?)
        `);
        
        insertStmt.run(
          reportData.case_id,
          reportData.content || ''
        );
        
        // Query back the inserted record
        const verifyStmt = db.prepare('SELECT * FROM case_reports WHERE case_id = ? LIMIT 1');
        const inserted = verifyStmt.get(reportData.case_id);
        // safeLog('Inserted report:', inserted);
        
        return inserted;
      }
    } catch (error) {
      // safeLog('SAVE_REPORT error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.EXPORT_REPORT_PDF, async (_event, data: any) => {
    try {
      // safeLog('EXPORT_REPORT_PDF called for case:', data.caseId);
      
      // Get case info for filename and case number
      const caseStmt = db.prepare('SELECT case_number FROM cases WHERE id = ?');
      const caseInfo = caseStmt.get(data.caseId);
      
      if (!caseInfo) {
        throw new Error('Case not found');
      }
      
      // Get current user/officer name — prefer profile data passed from renderer
      const officerName = data.officerName || (() => {
        try { const u = db.prepare('SELECT username FROM users LIMIT 1').get(); return u ? u.username : 'Unknown Officer'; } catch { return 'Unknown Officer'; }
      })();
      const agency = data.agency || '';
      const badgeNumber = data.badgeNumber || '';
      
      // Get current date and time
      const now = new Date();
      const dateString = now.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const timeString = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
      });
      
      // Ask user where to save
      const result = await dialog.showSaveDialog({
        title: 'Save Report as PDF',
        defaultPath: `Case_${caseInfo.case_number}_Report.pdf`,
        filters: [
          { name: 'PDF Files', extensions: ['pdf'] }
        ]
      });
      
      // Restore focus to main window after dialog closes
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
      }
      
      if (result.canceled || !result.filePath) {
        return { success: false, cancelled: true };
      }
      
      const savePath = result.filePath;
      
      // Create a hidden window to render the HTML and print to PDF
      const printWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        }
      });
      
      // Create HTML with proper styling for PDF including header and footer
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              margin: 0.75in 0.5in 0.75in 0.5in;
            }
            body {
              font-family: 'Times New Roman', serif;
              font-size: 12pt;
              line-height: 1.6;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 20px;
            }
            .header {
              text-align: center;
              padding: 20px 0;
              border-bottom: 2px solid #000;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 24pt;
              font-weight: bold;
              color: #00D4FF;
              margin-bottom: 10px;
              letter-spacing: 2px;
            }
            .header h1 {
              margin: 10px 0 5px 0;
              font-size: 18pt;
              font-weight: bold;
            }
            .header p {
              margin: 5px 0 0 0;
              font-size: 11pt;
            }
            .content {
              white-space: pre-wrap;
              word-wrap: break-word;
              margin-bottom: 60px;
            }
            .footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              padding: 10px 20px;
              border-top: 1px solid #666;
              font-size: 10pt;
              color: #666;
              background: #fff;
            }
            .footer-left {
              float: left;
            }
            .footer-right {
              float: right;
            }
            h1, h2, h3, h4, h5, h6 {
              color: #000;
              margin-top: 0.5em;
              margin-bottom: 0.3em;
            }
            p {
              margin: 0.5em 0;
            }
            ul, ol {
              margin: 0.5em 0;
              padding-left: 1.5em;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">ICAC P.U.L.S.E.</div>
            <h1>Case Report</h1>
            <p><strong>Case Number: ${caseInfo.case_number}</strong></p>
          </div>
          
          <div class="content">
${data.content}
          </div>
          
          <div class="footer">
            <div class="footer-left">
              Prepared by: ${officerName}${badgeNumber ? ' #' + badgeNumber : ''}${agency ? ' — ' + agency : ''}
            </div>
            <div class="footer-right">
              ${dateString} at ${timeString}
            </div>
          </div>
        </body>
        </html>
      `;
      
      // Load the HTML content
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
      
      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Print to PDF
      const pdfData = await printWindow.webContents.printToPDF({
        printBackground: false,
        margins: {
          top: 0,
          bottom: 0,
          left: 0.5,
          right: 0.5
        },
        displayHeaderFooter: false
      });
      
      // Save the PDF
      require('fs').writeFileSync(savePath, pdfData);
      
      // Close the print window
      printWindow.close();
      
      // Open the folder containing the PDF
      require('electron').shell.showItemInFolder(savePath);
      
      // safeLog('PDF exported successfully to:', savePath);
      return { success: true, path: savePath };
      
    } catch (error) {
      // safeLog('EXPORT_REPORT_PDF error:', error);
      throw error;
    }
  });

  // Email Verification
  ipcMain.handle(IPC_CHANNELS.VERIFY_EMAIL, async (_event, email: string) => {
    try {
      // safeLog('VERIFY_EMAIL called for:', email);
      
      const result = await verifyEmail(email, false);
      
      // safeLog('Email verification result:', result);
      
      return result;
    } catch (error) {
      // safeLog('VERIFY_EMAIL error:', error);
      throw error;
    }
  });

  // Open Report Window (Pop-out)
  ipcMain.handle(IPC_CHANNELS.OPEN_REPORT_WINDOW, async (_event, data: any) => {
    try {
      // safeLog('OPEN_REPORT_WINDOW called with data:', data);
      
      const { caseId, caseNumber } = data;
      
      // Create a new window for the report
      const reportWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
          preload: path.join(__dirname, '../preload/index.js'),
          nodeIntegration: false,
          contextIsolation: true,
        },
        title: `Report - ${caseNumber}`,
        backgroundColor: '#0B1120',
      });

      // Load the report window (content will be loaded from database)
      if (process.env.NODE_ENV === 'development') {
        const devServerUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173';
        reportWindow.loadURL(
          `${devServerUrl}/#/report-window?caseId=${caseId}&caseNumber=${encodeURIComponent(caseNumber)}`
        );
        reportWindow.webContents.openDevTools();
      } else {
        reportWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
          hash: `report-window?caseId=${caseId}&caseNumber=${encodeURIComponent(caseNumber)}`
        });
      }

      return { success: true };
    } catch (error) {
      // safeLog('OPEN_REPORT_WINDOW error:', error);
      throw error;
    }
  });

  // Dashboard Report Export
  ipcMain.handle(IPC_CHANNELS.EXPORT_DASHBOARD_REPORT, async (_event, data: any) => {
    try {
      // safeLog('EXPORT_DASHBOARD_REPORT called with data:', data);
      
      // Get current user/officer name
      const userStmt = db.prepare('SELECT username FROM users LIMIT 1');
      const userInfo = userStmt.get();
      const officerName = userInfo ? userInfo.username : 'Unknown Officer';
      
      // Get current date and time
      const now = new Date();
      const dateString = now.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const timeString = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
      });

      // Format the date range
      const fromDate = new Date(data.dateFrom).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const toDate = new Date(data.dateTo).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      // Ask user where to save
      const result = await dialog.showSaveDialog({
        title: 'Save Dashboard Report as PDF',
        defaultPath: `Dashboard_Report_${data.dateFrom}_to_${data.dateTo}.pdf`,
        filters: [
          { name: 'PDF Files', extensions: ['pdf'] }
        ]
      });
      
      // Restore focus to main window after dialog closes
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
      }
      
      if (result.canceled || !result.filePath) {
        return { success: false, cancelled: true };
      }
      
      const savePath = result.filePath;
      
      // Create a hidden window to render the HTML and print to PDF
      const printWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        }
      });

      // Status labels
      const statusLabels: Record<string, string> = {
        open: 'Open',
        warrants_issued: 'Warrants Issued',
        ready_residential: 'Ready for Residential',
        arrest: 'Arrests',
        closed_no_arrest: 'Closed',
        referred: 'Transferred',
      };

      // Case type labels
      const typeLabels: Record<string, string> = {
        cybertip: 'CyberTip',
        p2p: 'Peer 2 Peer',
        chat: 'Chat',
        other: 'Other',
      };

      // Generate status rows HTML
      let statusRowsHtml = '';
      const statusOrder = ['open', 'warrants_issued', 'ready_residential', 'arrest', 'closed_no_arrest', 'referred'];
      for (const status of statusOrder) {
        const count = data.casesByStatus[status] || 0;
        const label = statusLabels[status] || status;
        statusRowsHtml += `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${label}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: bold; color: #00D4FF;">${count}</td>
          </tr>
        `;
      }

      // Generate case type rows HTML
      let typeRowsHtml = '';
      const typeOrder = ['cybertip', 'p2p', 'chat', 'other'];
      for (const type of typeOrder) {
        const count = data.casesByType[type] || 0;
        const label = typeLabels[type] || type;
        typeRowsHtml += `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">${label}</td>
            <td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: bold; color: #00D4FF;">${count}</td>
          </tr>
        `;
      }
      
      // Create beautiful HTML report
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              margin: 0.75in 0.5in 0.75in 0.5in;
            }
            
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 20px;
            }
            
            .header {
              text-align: center;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 3px solid #00D4FF;
            }
            
            .header h1 {
              color: #0B1120;
              font-size: 32px;
              margin: 0 0 10px 0;
              font-weight: bold;
            }
            
            .header .subtitle {
              color: #666;
              font-size: 18px;
              margin: 5px 0;
            }
            
            .date-range {
              background: linear-gradient(135deg, #00D4FF 0%, #0099CC 100%);
              color: white;
              padding: 15px 20px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: center;
              font-size: 16px;
              font-weight: bold;
            }
            
            .summary-box {
              background: #f8f9fa;
              border: 2px solid #00D4FF;
              border-radius: 8px;
              padding: 25px;
              margin: 30px 0;
              text-align: center;
            }
            
            .summary-box h2 {
              color: #0B1120;
              margin: 0 0 10px 0;
              font-size: 18px;
            }
            
            .summary-box .total {
              font-size: 48px;
              font-weight: bold;
              color: #00D4FF;
              margin: 10px 0;
            }
            
            .section {
              margin: 40px 0;
              page-break-inside: avoid;
            }
            
            .section.page-break {
              page-break-before: always;
              margin-top: 0;
              padding-top: 20px;
            }
            
            .section h2 {
              color: #0B1120;
              font-size: 24px;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 2px solid #00D4FF;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              background: white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              border-radius: 8px;
              overflow: hidden;
            }
            
            th {
              background: linear-gradient(135deg, #00D4FF 0%, #0099CC 100%);
              color: white;
              padding: 15px;
              text-align: left;
              font-weight: bold;
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            td {
              padding: 12px;
              border-bottom: 1px solid #e0e0e0;
            }
            
            tr:last-child td {
              border-bottom: none;
            }
            
            tr:hover {
              background: #f8f9fa;
            }
            
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 2px solid #e0e0e0;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            
            .footer-info {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
              font-size: 14px;
            }
            
            .chart-placeholder {
              background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
              border: 2px dashed #00D4FF;
              border-radius: 8px;
              padding: 40px;
              text-align: center;
              margin: 20px 0;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📊 ICAC P.U.L.S.E.</h1>
            <div class="subtitle">Dashboard Statistical Report</div>
          </div>
          
          <div class="date-range">
            Report Period: ${fromDate} — ${toDate}
          </div>
          
          <div class="summary-box">
            <h2>Total Cases in Period</h2>
            <div class="total">${data.totalCases}</div>
            <p style="color: #666; margin: 0;">Cases created during the selected date range</p>
          </div>
          
          <div class="section page-break">
            <h2>Case Status Distribution</h2>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th style="text-align: right;">Count</th>
                </tr>
              </thead>
              <tbody>
                ${statusRowsHtml}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <h2>Case Type Distribution</h2>
            <table>
              <thead>
                <tr>
                  <th>Case Type</th>
                  <th style="text-align: right;">Count</th>
                </tr>
              </thead>
              <tbody>
                ${typeRowsHtml}
              </tbody>
            </table>
          </div>
          
          <div class="footer">
            <div class="footer-info">
              <div><strong>Generated by:</strong> ${officerName}</div>
              <div><strong>Date:</strong> ${dateString} at ${timeString}</div>
            </div>
            <div style="margin-top: 10px;">
              <strong>ICAC P.U.L.S.E.</strong> — Internet Crimes Against Children Case Management System<br>
              This report contains law enforcement sensitive information. Handle accordingly.
            </div>
          </div>
        </body>
        </html>
      `;
      
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
      
      // Wait for content to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Print to PDF
      const pdfData = await printWindow.webContents.printToPDF({
        marginsType: 0,
        printBackground: true,
        printSelectionOnly: false,
        landscape: false,
      });
      
      // Save PDF
      fs.writeFileSync(savePath, pdfData);
      
      // Close the print window
      printWindow.close();
      
      // Open the folder containing the PDF
      require('electron').shell.showItemInFolder(savePath);
      
      // safeLog('Dashboard report PDF exported successfully to:', savePath);
      return { success: true, path: savePath };
      
    } catch (error) {
      // safeLog('EXPORT_DASHBOARD_REPORT error:', error);
      throw error;
    }
  });
  
  // Evidence handlers
  // Open a dedicated pop-out window to display a SingleFile HTML chat capture
  /* ── Flock Safety IPC ─────────────────────────────────────── */
  ipcMain.on('flock-set-bounds', (_event: any, bounds: any) => {
    if (!flockBrowserView || !mainWindow || mainWindow.isDestroyed()) return;
    const b = { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) };
    lastFlockBounds = b;
    if (flockViewVisible) flockBrowserView.setBounds(b);
  });

  ipcMain.on('flock-set-visible', (_event: any, visible: boolean) => {
    if (!flockBrowserView || !mainWindow || mainWindow.isDestroyed()) return;
    flockViewVisible = visible;
    if (visible && lastFlockBounds) {
      const currentUrl = flockBrowserView.webContents.getURL();
      if (!currentUrl || currentUrl === '' || currentUrl === 'about:blank') {
        flockBrowserView.webContents.loadURL('https://search-2.flocksafety.com/');
      }
      flockBrowserView.setBounds(lastFlockBounds);
    } else if (!visible) {
      flockBrowserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  });

  ipcMain.handle('flock-search-plate', async (_event: any, { plate, state }: { plate: string; state?: string }) => {
    if (!flockBrowserView) return { success: false, error: 'Flock not initialized' };
    try {
      const currentUrl = flockBrowserView.webContents.getURL();
      if (!currentUrl.includes('search-2.flocksafety.com')) {
        flockBrowserView.webContents.loadURL('https://search-2.flocksafety.com/');
        await new Promise<void>(resolve => {
          flockBrowserView!.webContents.once('did-finish-load', () => resolve());
          setTimeout(resolve, 8000);
        });
      }
      if (plate) {
        await new Promise(r => setTimeout(r, 1500));
        await flockBrowserView.webContents.executeJavaScript(`
          (function(){
            const plateInput=document.querySelector('input[placeholder*="license plate" i],input[name*="plate" i],input[aria-label*="plate" i]');
            if(plateInput){const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(plateInput,'${plate.replace(/'/g, "\\'")}');plateInput.dispatchEvent(new Event('input',{bubbles:true}));plateInput.dispatchEvent(new Event('change',{bubbles:true}));}
          })();
        `);
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('flock-reset', async () => {
    if (!flockBrowserView) return;
    const ses = flockBrowserView.webContents.session;
    await ses.clearStorageData();
    flockBrowserView.webContents.loadURL('https://search-2.flocksafety.com/');
  });

  /* ── TLO / TransUnion IPC ───────────────────────────────── */
  ipcMain.on('tlo-set-bounds', (_event: any, bounds: any) => {
    if (!tloBrowserView || !mainWindow || mainWindow.isDestroyed()) return;
    const b = { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) };
    lastTloBounds = b;
    if (tloViewVisible) tloBrowserView.setBounds(b);
  });

  ipcMain.on('tlo-set-visible', (_event: any, visible: boolean) => {
    if (!tloBrowserView || !mainWindow || mainWindow.isDestroyed()) return;
    tloViewVisible = visible;
    if (visible && lastTloBounds) {
      const currentUrl = tloBrowserView.webContents.getURL();
      if (!currentUrl || currentUrl === '' || currentUrl === 'about:blank') {
        tloBrowserView.webContents.loadURL('https://tloxp.tlo.com/');
      }
      tloBrowserView.setBounds(lastTloBounds);
    } else if (!visible) {
      tloBrowserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  });

  ipcMain.handle('tlo-search-person', async (_event: any, { firstName, lastName, state }: { firstName?: string; lastName?: string; state?: string }) => {
    if (!tloBrowserView) return { success: false, error: 'TLO not initialized' };
    try {
      const currentUrl = tloBrowserView.webContents.getURL();
      if (!currentUrl.includes('tloxp.tlo.com') || currentUrl.includes('Login') || currentUrl.includes('login')) {
        tloBrowserView.webContents.loadURL('https://tloxp.tlo.com/');
        await new Promise<void>(resolve => {
          tloBrowserView!.webContents.once('did-finish-load', () => resolve());
          setTimeout(resolve, 8000);
        });
      }
      if (firstName || lastName) {
        await new Promise(r => setTimeout(r, 1500));
        await tloBrowserView.webContents.executeJavaScript(`
          (function(){
            function setVal(el,val){if(!el||!val)return;const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,val);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
            const fnInput=document.querySelector('input[name*="irstName" i],input[id*="irstName" i],input[placeholder*="First" i]');
            const lnInput=document.querySelector('input[name*="astName" i],input[id*="astName" i],input[placeholder*="Last" i]');
            setVal(fnInput,${JSON.stringify(firstName || '')});setVal(lnInput,${JSON.stringify(lastName || '')});
            ${state ? `const stInput=document.querySelector('select[name*="tate" i],select[id*="tate" i]');if(stInput){stInput.value=${JSON.stringify(state)};stInput.dispatchEvent(new Event('change',{bubbles:true}));}` : ''}
          })();
        `);
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('tlo-reset', async () => {
    if (!tloBrowserView) return;
    const ses = tloBrowserView.webContents.session;
    await ses.clearStorageData();
    tloBrowserView.webContents.loadURL('https://tloxp.tlo.com/');
  });

  /* ── ICAC Cops IPC ──────────────────────────────────────── */
  ipcMain.on('icaccops-set-bounds', (_event: any, bounds: any) => {
    if (!icaccopsBrowserView || !mainWindow || mainWindow.isDestroyed()) return;
    const b = { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) };
    lastIcaccopsBounds = b;
    if (icaccopsViewVisible) icaccopsBrowserView.setBounds(b);
  });

  ipcMain.on('icaccops-set-visible', (_event: any, visible: boolean) => {
    if (!icaccopsBrowserView || !mainWindow || mainWindow.isDestroyed()) return;
    icaccopsViewVisible = visible;
    if (visible && lastIcaccopsBounds) {
      const currentUrl = icaccopsBrowserView.webContents.getURL();
      if (!currentUrl || currentUrl === '' || currentUrl === 'about:blank') {
        icaccopsBrowserView.webContents.loadURL('https://www.icaccops.com/users?ReturnUrl=%2Fusers%2Fhome');
      }
      icaccopsBrowserView.setBounds(lastIcaccopsBounds);
    } else if (!visible) {
      icaccopsBrowserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  });

  ipcMain.handle('icaccops-reset', async () => {
    if (!icaccopsBrowserView) return;
    const ses = icaccopsBrowserView.webContents.session;
    await ses.clearStorageData();
    icaccopsBrowserView.webContents.loadURL('https://www.icaccops.com/users?ReturnUrl=%2Fusers%2Fhome');
  });

  /* ── GridCop IPC ────────────────────────────────────────── */
  ipcMain.on('gridcop-set-bounds', (_event: any, bounds: any) => {
    if (!gridcopBrowserView || !mainWindow || mainWindow.isDestroyed()) return;
    const b = { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) };
    lastGridcopBounds = b;
    if (gridcopViewVisible) gridcopBrowserView.setBounds(b);
  });

  ipcMain.on('gridcop-set-visible', (_event: any, visible: boolean) => {
    if (!gridcopBrowserView || !mainWindow || mainWindow.isDestroyed()) return;
    gridcopViewVisible = visible;
    if (visible && lastGridcopBounds) {
      const currentUrl = gridcopBrowserView.webContents.getURL();
      if (!currentUrl || currentUrl === '' || currentUrl === 'about:blank') {
        gridcopBrowserView.webContents.loadURL('https://www.gridcop.com/cb-login');
      }
      gridcopBrowserView.setBounds(lastGridcopBounds);
    } else if (!visible) {
      gridcopBrowserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  });

  ipcMain.handle('gridcop-reset', async () => {
    if (!gridcopBrowserView) return;
    const ses = gridcopBrowserView.webContents.session;
    await ses.clearStorageData();
    gridcopBrowserView.webContents.loadURL('https://www.gridcop.com/cb-login');
  });

  /* ── Vigilant LPR IPC ────────────────────────────────────── */
  ipcMain.on('vigilant-set-bounds', (_event: any, bounds: any) => {
    if (!vigilantBrowserView || !mainWindow || mainWindow.isDestroyed()) return;
    const b = { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) };
    lastVigilantBounds = b;
    if (vigilantViewVisible) vigilantBrowserView.setBounds(b);
  });

  ipcMain.on('vigilant-set-visible', (_event: any, visible: boolean) => {
    if (!vigilantBrowserView || !mainWindow || mainWindow.isDestroyed()) return;
    vigilantViewVisible = visible;
    if (visible && lastVigilantBounds) {
      const currentUrl = vigilantBrowserView.webContents.getURL();
      if (!currentUrl || currentUrl === '' || currentUrl === 'about:blank') {
        vigilantBrowserView.webContents.loadURL('https://vm.motorolasolutions.com/VM8_Auth/Login/VehicleManager_web');
      }
      vigilantBrowserView.setBounds(lastVigilantBounds);
    } else if (!visible) {
      vigilantBrowserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  });

  ipcMain.handle('vigilant-reset', async () => {
    if (!vigilantBrowserView) return;
    const ses = vigilantBrowserView.webContents.session;
    await ses.clearStorageData();
    vigilantBrowserView.webContents.loadURL('https://vm.motorolasolutions.com/VM8_Auth/Login/VehicleManager_web');
  });

  /* ── Thomson Reuters CLEAR IPC ──────────────────────────── */
  ipcMain.on('trclear-set-bounds', (_event: any, bounds: any) => {
    if (!trclearBrowserView || !mainWindow || mainWindow.isDestroyed()) return;
    const b = { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) };
    lastTrclearBounds = b;
    if (trclearViewVisible) trclearBrowserView.setBounds(b);
  });

  ipcMain.on('trclear-set-visible', (_event: any, visible: boolean) => {
    if (!trclearBrowserView || !mainWindow || mainWindow.isDestroyed()) return;
    trclearViewVisible = visible;
    if (visible && lastTrclearBounds) {
      const currentUrl = trclearBrowserView.webContents.getURL();
      if (!currentUrl || currentUrl === '' || currentUrl === 'about:blank') {
        trclearBrowserView.webContents.loadURL('https://signon.thomsonreuters.com/?productid=MYATRTA&bhcp=1');
      }
      trclearBrowserView.setBounds(lastTrclearBounds);
    } else if (!visible) {
      trclearBrowserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  });

  ipcMain.handle('trclear-reset', async () => {
    if (!trclearBrowserView) return;
    const ses = trclearBrowserView.webContents.session;
    await ses.clearStorageData();
    trclearBrowserView.webContents.loadURL('https://signon.thomsonreuters.com/?productid=MYATRTA&bhcp=1');
  });

  /* ── Accurint (LexisNexis) IPC ──────────────────────────── */
  ipcMain.on('accurint-set-bounds', (_event: any, bounds: any) => {
    if (!accurintBrowserView || !mainWindow || mainWindow.isDestroyed()) return;
    const b = { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) };
    lastAccurintBounds = b;
    if (accurintViewVisible) accurintBrowserView.setBounds(b);
  });

  ipcMain.on('accurint-set-visible', (_event: any, visible: boolean) => {
    if (!accurintBrowserView || !mainWindow || mainWindow.isDestroyed()) return;
    accurintViewVisible = visible;
    if (visible && lastAccurintBounds) {
      const currentUrl = accurintBrowserView.webContents.getURL();
      if (!currentUrl || currentUrl === '' || currentUrl === 'about:blank') {
        accurintBrowserView.webContents.loadURL('https://secure.accurint.com/app/bps/main?');
      }
      accurintBrowserView.setBounds(lastAccurintBounds);
    } else if (!visible) {
      accurintBrowserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  });

  ipcMain.handle('accurint-reset', async () => {
    if (!accurintBrowserView) return;
    const ses = accurintBrowserView.webContents.session;
    await ses.clearStorageData();
    accurintBrowserView.webContents.loadURL('https://secure.accurint.com/app/bps/main?');
  });

  /* ── BYOA (Bring Your Own Application) IPC ──────────────── */
  ipcMain.handle('byoa-create-view', (_event: any, { id, url }: { id: string; url: string }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return { success: false };
    // If view already exists, just return success
    if (byoaViews.has(id)) return { success: true };
    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: `persist:byoa_${id}`,
      },
    });
    mainWindow.addBrowserView(view);
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    view.setAutoResize({ width: false, height: false });
    view.webContents.on('did-finish-load', () => {
      const entry = byoaViews.get(id);
      if (entry && !entry.visible && mainWindow) mainWindow.webContents.focus();
      view.webContents.insertCSS(
        '::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#0d1117}::-webkit-scrollbar-thumb{background:#30363d;border-radius:4px}'
      ).catch(() => {});
      // Auto-fill credentials
      const pageUrl = view.webContents.getURL();
      if (pageUrl.includes('login') || pageUrl.includes('Login') || pageUrl.includes('signin') || pageUrl.includes('auth') || pageUrl === url) {
        mainWindow?.webContents.executeJavaScript(
          `JSON.stringify({ u: localStorage.getItem('byoa_${id}_username') || '', p: localStorage.getItem('byoa_${id}_password') || '' })`
        ).then((json: string) => {
          const creds = JSON.parse(json);
          if (creds.u || creds.p) {
            view.webContents.executeJavaScript(`
              (function(){
                function fill(){
                  const uInput=document.querySelector('input[name="username"],input[name="Username"],input[name="email"],input[name="Email"],input[type="email"],input[id*="user"],input[id*="User"],input[id*="email"],input[id*="Email"]');
                  const pInput=document.querySelector('input[name="password"],input[name="Password"],input[type="password"]');
                  function setVal(el,val){if(!el||!val)return;const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,val);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
                  setVal(uInput,${JSON.stringify(creds.u)});setVal(pInput,${JSON.stringify(creds.p)});
                }
                setTimeout(fill,500);setTimeout(fill,1500);
              })();
            `).catch(() => {});
          }
        }).catch(() => {});
      }
    });
    byoaViews.set(id, { view, visible: false, bounds: null, url });
    return { success: true };
  });

  ipcMain.on('byoa-set-bounds', (_event: any, { id, bounds }: { id: string; bounds: any }) => {
    const entry = byoaViews.get(id);
    if (!entry || !mainWindow || mainWindow.isDestroyed()) return;
    const b = { x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height) };
    entry.bounds = b;
    if (entry.visible) entry.view.setBounds(b);
  });

  ipcMain.on('byoa-set-visible', (_event: any, { id, visible }: { id: string; visible: boolean }) => {
    const entry = byoaViews.get(id);
    if (!entry || !mainWindow || mainWindow.isDestroyed()) return;
    entry.visible = visible;
    if (visible && entry.bounds) {
      const currentUrl = entry.view.webContents.getURL();
      if (!currentUrl || currentUrl === '' || currentUrl === 'about:blank') {
        entry.view.webContents.loadURL(entry.url);
      }
      entry.view.setBounds(entry.bounds);
    } else if (!visible) {
      entry.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    }
  });

  ipcMain.handle('byoa-reset', async (_event: any, { id }: { id: string }) => {
    const entry = byoaViews.get(id);
    if (!entry) return;
    const ses = entry.view.webContents.session;
    await ses.clearStorageData();
    entry.view.webContents.loadURL(entry.url);
  });

  ipcMain.handle('byoa-destroy-view', (_event: any, { id }: { id: string }) => {
    const entry = byoaViews.get(id);
    if (!entry || !mainWindow || mainWindow.isDestroyed()) return;
    entry.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    mainWindow.removeBrowserView(entry.view);
    (entry.view.webContents as any).destroy?.();
    byoaViews.delete(id);
    return { success: true };
  });

  ipcMain.handle('open-chat-viewer', async (_event, data: { filePath: string; title: string; evidenceId: number }) => {
    try {
      const absPath = fileManager.getAbsolutePath(data.filePath);

      // Parse SingleFile metadata (first 800 bytes)
      let captureUrl = '';
      let capturedDate = '';
      let platform = 'Chat Capture';
      try {
        const fd = fs.openSync(absPath, 'r');
        const buf = Buffer.alloc(800);
        const bytesRead = fs.readSync(fd, buf, 0, 800, 0);
        fs.closeSync(fd);
        const snippet = buf.slice(0, bytesRead).toString('utf8');
        const urlMatch = snippet.match(/url:\s*(https?:\/\/[^\s\n]+)/i);
        const dateMatch = snippet.match(/saved date:\s*([^\n]+)/i);
        captureUrl = urlMatch?.[1]?.trim() ?? '';
        capturedDate = dateMatch?.[1]?.trim() ?? '';
        const knownPlatforms: [string, string][] = [
          ['discord.com', 'Discord'], ['whatsapp.com', 'WhatsApp'],
          ['meetme.com', 'MeetMe'], ['sniffies.com', 'Sniffies'],
          ['kik.com', 'Kik'], ['instagram.com', 'Instagram'],
          ['facebook.com', 'Facebook'], ['messenger.com', 'Messenger'],
          ['snapchat.com', 'Snapchat'], ['telegram.org', 'Telegram'],
          ['t.me', 'Telegram'],
        ];
        for (const [domain, name] of knownPlatforms) {
          if (captureUrl.includes(domain)) { platform = name; break; }
        }
        if (platform === 'Chat Capture' && captureUrl) {
          try { platform = new URL(captureUrl).hostname.replace('www.', ''); } catch {}
        }
      } catch {}

      const viewerWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#0B1120',
        title: `${platform} — ${data.title}`,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          javascript: true,
        },
      });

      viewerWindow.loadFile(absPath);

      const injectToolbar = () => {
        const titleEscaped = JSON.stringify(data.title);
        const platformEscaped = JSON.stringify(platform);
        const dateEscaped = JSON.stringify(capturedDate);
        const evidenceIdVal = data.evidenceId;

        viewerWindow.webContents.executeJavaScript(`
(function() {
  if (document.getElementById('__pulse_toolbar')) return;

  /* ── Global styles ── */
  const style = document.createElement('style');
  style.textContent = \`
    #__pulse_toolbar * { box-sizing:border-box; font-family:system-ui,-apple-system,sans-serif; }
    .pulse-hl-yellow { background:#ffd700 !important; color:#000 !important; border-radius:2px; padding:0 1px; }
    .pulse-hl-red    { background:#ff4d4d !important; color:#fff !important; border-radius:2px; padding:0 1px; }
    .pulse-hl-green  { background:#00c851 !important; color:#fff !important; border-radius:2px; padding:0 1px; }
    #__pulse_search_input::placeholder { color:#64748b; }
    #__pulse_search_input { color-scheme: dark; }
  \`;
  document.head.appendChild(style);

  /* ── State ── */
  let hlMode = false;
  let hlColor = 'yellow';

  /* ── Helpers ── */
  const mkDiv  = (css) => { const e = document.createElement('div');  e.style.cssText = css; return e; };
  const mkSpan = (css) => { const e = document.createElement('span'); e.style.cssText = css; return e; };
  const mkBtn  = (label, css, title) => {
    const b = document.createElement('button');
    b.textContent = label; b.title = title || '';
    b.style.cssText = 'cursor:pointer;border:none;outline:none;' + css;
    return b;
  };
  const sep = () => { const s = mkSpan('width:1px;height:22px;background:rgba(0,210,211,0.2);flex-shrink:0;margin:0 4px;'); return s; };

  /* ── Toolbar shell ── */
  const bar = document.createElement('div');
  bar.id = '__pulse_toolbar';
  bar.style.cssText = [
    'position:fixed','top:0','left:0','right:0','z-index:2147483647',
    'height:56px','display:flex','align-items:center','gap:8px',
    'padding:0 14px','background:#080f1e',
    'border-bottom:2px solid #00d2d3',
    'font-size:13px','color:#e2e8f0',
    'box-shadow:0 0 30px rgba(0,210,211,0.25), 0 4px 16px rgba(0,0,0,0.8)',
  ].join(';');

  /* ── Left: PULSE + platform + title ── */
  const badge = mkSpan('font-weight:800;color:#00d2d3;letter-spacing:0.1em;font-size:11px;white-space:nowrap;');
  badge.textContent = 'ICAC P.U.L.S.E.';
  bar.appendChild(badge);
  bar.appendChild(sep());

  const plt = mkSpan('padding:3px 10px;border-radius:999px;border:1px solid rgba(0,210,211,0.5);background:rgba(0,210,211,0.12);color:#00d2d3;font-size:11px;font-weight:700;white-space:nowrap;');
  plt.textContent = ${platformEscaped};
  bar.appendChild(plt);
  bar.appendChild(sep());

  const info = mkDiv('min-width:0;line-height:1.25;flex-shrink:1;max-width:220px;');
  const ttl = mkDiv('font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#f1f5f9;font-size:12px;');
  ttl.textContent = ${titleEscaped};
  info.appendChild(ttl);
  if (${dateEscaped}) {
    const dt = mkDiv('font-size:10px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;');
    dt.textContent = 'Captured: ' + ${dateEscaped};
    info.appendChild(dt);
  }
  bar.appendChild(info);
  bar.appendChild(sep());

  /* ── Middle: Search ── */
  const searchWrap = mkDiv('display:flex;align-items:center;gap:4px;');

  const searchInput = document.createElement('input');
  searchInput.id = '__pulse_search_input';
  searchInput.type = 'text';
  searchInput.placeholder = 'Search in chat…';
  searchInput.style.cssText = 'background:#0d1a2e;border:1px solid rgba(0,210,211,0.35);border-radius:6px;color:#e2e8f0;font-size:12px;padding:5px 10px;width:180px;outline:none;';
  searchInput.onfocus = () => { searchInput.style.borderColor = '#00d2d3'; };
  searchInput.onblur  = () => { searchInput.style.borderColor = 'rgba(0,210,211,0.35)'; };
  searchWrap.appendChild(searchInput);

  const btnPrev = mkBtn('◀', 'background:#0d1a2e;border:1px solid rgba(0,210,211,0.3);color:#00d2d3;border-radius:5px;padding:4px 8px;font-size:11px;', 'Previous match');
  const btnNext = mkBtn('▶', 'background:#0d1a2e;border:1px solid rgba(0,210,211,0.3);color:#00d2d3;border-radius:5px;padding:4px 8px;font-size:11px;', 'Next match');
  searchWrap.appendChild(btnPrev);
  searchWrap.appendChild(btnNext);
  bar.appendChild(searchWrap);

  /* ── Search: find-all + scrollIntoView (reliable cross-page navigation) ── */
  let searchMatches = [];
  let searchIndex  = -1;

  const searchCount = mkSpan('font-size:11px;color:#64748b;white-space:nowrap;min-width:48px;text-align:center;');
  searchWrap.appendChild(searchCount);

  const clearMarks = () => {
    document.querySelectorAll('.pulse-search-mark').forEach(el => {
      const p = el.parentNode;
      while (el.firstChild) p.insertBefore(el.firstChild, el);
      p.removeChild(el);
      p.normalize();
    });
    searchMatches = [];
    searchIndex = -1;
    searchCount.textContent = '';
  };

  const highlightAll = (query) => {
    clearMarks();
    if (!query.trim()) return;
    const lower = query.toLowerCase();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) {
      if (n.parentElement && (
        n.parentElement.closest('#__pulse_toolbar') ||
        ['SCRIPT','STYLE','NOSCRIPT'].includes(n.parentElement.tagName)
      )) continue;
      if (n.textContent.toLowerCase().includes(lower)) nodes.push(n);
    }
    nodes.forEach(textNode => {
      const text = textNode.textContent;
      const frag = document.createDocumentFragment();
      let last = 0, idx;
      while ((idx = text.toLowerCase().indexOf(lower, last)) !== -1) {
        if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
        const mark = document.createElement('mark');
        mark.className = 'pulse-search-mark';
        mark.style.cssText = 'background:#ffd700;color:#000;border-radius:2px;padding:0 1px;';
        mark.textContent = text.slice(idx, idx + query.length);
        frag.appendChild(mark);
        searchMatches.push(mark);
        last = idx + query.length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    });
    if (searchMatches.length > 0) { searchIndex = 0; scrollTo(0); }
    else { searchCount.textContent = 'No results'; }
  };

  const scrollTo = (idx) => {
    searchMatches.forEach((m, i) => {
      m.style.cssText = i === idx
        ? 'background:#ff8c00;color:#fff;border-radius:2px;padding:0 1px;outline:2px solid #ff8c00;'
        : 'background:#ffd700;color:#000;border-radius:2px;padding:0 1px;';
    });
    if (searchMatches[idx]) {
      searchMatches[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    searchCount.textContent = searchMatches.length
      ? (idx + 1) + ' / ' + searchMatches.length
      : '';
  };

  const stepSearch = (backwards) => {
    if (!searchMatches.length) { highlightAll(searchInput.value.trim()); return; }
    searchIndex = backwards
      ? (searchIndex - 1 + searchMatches.length) % searchMatches.length
      : (searchIndex + 1) % searchMatches.length;
    scrollTo(searchIndex);
  };

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!searchMatches.length) highlightAll(searchInput.value.trim());
      else stepSearch(e.shiftKey);
    }
    if (e.key === 'Escape') { clearMarks(); searchInput.blur(); }
  });
  searchInput.addEventListener('input', () => { if (!searchInput.value.trim()) clearMarks(); });

  btnNext.addEventListener('mousedown', (e) => { e.preventDefault(); stepSearch(false); });
  btnPrev.addEventListener('mousedown', (e) => { e.preventDefault(); stepSearch(true); });

  /* Ctrl+F → focus search box */
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault(); e.stopPropagation();
      searchInput.focus(); searchInput.select();
    }
  }, true);

  bar.appendChild(sep());

  /* ── Right: Highlight tools ── */
  const hlLabel = mkSpan('font-size:11px;color:#94a3b8;white-space:nowrap;margin-right:2px;');
  hlLabel.textContent = 'Highlight:';
  bar.appendChild(hlLabel);

  /* Color buttons */
  const colors = [
    { key:'yellow', bg:'#ffd700', label:'🟡', title:'Yellow – General evidence' },
    { key:'red',    bg:'#ff4d4d', label:'🔴', title:'Red – Critical / key admission' },
    { key:'green',  bg:'#00c851', label:'🟢', title:'Green – Suspect identified' },
  ];
  const colorBtns = {};
  colors.forEach(({ key, bg, label, title }) => {
    const btn = mkBtn(label, 'background:transparent;border:2px solid transparent;border-radius:5px;padding:3px 6px;font-size:14px;transition:border-color 0.15s;', title);
    btn.dataset.color = key;
    btn.addEventListener('click', () => {
      hlColor = key;
      hlMode = true;
      updateHlUI();
    });
    colorBtns[key] = btn;
    bar.appendChild(btn);
  });

  /* Highlight mode indicator */
  const hlStatus = mkSpan('font-size:11px;padding:3px 8px;border-radius:4px;white-space:nowrap;transition:all 0.2s;');
  bar.appendChild(hlStatus);

  /* Clear button */
  const btnClear = mkBtn('✕ Clear', 'background:#1a0a0a;border:1px solid rgba(255,77,77,0.4);color:#ff4d4d;border-radius:5px;padding:4px 9px;font-size:11px;white-space:nowrap;', 'Remove all highlights');
  btnClear.addEventListener('click', () => {
    document.querySelectorAll('.pulse-hl-yellow,.pulse-hl-red,.pulse-hl-green').forEach(el => {
      const parent = el.parentNode;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    });
    hlMode = false;
    updateHlUI();
    persistHighlights();
    refreshPanel();
  });
  bar.appendChild(btnClear);

  bar.appendChild(sep());

  /* ── Highlights panel toggle button ── */
  const btnPanel = mkBtn('', 'background:#0d1a2e;border:1px solid rgba(0,210,211,0.35);color:#00d2d3;border-radius:5px;padding:4px 10px;font-size:11px;white-space:nowrap;display:flex;align-items:center;gap:5px;', 'Show / hide highlights panel');
  const panelBtnText = document.createElement('span');
  panelBtnText.textContent = '📋 Highlights';
  const panelBadge = document.createElement('span');
  panelBadge.style.cssText = 'background:#00d2d3;color:#080f1e;border-radius:999px;padding:1px 6px;font-size:10px;font-weight:800;min-width:18px;text-align:center;display:none;';
  btnPanel.appendChild(panelBtnText);
  btnPanel.appendChild(panelBadge);
  bar.appendChild(btnPanel);

  function updateHlUI() {
    colors.forEach(({ key }) => {
      const btn = colorBtns[key];
      if (hlMode && hlColor === key) {
        const colorMap = { yellow:'#ffd700', red:'#ff4d4d', green:'#00c851' };
        btn.style.borderColor = colorMap[key];
        btn.style.background = colorMap[key] + '22';
      } else {
        btn.style.borderColor = 'transparent';
        btn.style.background = 'transparent';
      }
    });
    if (hlMode) {
      const labelMap = { yellow:'Highlighting: General', red:'Highlighting: Critical', green:'Highlighting: Suspect ID' };
      hlStatus.textContent = '● ' + labelMap[hlColor];
      hlStatus.style.cssText = 'font-size:11px;padding:3px 8px;border-radius:4px;white-space:nowrap;background:rgba(0,210,211,0.1);color:#00d2d3;border:1px solid rgba(0,210,211,0.3);';
    } else {
      hlStatus.textContent = 'Select text to highlight';
      hlStatus.style.cssText = 'font-size:11px;padding:3px 8px;border-radius:4px;white-space:nowrap;color:#475569;';
    }
  }
  updateHlUI();

  /* ── Highlights side panel ── */
  const panel = document.createElement('div');
  panel.id = '__pulse_panel';
  panel.style.cssText = [
    'position:fixed','top:58px','right:0','bottom:0','z-index:2147483646',
    'width:300px','background:#080f1e',
    'border-left:2px solid rgba(0,210,211,0.3)',
    'display:none','flex-direction:column',
    'box-shadow:-8px 0 32px rgba(0,0,0,0.6)',
    'font-family:system-ui,-apple-system,sans-serif',
    'transition:transform 0.2s ease',
  ].join(';');

  /* Panel header */
  const panelHeader = mkDiv([
    'display:flex','align-items:center','justify-content:space-between',
    'padding:12px 14px','border-bottom:1px solid rgba(0,210,211,0.2)',
    'flex-shrink:0',
  ].join(';'));
  const panelTitle = mkSpan('font-size:12px;font-weight:700;color:#00d2d3;letter-spacing:0.05em;text-transform:uppercase;');
  panelTitle.textContent = 'Evidence Highlights';
  const btnClosePanel = mkBtn('✕', 'background:transparent;border:none;color:#475569;font-size:14px;padding:2px 4px;cursor:pointer;', 'Close panel');
  btnClosePanel.addEventListener('click', () => { panel.style.display = 'none'; document.documentElement.style.removeProperty('margin-right'); });
  panelHeader.appendChild(panelTitle);
  panelHeader.appendChild(btnClosePanel);
  panel.appendChild(panelHeader);

  /* Panel scroll area */
  const panelBody = mkDiv('flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:6px;');
  panelBody.style.setProperty('scrollbar-width', 'thin');
  panel.appendChild(panelBody);

  /* Panel empty state */
  const panelEmpty = mkDiv('text-align:center;color:#334155;font-size:12px;padding:32px 16px;line-height:1.6;');
  panelEmpty.textContent = 'No highlights yet. Select text while in highlight mode to annotate evidence.';

  /* Build a single highlight card */
  const makeCard = (span, idx) => {
    const color = span.classList.contains('pulse-hl-red') ? 'red'
                : span.classList.contains('pulse-hl-green') ? 'green' : 'yellow';
    const colorHex = { yellow:'#ffd700', red:'#ff4d4d', green:'#00c851' };
    const colorLabel = { yellow:'General', red:'Critical', green:'Suspect ID' };
    const bg = { yellow:'rgba(255,215,0,0.08)', red:'rgba(255,77,77,0.08)', green:'rgba(0,200,81,0.08)' };
    const border = { yellow:'rgba(255,215,0,0.25)', red:'rgba(255,77,77,0.25)', green:'rgba(0,200,81,0.25)' };

    const card = mkDiv([
      'border-radius:6px','padding:9px 11px',
      'background:' + bg[color],
      'border:1px solid ' + border[color],
      'cursor:pointer','transition:background 0.15s',
    ].join(';'));

    /* Top row: color dot + label + jump button */
    const topRow = mkDiv('display:flex;align-items:center;gap:6px;margin-bottom:5px;');
    const dot = mkSpan('width:8px;height:8px;border-radius:50%;flex-shrink:0;background:' + colorHex[color] + ';');
    const lbl = mkSpan('font-size:10px;font-weight:700;color:' + colorHex[color] + ';text-transform:uppercase;letter-spacing:0.06em;flex:1;');
    lbl.textContent = colorLabel[color];
    const jumpBtn = mkBtn('↗', 'background:transparent;border:none;color:#475569;font-size:12px;padding:0 2px;cursor:pointer;', 'Jump to in document');
    jumpBtn.addEventListener('mousedown', (e) => { e.stopPropagation(); });
    jumpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      span.scrollIntoView({ behavior:'smooth', block:'center' });
      span.style.outline = '2px solid ' + colorHex[color];
      span.style.outlineOffset = '2px';
      setTimeout(() => { span.style.outline = ''; span.style.outlineOffset = ''; }, 1500);
    });
    topRow.appendChild(dot);
    topRow.appendChild(lbl);
    topRow.appendChild(jumpBtn);
    card.appendChild(topRow);

    /* Text snippet */
    const snippet = mkDiv([
      'font-size:12px','color:#cbd5e1','line-height:1.5',
      'max-height:72px','overflow:hidden',
      'display:-webkit-box','-webkit-line-clamp:3','-webkit-box-orient:vertical',
    ].join(';'));
    snippet.textContent = '"' + span.textContent.trim() + '"';
    card.appendChild(snippet);

    /* Click card → jump */
    card.addEventListener('click', () => {
      span.scrollIntoView({ behavior:'smooth', block:'center' });
      span.style.outline = '2px solid ' + colorHex[color];
      span.style.outlineOffset = '2px';
      setTimeout(() => { span.style.outline = ''; span.style.outlineOffset = ''; }, 1500);
    });
    card.addEventListener('mouseenter', () => { card.style.filter = 'brightness(1.15)'; });
    card.addEventListener('mouseleave', () => { card.style.filter = ''; });

    return card;
  };

  /* Rebuild the panel contents */
  const refreshPanel = () => {
    panelBody.innerHTML = '';
    const allSpans = Array.from(document.querySelectorAll('.pulse-hl-yellow,.pulse-hl-red,.pulse-hl-green'));

    /* Update badge */
    if (allSpans.length > 0) {
      panelBadge.textContent = String(allSpans.length);
      panelBadge.style.display = 'inline-block';
    } else {
      panelBadge.style.display = 'none';
    }

    if (!allSpans.length) {
      panelBody.appendChild(panelEmpty);
      return;
    }

    /* Group by priority: red → yellow → green */
    const order = ['red','yellow','green'];
    const groupLabels = { red:'🔴 Critical', yellow:'🟡 General Evidence', green:'🟢 Suspect ID' };
    order.forEach(color => {
      const group = allSpans.filter(s => s.classList.contains('pulse-hl-' + color));
      if (!group.length) return;
      const groupHeader = mkDiv('font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;padding:4px 2px 2px;margin-top:4px;');
      groupHeader.textContent = groupLabels[color] + ' (' + group.length + ')';
      panelBody.appendChild(groupHeader);
      group.forEach((span, i) => panelBody.appendChild(makeCard(span, i)));
    });
  };

  /* Toggle panel */
  btnPanel.addEventListener('click', () => {
    const isOpen = panel.style.display === 'flex';
    if (isOpen) {
      panel.style.display = 'none';
      document.documentElement.style.removeProperty('margin-right');
    } else {
      refreshPanel();
      panel.style.display = 'flex';
      document.documentElement.style.setProperty('margin-right', '300px', 'important');
    }
  });

  /* ── Persistence helpers ── */
  const EVIDENCE_ID = ${evidenceIdVal};

  const getXPath = (node) => {
    if (node === document.body) return '/html/body';
    const parts = [];
    let cur = node;
    while (cur && cur !== document.body) {
      let idx = 1;
      let sib = cur.previousSibling;
      while (sib) { if (sib.nodeType === cur.nodeType && sib.nodeName === cur.nodeName) idx++; sib = sib.previousSibling; }
      parts.unshift(cur.nodeName.toLowerCase() + '[' + idx + ']');
      cur = cur.parentNode;
    }
    return '/html/body/' + parts.join('/');
  };

  const serializeHighlights = () => {
    const result = [];
    document.querySelectorAll('.pulse-hl-yellow,.pulse-hl-red,.pulse-hl-green').forEach(el => {
      const color = el.classList.contains('pulse-hl-red') ? 'red'
                  : el.classList.contains('pulse-hl-green') ? 'green' : 'yellow';
      result.push({ color, textContent: el.textContent, xpath: getXPath(el), startOffset: 0, endOffset: el.textContent.length });
    });
    return result;
  };

  const persistHighlights = () => {
    try {
      const { ipcRenderer } = require('electron');
      ipcRenderer.invoke('save-chat-highlights', EVIDENCE_ID, serializeHighlights());
    } catch(err) {}
  };

  const restoreHighlights = (rows) => {
    if (!rows || !rows.length) return;
    rows.forEach(row => {
      try {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          if (n.parentElement && n.parentElement.closest('#__pulse_toolbar,#__pulse_panel')) continue;
          if (n.parentElement && (n.parentElement.classList.contains('pulse-hl-yellow') ||
              n.parentElement.classList.contains('pulse-hl-red') ||
              n.parentElement.classList.contains('pulse-hl-green'))) continue;
          const idx = n.textContent.indexOf(row.text_content);
          if (idx !== -1) {
            const range = document.createRange();
            range.setStart(n, idx);
            range.setEnd(n, idx + row.text_content.length);
            const span = document.createElement('span');
            span.className = 'pulse-hl-' + row.color;
            try { range.surroundContents(span); } catch {}
            break;
          }
        }
      } catch {}
    });
  };

  try {
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke('load-chat-highlights', EVIDENCE_ID).then(rows => {
      if (rows && rows.length) {
        restoreHighlights(rows);
        // Update badge after restore
        const count = document.querySelectorAll('.pulse-hl-yellow,.pulse-hl-red,.pulse-hl-green').length;
        if (count > 0) { panelBadge.textContent = String(count); panelBadge.style.display = 'inline-block'; }
      }
    });
  } catch {}

  /* Highlight on mouseup when mode is active */
  document.addEventListener('mouseup', (e) => {
    if (!hlMode) return;
    if (bar.contains(e.target) || panel.contains(e.target)) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.toString().trim() === '') return;
    try {
      /* Collect text nodes inside the range (handles cross-element selections) */
      const textNodes = [];
      const walker = document.createTreeWalker(range.commonAncestorContainer.nodeType === 3
        ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer,
        NodeFilter.SHOW_TEXT);
      let tn;
      while ((tn = walker.nextNode())) {
        if (range.intersectsNode(tn)) textNodes.push(tn);
      }
      textNodes.forEach(node => {
        const nr = document.createRange();
        nr.selectNodeContents(node);
        /* Clamp to actual selection boundaries */
        if (node === range.startContainer) nr.setStart(node, range.startOffset);
        if (node === range.endContainer) nr.setEnd(node, range.endOffset);
        if (nr.toString().trim() === '') return;
        const span = document.createElement('span');
        span.className = 'pulse-hl-' + hlColor;
        nr.surroundContents(span);
      });
      sel.removeAllRanges();
      persistHighlights();
      refreshPanel();
    } catch(e) {}
  });

  /* ── Mount ── */
  document.documentElement.appendChild(bar);
  document.documentElement.appendChild(panel);
  document.documentElement.style.setProperty('margin-top', '56px', 'important');
})();
        `).catch((err: any) => safeLog('toolbar inject error:', err));
      };

      // Fire on dom-ready (earliest safe point) then again at did-finish-load
      // as a safety net for pages whose scripts manipulate the DOM after load
      viewerWindow.webContents.once('dom-ready', () => {
        setTimeout(injectToolbar, 300);
      });
      viewerWindow.webContents.once('did-finish-load', () => {
        setTimeout(injectToolbar, 800);
      });

      return { success: true };
    } catch (error) {
      console.log('open-chat-viewer error:', error);
      throw error;
    }
  });

  // Read the first N bytes of a case file (used by ChatViewer to extract SingleFile metadata)
  ipcMain.handle('read-file-snippet', async (_event, relativePath: string, bytes: number) => {
    try {
      const absPath = fileManager.getAbsolutePath(relativePath);
      const fd = fs.openSync(absPath, 'r');
      const buf = Buffer.alloc(bytes);
      const bytesRead = fs.readSync(fd, buf, 0, bytes, 0);
      fs.closeSync(fd);
      return buf.slice(0, bytesRead).toString('utf8');
    } catch (error) {
      return '';
    }
  });

  // Persist highlights for the investigative viewer
  ipcMain.handle('save-chat-highlights', async (_event, evidenceId: number, highlights: any[]) => {
    try {
      const db = getDatabase();
      db.prepare('DELETE FROM chat_highlights WHERE evidence_id = ?').run(evidenceId);
      const stmt = db.prepare(
        'INSERT INTO chat_highlights (evidence_id, color, text_content, xpath, start_offset, end_offset) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const h of highlights) {
        stmt.run(evidenceId, h.color, h.textContent, h.xpath, h.startOffset, h.endOffset);
      }
      saveDatabase();
      return { success: true };
    } catch (error) {
      console.log('save-chat-highlights error:', error);
      throw error;
    }
  });

  ipcMain.handle('load-chat-highlights', async (_event, evidenceId: number) => {
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT * FROM chat_highlights WHERE evidence_id = ? ORDER BY id ASC').all(evidenceId);
      return rows || [];
    } catch (error) {
      console.log('load-chat-highlights error:', error);
      return [];
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_EVIDENCE, async (_event, caseId: number) => {
    try {
      // safeLog('GET_EVIDENCE called for case:', caseId);
      const stmt = db.prepare('SELECT * FROM evidence WHERE case_id = ? ORDER BY uploaded_at DESC');
      const evidence = stmt.all(caseId);
      // safeLog('GET_EVIDENCE result:', evidence);
      return evidence || [];
    } catch (error) {
      // safeLog('GET_EVIDENCE error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.ADD_EVIDENCE, async (_event, evidenceData: any) => {
    try {
      // safeLog('ADD_EVIDENCE called with:', evidenceData);
      
      const insertStmt = db.prepare(`
        INSERT INTO evidence (case_id, description, file_path, category)
        VALUES (?, ?, ?, ?)
      `);
      
      insertStmt.run(
        evidenceData.case_id,
        evidenceData.description || '',
        evidenceData.file_path || '',
        evidenceData.category || 'Other'
      );
      
      // Query back the inserted record
      const verifyStmt = db.prepare('SELECT * FROM evidence WHERE case_id = ? ORDER BY uploaded_at DESC LIMIT 1');
      const inserted = verifyStmt.get(evidenceData.case_id);
      // safeLog('Inserted evidence:', inserted);
      
      return inserted;
    } catch (error) {
      // safeLog('ADD_EVIDENCE error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.DELETE_EVIDENCE, async (_event, evidenceId: number) => {
    try {
      // safeLog('DELETE_EVIDENCE called with id:', evidenceId);
      const stmt = db.prepare('DELETE FROM evidence WHERE id = ?');
      stmt.run(evidenceId);
      return { success: true };
    } catch (error) {
      // safeLog('DELETE_EVIDENCE error:', error);
      throw error;
    }
  });

  // Case Notes handlers
  ipcMain.handle(IPC_CHANNELS.GET_CASE_NOTES, async (_event, caseId: number) => {
    try {
      // safeLog('GET_CASE_NOTES called for case:', caseId);
      const stmt = db.prepare('SELECT * FROM case_notes WHERE case_id = ? ORDER BY created_at DESC');
      const notes = stmt.all(caseId);
      // safeLog('GET_CASE_NOTES result:', notes);
      return notes || [];
    } catch (error) {
      // safeLog('GET_CASE_NOTES error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.ADD_CASE_NOTE, async (_event, noteData: any) => {
    try {
      // safeLog('ADD_CASE_NOTE called with:', noteData);
      
      const insertStmt = db.prepare(`
        INSERT INTO case_notes (case_id, content)
        VALUES (?, ?)
      `);
      
      insertStmt.run(
        noteData.case_id,
        noteData.content || ''
      );
      
      // Query back the inserted record
      const verifyStmt = db.prepare('SELECT * FROM case_notes WHERE case_id = ? ORDER BY created_at DESC LIMIT 1');
      const inserted = verifyStmt.get(noteData.case_id);
      // safeLog('Inserted case note:', inserted);
      
      return inserted;
    } catch (error) {
      // safeLog('ADD_CASE_NOTE error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.DELETE_CASE_NOTE, async (_event, noteId: number) => {
    try {
      // safeLog('DELETE_CASE_NOTE called with id:', noteId);
      const stmt = db.prepare('DELETE FROM case_notes WHERE id = ?');
      stmt.run(noteId);
      return { success: true };
    } catch (error) {
      // safeLog('DELETE_CASE_NOTE error:', error);
      throw error;
    }
  });

  // Prosecution handlers
  ipcMain.handle(IPC_CHANNELS.GET_PROSECUTION, async (_event, caseId: number) => {
    try {
      // safeLog('GET_PROSECUTION called for case:', caseId);
      const stmt = db.prepare('SELECT * FROM prosecution_info WHERE case_id = ? LIMIT 1');
      const prosecution = stmt.get(caseId);
      // safeLog('GET_PROSECUTION result:', prosecution);
      return prosecution || null;
    } catch (error) {
      // safeLog('GET_PROSECUTION error:', error);
      throw error;
    }
  });
  
  ipcMain.handle(IPC_CHANNELS.SAVE_PROSECUTION, async (_event, prosecutionData: any) => {
    try {
      // safeLog('SAVE_PROSECUTION called with case_id:', prosecutionData.case_id);
      
      // Check if prosecution info exists
      const checkStmt = db.prepare('SELECT id FROM prosecution_info WHERE case_id = ? LIMIT 1');
      const existing = checkStmt.get(prosecutionData.case_id);
      
      if (existing) {
        // Update existing
        const prosecutionId = existing.id;
        // safeLog('Updating existing prosecution info:', prosecutionId);
        
        const updateStmt = db.prepare(`
          UPDATE prosecution_info SET
            court_case_number = ?,
            da_name = ?,
            charges = ?,
            convicted = ?,
            sentence = ?
          WHERE id = ?
        `);
        
        updateStmt.run(
          prosecutionData.court_case_number || null,
          prosecutionData.da_name || null,
          prosecutionData.charges || null,
          prosecutionData.convicted ? 1 : 0,
          prosecutionData.sentence || null,
          prosecutionId
        );
        
        return { id: prosecutionId, ...prosecutionData };
      } else {
        // Insert new
        // safeLog('Inserting new prosecution info for case:', prosecutionData.case_id);
        
        const insertStmt = db.prepare(`
          INSERT INTO prosecution_info (case_id, court_case_number, da_name, charges, convicted, sentence)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        insertStmt.run(
          prosecutionData.case_id,
          prosecutionData.court_case_number || null,
          prosecutionData.da_name || null,
          prosecutionData.charges || null,
          prosecutionData.convicted ? 1 : 0,
          prosecutionData.sentence || null
        );
        
        // Query back the inserted record
        const verifyStmt = db.prepare('SELECT * FROM prosecution_info WHERE case_id = ? LIMIT 1');
        const inserted = verifyStmt.get(prosecutionData.case_id);
        // safeLog('Inserted prosecution info:', inserted);
        
        return inserted;
      }
    } catch (error) {
      // safeLog('SAVE_PROSECUTION error:', error);
      throw error;
    }
  });

  // ============= TASK/TODO HANDLERS =============
  
  ipcMain.handle(IPC_CHANNELS.GET_TODOS, async (_event, caseId?: number) => {
    try {
      const db = getDatabase();
      let stmt;
      
      if (caseId) {
        // Get todos for a specific case
        stmt = db.prepare('SELECT * FROM todos WHERE case_id = ? ORDER BY created_at DESC');
        return stmt.all(caseId);
      } else {
        // Get all todos (for dashboard)
        stmt = db.prepare(`
          SELECT t.*, c.case_number 
          FROM todos t
          LEFT JOIN cases c ON t.case_id = c.id
          ORDER BY t.completed ASC, t.due_date ASC, t.created_at DESC
        `);
        return stmt.all();
      }
    } catch (error) {
      // safeLog('GET_TODOS error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.ADD_TODO, async (_event, todoData: any) => {
    try {
      // safeLog('ADD_TODO called with:', todoData);
      const db = getDatabase();
      
      const stmt = db.prepare(`
        INSERT INTO todos (case_id, content, due_date, file_path, file_name, completed)
        VALUES (?, ?, ?, ?, ?, 0)
      `);
      
      stmt.run(
        todoData.caseId || null,
        todoData.content,
        todoData.dueDate || null,
        todoData.filePath || null,
        todoData.fileName || null
      );
      
      // Get the inserted todo
      const verifyStmt = db.prepare('SELECT * FROM todos ORDER BY id DESC LIMIT 1');
      const inserted = verifyStmt.get();
      // safeLog('Inserted todo:', inserted);
      
      return inserted;
    } catch (error) {
      // safeLog('ADD_TODO error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_TODO, async (_event, todoId: number, updates: any) => {
    try {
      // safeLog('UPDATE_TODO called with:', todoId, updates);
      const db = getDatabase();
      
      const stmt = db.prepare(`
        UPDATE todos SET
          completed = ?,
          completed_at = ?
        WHERE id = ?
      `);
      
      stmt.run(
        updates.completed ? 1 : 0,
        updates.completed ? new Date().toISOString() : null,
        todoId
      );
      
      return { success: true };
    } catch (error) {
      // safeLog('UPDATE_TODO error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_TODO, async (_event, todoId: number) => {
    try {
      // safeLog('DELETE_TODO called with:', todoId);
      const db = getDatabase();
      
      // Get the file path before deleting (if there's a file to delete)
      const todoStmt = db.prepare('SELECT file_path FROM todos WHERE id = ?');
      const todo = todoStmt.get(todoId);
      
      // Delete the todo
      const deleteStmt = db.prepare('DELETE FROM todos WHERE id = ?');
      deleteStmt.run(todoId);
      
      // Optionally delete the file (keeping it for now as it may be referenced elsewhere)
      // If you want to delete files, uncomment:
      // if (todo && todo.file_path) {
      //   const filePath = path.join(getCasesPath(), todo.file_path);
      //   if (fs.existsSync(filePath)) {
      //     fs.unlinkSync(filePath);
      //   }
      // }
      
      return { success: true };
    } catch (error) {
      // safeLog('DELETE_TODO error:', error);
      throw error;
    }
  });

  // ========== Public Outreach ==========
  
  ipcMain.handle(IPC_CHANNELS.GET_ALL_PUBLIC_OUTREACH, async () => {
    try {
      // safeLog('GET_ALL_PUBLIC_OUTREACH called');
      const db = getDatabase();
      
      const stmt = db.prepare(`
        SELECT * FROM public_outreach 
        ORDER BY date DESC
      `);
      const outreach = stmt.all();
      
      // safeLog('Found', outreach.length, 'outreach events');
      return outreach;
    } catch (error) {
      // safeLog('GET_ALL_PUBLIC_OUTREACH error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_PUBLIC_OUTREACH, async (_event, id: number) => {
    try {
      // safeLog('GET_PUBLIC_OUTREACH called with:', id);
      const db = getDatabase();
      
      const stmt = db.prepare('SELECT * FROM public_outreach WHERE id = ?');
      const outreach = stmt.get(id);
      
      return outreach;
    } catch (error) {
      // safeLog('GET_PUBLIC_OUTREACH error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.ADD_PUBLIC_OUTREACH, async (_event, data: any) => {
    try {
      // safeLog('ADD_PUBLIC_OUTREACH called with:', data);
      const db = getDatabase();
      
      const stmt = db.prepare(`
        INSERT INTO public_outreach (date, location, num_attendees, is_law_enforcement, notes)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        data.date,
        data.location,
        data.numAttendees,
        data.isLawEnforcement ? 1 : 0,
        data.notes || null
      );
      
      // Get the created record
      const getStmt = db.prepare('SELECT * FROM public_outreach ORDER BY id DESC LIMIT 1');
      const created = getStmt.get();
      
      return { success: true, outreach: created };
    } catch (error) {
      // safeLog('ADD_PUBLIC_OUTREACH error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_PUBLIC_OUTREACH, async (_event, id: number, data: any) => {
    try {
      // safeLog('UPDATE_PUBLIC_OUTREACH called with:', id, data);
      const db = getDatabase();
      
      const stmt = db.prepare(`
        UPDATE public_outreach 
        SET date = ?, location = ?, num_attendees = ?, is_law_enforcement = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(
        data.date,
        data.location,
        data.numAttendees,
        data.isLawEnforcement ? 1 : 0,
        data.notes || null,
        id
      );
      
      return { success: true };
    } catch (error) {
      // safeLog('UPDATE_PUBLIC_OUTREACH error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_PUBLIC_OUTREACH, async (_event, id: number) => {
    try {
      // safeLog('DELETE_PUBLIC_OUTREACH called with:', id);
      const db = getDatabase();
      
      const stmt = db.prepare('DELETE FROM public_outreach WHERE id = ?');
      stmt.run(id);
      
      return { success: true };
    } catch (error) {
      // safeLog('DELETE_PUBLIC_OUTREACH error:', error);
      throw error;
    }
  });

  // ========== Outreach Materials ==========
  
  ipcMain.handle(IPC_CHANNELS.GET_OUTREACH_MATERIALS, async () => {
    try {
      // safeLog('GET_OUTREACH_MATERIALS called');
      const db = getDatabase();
      
      const stmt = db.prepare(`
        SELECT * FROM outreach_materials 
        ORDER BY created_at DESC
      `);
      const materials = stmt.all();
      
      // safeLog('Found', materials.length, 'outreach materials');
      return materials;
    } catch (error) {
      // safeLog('GET_OUTREACH_MATERIALS error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.ADD_OUTREACH_MATERIAL, async (_event, data: any) => {
    try {
      // safeLog('ADD_OUTREACH_MATERIAL called with:', data);
      const db = getDatabase();
      
      const stmt = db.prepare(`
        INSERT INTO outreach_materials (material_name, material_type, file_path, notes)
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run(
        data.materialName,
        data.materialType,
        data.filePath,
        data.notes || null
      );
      
      // Get the created record
      const getStmt = db.prepare('SELECT * FROM outreach_materials ORDER BY id DESC LIMIT 1');
      const created = getStmt.get();
      
      return { success: true, material: created };
    } catch (error) {
      // safeLog('ADD_OUTREACH_MATERIAL error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_OUTREACH_MATERIAL, async (_event, id: number, data: any) => {
    try {
      // safeLog('UPDATE_OUTREACH_MATERIAL called with:', id, data);
      const db = getDatabase();
      
      const stmt = db.prepare(`
        UPDATE outreach_materials 
        SET material_name = ?, material_type = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(
        data.materialName,
        data.materialType,
        data.notes || null,
        id
      );
      
      return { success: true };
    } catch (error) {
      // safeLog('UPDATE_OUTREACH_MATERIAL error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_OUTREACH_MATERIAL, async (_event, id: number) => {
    try {
      // safeLog('DELETE_OUTREACH_MATERIAL called with:', id);
      const db = getDatabase();
      
      // Get file path before deleting
      const material = db.prepare('SELECT file_path FROM outreach_materials WHERE id = ?').get(id);
      
      if (material && material.file_path) {
        // Delete the physical file
        const fullPath = path.join(getCasesPath(), material.file_path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          // safeLog('Deleted file:', fullPath);
        }
      }
      
      // Delete from database
      const stmt = db.prepare('DELETE FROM outreach_materials WHERE id = ?');
      stmt.run(id);
      
      return { success: true };
    } catch (error) {
      // safeLog('DELETE_OUTREACH_MATERIAL error:', error);
      throw error;
    }
  });

  // ========== Resources ==========
  
  ipcMain.handle(IPC_CHANNELS.GET_ALL_RESOURCES, async () => {
    try {
      // safeLog('GET_ALL_RESOURCES called');
      const db = getDatabase();
      
      const stmt = db.prepare(`
        SELECT * FROM resources 
        ORDER BY created_at DESC
      `);
      const resources = stmt.all();
      
      // safeLog('Found', resources.length, 'resources');
      return resources;
    } catch (error) {
      // safeLog('GET_ALL_RESOURCES error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_RESOURCE, async (_event, id: number) => {
    try {
      // safeLog('GET_RESOURCE called with:', id);
      const db = getDatabase();
      
      const stmt = db.prepare('SELECT * FROM resources WHERE id = ?');
      const resource = stmt.get(id);
      
      return resource;
    } catch (error) {
      // safeLog('GET_RESOURCE error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.ADD_RESOURCE, async (_event, data: any) => {
    try {
      // safeLog('ADD_RESOURCE called with:', data);
      const db = getDatabase();
      
      const stmt = db.prepare(`
        INSERT INTO resources (title, resource_type, file_path, notes)
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run(
        data.title,
        data.resourceType || null,
        data.filePath,
        data.notes || null
      );
      
      // Get the created record
      const getStmt = db.prepare('SELECT * FROM resources ORDER BY id DESC LIMIT 1');
      const created = getStmt.get();
      
      return { success: true, resource: created };
    } catch (error) {
      // safeLog('ADD_RESOURCE error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_RESOURCE, async (_event, id: number, data: any) => {
    try {
      // safeLog('UPDATE_RESOURCE called with:', id, data);
      const db = getDatabase();
      
      const stmt = db.prepare(`
        UPDATE resources 
        SET title = ?, resource_type = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(
        data.title,
        data.resourceType || null,
        data.notes || null,
        id
      );
      
      return { success: true };
    } catch (error) {
      // safeLog('UPDATE_RESOURCE error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_RESOURCE, async (_event, id: number) => {
    try {
      // safeLog('DELETE_RESOURCE called with:', id);
      const db = getDatabase();
      
      // Get file path before deleting
      const resource = db.prepare('SELECT file_path FROM resources WHERE id = ?').get(id);
      
      if (resource && resource.file_path) {
        // Delete the physical file
        const fullPath = path.join(getCasesPath(), resource.file_path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          // safeLog('Deleted file:', fullPath);
        }
      }
      
      // Delete from database
      const stmt = db.prepare('DELETE FROM resources WHERE id = ?');
      stmt.run(id);
      
      return { success: true };
    } catch (error) {
      // safeLog('DELETE_RESOURCE error:', error);
      throw error;
    }
  });

  // ========== Offense Reference ==========
  
  ipcMain.handle(IPC_CHANNELS.GET_ALL_OFFENSES, async () => {
    try {
      // safeLog('GET_ALL_OFFENSES called');
      const db = getDatabase();
      
      const stmt = db.prepare(`
        SELECT * FROM offense_reference 
        ORDER BY display_order ASC, charge_code ASC
      `);
      const offenses = stmt.all();
      
      // safeLog('Found', offenses.length, 'offenses');
      return offenses;
    } catch (error) {
      // safeLog('GET_ALL_OFFENSES error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.GET_OFFENSE, async (_event, id: number) => {
    try {
      // safeLog('GET_OFFENSE called with:', id);
      const db = getDatabase();
      
      const stmt = db.prepare('SELECT * FROM offense_reference WHERE id = ?');
      const offense = stmt.get(id);
      
      return offense;
    } catch (error) {
      // safeLog('GET_OFFENSE error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.ADD_OFFENSE, async (_event, data: any) => {
    try {
      // safeLog('ADD_OFFENSE called with:', data);
      const db = getDatabase();
      
      // Get max display_order and add 1
      const maxOrderStmt = db.prepare('SELECT MAX(display_order) as max_order FROM offense_reference');
      const result = maxOrderStmt.get();
      const nextOrder = (result.max_order || 0) + 1;
      
      const stmt = db.prepare(`
        INSERT INTO offense_reference (charge_code, charge_description, seriousness, sentencing_range, notes, category, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        data.chargeCode,
        data.chargeDescription,
        data.seriousness,
        data.sentencingRange || null,
        data.notes || null,
        data.category || 'state',
        nextOrder
      );
      
      // Get the created record
      const getStmt = db.prepare('SELECT * FROM offense_reference ORDER BY id DESC LIMIT 1');
      const created = getStmt.get();
      
      return { success: true, offense: created };
    } catch (error) {
      // safeLog('ADD_OFFENSE error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_OFFENSE, async (_event, id: number, data: any) => {
    try {
      // safeLog('UPDATE_OFFENSE called with:', id, data);
      const db = getDatabase();
      
      const stmt = db.prepare(`
        UPDATE offense_reference 
        SET charge_code = ?, charge_description = ?, seriousness = ?, sentencing_range = ?, notes = ?, category = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      
      stmt.run(
        data.chargeCode,
        data.chargeDescription,
        data.seriousness,
        data.sentencingRange || null,
        data.notes || null,
        data.category || 'state',
        id
      );
      
      return { success: true };
    } catch (error) {
      // safeLog('UPDATE_OFFENSE error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_OFFENSE, async (_event, id: number) => {
    try {
      // safeLog('DELETE_OFFENSE called with:', id);
      const db = getDatabase();
      
      const stmt = db.prepare('DELETE FROM offense_reference WHERE id = ?');
      stmt.run(id);
      
      return { success: true };
    } catch (error) {
      // safeLog('DELETE_OFFENSE error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT_OFFENSES, async (_event) => {
    try {
      // safeLog('EXPORT_OFFENSES called');
      
      // Show save dialog
      const result = await dialog.showSaveDialog({
        title: 'Export Offense References',
        defaultPath: `Offense_References_${new Date().toISOString().split('T')[0]}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] }
        ]
      });
      
      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }
      
      const db = getDatabase();
      const stmt = db.prepare('SELECT id, charge_code, charge_description, seriousness, sentencing_range, notes, category, display_order FROM offense_reference ORDER BY display_order');
      const offenses = stmt.all();
      
      // Create export object with metadata
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        appName: 'ICAC P.U.L.S.E.',
        count: offenses.length,
        offenses: offenses
      };
      
      // Write to file
      fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2));
      
      return { success: true, filePath: result.filePath, count: offenses.length };
    } catch (error) {
      // safeLog('EXPORT_OFFENSES error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_OFFENSES, async (_event, options: { overwriteDuplicates: boolean }) => {
    try {
      // safeLog('IMPORT_OFFENSES called with options:', options);
      
      // Show open dialog
      const result = await dialog.showOpenDialog({
        title: 'Import Offense References',
        filters: [
          { name: 'JSON Files', extensions: ['json'] }
        ],
        properties: ['openFile']
      });
      
      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }
      
      const filePath = result.filePaths[0];
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const importData = JSON.parse(fileContent);
      
      // Validate import data
      if (!importData.offenses || !Array.isArray(importData.offenses)) {
        throw new Error('Invalid offense reference file format');
      }
      
      const db = getDatabase();
      let imported = 0;
      let skipped = 0;
      let updated = 0;
      
      // Get existing offense charge codes for duplicate detection
      const existingStmt = db.prepare('SELECT charge_code, category FROM offense_reference');
      const existing = existingStmt.all();
      const existingMap = new Map();
      existing.forEach(o => {
        existingMap.set(`${o.charge_code}|${o.category}`, true);
      });
      
      for (const offense of importData.offenses) {
        const key = `${offense.charge_code}|${offense.category}`;
        
        if (existingMap.has(key)) {
          if (options.overwriteDuplicates) {
            // Update existing
            const updateStmt = db.prepare(`
              UPDATE offense_reference 
              SET charge_description = ?, seriousness = ?, sentencing_range = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
              WHERE charge_code = ? AND category = ?
            `);
            updateStmt.run(
              offense.charge_description,
              offense.seriousness,
              offense.sentencing_range || null,
              offense.notes || null,
              offense.charge_code,
              offense.category || 'state'
            );
            updated++;
          } else {
            // Skip duplicate
            skipped++;
          }
        } else {
          // Insert new
          // Get max display_order
          const maxOrderStmt = db.prepare('SELECT MAX(display_order) as max_order FROM offense_reference');
          const result = maxOrderStmt.get();
          const nextOrder = (result.max_order || 0) + 1;
          
          const insertStmt = db.prepare(`
            INSERT INTO offense_reference (charge_code, charge_description, seriousness, sentencing_range, notes, category, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          insertStmt.run(
            offense.charge_code,
            offense.charge_description,
            offense.seriousness,
            offense.sentencing_range || null,
            offense.notes || null,
            offense.category || 'state',
            nextOrder
          );
          imported++;
        }
      }
      
      return { success: true, imported, skipped, updated };
    } catch (error) {
      // safeLog('IMPORT_OFFENSES error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.REORDER_OFFENSES, async (_event, offenseIds: number[]) => {
    try {
      // safeLog('REORDER_OFFENSES called with:', offenseIds.length, 'offenses');
      const db = getDatabase();
      
      const stmt = db.prepare('UPDATE offense_reference SET display_order = ? WHERE id = ?');
      
      offenseIds.forEach((id, index) => {
        stmt.run(index, id);
      });
      
      return { success: true };
    } catch (error) {
      // safeLog('REORDER_OFFENSES error:', error);
      throw error;
    }
  });

  // ── CDR Module ────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.GET_CDR_RECORDS, async (_event, caseId: number) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM cdr_records WHERE case_id = ? ORDER BY timestamp DESC');
      return stmt.all(caseId) || [];
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_CDR_RECORDS, async (_event, data: { caseId: number; records: any[]; refLat?: number; refLon?: number }) => {
    try {
      const rawDb = getRawDatabase();
      const sql = `INSERT INTO cdr_records (case_id, phone_a, phone_b, date_val, time_val, timestamp, call_type, duration_seconds, imei, imsi, tower_a, tower_b, source, raw_line)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
      rawDb.exec('BEGIN TRANSACTION');
      let imported = 0;
      for (const r of data.records) {
        rawDb.exec(sql, [
          data.caseId,
          r.phoneA || null, r.phoneB || null,
          r.date || null, r.time || null, r.timestamp || null,
          r.callType || 'voice', r.duration || 0,
          r.imei || null, r.imsi || null,
          r.towerA || null, r.towerB || null,
          r.source || null, r.raw || null
        ]);
        imported++;
      }
      rawDb.exec('COMMIT');
      saveDatabase();
      console.log(`CDR import: ${imported} records imported for case ${data.caseId}`);
      return { success: true, imported };
    } catch (error) {
      try { getRawDatabase().exec('ROLLBACK'); } catch {}
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_CDR_RECORDS, async (_event, caseId: number) => {
    try {
      const db = getDatabase();
      db.run('DELETE FROM cdr_records WHERE case_id = ?', [caseId]);
      saveDatabase();
      return { success: true };
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.READ_EVIDENCE_FILE, async (_event, relativePath: string) => {
    try {
      const absPath = fileManager.getAbsolutePath(relativePath);
      if (!fs.existsSync(absPath)) return { success: false, error: 'File not found' };
      const content = fs.readFileSync(absPath, 'utf-8');
      return { success: true, content };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Aperture Module ───────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.GET_APERTURE_EMAILS, async (_event, caseId: number) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM aperture_emails WHERE case_id = ? ORDER BY date_sent DESC');
      return stmt.all(caseId) || [];
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_APERTURE_EMAILS, async (_event, data: { caseId: number; fileData: string; fileName: string; sourceName?: string }) => {
    try {
      const rawDb = getRawDatabase();
      const raw = Buffer.from(data.fileData, 'base64').toString('utf-8');
      const emails = parseEmailContent(raw, data.fileName);
      const sourceName = data.sourceName || data.fileName.replace(/\.[^.]+$/, '');

      const sql = `INSERT INTO aperture_emails (case_id, message_id, from_address, to_addresses, cc_addresses, subject, date_sent, body_text, body_html, headers_raw, source_file, source_name, flagged, ip_addresses, attachments_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`;
      
      rawDb.exec('BEGIN TRANSACTION');
      let imported = 0;
      for (const e of emails) {
        rawDb.exec(sql, [
          data.caseId,
          e.messageId || null,
          e.from || '',
          e.to || '',
          e.cc || '',
          e.subject || '(no subject)',
          e.date || new Date().toISOString(),
          e.bodyText || '',
          e.bodyHtml || '',
          e.headersRaw || '',
          data.fileName,
          sourceName,
          JSON.stringify(e.ipAddresses || []),
          JSON.stringify(e.attachments || [])
        ]);
        imported++;
      }
      rawDb.exec('COMMIT');
      saveDatabase();
      console.log(`Aperture import: ${imported} emails imported for case ${data.caseId}`);
      return { success: true, imported };
    } catch (error) {
      try { getRawDatabase().exec('ROLLBACK'); } catch {}
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_APERTURE_EMAIL, async (_event, data: { id: number; flagged?: number }) => {
    try {
      const db = getDatabase();
      if (data.flagged !== undefined) {
        db.run('UPDATE aperture_emails SET flagged = ? WHERE id = ?', [data.flagged, data.id]);
        saveDatabase();
      }
      return { success: true };
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_APERTURE_EMAILS, async (_event, caseId: number) => {
    try {
      const db = getDatabase();
      db.run('DELETE FROM aperture_emails WHERE case_id = ?', [caseId]);
      db.run('DELETE FROM aperture_notes WHERE case_id = ?', [caseId]);
      saveDatabase();
      return { success: true };
    } catch (error) {
      throw error;
    }
  });

  // Aperture: Get distinct sources for a case
  ipcMain.handle(IPC_CHANNELS.GET_APERTURE_SOURCES, async (_event, caseId: number) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare(
        `SELECT COALESCE(source_name, source_file) as name, COUNT(*) as count
         FROM aperture_emails WHERE case_id = ?
         GROUP BY COALESCE(source_name, source_file) ORDER BY name`
      );
      return stmt.all(caseId) || [];
    } catch (error) {
      throw error;
    }
  });

  // Aperture: Get notes for an email
  ipcMain.handle(IPC_CHANNELS.GET_APERTURE_NOTES, async (_event, emailId: number) => {
    try {
      const db = getDatabase();
      const stmt = db.prepare('SELECT * FROM aperture_notes WHERE email_id = ? ORDER BY created_at DESC');
      return stmt.all(emailId) || [];
    } catch (error) {
      throw error;
    }
  });

  // Aperture: Add a note to an email
  ipcMain.handle(IPC_CHANNELS.ADD_APERTURE_NOTE, async (_event, data: { caseId: number; emailId: number; content: string }) => {
    try {
      const db = getDatabase();
      const now = new Date().toISOString();
      db.run(
        'INSERT INTO aperture_notes (case_id, email_id, content, created_at) VALUES (?, ?, ?, ?)',
        [data.caseId, data.emailId, data.content, now]
      );
      saveDatabase();
      // Get inserted note id
      const result = db.exec('SELECT last_insert_rowid() as id');
      const noteId = result.length > 0 ? result[0].values[0][0] : Date.now();
      return { success: true, note: { id: noteId as number, content: data.content, created_at: now } };
    } catch (error) {
      throw error;
    }
  });

  // Aperture: Delete a note
  ipcMain.handle(IPC_CHANNELS.DELETE_APERTURE_NOTE, async (_event, noteId: number) => {
    try {
      const db = getDatabase();
      db.run('DELETE FROM aperture_notes WHERE id = ?', [noteId]);
      saveDatabase();
      return { success: true };
    } catch (error) {
      throw error;
    }
  });

  // Aperture: Save report as PDF to case evidence folder and register as evidence
  ipcMain.handle(IPC_CHANNELS.SAVE_APERTURE_REPORT, async (_event, data: { caseId: number; caseNumber: string; html: string }) => {
    try {
      const casesDir = getCasesPath();
      const caseDir = path.join(casesDir, data.caseNumber);
      const evidenceDir = path.join(caseDir, 'evidence');
      if (!fs.existsSync(evidenceDir)) {
        fs.mkdirSync(evidenceDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const fileName = `Aperture_Report_${timestamp}.pdf`;
      const filePath = path.join(evidenceDir, fileName);

      // Create a hidden BrowserWindow to render HTML → PDF
      const { BrowserWindow: BW } = require('electron');
      const printWin = new BW({ show: false, webPreferences: { nodeIntegration: false } });
      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(data.html)}`);

      const pdfBuffer = await printWin.webContents.printToPDF({
        printBackground: true,
        landscape: false,
        pageSize: 'Letter',
        margins: { marginType: 'default' },
      });
      printWin.close();

      fs.writeFileSync(filePath, pdfBuffer);

      // Register as evidence in the database
      const relativePath = path.join(data.caseNumber, 'evidence', fileName);
      const db = getDatabase();
      const insertStmt = db.prepare(
        'INSERT INTO evidence (case_id, description, file_path, category) VALUES (?, ?, ?, ?)'
      );
      insertStmt.run(data.caseId, `Aperture Email Analysis Report (${timestamp})`, relativePath, 'Reports');
      saveDatabase();

      return { success: true, filePath: relativePath };
    } catch (error: any) {
      console.error('Save aperture report error:', error);
      return { success: false, error: error.message };
    }
  });

  // ── Open in system browser (for DRM services) ─────────────────────────
  ipcMain.handle('open-external-url', async (_event, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ── Media Player ───────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.POP_OUT_MEDIA_PLAYER, async (_event, url: string) => {
    try {
      // If already open, focus it and navigate
      if (mediaPlayerWindow && !mediaPlayerWindow.isDestroyed()) {
        mediaPlayerWindow.loadURL(url);
        mediaPlayerWindow.focus();
        return { success: true };
      }

      mediaPlayerWindow = new BrowserWindow({
        width: 1024,
        height: 700,
        minWidth: 480,
        minHeight: 400,
        frame: true,
        title: 'PULSE Media Player',
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          plugins: true,
          partition: 'persist:media', // shared with sidebar webview for cookie sync
        },
      });

      mediaPlayerWindow.loadURL(url);
      mediaPlayerWindow.on('closed', () => {
        mediaPlayerWindow = null;
        // Notify renderer so sidebar webview can reload with updated cookies/state
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('media-popout-closed');
        }
      });

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Add Media Service — opens a browser pop-out with toolbar for browsing, logging in, and saving
  ipcMain.handle(IPC_CHANNELS.ADD_MEDIA_SERVICE, async () => {
    return new Promise((resolve) => {
      const addWin = new BrowserWindow({
        width: 1024,
        height: 750,
        minWidth: 600,
        minHeight: 500,
        frame: true,
        title: 'Add Streaming Service — PULSE',
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          webviewTag: true,
          partition: 'persist:media',
        },
      });

      // Self-contained HTML with toolbar + webview
      const icons = ['🎵','📻','▶️','🎶','📺','🏈','🎬','🎮','📡','🌐','🎤','🎧','📱','💻','🔊','🎸','🎹','🎻','🎷','🥁'];
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Add Service</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0B1120; color:#e2e8f0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; display:flex; flex-direction:column; height:100vh; overflow:hidden; }
  .toolbar { padding:10px 12px; background:#111827; border-bottom:1px solid rgba(0,212,255,0.15); display:flex; flex-direction:column; gap:8px; flex-shrink:0; }
  .row { display:flex; gap:8px; align-items:center; }
  .url-bar { flex:1; padding:7px 12px; background:#1e293b; border:1px solid rgba(0,212,255,0.2); border-radius:6px; color:#e2e8f0; font-size:13px; outline:none; }
  .url-bar:focus { border-color:rgba(0,212,255,0.5); }
  .btn { padding:7px 16px; border:none; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.15s; }
  .btn-go { background:rgba(0,212,255,0.2); color:#00d4ff; }
  .btn-go:hover { background:rgba(0,212,255,0.3); }
  .btn-save { background:rgba(34,197,94,0.2); color:#22c55e; }
  .btn-save:hover { background:rgba(34,197,94,0.3); }
  .btn-save:disabled { opacity:0.35; cursor:not-allowed; }
  .btn-cancel { background:rgba(255,255,255,0.05); color:#94a3b8; }
  .btn-cancel:hover { background:rgba(255,255,255,0.1); color:#e2e8f0; }
  .name-input { width:160px; padding:7px 10px; background:#1e293b; border:1px solid rgba(0,212,255,0.2); border-radius:6px; color:#e2e8f0; font-size:13px; outline:none; }
  .name-input:focus { border-color:rgba(0,212,255,0.5); }
  .icon-btn { width:32px; height:32px; display:flex; align-items:center; justify-content:center; background:#1e293b; border:1px solid rgba(0,212,255,0.2); border-radius:6px; cursor:pointer; font-size:16px; position:relative; }
  .icon-btn:hover { border-color:rgba(0,212,255,0.4); }
  .icon-picker { position:absolute; top:38px; left:0; background:#1e293b; border:1px solid rgba(0,212,255,0.3); border-radius:8px; padding:6px; display:flex; flex-wrap:wrap; gap:4px; width:220px; z-index:99; box-shadow:0 8px 24px rgba(0,0,0,0.5); }
  .icon-opt { width:28px; height:28px; display:flex; align-items:center; justify-content:center; border-radius:4px; cursor:pointer; font-size:14px; border:none; background:transparent; }
  .icon-opt:hover { background:rgba(0,212,255,0.15); }
  .hint { font-size:11px; color:#64748b; padding:0 4px; }
  webview { flex:1; border:none; }
</style></head><body>
<div class="toolbar">
  <div class="row">
    <input id="url" class="url-bar" placeholder="Enter URL (e.g. https://www.disneyplus.com)" value="https://www.google.com" />
    <button class="btn btn-go" onclick="navigate()">Go</button>
  </div>
  <div class="row">
    <div class="icon-btn" id="iconBtn" onclick="toggleIconPicker()">${icons[9]}</div>
    <input id="name" class="name-input" placeholder="Service name" />
    <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:#94a3b8;cursor:pointer;" title="Check this for streaming services like Netflix, Hulu, Disney+ that require DRM">
      <input type="checkbox" id="extCheck" style="accent-color:#00d4ff;" /> Opens in browser
    </label>
    <button id="saveBtn" class="btn btn-save" onclick="save()" disabled>Save Shortcut</button>
    <button class="btn btn-cancel" onclick="window.close()">Cancel</button>
    <span class="hint">Browse → Log in → Name it → Save</span>
  </div>
</div>
<div id="iconPicker" class="icon-picker" style="display:none;position:fixed;top:82px;left:12px;">
  ${icons.map(i => `<button class="icon-opt" onclick="pickIcon('${i}')">${i}</button>`).join('')}
</div>
<webview id="wv" src="https://www.google.com" partition="persist:media" allowpopups plugins style="flex:1;width:100%;"></webview>
<script>
  const { ipcRenderer } = require('electron');
  const wv = document.getElementById('wv');
  const urlBar = document.getElementById('url');
  const nameInput = document.getElementById('name');
  const saveBtn = document.getElementById('saveBtn');
  const iconBtn = document.getElementById('iconBtn');
  const iconPicker = document.getElementById('iconPicker');
  let selectedIcon = '${icons[9]}';

  // Sync URL bar as user navigates
  wv.addEventListener('did-navigate', (e) => { urlBar.value = e.url; checkSave(); });
  wv.addEventListener('did-navigate-in-page', (e) => { urlBar.value = e.url; checkSave(); });
  wv.addEventListener('page-title-updated', (e) => {
    if (!nameInput.value) {
      // Auto-suggest name from page title
      let t = e.title.split(/[|\\-–—]/)[0].trim();
      if (t.length > 20) t = t.substring(0, 20);
      nameInput.value = t;
      checkSave();
    }
  });

  nameInput.addEventListener('input', checkSave);

  function navigate() {
    let u = urlBar.value.trim();
    if (!u) return;
    if (!u.startsWith('http')) u = 'https://' + u;
    urlBar.value = u;
    wv.src = u;
  }
  urlBar.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(); });

  function checkSave() { saveBtn.disabled = !nameInput.value.trim(); }

  function toggleIconPicker() { iconPicker.style.display = iconPicker.style.display === 'none' ? 'flex' : 'none'; }
  function pickIcon(icon) { selectedIcon = icon; iconBtn.textContent = icon; iconPicker.style.display = 'none'; }

  // Close picker on outside click
  document.addEventListener('click', (e) => {
    if (!iconBtn.contains(e.target) && !iconPicker.contains(e.target)) iconPicker.style.display = 'none';
  });

  function save() {
    const name = nameInput.value.trim();
    const url = urlBar.value.trim();
    if (!name || !url) return;
    const external = document.getElementById('extCheck').checked;
    ipcRenderer.send('media-service-saved', { name, url, icon: selectedIcon, external });
    window.close();
  }
</script>
</body></html>`;

      addWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

      // Listen for the save event from the pop-out
      const onSaved = (_e: any, data: { name: string; url: string; icon: string; external?: boolean }) => {
        resolve({ success: true, service: data });
      };
      ipcMain.once('media-service-saved', onSaved);

      addWin.on('closed', () => {
        ipcMain.removeListener('media-service-saved', onSaved);
        resolve({ success: false, cancelled: true });
      });
    });
  });

  // ── Field Security ────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.SECURITY_CHECK, async () => {
    try {
      return fieldSecurity ? fieldSecurity.getState() : { enabled: false, locked: true };
    } catch (error) {
      return { enabled: false, locked: true };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SECURITY_SETUP, async (_event, password: string) => {
    try {
      if (!fieldSecurity) throw new Error('Security module not initialized');
      const recoveryKey = fieldSecurity.setup(password);
      return { success: true, recoveryKey };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SECURITY_UNLOCK, async (_event, password: string) => {
    try {
      if (!fieldSecurity) return { success: false, error: 'Security module not initialized' };
      const ok = fieldSecurity.unlock(password);
      return { success: ok, error: ok ? undefined : 'Invalid password' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SECURITY_RECOVER, async (_event, recoveryKey: string) => {
    try {
      if (!fieldSecurity) return { success: false, error: 'Security module not initialized' };
      const ok = fieldSecurity.recover(recoveryKey);
      return { success: ok, error: ok ? undefined : 'Invalid recovery key' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SECURITY_CHANGE_PW, async (_event, newPassword: string) => {
    try {
      if (!fieldSecurity) return { success: false, error: 'Security module not initialized' };
      fieldSecurity.changePassword(newPassword);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SECURITY_NEW_RECOVERY, async () => {
    try {
      if (!fieldSecurity) return { success: false, error: 'Security module not initialized' };
      const newKey = fieldSecurity.generateNewRecoveryKey();
      return { success: true, recoveryKey: newKey };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SECURITY_DISABLE, async () => {
    try {
      if (!fieldSecurity) return { success: false, error: 'Security module not initialized' };
      fieldSecurity.disable();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SECURITY_LOCK, async () => {
    try {
      if (fieldSecurity) fieldSecurity.lock();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ═══════════════ In-App Updater ═══════════════

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Bug Reports — POST to Intellect Dashboard
  ipcMain.handle('submit-bug-report', async (_event, data: { title: string; description: string; steps_to_reproduce: string; severity: string; apiKey: string; reporterName: string }) => {
    try {
      const payload = JSON.stringify({
        title: data.title,
        description: data.description,
        steps_to_reproduce: data.steps_to_reproduce,
        severity: data.severity,
        product_slug: 'icac-pulse',
        reporter_name: data.reporterName || 'ICAC P.U.L.S.E. User',
        app_version: app.getVersion(),
      });

      return await new Promise((resolve, reject) => {
        const req = https.request('https://intellect-unified-dashboard-production.up.railway.app/api/bug-reports', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'X-API-Key': data.apiKey,
          },
        }, (res) => {
          let body = '';
          res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try { resolve(JSON.parse(body)); } catch { resolve({ success: true }); }
            } else {
              reject(new Error(`Server returned ${res.statusCode}: ${body}`));
            }
          });
        });
        req.on('error', (err: Error) => reject(err));
        req.write(payload);
        req.end();
      });
    } catch (error) {
      console.error('submit-bug-report error:', error);
      throw error;
    }
  });

  ipcMain.handle('download-app-update', async (_event, { url }: { url: string }) => {
    const tempDir = app.getPath('temp');
    const installerPath = path.join(tempDir, `ICAC-PULSE-Update-${Date.now()}.exe`);

    return new Promise((resolve, reject) => {
      const doDownload = (downloadUrl: string, redirectCount = 0) => {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'));
          return;
        }

        const proto = downloadUrl.startsWith('https') ? https : http;
        proto.get(downloadUrl, { headers: { 'User-Agent': `ICAC-PULSE/${app.getVersion()}` } }, (response) => {
          // Follow redirects
          if ((response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) && response.headers.location) {
            doDownload(response.headers.location, redirectCount + 1);
            return;
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Download failed: HTTP ${response.statusCode}`));
            return;
          }

          const totalSize = parseInt(response.headers['content-length'] || '0', 10);
          let downloadedSize = 0;
          const file = fs.createWriteStream(installerPath);

          response.on('data', (chunk: Buffer) => {
            downloadedSize += chunk.length;
            const percent = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : -1;
            mainWindow?.webContents.send('update-download-progress', {
              percent,
              transferred: downloadedSize,
              total: totalSize,
            });
          });

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve({ success: true, installerPath });
          });

          file.on('error', (err) => {
            try { fs.unlinkSync(installerPath); } catch {}
            reject(err);
          });
        }).on('error', (err) => {
          try { fs.unlinkSync(installerPath); } catch {}
          reject(err);
        });
      };

      doDownload(url);
    });
  });

  ipcMain.handle('install-app-update', async (_event, { installerPath }: { installerPath: string }) => {
    try {
      const appExePath = app.getPath('exe');
      const ts = Date.now();
      const ps1Path = path.join(app.getPath('temp'), `icac-pulse-updater-${ts}.ps1`);

      // PowerShell script: Wait-Process (event-based, no polling) → silent install → restart → cleanup
      const psContent = [
        `try { Wait-Process -Id ${process.pid} -Timeout 30 -ErrorAction SilentlyContinue } catch {}`,
        'Start-Sleep -Seconds 1',
        `Start-Process -FilePath '${installerPath.replace(/'/g, "''")}' -ArgumentList '/S' -Wait`,
        'Start-Sleep -Seconds 2',
        `Start-Process -FilePath '${appExePath.replace(/'/g, "''")}'`,
        `Remove-Item -LiteralPath '${installerPath.replace(/'/g, "''")}' -Force -ErrorAction SilentlyContinue`,
        `Remove-Item -LiteralPath '${ps1Path.replace(/'/g, "''")}' -Force -ErrorAction SilentlyContinue`,
      ].join('\r\n');

      fs.writeFileSync(ps1Path, psContent, 'utf-8');

      const child = spawn('powershell.exe', [
        '-WindowStyle', 'Hidden',
        '-ExecutionPolicy', 'Bypass',
        '-File', ps1Path
      ], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();

      // Give PowerShell a moment to start, then quit
      setTimeout(() => {
        app.quit();
      }, 500);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // OPS Template backup — persist to data directory so it survives localStorage corruption during updates
  const OPS_BACKUP_FILE = 'ops_template_backup.json';

  ipcMain.handle('save-ops-template-backup', async (_event, data: Record<string, any>) => {
    try {
      const dataPath = getUserDataPath();
      const filePath = path.join(dataPath, OPS_BACKUP_FILE);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true };
    } catch (error: any) {
      console.error('Failed to save OPS template backup:', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('load-ops-template-backup', async () => {
    try {
      const dataPath = getUserDataPath();
      const filePath = path.join(dataPath, OPS_BACKUP_FILE);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return { success: true, data: JSON.parse(raw) };
      }
      return { success: true, data: null };
    } catch (error: any) {
      console.error('Failed to load OPS template backup:', error.message);
      return { success: false, data: null };
    }
  });
}

