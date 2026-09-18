// State
let splitFile = null;
let splitFileBuffer = null;
let mergeFiles = []; // Array of { file, buffer, id }
let convertFile = null;
let convertFileBuffer = null;

// UI Elements
const tabs = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Splitter Elements
const splitDropZone = document.getElementById('split-drop-zone');
const splitFileInput = document.getElementById('split-file-input');
const splitterUploadCard = document.getElementById('splitter-upload');
const splitterActionsCard = document.getElementById('splitter-actions');
const splitFileName = document.getElementById('split-file-name');
const splitFilePages = document.getElementById('split-file-pages');
const splitRemoveBtn = document.getElementById('split-remove-btn');
const splitBtn = document.getElementById('split-btn');
const pageRangesInput = document.getElementById('page-ranges');
const splitError = document.getElementById('split-error');
const splitPreviewGrid = document.getElementById('split-preview-grid');
const splitProgress = document.getElementById('split-progress');
const splitProgressText = document.getElementById('split-progress-text');
const splitProgressTrack = document.getElementById('split-progress-track');
const splitProgressBar = document.getElementById('split-progress-bar');

// Modal Elements
const previewModal = document.getElementById('preview-modal');
const closeModal = document.getElementById('close-modal');
const modalPageNum = document.getElementById('modal-page-num');
const modalCanvas = document.getElementById('modal-canvas');
const modalSpinner = document.getElementById('modal-spinner');
const modalPrevBtn = document.getElementById('modal-prev-btn');
const modalNextBtn = document.getElementById('modal-next-btn');
let currentPdfJsDoc = null;
let currentPreviewLoadingTask = null;
let currentModalPageNum = 1;
let previewSession = 0;
let splitPageCount = 0;
const selectedSplitPages = new Set();

// Pagination State & Elements
let currentPreviewPage = 1;
const previewsPerPage = 20;
const previewPagination = document.getElementById('preview-pagination');
const prevPreviewBtn = document.getElementById('prev-preview-btn');
const nextPreviewBtn = document.getElementById('next-preview-btn');
const previewPageIndicator = document.getElementById('preview-page-indicator');

// Merger Elements
const mergeDropZone = document.getElementById('merge-drop-zone');
const mergeFileInput = document.getElementById('merge-file-input');
const mergerUploadCard = document.getElementById('merger-upload');
const mergerActionsCard = document.getElementById('merger-actions');
const mergeFileList = document.getElementById('merge-file-list');
const mergeFileCount = document.getElementById('merge-file-count');
const mergeBtn = document.getElementById('merge-btn');
const mergeError = document.getElementById('merge-error');

// PDF to JPEG Elements
const convertDropZone = document.getElementById('convert-drop-zone');
const convertFileInput = document.getElementById('convert-file-input');
const converterUploadCard = document.getElementById('converter-upload');
const converterActionsCard = document.getElementById('converter-actions');
const convertFileName = document.getElementById('convert-file-name');
const convertFilePages = document.getElementById('convert-file-pages');
const convertRemoveBtn = document.getElementById('convert-remove-btn');
const jpegScale = document.getElementById('jpeg-scale');
const jpegQuality = document.getElementById('jpeg-quality');
const convertBtn = document.getElementById('convert-btn');
const convertError = document.getElementById('convert-error');
const convertProgress = document.getElementById('convert-progress');
const convertProgressText = document.getElementById('convert-progress-text');
const convertProgressTrack = document.getElementById('convert-progress-track');
const convertProgressBar = document.getElementById('convert-progress-bar');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Setup Sortable for drag-and-drop reordering in Merger
    new Sortable(mergeFileList, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: () => {
            // Update mergeFiles array order to match DOM
            const newOrderIds = Array.from(mergeFileList.children).map(li => li.dataset.id);
            mergeFiles = newOrderIds.map(id => mergeFiles.find(f => f.id === id));
        }
    });
});

// Tab Switching
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(`${tab.dataset.tab}-section`).classList.add('active');
    });
});

// Helpers
const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const readFileAsArrayBuffer = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

