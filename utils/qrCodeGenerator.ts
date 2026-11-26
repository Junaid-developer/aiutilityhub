import QRCode from 'qrcode';

export type QrInputType = 'url' | 'text' | 'email' | 'phone' | 'wifi';
export type QrErrorLevel = 'L' | 'M' | 'Q' | 'H';
export type QrSize = 200 | 300 | 500;
export type WifiSecurity = 'WPA' | 'WEP' | 'nopass';

export interface QrInputValues {
  type: QrInputType;
  url: string;
  text: string;
  email: string;
  emailSubject: string;
  phone: string;
  wifiSsid: string;
  wifiPassword: string;
  wifiSecurity: WifiSecurity;
  wifiHidden: boolean;
}

export interface QrCustomization {
  size: QrSize;
  fgColor: string;
  bgColor: string;
  errorLevel: QrErrorLevel;
}

export const MAX_QR_TEXT_LENGTH = 2000;

export type BuildPayloadResult =
  | { ok: true; payload: string }
  | { ok: false; error: string };

function escapeWifiField(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

export function buildQrPayload(input: QrInputValues): BuildPayloadResult {
  switch (input.type) {
    case 'url': {
      const raw = input.url.trim();
      if (!raw) {
        return { ok: false, error: 'Please enter a website URL.' };
      }
      if (/\s/.test(raw)) {
        return {
          ok: false,
          error: 'Website URL cannot contain spaces.',
        };
      }
      const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return {
            ok: false,
            error: 'Please enter a valid http:// or https:// website URL.',
          };
        }
        const host = parsed.hostname;
        if (
          !host ||
          (host !== 'localhost' && !host.includes('.')) ||
          host.startsWith('.') ||
          host.endsWith('.')
        ) {
          return {
            ok: false,
            error:
              'Please enter a valid website URL (for example, https://example.com).',
          };
        }
        if (candidate.length > MAX_QR_TEXT_LENGTH) {
          return {
            ok: false,
            error: `URL exceeds the ${MAX_QR_TEXT_LENGTH.toLocaleString()}-character limit.`,
          };
        }
        return { ok: true, payload: candidate };
      } catch {
        return {
          ok: false,
          error:
            'Please enter a valid website URL (for example, https://example.com).',
        };
      }
    }

    case 'text': {
      const trimmed = input.text.trim();
      if (!trimmed) {
        return { ok: false, error: 'Please enter text to encode.' };
      }
      if (input.text.length > MAX_QR_TEXT_LENGTH) {
        return {
          ok: false,
          error: `Text exceeds the ${MAX_QR_TEXT_LENGTH.toLocaleString()}-character QR capacity limit.`,
        };
      }
      return { ok: true, payload: input.text };
    }

    case 'email': {
      const email = input.email.trim();
      if (!email) {
        return { ok: false, error: 'Please enter an email address.' };
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return {
          ok: false,
          error:
            'Please enter a valid email address (for example, name@example.com).',
        };
      }
      const subject = input.emailSubject.trim();
      const payload = subject
        ? `mailto:${email}?subject=${encodeURIComponent(subject)}`
        : `mailto:${email}`;
      if (payload.length > MAX_QR_TEXT_LENGTH) {
        return {
          ok: false,
          error: `Email payload exceeds the ${MAX_QR_TEXT_LENGTH.toLocaleString()}-character limit.`,
        };
      }
      return { ok: true, payload };
    }

    case 'phone': {
      const raw = input.phone.trim();
      if (!raw) {
        return { ok: false, error: 'Please enter a phone number.' };
      }
      const normalized = raw.replace(/[\s\-().]/g, '');
      if (!/^\+?[0-9]{6,16}$/.test(normalized)) {
        return {
          ok: false,
          error:
            'Please enter a valid phone number (6 to 16 digits, optional + country code).',
        };
      }
      return { ok: true, payload: `tel:${normalized}` };
    }

    case 'wifi': {
      const ssid = input.wifiSsid.trim();
      if (!ssid) {
        return { ok: false, error: 'Please enter the Wi-Fi network name (SSID).' };
      }
      if (input.wifiSecurity !== 'nopass' && !input.wifiPassword) {
        return {
          ok: false,
          error: 'Please enter the Wi-Fi password, or select None for an open network.',
        };
      }
      const escapedSsid = escapeWifiField(ssid);
      const hiddenFlag = input.wifiHidden ? 'true' : 'false';
      const payload =
        input.wifiSecurity === 'nopass'
          ? `WIFI:T:nopass;S:${escapedSsid};H:${hiddenFlag};;`
          : `WIFI:T:${input.wifiSecurity};S:${escapedSsid};P:${escapeWifiField(
              input.wifiPassword
            )};H:${hiddenFlag};;`;
      if (payload.length > MAX_QR_TEXT_LENGTH) {
        return {
          ok: false,
          error: 'Wi-Fi configuration exceeds maximum QR code length.',
        };
      }
      return { ok: true, payload };
    }
  }
}

function hexToLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 0;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const linear = [r, g, b].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function hasLowQrContrast(fgHex: string, bgHex: string): boolean {
  const l1 = hexToLuminance(fgHex);
  const l2 = hexToLuminance(bgHex);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return ratio < 3;
}

export interface GeneratedQrAssets {
  pngDataUrl: string;
  svgMarkup: string;
}

export async function renderQrAssets(
  payload: string,
  options: QrCustomization
): Promise<GeneratedQrAssets> {
  const qrOptions = {
    width: options.size,
    margin: 2,
    errorCorrectionLevel: options.errorLevel,
    color: {
      dark: options.fgColor,
      light: options.bgColor,
    },
  };

  const [pngDataUrl, svgMarkup] = await Promise.all([
    QRCode.toDataURL(payload, qrOptions),
    QRCode.toString(payload, { ...qrOptions, type: 'svg' }),
  ]);

  return { pngDataUrl, svgMarkup };
}
