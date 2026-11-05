# HEIF encoder

Vendored package: **elheif 0.1.0**, downloaded from
https://registry.npmjs.org/elheif/-/elheif-0.1.0.tgz

- Source and build instructions: https://github.com/hpp2334/elheif
- Wrapper license: MIT; see [LICENSE](LICENSE).
- The files in `pkg/` are unmodified upstream distribution files.
- `pkg/elheif-wasm.js` includes the WebAssembly binary and is loaded only for HEIF conversion.
- The app calls the upstream runtime directly from `heif-worker.js`. The upstream ESM entry point is retained for provenance but is not used by the app.

The bundled runtime includes these libraries:

| Library | License notice | Source |
| --- | --- | --- |
| libheif | [LGPL v3](LICENSE-libheif) | https://github.com/strukturag/libheif |
| libde265 | [LGPL v3](LICENSE-libde265) | https://github.com/strukturag/libde265 |
| kvazaar | [BSD 3-Clause](LICENSE-kvazaar) | https://github.com/ultravideo/kvazaar |

Upstream's `core/CMakeLists.txt` fetches these dependencies without version tags;
the npm package does not identify their exact build commits. The build source,
wrapper and scripts are available in the elheif repository. A replacement runtime
can be built with its Emscripten build workflow and substituted at
`pkg/elheif-wasm.js`, retaining the `__init__ELHEIF_MODULE` API.
