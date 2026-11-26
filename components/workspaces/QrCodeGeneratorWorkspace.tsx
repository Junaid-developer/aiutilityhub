import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Globe,
  Mail,
  Phone,
  QrCode as QrIcon,
  RotateCcw,
  Type,
  Wifi,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildQrPayload,
  hasLowQrContrast,
  MAX_QR_TEXT_LENGTH,
  QrCustomization,
  QrErrorLevel,
  QrInputType,
  QrInputValues,
  QrSize,
  renderQrAssets,
  WifiSecurity,
} from '../../utils/qrCodeGenerator';

const DEFAULT_INPUTS: QrInputValues = {
  type: 'url',
  url: 'https://aiutilityhub.com',
  text: '',
  email: '',
  emailSubject: '',
  phone: '',
  wifiSsid: '',
  wifiPassword: '',
  wifiSecurity: 'WPA',
  wifiHidden: false,
};

const DEFAULT_CUSTOMIZATION: QrCustomization = {
  size: 300,
  fgColor: '#173F35',
  bgColor: '#FFFFFF',
  errorLevel: 'M',
};

const INPUT_TABS: { id: QrInputType; label: string; icon: typeof Globe }[] = [
  { id: 'url', label: 'Website URL', icon: Globe },
  { id: 'text', label: 'Plain Text', icon: Type },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'phone', label: 'Phone', icon: Phone },
  { id: 'wifi', label: 'Wi-Fi', icon: Wifi },
];

const FG_SWATCHES = [
  { label: 'Forest Green', hex: '#173F35' },
  { label: 'Charcoal', hex: '#252B28' },
  { label: 'Black', hex: '#000000' },
];

const BG_SWATCHES = [
  { label: 'White', hex: '#FFFFFF' },
  { label: 'Warm Ivory', hex: '#EDE9DF' },
  { label: 'Soft Cream', hex: '#F7F5F0' },
];

const ERROR_LEVELS: { id: QrErrorLevel; label: string }[] = [
  { id: 'L', label: 'Low' },
  { id: 'M', label: 'Medium' },
  { id: 'Q', label: 'Quartile' },
  { id: 'H', label: 'High' },
];

const SIZES: QrSize[] = [200, 300, 500];