const downloadBuffer = (buffer, filename) => {
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const setLoading = (button, isLoading) => {
    const text = button.querySelector('.btn-text');
    const spinner = button.querySelector('.spinner');
    if (isLoading) {
        button.disabled = true;
        text.classList.add('hidden');
        spinner.classList.remove('hidden');
    } else {
        button.disabled = false;
        text.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
};

const resetProgress = (container, text, track, bar) => {
    container.classList.add('hidden');
    container.classList.remove('is-indeterminate');
    text.textContent = '';
    track.setAttribute('aria-valuenow', '0');
    track.removeAttribute('aria-valuetext');
    bar.style.width = '0%';
};

const updateProgress = (container, text, track, bar, current, total, action) => {
    container.classList.remove('hidden');
    const isIndeterminate = !total;
    container.classList.toggle('is-indeterminate', isIndeterminate);

    if (isIndeterminate) {
        bar.style.removeProperty('width');
        text.textContent = `${action} PDF…`;
        track.removeAttribute('aria-valuenow');
        track.setAttribute('aria-valuetext', `${action} PDF`);
        return;
    }

    const percentage = Math.round((current / total) * 100);
    const completed = current >= total;
    const message = `${action} ${current} / ${total} pages (${percentage}%)${completed ? '' : '…'}`;
    text.textContent = message;
    track.setAttribute('aria-valuenow', String(percentage));
    track.setAttribute('aria-valuetext', message);
    bar.style.width = `${percentage}%`;
};

const releaseCurrentPreviewDocument = async () => {
    previewSession += 1;
    const loadingTask = currentPreviewLoadingTask;
    const pdfDocument = currentPdfJsDoc;
    currentPreviewLoadingTask = null;
    currentPdfJsDoc = null;

    const cleanupTasks = [];
    if (loadingTask) cleanupTasks.push(loadingTask.destroy());
    if (pdfDocument) cleanupTasks.push(pdfDocument.destroy());
    if (cleanupTasks.length) await Promise.allSettled(cleanupTasks);
};

// --- SPLITTER LOGIC ---

const handleSplitFile = async (file) => {
    if (file.type !== 'application/pdf') {
        splitError.textContent = 'Please select a valid PDF file.';
        return;
    }
    splitError.textContent = '';
    resetProgress(splitProgress, splitProgressText, splitProgressTrack, splitProgressBar);
    await releaseCurrentPreviewDocument();
    selectedSplitPages.clear();
    splitPageCount = 0;
    
    try {
        splitFile = file;
        splitFileBuffer = await readFileAsArrayBuffer(file);
        
        // Count pages
        const pdfDoc = await PDFLib.PDFDocument.load(splitFileBuffer);
        const pageCount = pdfDoc.getPageCount();
        splitPageCount = pageCount;
        
        splitFileName.textContent = file.name;
        splitFilePages.textContent = `${pageCount} page${pageCount > 1 ? 's' : ''} • ${formatBytes(file.size)}`;
        
        splitterUploadCard.classList.add('hidden');
        splitterActionsCard.classList.remove('hidden');
        
        // Render previews for the newly selected file.
        currentPreviewPage = 1;
        renderPreviews(splitFileBuffer, 1);
    } catch (error) {
        console.error(error);
        splitError.textContent = 'Failed to load PDF. It might be encrypted or corrupted.';
        splitFile = null;
        splitFileBuffer = null;
    }
};

splitFileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleSplitFile(e.target.files[0]);
});

// Drag and drop for splitter
splitDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    splitDropZone.classList.add('dragover');
});

splitDropZone.addEventListener('dragleave', () => {
    splitDropZone.classList.remove('dragover');
});

splitDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    splitDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleSplitFile(e.dataTransfer.files[0]);
});

