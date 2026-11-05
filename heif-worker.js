// elheif 0.1.0: libheif + kvazaar, with its WASM binary bundled locally.
importScripts('lib/elheif/pkg/elheif-wasm.js');

let runtimePromise;
const getRuntime = () => {
    if (!runtimePromise) {
        runtimePromise = new Promise((resolve, reject) => {
            const runtime = {
                onRuntimeInitialized: () => resolve(runtime),
                onAbort: reason => reject(new Error(`HEIF encoder initialization failed: ${reason}`))
            };
            globalThis.__init__ELHEIF_MODULE(runtime);
        });
    }
    return runtimePromise;
};

self.onmessage = async ({ data: { pixels, width, height } }) => {
    try {
        const runtime = await getRuntime();
        const result = runtime.jsEncodeImage(new Uint8Array(pixels), width, height);
        if (result.err || !result.data?.length) throw new Error(result.err || 'HEIF encoding returned an empty image.');
        // Copy before transferring: the result may reference the WASM heap.
        const output = new Uint8Array(result.data);
        self.postMessage({ buffer: output.buffer }, [output.buffer]);
    } catch (error) {
        self.postMessage({ error: `HEIF encoding failed. ${error.message || String(error)}` });
    }
};
