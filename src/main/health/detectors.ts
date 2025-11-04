import http from 'http';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const ANKICONNECT_PORT = 8765;
const AC_URL = `http://127.0.0.1:${ANKICONNECT_PORT}`;

async function postJson<T>(path: string, body: any, timeoutMs = 1500): Promise<T> {
  const payload = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request(
      AC_URL + path,
      { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          'Content-Length': payload.length,
          'Connection': 'close'
        }, 
        timeout: timeoutMs,
        agent: new http.Agent({ keepAlive: false }),
      },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
          catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

export async function checkAnkiProcess(): Promise<{ status: 'ok' | 'error'; detail?: string }> {
  const platform = process.platform;
  try { 
    let cmd: string;
    if (platform === 'win32') {
      // Look for anki.exe 
      cmd = 'tasklist /FI "IMAGENAME eq anki.exe" /FO CSV /NH';
    } else if (platform === 'darwin') {
      // Match either the app bundle or process name
      cmd = "pgrep -f -i 'Anki.app|Anki'";
    } else {
      // linux/freebsd/etc.
      cmd = "pgrep -f -i 'anki'";
    }
    const { stdout } = await execAsync(cmd);
    if (platform === 'win32') {
      const out = (stdout || '').trim();
      // If not found, tasklist prints an INFO line; otherwise it prints a CSV row for anki.exe
      if (/^"anki\.exe",/i.test(out)) {
        return { status: 'ok', detail: 'Anki process detected' };
      }
      if (/^INFO:/i.test(out) || out.length === 0) {
        return { status: 'error', detail: 'Anki process not found' };      
      }
      // Fallback: if any non-empty CSV comes back, treat as found
      return { status: 'ok', detail: 'Anki process detected' };
    }
    // non-windows: pgrep prints PID(s) when found
    const found = typeof stdout === 'string' && stdout.trim().length > 0;
    return found
      ? { status: 'ok', detail: 'Anki process detected' }
      : { status: 'error', detail: 'Anki process not found' };
  } catch (e: any) {
    // Treat common 'not found' cases as a clea miss; otherwise surface errors
    // pgrep returns non-zero exit when nothing is found; treat as not running 
    const msg = (e?.stderr || e?.stdout || e?.message || String(e)).toString();
    if (/INFO:\s*No tasks/i.test(msg) || /exit code 1/i.test(msg) || /no matching/i.test(msg)) {
      return { status: 'error', detail: 'Anki process not found' };
    }
    return { status: 'error', detail: `Process check error: ${msg}` };
  }
}

export async function checkAnkiConnectHttp(): Promise<{ status: 'ok' | 'error'; detail?: string }> {
  try {
    // a 404 on GET is fine; we only need TCP accept. Use POST to be faithful.
    await postJson('/', { action: 'version', version: 6 }, 1000);
    return { status: 'ok', detail: 'AnkiConnect found & enabled' };
  } catch (e: any) {
    return { status: 'error', detail: `Cannot reach AnkiConnect: ${e?.message ?? e}` };
  }
}

export async function checkAnkiConnectVersion(minVersion = 6): Promise<{ status: 'ok' | 'warning' | 'error'; detail?: string }> {
  try {
    const res = await postJson<{ result?: number; error?: string }>('/', { action: 'version', version: minVersion }, 1200);
    if (res?.result && res.result >= minVersion) return { status: 'ok', detail: `AnkiConnect Version ${res.result}` };
    if (res?.result) return { status: 'warning', detail: `version ${res.result} < required ${minVersion}` };
    return { status: 'error', detail: res?.error ?? 'No version in response' };
  } catch (e: any) {
    return { status: 'error', detail: `Version check errored: ${e?.message ?? e}` };
  }
}

export async function checkAddNoteDryRun(): Promise<{ status: 'ok' | 'warning' | 'error'; detail?: string }> {
  try {
    // use "canAddNotes" (or harmless invalid deck) to avoid side effects
    const payload = {
      action: 'canAddNotes',
      version: 6,
      params: {
        notes: [
          {
            deckName: '__health_check_do_not_create__',
            modelName: 'Basic',
            fields: { Front: 'health-check', Back: 'health-check' },
            options: { allowDuplicate: true, duplicateScope: 'deck' },
            tags: ['health-check'],
          }
        ]
      }
    };
    const res = await postJson<{ result?: boolean[]; error?: string }>('/', payload, 2500);
    if (Array.isArray(res?.result)) {
      const ok = res.result[0] === true || res.result[0] === false;
      return ok ? { status: 'ok', detail: 'canAddNotes reachable' } : { status: 'warning', detail: 'Unexpected response shape' };
    }
    return { status: 'error', detail: res?.error ?? 'No result from canAddNotes' };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    if (/ECONNRESET|EPIPE/i.test(msg)) {
      await new Promise(r => setTimeout(r, 400));
      try {
        const payload = {
          action: 'canAddNotes',
          version: 6,
          params: {
            notes: [
              {
                deckName: '_health_check_do_not_create__',
                modelName: 'Basic',
                fields: { Front: 'health-check', Back: 'health-check' },
                options: { allowDuplicate: true, duplicateScope: 'deck' },
                tags: ['health-check'],
              }
            ]
          }
        };
        const res2 = await postJson<{ result?: boolean[]; error?: string }>('/', payload, 2500);
        if (Array.isArray(res2?.result)) {
          const ok = res2.result[0] === true || res2.result[0] === false;
          return ok ? { status: 'ok', detail: 'canAddNotes reachable (after retry)' } : { status: 'warning', detail: 'Unexpected response shape (after retry)' };
        }
        return { status: 'error', detail: res2?.error ?? 'No result from canAddNotes (after retry)' };
      } catch (e2: any) {
        return { status: 'error', detail: `Dry-run errored after retry: ${e2?.message ?? e2}` };
      }
    }
    return { status: 'error', detail: `Dry-run errored: ${msg}` };
  }
}