splitRemoveBtn.addEventListener('click', async () => {
    await releaseCurrentPreviewDocument();
    splitFile = null;
    splitFileBuffer = null;
    splitPageCount = 0;
    selectedSplitPages.clear();
    splitFileInput.value = '';
    pageRangesInput.value = '';
    splitError.textContent = '';
    resetProgress(splitProgress, splitProgressText, splitProgressTrack, splitProgressBar);
    splitPreviewGrid.innerHTML = ''; // Clear previews
    previewPagination.classList.add('hidden'); // Hide pagination
    previewModal.classList.add('hidden');
    modalCanvas.width = 0;
    modalCanvas.height = 0;
    splitterUploadCard.classList.remove('hidden');
    splitterActionsCard.classList.add('hidden');
});

// Pagination Listeners
prevPreviewBtn.addEventListener('click', () => {
    if (currentPreviewPage > 1) {
        renderPreviews(splitFileBuffer, currentPreviewPage - 1);
    }
});

nextPreviewBtn.addEventListener('click', () => {
    if (currentPdfJsDoc) {
        const totalPreviewPages = Math.ceil(currentPdfJsDoc.numPages / previewsPerPage);
        if (currentPreviewPage < totalPreviewPages) {
            renderPreviews(splitFileBuffer, currentPreviewPage + 1);
        }
    }
});

const renderPreviews = async (buffer, targetPage = 1) => {
    const session = previewSession;
    splitPreviewGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">Generating previews...</div>';
    
    try {
        if (!currentPdfJsDoc) {
            const loadingTask = pdfjsLib.getDocument({ 
                // PDF.js transfers its input to its worker, so keep the extraction
                // buffer intact by passing a copy for preview rendering.
                data: buffer.slice(0),
                cMapUrl: 'lib/cmaps/',
                cMapPacked: true
            });
            currentPreviewLoadingTask = loadingTask;
            const pdfDocument = await loadingTask.promise;

            if (session !== previewSession) {
                await pdfDocument.destroy();
                return;
            }

            currentPdfJsDoc = pdfDocument;
            currentPreviewLoadingTask = null;
        }

        if (session !== previewSession) return;
        
        const totalPages = currentPdfJsDoc.numPages;
        const totalPreviewPages = Math.ceil(totalPages / previewsPerPage);
        
        currentPreviewPage = targetPage;
        
        // Update pagination UI
        if (totalPreviewPages > 1) {
            previewPagination.classList.remove('hidden');
            previewPageIndicator.textContent = `Page ${currentPreviewPage} of ${totalPreviewPages}`;
            prevPreviewBtn.disabled = currentPreviewPage === 1;
            nextPreviewBtn.disabled = currentPreviewPage === totalPreviewPages;
            
            // Adjust styling for disabled buttons
            prevPreviewBtn.style.opacity = prevPreviewBtn.disabled ? '0.5' : '1';
            prevPreviewBtn.style.cursor = prevPreviewBtn.disabled ? 'not-allowed' : 'pointer';
            nextPreviewBtn.style.opacity = nextPreviewBtn.disabled ? '0.5' : '1';
            nextPreviewBtn.style.cursor = nextPreviewBtn.disabled ? 'not-allowed' : 'pointer';
        } else {
            previewPagination.classList.add('hidden');
        }
        
        splitPreviewGrid.innerHTML = ''; // Clear loading text
        
        const startPage = (currentPreviewPage - 1) * previewsPerPage + 1;
        const endPage = Math.min(startPage + previewsPerPage - 1, totalPages);
        
        for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
            const page = await currentPdfJsDoc.getPage(pageNum);
            if (session !== previewSession) return;
            
            // Create card
            const card = document.createElement('div');
            card.className = 'preview-card';
            card.dataset.pageNumber = String(pageNum);
            card.title = 'Click to view full size';
            card.addEventListener('click', () => openPreviewModal(pageNum));

            const selectControl = document.createElement('label');
            selectControl.className = 'preview-select-control';
            selectControl.title = `Select Page ${pageNum}`;
            selectControl.addEventListener('click', (event) => event.stopPropagation());

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = selectedSplitPages.has(pageNum);
            checkbox.setAttribute('aria-label', `Select Page ${pageNum}`);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedSplitPages.add(pageNum);
                } else {
                    selectedSplitPages.delete(pageNum);
                }
                updateRenderedPreviewSelection();
                syncPageRangeInputFromSelection();
            });
            selectControl.appendChild(checkbox);
            card.classList.toggle('selected', checkbox.checked);
            
            // Create canvas
            const canvas = document.createElement('canvas');
            canvas.className = 'preview-canvas';
            const ctx = canvas.getContext('2d');
            
            // Scale rendering
            const viewport = page.getViewport({ scale: 1.0 });
            // Max width for thumbnail is 120px roughly, so let's scale it down for performance
            const scale = 150 / viewport.width; 
            const scaledViewport = page.getViewport({ scale });
            
            canvas.height = scaledViewport.height;
            canvas.width = scaledViewport.width;
            
            // Render
            const renderContext = {
                canvasContext: ctx,
                viewport: scaledViewport
            };
            
            await page.render(renderContext).promise;
            page.cleanup();
            if (session !== previewSession) return;
            
            // Label
            const label = document.createElement('span');
            label.className = 'preview-page-num';
            label.textContent = `Page ${pageNum}`;
            
            card.appendChild(selectControl);
            card.appendChild(canvas);
            card.appendChild(label);
            splitPreviewGrid.appendChild(card);
        }
    } catch (err) {
        if (session !== previewSession) return;
        currentPreviewLoadingTask = null;
        console.error('Error rendering previews:', err);
        splitPreviewGrid.innerHTML = '<div style="grid-column: 1/-1; color: var(--danger); text-align:center;">Failed to generate previews.</div>';
    }
};

