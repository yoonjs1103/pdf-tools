## pdf_tools

- Split PDF
- Merge PDFs
- PDF to Image (JPEG, PNG, HEIF)

#### V1.2 update
1. `PDF to JPEG`의 이름을 `PDF to Image`로 변경했습니다.
2. 전체 페이지 또는 선택한 페이지를 이미지로 변환합니다.
    - `Selected pages`에서 `1-3, 5, 8-10`처럼 번호와 범위를 입력합니다.
    - 중복은 제거하고 원본 순서대로 저장하며, 잘못된 번호와 범위는 오류로 안내합니다.
    - 진행률은 선택한 페이지 수를 기준으로 표시합니다.
3. JPEG, PNG, HEIF 출력 형식을 선택할 수 있습니다.
    - JPEG에만 80%, 90%, 100% 품질 설정을 적용합니다.
    - PNG는 무손실 압축을 사용합니다.
    - HEIF는 로컬에 포함한 WebAssembly 인코더로 HEVC 이미지를 생성합니다. 품질은 인코더 기본값을 사용합니다.
    - 각 파일은 `원본이름_page_페이지번호.확장자`로 저장됩니다.
    - 여러 페이지를 저장할 때 브라우저에서 여러 파일 다운로드 허용이 필요할 수 있습니다.

로컬 실행 시 Live Server 같은 HTTP 서버로 `index.html`을 여세요. HEIF 인코딩은 Web Worker를 사용하므로 `file://`로 직접 열면 제한될 수 있습니다. 모든 PDF 처리와 이미지 변환은 브라우저 안에서 이루어집니다.

검증: Node.js 22 이상과 Chrome이 설치되어 있으면 `node tests/converter.cjs`를 실행합니다. Chrome 경로가 기본 Windows 설치 경로와 다르면 `CHROME_PATH` 환경변수로 지정합니다. 실제 PDF를 생성해 페이지 선택, JPEG/PNG/HEIF 파일 내용, 오류 처리, 진행률과 모바일 레이아웃을 확인합니다.

HEIF 인코더 출처와 라이선스: [lib/elheif/THIRD_PARTY.md](lib/elheif/THIRD_PARTY.md).

#### V1.1 update
1. 분할·JPEG 변환에 준비 상태와 현재 / 전체 페이지 (퍼센트) 진행률 바를 추가했습니다.
2. 분할 미리보기 썸네일에 체크박스를 넣었습니다.- 체크 → 입력칸이 1-3, 5 형식으로 자동 갱신
    - 입력칸 수정 → 썸네일 선택 상태도 동기화
    - 기존 상세 모달은 썸네일 본문 클릭으로 유지됩니다.

3. 파일 교체·삭제 시 currentPdfJsDoc.destroy() 및 로딩 작업을 정리합니다.- 미리보기/모달/변환에서 사용한 페이지 리소스와 캔버스도 해제합니다.
    - 미리보기에는 원본 버퍼 복사본을 전달해 PDF.js 워커가 추출용 버퍼를 분리하지 않도록 했습니다.
