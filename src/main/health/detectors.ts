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
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': payload.length }, timeout: timeoutMs },
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

export async function checkAnkiProcess(): Promise<{ status: 'ok' | 'fail'; detail?: string }> {
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
        return { status: 'fail', detail: 'Anki process not found' };      
      }
      // Fallback: if any non-empty CSV comes back, treat as found
      return { status: 'ok', detail: 'Anki process detected' };
    }
    // non-windows: pgrep prints PID(s) when found
    const found = typeof stdout === 'string' && stdout.trim().length > 0;
    return found
      ? { status: 'ok', detail: 'Anki process detected' }
      : { status: 'fail', detail: 'Anki process not found' };
  } catch (e: any) {
    // Treat common 'not found' cases as a clea miss; otherwise surface errors
    // pgrep returns non-zero exit when nothing is found; treat as not running 
    const msg = (e?.stderr || e?.stdout || e?.message || String(e)).toString();
    if (/INFO:\s*No tasks/i.test(msg) || /exit code 1/i.test(msg) || /no matching/i.test(msg)) {
      return { status: 'fail', detail: 'Anki process not found' };
    }
    return { status: 'fail', detail: `Process check error: ${msg}` };
  }
}

export async function checkAnkiConnectHttp(): Promise<{ status: 'ok' | 'fail'; detail?: string }> {
  try {
    // a 404 on GET is fine; we only need TCP accept. Use POST to be faithful.
    await postJson('/', { action: 'version', version: 6 }, 1000);
    return { status: 'ok', detail: 'AnkiConnect found & enabled' };
  } catch (e: any) {
    return { status: 'fail', detail: `Cannot reach AnkiConnect: ${e?.message ?? e}` };
  }
}

export async function checkAnkiConnectVersion(minVersion = 6): Promise<{ status: 'ok' | 'warn' | 'fail'; detail?: string }> {
  try {
    const res = await postJson<{ result?: number; error?: string }>('/', { action: 'version', version: minVersion }, 1200);
    if (res?.result && res.result >= minVersion) return { status: 'ok', detail: `AnkiConnect Version ${res.result}` };
    if (res?.result) return { status: 'warn', detail: `version ${res.result} < required ${minVersion}` };
    return { status: 'fail', detail: res?.error ?? 'No version in response' };
  } catch (e: any) {
    return { status: 'fail', detail: `Version check failed: ${e?.message ?? e}` };
  }
}

export async function checkAddNoteDryRun(): Promise<{ status: 'ok' | 'warn' | 'fail'; detail?: string }> {
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
    const res = await postJson<{ result?: boolean[]; error?: string }>('/', payload, 1500);
    if (Array.isArray(res?.result)) {
      const ok = res.result[0] === true || res.result[0] === false;
      return ok ? { status: 'ok', detail: 'canAddNotes reachable' } : { status: 'warn', detail: 'Unexpected response shape' };
    }
    return { status: 'fail', detail: res?.error ?? 'No result from canAddNotes' };
  } catch (e: any) {
    return { status: 'fail', detail: `Dry-run failed: ${e?.message ?? e}` };
  }
}