const openPreviewModal = async (pageNum) => {
    if (!currentPdfJsDoc) return;
    
    currentModalPageNum = pageNum;
    previewModal.classList.remove('hidden');
    modalPageNum.textContent = `Page ${pageNum}`;
    
    // Update navigation buttons state
    if (modalPrevBtn && modalNextBtn) {
        modalPrevBtn.disabled = pageNum <= 1;
        modalNextBtn.disabled = pageNum >= currentPdfJsDoc.numPages;
        modalPrevBtn.style.opacity = modalPrevBtn.disabled ? '0.3' : '1';
        modalPrevBtn.style.cursor = modalPrevBtn.disabled ? 'not-allowed' : 'pointer';
        modalNextBtn.style.opacity = modalNextBtn.disabled ? '0.3' : '1';
        modalNextBtn.style.cursor = modalNextBtn.disabled ? 'not-allowed' : 'pointer';
    }

    modalCanvas.classList.add('hidden');
    modalSpinner.classList.remove('hidden');
    
    try {
        const page = await currentPdfJsDoc.getPage(pageNum);
        const ctx = modalCanvas.getContext('2d');
        
        // Render at a higher scale for detail (2.0)
        const scale = 2.0; 
        const viewport = page.getViewport({ scale });
        
        modalCanvas.height = viewport.height;
        modalCanvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        page.cleanup();
        
        modalSpinner.classList.add('hidden');
        modalCanvas.classList.remove('hidden');
    } catch (err) {
        console.error('Modal render error:', err);
        modalSpinner.classList.add('hidden');
    }
};

closeModal.addEventListener('click', () => {
    previewModal.classList.add('hidden');
});

if (modalPrevBtn) {
    modalPrevBtn.addEventListener('click', () => {
        if (currentModalPageNum > 1) {
            openPreviewModal(currentModalPageNum - 1);
        }
    });
}

if (modalNextBtn) {
    modalNextBtn.addEventListener('click', () => {
        if (currentPdfJsDoc && currentModalPageNum < currentPdfJsDoc.numPages) {
            openPreviewModal(currentModalPageNum + 1);
        }
    });
}

// Close modal when clicking outside content
previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) {
        previewModal.classList.add('hidden');
    }
});

