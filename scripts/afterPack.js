// scripts/afterPack.js
const fs = require('fs/promises');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return;
  const sandboxPath = path.join(context.appOutDir, 'chrome-sandbox');
  try {
    await fs.chmod(sandboxPath, 0o4755); // setuid root requirement for sandbox
    console.log('[afterPack] chrome-sandbox set to 4755');
  } catch (err) {
    console.warn('[afterPack] failed to chmod chrome-sandbox', err?.message || err);
  }
};