export function QrCodeGeneratorWorkspace() {
  const [inputs, setInputs] = useState<QrInputValues>(DEFAULT_INPUTS);
  const [customization, setCustomization] = useState<QrCustomization>(
    DEFAULT_CUSTOMIZATION
  );
  const [activePayload, setActivePayload] = useState<string>(
    'https://aiutilityhub.com'
  );
  const [pngUrl, setPngUrl] = useState<string>('');
  const [svgMarkup, setSvgMarkup] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>(
    'idle'
  );
  const [isRendering, setIsRendering] = useState<boolean>(false);

  const lowContrast = useMemo(
    () => hasLowQrContrast(customization.fgColor, customization.bgColor),
    [customization.fgColor, customization.bgColor]
  );

  // Render QR assets whenever activePayload or customization changes
  const generateAssets = useCallback(
    async (payload: string, opts: QrCustomization) => {
      if (!payload) {
        setPngUrl('');
        setSvgMarkup('');
        return;
      }
      setIsRendering(true);
      try {
        const assets = await renderQrAssets(payload, opts);
        setPngUrl(assets.pngDataUrl);
        setSvgMarkup(assets.svgMarkup);
      } catch {
        setErrorMsg(
          'Unable to generate QR code for the provided content. Try shortening your input.'
        );
        setPngUrl('');
        setSvgMarkup('');
      } finally {
        setIsRendering(false);
      }
    },
    []
  );

  useEffect(() => {
    if (activePayload) {
      void generateAssets(activePayload, customization);
    }
  }, [activePayload, customization, generateAssets]);

  useEffect(() => {
    if (copyStatus === 'idle') return;
    const timer = window.setTimeout(() => setCopyStatus('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [copyStatus]);

  const handleGenerateClick = (e: React.FormEvent) => {
    e.preventDefault();
    const result = buildQrPayload(inputs);
    if (!result.ok) {
      setErrorMsg(result.error);
      return;
    }
    setErrorMsg('');
    if (result.payload === activePayload) {
      void generateAssets(result.payload, customization);
    } else {
      setActivePayload(result.payload);
    }
  };

  const handleReset = () => {
    setInputs(DEFAULT_INPUTS);
    setCustomization(DEFAULT_CUSTOMIZATION);
    setErrorMsg('');
    setCopyStatus('idle');
    setActivePayload('https://aiutilityhub.com');
  };

  const handleCopyPayload = async () => {
    if (!activePayload) return;
    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(activePayload);
        setCopyStatus('copied');
        return;
      }
      throw new Error('Clipboard unavailable');
    } catch {
      try {
        const temp = document.createElement('textarea');
        temp.value = activePayload;
        temp.setAttribute('readonly', '');
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(temp);
        setCopyStatus(ok ? 'copied' : 'error');
      } catch {
        setCopyStatus('error');
      }
    }
  };

  const handleDownloadPng = () => {
    if (!pngUrl) return;
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = `qr-code-${customization.size}px.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSvg = () => {
    if (!svgMarkup) return;
    const blob = new Blob([svgMarkup], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qr-code-${customization.size}px.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const updateInput = <K extends keyof QrInputValues>(
    key: K,
    value: QrInputValues[K]
  ) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
    if (errorMsg) setErrorMsg('');
  };

  return (
    <div className="rounded-[18px] border border-[#DCDDD3] bg-white p-5 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.06)] sm:p-8 dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.24)]">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Input Form & Customization */}
        <form onSubmit={handleGenerateClick} noValidate className="space-y-6 lg:col-span-7">
          {/* Input Type Tabs */}
          <div>
            <span className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
              Input Type
            </span>
            <div
              role="tablist"
              aria-label="QR Code Input Type"
              className="mt-2 grid grid-cols-2 gap-1.5 rounded-xl bg-[#EDE9DF] p-1 sm:grid-cols-5 dark:bg-[#17231F]"
            >
              {INPUT_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = inputs.type === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      updateInput('type', tab.id);
                    }}
                    className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                        : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Input Fields */}
          {inputs.type === 'url' && (
            <div>
              <label
                htmlFor="qr-url-input"
                className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
              >
                Website URL
              </label>
              <input
                id="qr-url-input"
                type="url"
                value={inputs.url}
                onChange={(e) => updateInput('url', e.target.value)}
                placeholder="https://example.com"
                className="mt-2 h-11 w-full rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/35 px-4 text-sm text-[#252B28] placeholder-[#56615B] focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD] dark:focus:border-[#D9B978]"
              />
            </div>
          )}

          {inputs.type === 'text' && (
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="qr-text-input"
                  className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
                >
                  Plain Text
                </label>
                <span className="font-mono text-xs text-[#56615B] tabular-nums dark:text-[#B9C5BD]">
                  {inputs.text.length.toLocaleString()} /{' '}
                  {MAX_QR_TEXT_LENGTH.toLocaleString()}
                </span>
              </div>
              <textarea
                id="qr-text-input"
                rows={4}
                value={inputs.text}
                onChange={(e) => updateInput('text', e.target.value)}
                placeholder="Enter any message, note, or text snippet..."
                className="mt-2 w-full rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/35 px-4 py-3 text-sm text-[#252B28] placeholder-[#56615B] focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD] dark:focus:border-[#D9B978]"
              />
            </div>
          )}

          {inputs.type === 'email' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="qr-email-input"
                  className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
                >
                  Email Address
                </label>
                <input
                  id="qr-email-input"
                  type="email"
                  value={inputs.email}
                  onChange={(e) => updateInput('email', e.target.value)}
                  placeholder="hello@example.com"
                  className="mt-2 h-11 w-full rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/35 px-4 text-sm text-[#252B28] placeholder-[#56615B] focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD] dark:focus:border-[#D9B978]"
                />
              </div>
              <div>
                <label
                  htmlFor="qr-email-subject"
                  className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
                >
                  Subject (Optional)
                </label>
                <input
                  id="qr-email-subject"
                  type="text"
                  value={inputs.emailSubject}
                  onChange={(e) => updateInput('emailSubject', e.target.value)}
                  placeholder="Inquiry from QR code"
                  className="mt-2 h-11 w-full rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/35 px-4 text-sm text-[#252B28] placeholder-[#56615B] focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD] dark:focus:border-[#D9B978]"
                />
              </div>
            </div>
          )}

          {inputs.type === 'phone' && (
            <div>
              <label
                htmlFor="qr-phone-input"
                className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
              >
                Phone Number
              </label>
              <input
                id="qr-phone-input"
                type="tel"
                value={inputs.phone}
                onChange={(e) => updateInput('phone', e.target.value)}
                placeholder="+1 555 234 5678"
                className="mt-2 h-11 w-full rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/35 px-4 font-mono text-sm text-[#252B28] placeholder-[#56615B] focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD] dark:focus:border-[#D9B978]"
              />
            </div>
          )}

          {inputs.type === 'wifi' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="qr-wifi-ssid"
                    className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
                  >
                    Network Name (SSID)
                  </label>
                  <input
                    id="qr-wifi-ssid"
                    type="text"
                    value={inputs.wifiSsid}
                    onChange={(e) => updateInput('wifiSsid', e.target.value)}
                    placeholder="Studio Guest Wi-Fi"
                    className="mt-2 h-11 w-full rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/35 px-4 text-sm text-[#252B28] placeholder-[#56615B] focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD] dark:focus:border-[#D9B978]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="qr-wifi-security"
                    className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
                  >
                    Security Type
                  </label>
                  <select
                    id="qr-wifi-security"
                    value={inputs.wifiSecurity}
                    onChange={(e) => {
                      const nextSec = e.target.value as WifiSecurity;
                      setInputs((prev) => ({
                        ...prev,
                        wifiSecurity: nextSec,
                        wifiPassword:
                          nextSec === 'nopass' ? '' : prev.wifiPassword,
                      }));
                      if (errorMsg) setErrorMsg('');
                    }}
                    className="mt-2 h-11 w-full rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/35 px-3.5 text-sm text-[#252B28] focus:border-[#173F35] focus:outline-none dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:focus:border-[#D9B978]"
                  >
                    <option value="WPA">WPA / WPA2 / WPA3</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">None (Open Network)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="qr-wifi-password"
                    className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
                  >
                    Password
                  </label>
                  <input
                    id="qr-wifi-password"
                    type="text"
                    disabled={inputs.wifiSecurity === 'nopass'}
                    value={inputs.wifiPassword}
                    onChange={(e) =>
                      updateInput('wifiPassword', e.target.value)
                    }
                    placeholder={
                      inputs.wifiSecurity === 'nopass'
                        ? 'No password required'
                        : 'Enter Wi-Fi password'
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/35 px-4 text-sm text-[#252B28] placeholder-[#56615B] focus:border-[#173F35] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD] dark:focus:border-[#D9B978]"
                  />
                </div>

                <label className="mt-2 flex cursor-pointer items-center gap-2.5 text-sm sm:mt-7">
                  <input
                    type="checkbox"
                    checked={inputs.wifiHidden}
                    onChange={(e) =>
                      updateInput('wifiHidden', e.target.checked)
                    }
                    className="h-4 w-4 rounded border-[#DCDDD3] accent-[#173F35] dark:accent-[#D9B978]"
                  />
                  <span className="font-medium text-[#252B28] dark:text-[#F2F0E9]">
                    Hidden network
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-700/25 bg-red-50 px-4 py-3 text-xs font-medium text-red-900 dark:border-red-400/30 dark:bg-red-950/50 dark:text-red-200"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300"
                aria-hidden="true"
              />
              <span>{errorMsg}</span>
            </p>
          )}

          {/* Customization Controls */}
          <div className="space-y-5 border-t border-[#DCDDD3] pt-6 dark:border-[#35463E]">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Size */}
              <div>
                <span className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
                  QR Code Size
                </span>
                <div
                  role="group"
                  aria-label="QR Code Size"
                  className="mt-2 grid grid-cols-3 gap-1.5 rounded-lg bg-[#EDE9DF] p-1 dark:bg-[#17231F]"
                >
                  {SIZES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={customization.size === s}
                      onClick={() =>
                        setCustomization((prev) => ({ ...prev, size: s }))
                      }
                      className={`min-h-9 rounded-md font-mono text-xs font-semibold tabular-nums transition-colors ${
                        customization.size === s
                          ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                          : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]'
                      }`}
                    >
                      {s}px
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Correction */}
              <div>
                <span className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]">
                  Error Correction
                </span>
                <div
                  role="group"
                  aria-label="Error Correction"
                  className="mt-2 grid grid-cols-4 gap-1 rounded-lg bg-[#EDE9DF] p-1 dark:bg-[#17231F]"
                >
                  {ERROR_LEVELS.map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      aria-pressed={customization.errorLevel === lvl.id}
                      onClick={() =>
                        setCustomization((prev) => ({
                          ...prev,
                          errorLevel: lvl.id,
                        }))
                      }
                      className={`min-h-9 rounded-md px-1 text-xs font-semibold transition-colors ${
                        customization.errorLevel === lvl.id
                          ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                          : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Foreground & Background Colors */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="qr-fg-color"
                  className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
                >
                  Foreground Color
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="qr-fg-color"
                    type="color"
                    value={customization.fgColor}
                    onChange={(e) =>
                      setCustomization((prev) => ({
                        ...prev,
                        fgColor: e.target.value.toUpperCase(),
                      }))
                    }
                    className="h-10 w-11 shrink-0 cursor-pointer rounded-lg border border-[#DCDDD3] bg-transparent p-1 dark:border-[#35463E]"
                  />
                  <span className="font-mono text-xs text-[#252B28] dark:text-[#F2F0E9]">
                    {customization.fgColor}
                  </span>
                  <div
                    role="group"
                    aria-label="Foreground color presets"
                    className="ml-auto flex items-center gap-1.5"
                  >
                    {FG_SWATCHES.map((swatch) => {
                      const active =
                        customization.fgColor.toUpperCase() === swatch.hex;
                      return (
                        <button
                          key={swatch.hex}
                          type="button"
                          title={swatch.label}
                          aria-label={`Set foreground color to ${swatch.label}`}
                          aria-pressed={active}
                          onClick={() =>
                            setCustomization((prev) => ({
                              ...prev,
                              fgColor: swatch.hex,
                            }))
                          }
                          className={`h-6 w-6 rounded-md border transition-transform hover:scale-105 ${
                            active
                              ? 'ring-2 ring-[#C49A58] ring-offset-1 dark:ring-[#D9B978]'
                              : 'border-[#DCDDD3] dark:border-[#35463E]'
                          }`}
                          style={{ backgroundColor: swatch.hex }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="qr-bg-color"
                  className="block text-sm font-medium text-[#252B28] dark:text-[#F2F0E9]"
                >
                  Background Color
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    id="qr-bg-color"
                    type="color"
                    value={customization.bgColor}
                    onChange={(e) =>
                      setCustomization((prev) => ({
                        ...prev,
                        bgColor: e.target.value.toUpperCase(),
                      }))
                    }
                    className="h-10 w-11 shrink-0 cursor-pointer rounded-lg border border-[#DCDDD3] bg-transparent p-1 dark:border-[#35463E]"
                  />
                  <span className="font-mono text-xs text-[#252B28] dark:text-[#F2F0E9]">
                    {customization.bgColor}
                  </span>
                  <div
                    role="group"
                    aria-label="Background color presets"
                    className="ml-auto flex items-center gap-1.5"
                  >
                    {BG_SWATCHES.map((swatch) => {
                      const active =
                        customization.bgColor.toUpperCase() === swatch.hex;
                      return (
                        <button
                          key={swatch.hex}
                          type="button"
                          title={swatch.label}
                          aria-label={`Set background color to ${swatch.label}`}
                          aria-pressed={active}
                          onClick={() =>
                            setCustomization((prev) => ({
                              ...prev,
                              bgColor: swatch.hex,
                            }))
                          }
                          className={`h-6 w-6 rounded-md border transition-transform hover:scale-105 ${
                            active
                              ? 'ring-2 ring-[#C49A58] ring-offset-1 dark:ring-[#D9B978]'
                              : 'border-[#DCDDD3] dark:border-[#35463E]'
                          }`}
                          style={{ backgroundColor: swatch.hex }}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {lowContrast && (
              <p className="flex items-start gap-2 rounded-lg bg-[#EDE9DF] px-3.5 py-2.5 text-xs text-[#252B28] dark:bg-[#17231F] dark:text-[#B9C5BD]">
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#7D5C23] dark:text-[#D9B978]"
                  aria-hidden="true"
                />
                <span>
                  Low contrast between foreground and background colors may make
                  the QR code difficult for cameras to scan.
                </span>
              </p>
            )}
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors duration-150 hover:bg-[#173F35]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] sm:flex-initial dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
            >
              <QrIcon className="h-4 w-4" aria-hidden="true" />
              <span>Generate QR Code</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DCDDD3] bg-white px-4 py-2.5 text-sm font-medium text-[#56615B] transition-colors hover:border-[#C49A58] hover:text-[#252B28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#B9C5BD] dark:hover:border-[#D9B978] dark:hover:text-[#F2F0E9]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Reset All</span>
            </button>
          </div>
        </form>

        {/* Right: Live QR Preview & Export Panel */}
        <div className="flex flex-col justify-between border-t border-[#DCDDD3] pt-6 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8 dark:border-[#35463E]">
          <div className="flex flex-col items-center">
            <div className="flex w-full items-center justify-between text-xs text-[#56615B] dark:text-[#B9C5BD]">
              <span className="font-medium">QR Preview</span>
              <span className="font-mono tabular-nums">
                {customization.size}×{customization.size}px · Level{' '}
                {customization.errorLevel}
              </span>
            </div>

            <div
              className="mt-4 flex aspect-square w-full max-w-[270px] items-center justify-center overflow-hidden rounded-2xl border border-[#DCDDD3] p-4 shadow-xs dark:border-[#35463E]"
              style={{ backgroundColor: customization.bgColor }}
            >
              {pngUrl ? (
                <img
                  src={pngUrl}
                  alt={`QR code for ${activePayload}`}
                  referrerPolicy="no-referrer"
                  className={`h-full w-full object-contain transition-opacity duration-150 ${
                    isRendering ? 'opacity-60' : 'opacity-100'
                  }`}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-center text-xs text-[#56615B]">
                  <QrIcon className="h-12 w-12 opacity-40" aria-hidden="true" />
                  <span>Enter valid details and generate</span>
                </div>
              )}
            </div>

            {/* Encoded Payload Summary & Copy */}
            <div className="mt-4 w-full rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/40 p-3 dark:border-[#35463E] dark:bg-[#17231F]/70">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-[#56615B] dark:text-[#B9C5BD]">
                  Encoded Content
                </span>
                <button
                  type="button"
                  onClick={handleCopyPayload}
                  disabled={!activePayload}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#173F35] hover:underline disabled:opacity-45 dark:text-[#D9B978]"
                >
                  {copyStatus === 'copied' ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Copy Content</span>
                    </>
                  )}
                </button>
              </div>
              <p className="mt-1.5 break-all font-mono text-xs leading-relaxed text-[#252B28] dark:text-[#F2F0E9]">
                {activePayload}
              </p>
            </div>
          </div>

          {/* Download Actions */}
          <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={!pngUrl}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#C49A58] px-4 py-2.5 text-sm font-semibold text-[#17231F] transition-colors hover:bg-[#D9B978] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173F35] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#D9B978] dark:hover:bg-[#C49A58]"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Download PNG</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSvg}
              disabled={!svgMarkup}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#DCDDD3] bg-white px-4 py-2.5 text-sm font-semibold text-[#173F35] transition-colors hover:border-[#C49A58] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#D9B978] dark:hover:border-[#D9B978]"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Download SVG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