const parseRanges = (rangeStr, maxPages) => {
    if (!rangeStr.trim()) return null; // Means extract all
    const ranges = rangeStr.split(',').map(s => s.trim());
    const pages = new Set();
    
    for (const range of ranges) {
        if (range.includes('-')) {
            const parts = range.split('-');
            let start = parseInt(parts[0], 10);
            let end = parseInt(parts[1], 10);
            if (isNaN(start) || isNaN(end)) throw new Error(`Invalid range format: ${range}`);
            start = Math.max(1, start);
            end = Math.min(maxPages, end);
            for (let i = start; i <= end; i++) pages.add(i);
        } else {
            const page = parseInt(range, 10);
            if (isNaN(page)) throw new Error(`Invalid page number: ${range}`);
            if (page >= 1 && page <= maxPages) pages.add(page);
        }
    }
    return Array.from(pages).sort((a, b) => a - b).map(p => p - 1); // 0-indexed for pdf-lib
};

const formatPageRanges = (pages) => {
    const sortedPages = Array.from(pages).sort((a, b) => a - b);
    if (!sortedPages.length) return '';

    const ranges = [];
    let start = sortedPages[0];
    let end = start;

    for (const page of sortedPages.slice(1)) {
        if (page === end + 1) {
            end = page;
            continue;
        }
        ranges.push(start === end ? String(start) : `${start}-${end}`);
        start = end = page;
    }
    ranges.push(start === end ? String(start) : `${start}-${end}`);
    return ranges.join(', ');
};

const updateRenderedPreviewSelection = () => {
    splitPreviewGrid.querySelectorAll('.preview-card').forEach(card => {
        const pageNum = Number(card.dataset.pageNumber);
        const isSelected = selectedSplitPages.has(pageNum);
        card.classList.toggle('selected', isSelected);
        const checkbox = card.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = isSelected;
    });
};

const syncPageRangeInputFromSelection = () => {
    pageRangesInput.value = formatPageRanges(selectedSplitPages);
};

const syncSelectionFromPageRangeInput = () => {
    if (!splitPageCount) return;

    try {
        const pageIndices = parseRanges(pageRangesInput.value, splitPageCount);
        selectedSplitPages.clear();
        if (pageIndices) pageIndices.forEach(index => selectedSplitPages.add(index + 1));
        updateRenderedPreviewSelection();
    } catch {
        // Preserve the existing selection while a range is temporarily incomplete.
    }
};

pageRangesInput.addEventListener('input', syncSelectionFromPageRangeInput);

splitBtn.addEventListener('click', async () => {
    if (!splitFileBuffer) return;
    
    setLoading(splitBtn, true);
    splitError.textContent = '';
    resetProgress(splitProgress, splitProgressText, splitProgressTrack, splitProgressBar);
    updateProgress(splitProgress, splitProgressText, splitProgressTrack, splitProgressBar, 0, 0, 'Preparing');
    
    try {
        const sourcePdf = await PDFLib.PDFDocument.load(splitFileBuffer);
        const maxPages = sourcePdf.getPageCount();
        const rangeStr = pageRangesInput.value;
        
        let indicesToExtract = [];
        try {
            indicesToExtract = parseRanges(rangeStr, maxPages);
        } catch (e) {
            splitError.textContent = e.message;
            resetProgress(splitProgress, splitProgressText, splitProgressTrack, splitProgressBar);
            return;
        }

        if (indicesToExtract === null) {
            // Extract all pages individually
            updateProgress(splitProgress, splitProgressText, splitProgressTrack, splitProgressBar, 0, maxPages, 'Extracting');
            for (let i = 0; i < maxPages; i++) {
                const newPdf = await PDFLib.PDFDocument.create();
                const [copiedPage] = await newPdf.copyPages(sourcePdf, [i]);
                newPdf.addPage(copiedPage);
                const pdfBytes = await newPdf.save();
                downloadBuffer(pdfBytes, `${splitFile.name.replace('.pdf', '')}_page_${i + 1}.pdf`);
                updateProgress(splitProgress, splitProgressText, splitProgressTrack, splitProgressBar, i + 1, maxPages, 'Extracting');
            }
        } else {
            if (indicesToExtract.length === 0) {
                splitError.textContent = 'No valid pages found in the specified range.';
                resetProgress(splitProgress, splitProgressText, splitProgressTrack, splitProgressBar);
                return;
            }
            // Extract specific pages into one new PDF
            const newPdf = await PDFLib.PDFDocument.create();
            updateProgress(splitProgress, splitProgressText, splitProgressTrack, splitProgressBar, 0, indicesToExtract.length, 'Extracting');
            for (let i = 0; i < indicesToExtract.length; i++) {
                const [copiedPage] = await newPdf.copyPages(sourcePdf, [indicesToExtract[i]]);
                newPdf.addPage(copiedPage);
                updateProgress(splitProgress, splitProgressText, splitProgressTrack, splitProgressBar, i + 1, indicesToExtract.length, 'Extracting');
            }
            const pdfBytes = await newPdf.save();
            downloadBuffer(pdfBytes, `${splitFile.name.replace('.pdf', '')}_extracted.pdf`);
        }
    } catch (error) {
        console.error(error);
        splitError.textContent = 'An error occurred while splitting the PDF.';
    } finally {
        setLoading(splitBtn, false);
    }
});

