import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearPayPalTokenCache, testPayPalConnection, isPayPalConfigured, getMaskedClientId } from './paypalService.js';
import { isGeminiConfigured, getGeminiModel } from './geminiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_FILE = path.resolve(__dirname, '../../.env');

/**
 * Get public, safe configuration status
 */
export async function getSystemStatus() {
  const paypalConfigured = isPayPalConfigured();
  const geminiConfigured = isGeminiConfigured();
  const clientIdPreview = getMaskedClientId();

  return {
    status: 'ok',
    paypalConnected: paypalConfigured,
    paypalMode: 'sandbox',
    geminiConfigured,
    geminiModel: getGeminiModel(),
    clientIdPreview,
    catalogCurrency: process.env.CATALOG_CURRENCY || 'USD',
    timestamp: new Date().toISOString(),
    message: paypalConfigured && geminiConfigured
      ? 'All AI and PayPal Sandbox services connected.'
      : !paypalConfigured && !geminiConfigured
      ? 'Running in Simulation & Deterministic Fallback mode. Configure keys in Settings to connect live APIs.'
      : !paypalConfigured
      ? 'Gemini is active. PayPal in Simulation mode.'
      : 'PayPal Sandbox is connected. Gemini in Fallback mode.'
  };
}

/**
 * Update and test credentials safely
 */
export async function updateCredentials({ paypalClientId, paypalClientSecret, geminiApiKey, adminSecret }) {
  // Validate admin secret
  const configuredAdminSecret = process.env.ADMIN_SECRET || 'payflow-dev-secret';
  if (adminSecret !== configuredAdminSecret) {
    throw new Error('Unauthorized: Invalid administrative credentials.');
  }

  const updates = {};
  let paypalTestResult = null;

  // If testing/updating PayPal credentials
  if (paypalClientId && paypalClientSecret) {
    const cleanId = paypalClientId.trim();
    const cleanSecret = paypalClientSecret.trim();

    if (cleanId.length < 10 || cleanSecret.length < 10) {
      throw new Error('PayPal Client ID and Secret appear too short to be valid.');
    }

    // Test connection first before committing
    paypalTestResult = await testPayPalConnection(cleanId, cleanSecret);
    if (!paypalTestResult.success) {
      throw new Error(`PayPal Sandbox Connection Test Failed: ${paypalTestResult.message}`);
    }

    updates.PAYPAL_CLIENT_ID = cleanId;
    updates.PAYPAL_CLIENT_SECRET = cleanSecret;
  }

  // If updating Gemini key
  if (geminiApiKey) {
    const cleanGeminiKey = geminiApiKey.trim();
    if (cleanGeminiKey.length < 10) {
      throw new Error('Gemini API key appears too short to be valid.');
    }
    updates.GEMINI_API_KEY = cleanGeminiKey;
  }

  // Apply to process.env immediately
  for (const [key, value] of Object.entries(updates)) {
    process.env[key] = value;
  }

  // Clear cached tokens since credentials changed
  clearPayPalTokenCache();

  // If in local development, persist safely to .env file
  if (process.env.NODE_ENV !== 'production') {
    try {
      let envContent = '';
      try {
        envContent = await fs.readFile(ENV_FILE, 'utf-8');
      } catch {
        envContent = '';
      }

      const envMap = {};
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const k = trimmed.substring(0, idx).trim();
            const v = trimmed.substring(idx + 1).trim();
            envMap[k] = v;
          }
        }
      });

      // Update values
      Object.assign(envMap, updates);

      // Reconstruct file lines
      const outputLines = Object.entries(envMap).map(([k, v]) => `${k}=${v}`);
      const tempPath = `${ENV_FILE}.${Date.now()}.tmp`;
      await fs.writeFile(tempPath, outputLines.join('\n') + '\n', 'utf-8');
      await fs.rename(tempPath, ENV_FILE);
    } catch (fsErr) {
      console.warn('[ConfigService] Could not write to .env file:', fsErr.message);
    }
  }

  return {
    success: true,
    message: 'Credentials updated and verified successfully.',
    paypalConnected: isPayPalConfigured(),
    geminiConfigured: isGeminiConfigured(),
    clientIdPreview: getMaskedClientId()
  };
}
