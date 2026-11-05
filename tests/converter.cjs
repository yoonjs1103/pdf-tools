// Run with Node.js 22+ and a local Chrome installation. No npm packages needed.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

async function main() {
    const root = path.resolve(__dirname, '..');
    const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-tools-test-'));
    const server = http.createServer(async (req, res) => {
        const pathname = new URL(req.url, 'http://localhost').pathname;
        const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
        if (!filename.startsWith(`${root}${path.sep}`)) return res.writeHead(403).end();
        try {
            const data = await fs.readFile(filename);
            res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(filename)] || 'application/octet-stream');
            res.end(data);
        } catch {
            res.writeHead(404).end();
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
        '--headless=new', '--no-first-run', '--no-default-browser-check',
        '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
    ], { stdio: 'ignore', windowsHide: true });
    let launchError;
    chrome.on('error', error => { launchError = error; });
    let socket;
    try {
        let port;
        for (let attempt = 0; attempt < 100; attempt++) {
            if (launchError) throw launchError;
            try {
                port = Number((await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
                break;
            } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
        }
        assert.ok(port, 'Chrome must start');
        const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
        socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
        let nextId = 0;
        const pending = new Map();
        socket.onmessage = ({ data }) => {
            const message = JSON.parse(data);
            if (!message.id) return;
            const callbacks = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) callbacks.reject(new Error(message.error.message));
            else callbacks.resolve(message.result);
        };
        const call = (method, params = {}) => new Promise((resolve, reject) => {
            const id = ++nextId;
            pending.set(id, { resolve, reject });
            socket.send(JSON.stringify({ id, method, params }));
        });
        const evaluate = async expression => {
            const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
            if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
            return result.result.value;
        };
        await call('Page.navigate', { url: origin });
        for (let attempt = 0; attempt < 100; attempt++) {
            if (await evaluate('typeof getConversionPages === "function"')) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        const results = await evaluate(`(async () => {
            const check = (condition, message) => { if (!condition) throw new Error(message); };
            const equal = (actual, expected, message) => check(JSON.stringify(actual) === JSON.stringify(expected), message);
            equal(getConversionPages('all', '', 3), [1, 2, 3], 'All pages');
            equal(getConversionPages('selected', '3, 1-2, 2', 3), [1, 2, 3], 'Sorted unique selection');
            for (const invalid of ['', '0', '4', '2-1', '1-4', '1x', '1.5', '1,', '1--2', '-1', '1-2-3']) {
                let failed = false;
                try { getConversionPages('selected', invalid, 3); } catch { failed = true; }
                check(failed, 'Reject invalid range: ' + invalid);
            }
            const doc = await PDFLib.PDFDocument.create();
            for (const color of [PDFLib.rgb(1, 0, 0), PDFLib.rgb(0, 1, 0), PDFLib.rgb(0, 0, 1)]) {
                const page = doc.addPage([64, 64]);
                page.drawRectangle({ x: 0, y: 0, width: 64, height: 64, color });
            }
            const file = new File([await doc.save()], 'sample.pdf', { type: 'application/pdf' });
            await handleConvertFile(file);
            check(convertPageCount === 3, 'PDF page count');
            document.querySelector('[data-tab="converter"]').click();
            window.savedImages = [];
            const blobs = new Map();
            const createObjectURL = URL.createObjectURL.bind(URL);
            URL.createObjectURL = blob => { const url = createObjectURL(blob); blobs.set(url, blob); return url; };
            HTMLAnchorElement.prototype.click = function () { savedImages.push({ blob: blobs.get(this.href), filename: this.download }); };
            const run = async () => {
                convertBtn.click();
                check(convertBtn.disabled && imageFormat.disabled && convertPageRanges.disabled, 'Lock settings during conversion');
                const deadline = Date.now() + 60000;
                while (convertBtn.disabled && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
                check(!convertBtn.disabled, 'Conversion finishes');
                check(!convertError.textContent, convertError.textContent);
                check(!imageFormat.disabled && !convertRemoveBtn.disabled, 'Restore controls');
            };
            convertPageMode.value = 'selected';
            convertPageRanges.value = '3, 1, 3';
            updateConversionSelection();
            await run();
            equal(savedImages.map(image => image.filename), ['sample_page_1.jpeg', 'sample_page_3.jpeg'], 'Selected JPEG filenames');
            for (const image of savedImages) {
                equal(Array.from(new Uint8Array(await image.blob.arrayBuffer()).slice(0, 3)), [255, 216, 255], 'Real JPEG bytes');
            }
            check(convertProgressText.textContent.includes('2 / 2'), 'Selected-page progress');
            imageFormat.value = 'png'; updateConversionFormat();
            check(jpegQuality.disabled && jpegQualityGroup.classList.contains('hidden'), 'Hide JPEG quality for PNG');
            convertPageMode.value = 'all'; updateConversionSelection();
            savedImages.length = 0;
            await run();
            equal(savedImages.map(image => image.filename), [1, 2, 3].map(page => 'sample_page_' + page + '.png'), 'All PNG filenames');
            const colors = [];
            for (const image of savedImages) {
                equal(Array.from(new Uint8Array(await image.blob.arrayBuffer()).slice(0, 8)), [137,80,78,71,13,10,26,10], 'Real PNG bytes');
                const bitmap = await createImageBitmap(image.blob);
                const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
                const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
                colors.push(Array.from(ctx.getImageData(20,20,1,1).data).slice(0,3)); bitmap.close();
            }
            equal(colors, [[255,0,0],[0,255,0],[0,0,255]], 'Output contains correct PDF pages');
            imageFormat.value = 'heif'; updateConversionFormat();
            convertPageMode.value = 'selected'; convertPageRanges.value = '2-3'; updateConversionSelection();
            savedImages.length = 0;
            await run();
            equal(savedImages.map(image => image.filename), ['sample_page_2.heif', 'sample_page_3.heif'], 'Selected HEIF filenames');
            await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = 'lib/elheif/pkg/elheif-wasm.js'; script.onload = resolve; script.onerror = reject; document.head.appendChild(script); });
            const runtime = {};
            await new Promise((resolve,reject) => { runtime.onRuntimeInitialized=resolve; runtime.onAbort=reject; __init__ELHEIF_MODULE(runtime); });
            for (const [index, image] of savedImages.entries()) {
                const bytes = new Uint8Array(await image.blob.arrayBuffer());
                check(new TextDecoder().decode(bytes.slice(4,8)) === 'ftyp', 'HEIF container signature');
                const result = runtime.jsDecodeImage(bytes);
                check(!result.err && result.data.length === 1, 'HEIF decodes successfully');
                const bitmap = result.data[0];
                check(bitmap.width === 128 && bitmap.height === 128, 'HEIF output resolution');
                const pixel = Array.from(bitmap.data.slice(0,3));
                check(pixel[index + 1] > 200 && pixel[0] < 30, 'Correct HEIF page content');
            }
            const count = savedImages.length;
            convertPageRanges.value = '99'; updateConversionSelection(); convertBtn.click();
            check(savedImages.length === count && !convertBtn.disabled && !!convertError.textContent, 'Invalid input prevents conversion');
            convertRemoveBtn.click();
            check(!convertFile && convertPageCount === 0 && convertPageRanges.value === '', 'Removal resets selection');
            await handleConvertFile(file);
            check(convertPageMode.value === 'all', 'New file defaults to all pages');
            const NativeWorker = window.Worker;
            window.Worker = class {
                constructor() { setTimeout(() => this.onerror({ preventDefault() {} }), 0); }
                terminate() {}
            };
            const failingEncoder = createHeifEncoder();
            await new Promise(resolve => setTimeout(resolve, 10));
            let workerFailed = false;
            try { await failingEncoder.encode(new ImageData(1, 1)); } catch { workerFailed = true; }
            failingEncoder.destroy(); window.Worker = NativeWorker;
            check(workerFailed, 'Worker load failure rejects even before the first encode');
            let incorrectMimeFailed = false;
            try { await canvasToBlob({ toBlob(callback) { callback(new Blob(['wrong'], {type: 'image/png'})); } }, 'image/jpeg', 0.9); }
            catch { incorrectMimeFailed = true; }
            check(incorrectMimeFailed, 'Reject browser fallback to a different file format');
            imageFormat.value = 'jpeg'; updateConversionFormat();
            check(!jpegQuality.disabled && !jpegQualityGroup.classList.contains('hidden'), 'JPEG quality restored');
            await handleConvertFile(new File(['broken'], 'broken.pdf', { type: 'application/pdf' }));
            check(!convertFile && !convertError.closest('.hidden') && !!convertError.textContent, 'Load failures remain visible');
            await handleConvertFile(file);
            return { tests: 'Range validation, real PDF rendering, JPEG/PNG/HEIF signatures and decoded pixels, progress, controls, file reset, load failure', formats: ['jpeg','png','heif'] };
        })()`);
        console.log('PASS', results);
        await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
        assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'Mobile layout must not overflow');
        console.log('PASS mobile layout');
        if (process.env.SCREENSHOT_PATH) {
            const screenshot = await call('Page.captureScreenshot');
            await fs.writeFile(process.env.SCREENSHOT_PATH, Buffer.from(screenshot.data, 'base64'));
        }
        await call('Browser.close');
    } finally {
        socket?.close();
        chrome.kill();
        await new Promise(resolve => server.close(resolve));
        await fs.rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }).catch(() => {});
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