// --- MERGER LOGIC ---

const renderMergeList = () => {
    mergeFileList.innerHTML = '';
    mergeFileCount.textContent = `${mergeFiles.length} file${mergeFiles.length !== 1 ? 's' : ''}`;
    
    if (mergeFiles.length > 0) {
        mergerUploadCard.classList.add('hidden');
        mergerActionsCard.classList.remove('hidden');
    } else {
        mergerUploadCard.classList.remove('hidden');
        mergerActionsCard.classList.add('hidden');
    }
    
    mergeFiles.forEach(fileObj => {
        const li = document.createElement('li');
        li.className = 'file-list-item';
        li.dataset.id = fileObj.id;
        
        li.innerHTML = `
            <div class="drag-handle" title="Drag to reorder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </div>
            <div class="file-details">
                <span class="file-name" title="${fileObj.file.name}">${fileObj.file.name}</span>
                <span class="file-pages" style="display: block; font-size: 0.75rem; color: var(--text-muted);">${formatBytes(fileObj.file.size)}</span>
            </div>
            <button class="icon-btn remove-merge-btn" data-id="${fileObj.id}" title="Remove file">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        `;
        mergeFileList.appendChild(li);
    });
    
    // Add remove listeners
    document.querySelectorAll('.remove-merge-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            mergeFiles = mergeFiles.filter(f => f.id !== id);
            renderMergeList();
        });
    });
};

const handleMergeFiles = async (files) => {
    mergeError.textContent = '';
    const newFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    
    if (newFiles.length !== files.length) {
        mergeError.textContent = 'Some files were skipped because they are not PDFs.';
    }
    
    for (const file of newFiles) {
        try {
            const buffer = await readFileAsArrayBuffer(file);
            mergeFiles.push({
                file,
                buffer,
                id: Math.random().toString(36).substr(2, 9)
            });
        } catch (err) {
            console.error(`Failed to read ${file.name}`);
        }
    }
    
    renderMergeList();
    mergeFileInput.value = ''; // Reset input
};

mergeFileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleMergeFiles(e.target.files);
});

// Drag and drop for merger
mergeDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    mergeDropZone.classList.add('dragover');
});

mergeDropZone.addEventListener('dragleave', () => {
    mergeDropZone.classList.remove('dragover');
});

mergeDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    mergeDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleMergeFiles(e.dataTransfer.files);
});

mergeBtn.addEventListener('click', async () => {
    if (mergeFiles.length < 2) {
        mergeError.textContent = 'Please add at least 2 PDF files to merge.';
        return;
    }
    
    setLoading(mergeBtn, true);
    mergeError.textContent = '';
    
    try {
        const mergedPdf = await PDFLib.PDFDocument.create();
        
        for (const fileObj of mergeFiles) {
            const pdfDoc = await PDFLib.PDFDocument.load(fileObj.buffer);
            const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            copiedPages.forEach(page => mergedPdf.addPage(page));
        }
        
        const pdfBytes = await mergedPdf.save();
        downloadBuffer(pdfBytes, 'merged_document.pdf');
    } catch (error) {
        console.error(error);
        mergeError.textContent = 'An error occurred while merging the PDFs. Make sure files are not encrypted.';
    } finally {
        setLoading(mergeBtn, false);
    }
});

