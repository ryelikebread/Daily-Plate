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
  function variants(code) {
    const c = String(code || '').replace(/\D/g, '');
    const out = new Set([c]);
    if (c.length === 12) out.add('0' + c);
    if (c.length === 13 && c.startsWith('0')) out.add(c.slice(1));
    return [...out].filter(Boolean);
  }

  return { scan, variants, scanFile };
})();
