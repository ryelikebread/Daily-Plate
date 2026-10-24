// Camera barcode scanner.
// Uses the browser's built-in BarcodeDetector when it exists (Android Chrome),
// otherwise the bundled ZXing decoder (vendor/zxing.min.js), which is what
// iPhone Safari uses. ZXing is loaded only when you first scan.
//
// Scanner.scan() opens the scanner dialog and resolves with the barcode
// digits, or null if the person cancels.

const Scanner = (() => {
  const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];
  let zxingPromise = null;
  let decoderPromise = null;
  let stream = null;
  let loopTimer = null;
  let finish = null;

  const el = (id) => document.getElementById(id);

  function loadZXing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    if (!zxingPromise) {
      zxingPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'vendor/zxing.min.js';
        s.onload = () => resolve(window.ZXing);
        s.onerror = () => { zxingPromise = null; reject(new Error('Could not load the barcode reader.')); };
        document.head.appendChild(s);
      });
    }
    return zxingPromise;
  }

  async function nativeDecoder() {
    if (!('BarcodeDetector' in window)) return null;
    try {
      const supported = await BarcodeDetector.getSupportedFormats();
      const formats = NATIVE_FORMATS.filter(f => supported.includes(f));
      if (!formats.length) return null;
      const d = new BarcodeDetector({ formats });
      return async (canvas) => { const r = await d.detect(canvas); return r[0] ? r[0].rawValue : null; };
    } catch (_) { return null; }
  }

  async function zxingDecoder() {
    const Z = await loadZXing();
    const hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_128]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    const reader = new Z.MultiFormatReader();
    reader.setHints(hints);
    return async (canvas) => {
      try {
        const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)));
        return reader.decode(bitmap).getText();
      } catch (_) {
        return null; // nothing found in this frame
      } finally {
        reader.reset();
      }
    };
  }

  function getDecoder() {
    if (!decoderPromise) {
      decoderPromise = nativeDecoder().then(d => d || zxingDecoder()).catch(err => { decoderPromise = null; throw err; });
    }
    return decoderPromise;
  }

  function status(text, isError) {
    const s = el('scan-status');
    s.textContent = text;
    s.classList.toggle('over', !!isError);
  }

  function stopCamera() {
    clearTimeout(loopTimer);
    loopTimer = null;
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    const v = el('scan-video');
    v.srcObject = null;
  }

  function done(code) {
    stopCamera();
    const f = finish;
    finish = null;
    if (el('scan-dialog').open) el('scan-dialog').close();
    if (f) f(code);
  }

  // Draw the current frame (scaled down for speed) and try to read it.
  async function scanLoop(decode) {
    if (!stream) return;
    const v = el('scan-video');
    if (v.readyState >= 2 && v.videoWidth) {
      const scale = Math.min(1, 960 / v.videoWidth);
      const c = el('scan-canvas');
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext('2d', { willReadFrequently: true }).drawImage(v, 0, 0, c.width, c.height);
      const code = await decode(c);
      if (code) { if (navigator.vibrate) navigator.vibrate(60); return done(code); }
    }
    loopTimer = setTimeout(() => scanLoop(decode), 120);
  }

  function cameraErrorMessage(err) {
    const name = err && err.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return 'Camera access is blocked. On iPhone: Settings → Apps → Safari → Camera → Allow, then try again. Or use "Scan a photo" below.';
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera found. Use "Scan a photo" or type the number.';
    if (name === 'NotReadableError') return 'The camera is busy in another app. Close it and try again.';
    if (!window.isSecureContext) return 'The camera needs the app to be opened over https (or localhost).';
    return 'Could not start the camera: ' + ((err && err.message) || name || 'unknown error');
  }

  async function startCamera() {
    status('Starting camera…');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      status(cameraErrorMessage({ name: window.isSecureContext ? 'NotFoundError' : 'SecurityError' }), true);
      return;
    }
    try {
      const decodePromise = getDecoder(); // load the reader while the camera starts
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (!finish) { stopCamera(); return; } // closed while waiting for permission
      const v = el('scan-video');
      v.srcObject = stream;
      await v.play().catch(() => {});
      const decode = await decodePromise;
      status('Point the camera at the barcode. Hold steady, about a hand-width away.');
      scanLoop(decode);
    } catch (err) {
      stopCamera();
      status(cameraErrorMessage(err), true);
    }
  }

  // Read a barcode from a still photo (fallback when the camera can't be used).
  async function scanFile(file) {
    if (!file) return;
    status('Reading photo…');
    try {
      const decode = await getDecoder();
      const img = await createImageBitmap(file);
      const c = el('scan-canvas');
      for (const max of [1600, 1000, 640]) {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, c.width, c.height);
        const code = await decode(c);
        if (code) return done(code);
      }
      status('No barcode found in that photo. Try a closer, sharper photo, or type the number.', true);
    } catch (err) {
      status('Could not read the photo: ' + err.message, true);
    }
  }

  let wired = false;
  function wire() {
    if (wired) return;
    wired = true;
    el('scan-cancel').addEventListener('click', () => done(null));
    el('scan-dialog').addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    el('scan-photo').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; scanFile(f); });
    el('scan-retry').addEventListener('click', () => { stopCamera(); startCamera(); });
  }

  function scan() {
    wire();
    if (finish) done(null);
    return new Promise((resolve) => {
      finish = resolve;
      el('scan-dialog').showModal();
      startCamera();
    });
  }

  // Barcode digits can be printed as UPC-A (12) or EAN-13 (13, leading 0).
  // Every spelling a product code can have: as typed, with leading zeros
  // removed, padded to 8/12/13/14 digits, and UPC-E expanded to UPC-A.
  function variants(code) {
    const c = String(code || '').replace(/\D/g, '');
    if (!c) return [];
    const out = [c];
    if (c.length === 12) out.push('0' + c);
    if (c.length === 13 && c.startsWith('0')) out.push(c.slice(1));
    const core = c.replace(/^0+/, '');
    if (core) {
      for (const n of [12, 13, 8, 14]) if (core.length <= n) out.push(core.padStart(n, '0'));
      out.push(core);
    }
    if (c.length === 8 && /^[01]/.test(c)) { const a = upceToUpca(c); if (a) out.push(a, '0' + a); }
    // Many sites show a code without its check digit (or with a wrong one):
    // try the code as the 11-digit body of a UPC-A, and with the last digit replaced.
    if (core && !checkDigitOk(c)) {
      const bodies = new Set();
      if (core.length <= 11) bodies.add(core.padStart(11, '0'));
      if (core.length >= 2 && core.length <= 12) bodies.add(core.slice(0, -1).padStart(11, '0'));
      for (const b of bodies) { const u = b + checkDigit(b); out.push(u, '0' + u); }
    }
    return [...new Set(out)];
  }

  function checkDigit(body) {
    let sum = 0;
    body.split('').reverse().forEach((ch, i) => { sum += Number(ch) * (i % 2 === 0 ? 3 : 1); });
    return String((10 - (sum % 10)) % 10);
  }

  function upceToUpca(e) {
    const ns = e[0], d = e.slice(1, 7), chk = e[7], last = d[5];
    let body;
    if ('012'.includes(last)) body = d.slice(0, 2) + last + '0000' + d.slice(2, 5);
    else if (last === '3') body = d.slice(0, 3) + '00000' + d.slice(3, 5);
    else if (last === '4') body = d.slice(0, 4) + '00000' + d[4];
    else body = d.slice(0, 5) + '0000' + last;
    return ns + body + chk;
  }

  // GS1 check digit test; works for 8, 12, 13 and 14 digit codes.
  function checkDigitOk(code) {
    const c = String(code || '').replace(/\D/g, '');
    if (c.length < 8) return false;
    const digits = c.split('').map(Number); const chk = digits.pop();
    let sum = 0;
    digits.reverse().forEach((d, i) => { sum += d * (i % 2 === 0 ? 3 : 1); });
    return (10 - (sum % 10)) % 10 === chk;
  }

  return { scan, variants, checkDigitOk, scanFile };
})();