// --- PDF TO JPEG LOGIC ---

const isPdfFile = (file) => file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));

const handleConvertFile = async (file) => {
    if (!isPdfFile(file)) {
        convertError.textContent = 'Please select a valid PDF file.';
        return;
    }

    convertError.textContent = '';
    resetProgress(convertProgress, convertProgressText, convertProgressTrack, convertProgressBar);
    try {
        const buffer = await readFileAsArrayBuffer(file);
        const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0), cMapUrl: 'lib/cmaps/', cMapPacked: true });
        const pdfDoc = await loadingTask.promise;
        const pageCount = pdfDoc.numPages;
        await pdfDoc.destroy();

        convertFile = file;
        convertFileBuffer = buffer;
        convertFileName.textContent = file.name;
        convertFilePages.textContent = `${pageCount} page${pageCount === 1 ? '' : 's'} · ${formatBytes(file.size)}`;
        converterUploadCard.classList.add('hidden');
        converterActionsCard.classList.remove('hidden');
    } catch (error) {
        console.error(error);
        convertError.textContent = 'Failed to load PDF. It might be encrypted or corrupted.';
        convertFile = null;
        convertFileBuffer = null;
    }
};

convertFileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleConvertFile(e.target.files[0]);
});

['dragover', 'dragleave'].forEach(eventName => {
    convertDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        convertDropZone.classList.toggle('dragover', eventName === 'dragover');
    });
});

convertDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    convertDropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleConvertFile(e.dataTransfer.files[0]);
});

convertRemoveBtn.addEventListener('click', () => {
    convertFile = null;
    convertFileBuffer = null;
    convertFileInput.value = '';
    convertError.textContent = '';
    resetProgress(convertProgress, convertProgressText, convertProgressTrack, convertProgressBar);
    converterUploadCard.classList.remove('hidden');
    converterActionsCard.classList.add('hidden');
});

const canvasToBlob = (canvas, quality) => new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('JPEG creation failed.')), 'image/jpeg', quality);
});

convertBtn.addEventListener('click', async () => {
    if (!convertFileBuffer || !convertFile) return;

    setLoading(convertBtn, true);
    convertError.textContent = '';
    resetProgress(convertProgress, convertProgressText, convertProgressTrack, convertProgressBar);
    updateProgress(convertProgress, convertProgressText, convertProgressTrack, convertProgressBar, 0, 0, 'Preparing');

    let pdfDoc = null;
    let loadingTask = null;

    try {
        loadingTask = pdfjsLib.getDocument({ data: convertFileBuffer.slice(0), cMapUrl: 'lib/cmaps/', cMapPacked: true });
        pdfDoc = await loadingTask.promise;
        const scale = Number(jpegScale.value);
        const quality = Number(jpegQuality.value);
        const baseName = convertFile.name.replace(/\.pdf$/i, '');
        updateProgress(convertProgress, convertProgressText, convertProgressTrack, convertProgressBar, 0, pdfDoc.numPages, 'Converting');

        for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
            const page = await pdfDoc.getPage(pageNumber);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            const context = canvas.getContext('2d', { alpha: false });
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: context, viewport, background: '#ffffff' }).promise;
            const jpegBlob = await canvasToBlob(canvas, quality);
            downloadBlob(jpegBlob, `${baseName}_page_${pageNumber}.jpeg`);
            canvas.width = 0;
            canvas.height = 0;
            page.cleanup();
            updateProgress(convertProgress, convertProgressText, convertProgressTrack, convertProgressBar, pageNumber, pdfDoc.numPages, 'Converting');
        }
    } catch (error) {
        console.error(error);
        convertError.textContent = 'An error occurred while converting the PDF to JPEG.';
    } finally {
        if (pdfDoc) {
            await pdfDoc.destroy();
        } else if (loadingTask) {
            await loadingTask.destroy();
        }
        setLoading(convertBtn, false);
    }
});
