// ── State ──────────────────────────────────────────────────────
let selectedFilesData = []; // { file, settings, thumbnail, optimizedSize }
let dragSrcIndex = -1;
const MAX_MB = 50, MAX_FILES = 50;

// ── DOM Refs ───────────────────────────────────────────────────
const dropZone         = document.getElementById('dropZone');
const fileInput        = document.getElementById('fileInput');
const fileList         = document.getElementById('fileList');
const previewContainer = document.getElementById('previewContainer');
const fileCountTxt     = document.getElementById('fileCount');
const qualitySlider    = document.getElementById('quality');
const processBtn       = document.getElementById('processBtn');
const btnText          = document.getElementById('btnText');
const loadingScanner   = document.getElementById('loadingScanner');
const resultInfo       = document.getElementById('resultInfo');
const clearAllBtn      = document.getElementById('clearAll');
const globalLoading    = document.getElementById('globalLoading');
const loadingProgressText = document.getElementById('loadingProgressText');
const finalDownloadBtn = document.getElementById('finalDownloadBtn');
const resetBtn         = document.getElementById('resetBtn');
const imageForm        = document.getElementById('imageForm');
const progressContainer= document.getElementById('progressContainer');
const progressBar      = document.getElementById('progressBar');
const progressCount    = document.getElementById('progressCount');
const statsCard        = document.getElementById('statsCard');

// ── Tabs ───────────────────────────────────────────────────────
window.switchTab = function(tab) {
    const uploadPanel = document.getElementById('imageForm');
    const urlPanel    = document.getElementById('urlPanel');
    const tabUpload   = document.getElementById('tabUpload');
    const tabUrl      = document.getElementById('tabUrl');
    if (tab === 'upload') {
        uploadPanel.classList.remove('hidden');
        urlPanel.classList.add('hidden');
        tabUpload.classList.add('tab-active');
        tabUrl.classList.remove('tab-active');
    } else {
        uploadPanel.classList.add('hidden');
        urlPanel.classList.remove('hidden');
        tabUrl.classList.add('tab-active');
        tabUpload.classList.remove('tab-active');
    }
};

// ── Background color sync ──────────────────────────────────────
const bgPicker = document.getElementById('background');
const bgHex    = document.getElementById('backgroundHex');
window.syncBgColor = function(input) {
    const val = input.value;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) bgPicker.value = val;
};
bgPicker.addEventListener('input', function() { bgHex.value = this.value; });

// ── Drag & Drop ────────────────────────────────────────────────
dropZone.ondragover = e => { e.preventDefault(); dropZone.classList.add('dragover'); };
dropZone.ondragleave = () => dropZone.classList.remove('dragover');
dropZone.ondrop = e => { e.preventDefault(); dropZone.classList.remove('dragover'); ingestFiles(e.dataTransfer.files); };
fileInput.onchange = e => ingestFiles(e.target.files);

// ── Clipboard Paste ────────────────────────────────────────────
document.addEventListener('paste', function(e) {
    const items = e.clipboardData?.items || [];
    const arr = [];
    for (const item of items) {
        if (!item.type.startsWith('image/')) continue;
        const blob = item.getAsFile();
        if (blob) arr.push(new File([blob], `paste_${Date.now()}.${item.type.split('/')[1]||'png'}`, { type: item.type }));
    }
    if (arr.length) ingestFiles(arr);
});

// ── File Ingestion ─────────────────────────────────────────────
function ingestFiles(files) {
    const arr = Array.from(files);
    let skipped = 0;
    for (const file of arr) {
        if (!file.type.startsWith('image/')) continue;
        if (selectedFilesData.length >= MAX_FILES) { alert(`Tối đa ${MAX_FILES} file.`); break; }
        if (file.size > MAX_MB * 1024 * 1024) { skipped++; continue; }
        selectedFilesData.push({ file, settings: {}, thumbnail: null, optimizedSize: null });
    }
    if (skipped) alert(`${skipped} file bị bỏ qua (>${MAX_MB}MB).`);
    renderUI();
}

// ── Render File List ───────────────────────────────────────────
function renderUI() {
    fileList.innerHTML = '';
    fileCountTxt.textContent = selectedFilesData.length;
    previewContainer.classList.toggle('hidden', selectedFilesData.length === 0);

    selectedFilesData.forEach((data, index) => {
        const row = document.createElement('div');
        row.className = 'list-row rounded-3xl p-4 lg:p-5 transition-all';
        row.draggable = true;
        row.dataset.index = index;

        // Drag events
        row.addEventListener('dragstart', () => { dragSrcIndex = index; row.classList.add('opacity-50'); });
        row.addEventListener('dragend', () => row.classList.remove('opacity-50'));
        row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('drag-over'); });
        row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
        row.addEventListener('drop', e => {
            e.preventDefault(); row.classList.remove('drag-over');
            if (dragSrcIndex !== index) {
                const moved = selectedFilesData.splice(dragSrcIndex, 1)[0];
                selectedFilesData.splice(index, 0, moved);
                renderUI();
            }
        });

        const sizeStr = data.file.size >= 1048576
            ? (data.file.size / 1048576).toFixed(1) + ' MB'
            : (data.file.size / 1024).toFixed(0) + ' KB';

        const isDone = data.optimizedSize != null;
        const savings = isDone ? Math.round((1 - data.optimizedSize / data.file.size) * 100) : 0;
        const optStr  = isDone ? (data.optimizedSize >= 1048576
            ? (data.optimizedSize / 1048576).toFixed(1) + ' MB'
            : (data.optimizedSize / 1024).toFixed(1) + ' KB') : '';

        row.innerHTML = `
        <div class="flex items-center gap-4 relative">
            <div id="status-${index}" class="${isDone ? '' : 'hidden'} absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-emerald-500/90 text-white flex items-center justify-center z-20 shadow-[0_0_10px_rgba(16,185,129,0.5)] border border-emerald-400/20">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path></svg>
            </div>
            <div class="drag-handle w-4 flex-shrink-0 text-slate-700 hover:text-slate-500 cursor-grab text-center select-none">⠿</div>
            <div class="w-12 h-12 rounded-xl overflow-hidden glass flex-shrink-0 border border-white/5 shadow-lg">
                ${data.thumbnail ? `<img src="${data.thumbnail}" class="w-full h-full object-cover">` : '<div class="w-full h-full bg-slate-800 animate-pulse"></div>'}
            </div>
            <div class="flex-1 min-w-0">
                <div class="text-xs font-bold text-white/90 truncate">${data.file.name}</div>
                <div id="size-info-${index}" class="text-xs font-black text-slate-600 mt-0.5 italic flex items-center gap-1.5">
                    ${isDone
                        ? `<span class="text-white/40">${sizeStr}</span><span class="text-white/20">→</span><span class="text-indigo-400">${optStr}</span><span class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] border border-emerald-500/10">-${savings}%</span>`
                        : `${sizeStr} · Đã Chọn`}
                </div>
            </div>
            <div class="flex items-center gap-1.5 flex-shrink-0">
                <button type="button" onclick="showPreviewModal(${index})" title="Xem trước" class="p-2.5 rounded-xl bg-violet-500/5 hover:bg-violet-500/15 text-violet-400 transition-all border border-violet-500/10">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke-width="2"></path><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" stroke-width="2"></path></svg>
                </button>
                <button id="dl-${index}" type="button" onclick="downloadIndividual(${index})" title="Tải xuống" class="${isDone ? '' : 'hidden'} p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all border border-emerald-500/10">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
                </button>
                <button type="button" onclick="toggleRowSettings(${index},this)" class="p-2.5 rounded-xl bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-400 transition-all border border-indigo-500/10">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543-.94-3.31.826-2.37 2.37a1.724 1.724 0 00-1.065 2.572c-1.756.426-1.756 2.924 0 3.35a1.724 1.724 0 001.066 2.573c-.94 1.543.826 3.31 2.37 2.37.996.608 2.296.07 2.572-1.065z" stroke-width="2"></path></svg>
                </button>
                <button type="button" onclick="removeFile(${index})" class="p-2.5 rounded-xl bg-rose-500/5 hover:bg-rose-500/10 text-rose-500/60 hover:text-rose-500 transition-all border border-rose-500/10">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round"></path></svg>
                </button>
            </div>
        </div>
        <div id="row-settings-${index}" class="settings-expand">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="field-group">
                    <label class="field-label accent">Chất Lượng</label>
                    <input type="number" min="1" max="100" onchange="setPerFile(${index},'quality',this.value)"
                        placeholder="Mặc định" class="pro-input" value="${data.settings.quality||''}">
                </div>
                <div class="field-group">
                    <label class="field-label accent">Định Dạng</label>
                    <select onchange="setPerFile(${index},'format',this.value)" class="pro-select">
                        <option value="" ${!data.settings.format?'selected':''}>— Mặc định —</option>
                        <option value="jpeg" ${data.settings.format==='jpeg'?'selected':''}>JPEG</option>
                        <option value="png"  ${data.settings.format==='png'?'selected':''}>PNG</option>
                        <option value="webp" ${data.settings.format==='webp'?'selected':''}>WebP</option>
                        <option value="avif" ${data.settings.format==='avif'?'selected':''}>AVIF</option>
                        <option value="gif"  ${data.settings.format==='gif'?'selected':''}>GIF</option>
                        <option value="tiff" ${data.settings.format==='tiff'?'selected':''}>TIFF</option>
                    </select>
                </div>
                <div class="field-group">
                    <label class="field-label accent">Rộng Max</label>
                    <input type="number" onchange="setPerFile(${index},'maxWidth',this.value)"
                        placeholder="Auto" class="pro-input" value="${data.settings.maxWidth||''}">
                </div>
                <div class="field-group">
                    <label class="field-label accent">Cao Max</label>
                    <input type="number" onchange="setPerFile(${index},'maxHeight',this.value)"
                        placeholder="Auto" class="pro-input" value="${data.settings.maxHeight||''}">
                </div>
                <div class="field-group">
                    <label class="field-label accent">Xoay</label>
                    <select onchange="setPerFile(${index},'rotate',this.value)" class="pro-select">
                        <option value="0">— Không —</option>
                        <option value="90" ${data.settings.rotate===90?'selected':''}>90° CW</option>
                        <option value="180" ${data.settings.rotate===180?'selected':''}>180°</option>
                        <option value="270" ${data.settings.rotate===270?'selected':''}>270° CW</option>
                    </select>
                </div>
                <div class="field-group">
                    <label class="field-label accent">Blur (0-20)</label>
                    <input type="number" min="0" max="20" step="0.5" onchange="setPerFile(${index},'blur',this.value)"
                        placeholder="0" class="pro-input" value="${data.settings.blur||''}">
                </div>
                <div class="field-group col-span-2 flex gap-4 items-end pb-1">
                    <label class="toggle-label">
                        <input type="checkbox" onchange="setPerFile(${index},'flipH',this.checked)" ${data.settings.flipH?'checked':''} class="toggle-checkbox">
                        <span class="toggle-pill"></span>
                        <span class="text-xs text-slate-400">Lật Ngang</span>
                    </label>
                    <label class="toggle-label">
                        <input type="checkbox" onchange="setPerFile(${index},'flipV',this.checked)" ${data.settings.flipV?'checked':''} class="toggle-checkbox">
                        <span class="toggle-pill"></span>
                        <span class="text-xs text-slate-400">Lật Dọc</span>
                    </label>
                    <label class="toggle-label">
                        <input type="checkbox" onchange="setPerFile(${index},'grayscale',this.checked)" ${data.settings.grayscale?'checked':''} class="toggle-checkbox">
                        <span class="toggle-pill"></span>
                        <span class="text-xs text-slate-400">Grayscale</span>
                    </label>
                    <label class="toggle-label group">
                        <input type="checkbox" onchange="setPerFile(${index},'removeBg',this.checked)" ${data.settings.removeBg?'checked':''} class="toggle-checkbox">
                        <span class="toggle-pill !bg-emerald-500/10 !border-emerald-500/20"></span>
                        <span class="text-[10px] font-black text-emerald-400 group-hover:text-emerald-300">MAGIC AI</span>
                    </label>
                </div>
            </div>
        </div>`;

        fileList.appendChild(row);

        // Load thumbnail if not cached
        if (!data.thumbnail) {
            const reader = new FileReader();
            reader.onload = e => {
                data.thumbnail = e.target.result;
                const imgEl = row.querySelector('img');
                const ph = row.querySelector('.animate-pulse');
                if (ph) {
                    const img = document.createElement('img');
                    img.src = data.thumbnail;
                    img.className = 'w-full h-full object-cover';
                    ph.replaceWith(img);
                } else if (imgEl) imgEl.src = data.thumbnail;
            };
            reader.readAsDataURL(data.file);
        }
    });
}

// ── Per-file settings ──────────────────────────────────────────
window.setPerFile = (i, key, val) => {
    if (val === '' || val === false || val === null) delete selectedFilesData[i].settings[key];
    else if (['flipH','flipV','grayscale','sharpen','stripExif','removeBg'].includes(key)) selectedFilesData[i].settings[key] = val === true || val === 'true';
    else if (['format','resizeFit'].includes(key)) selectedFilesData[i].settings[key] = val;
    else selectedFilesData[i].settings[key] = parseFloat(val);
};
window.toggleRowSettings = (i, btn) => {
    document.getElementById('row-settings-' + i)?.classList.toggle('show');
    btn.classList.toggle('bg-indigo-500/20');
};
window.removeFile = i => { selectedFilesData.splice(i, 1); renderUI(); };

// ── Build FormData ─────────────────────────────────────────────
function buildFormData(filesArr) {
    const fd = new FormData(imageForm);
    fd.delete('files');
    for (const d of filesArr) fd.append('files', d.file);

    const perFileSettings = [];
    filesArr.forEach((d, j) => {
        if (Object.keys(d.settings).length) perFileSettings.push({ index: j, ...d.settings });
    });
    fd.set('individualSettings', JSON.stringify(perFileSettings));
    return fd;
}

// ── Sequential processing (per-file with progress) ─────────────
imageForm.onsubmit = async function(e) {
    e.preventDefault();
    if (!selectedFilesData.length) { alert('Hàng đợi trống.'); return; }

    setLoading(true);
    resultInfo.classList.add('hidden');
    statsCard.classList.add('hidden');
    progressContainer.classList.remove('hidden');

    // Reset status indicators
    selectedFilesData.forEach((d, i) => {
        d.optimizedSize = null;
        const st = document.getElementById('status-' + i);
        if (st) st.classList.add('hidden');
        const dl = document.getElementById('dl-' + i);
        if (dl) dl.classList.add('hidden');
    });

    // Process one file at a time
    let allBlobs = [];
    let allMeta  = [];
    for (let i = 0; i < selectedFilesData.length; i++) {
        const pct = Math.round((i / selectedFilesData.length) * 100);
        progressBar.style.width = pct + '%';
        progressCount.textContent = `${i}/${selectedFilesData.length}`;
        loadingProgressText.textContent = `File ${i+1}/${selectedFilesData.length}: ${selectedFilesData[i].file.name}`;

        try {
            const fd = buildFormData([selectedFilesData[i]]);
            const res = await fetch('/image-tool', { method:'POST', body: fd });
            if (!res.ok) throw new Error(await res.text());

            const metaStr = res.headers.get('X-Optimized-Metadata');
            let metaArr = [];
            try { metaArr = JSON.parse(metaStr || '[]'); } catch {}

            const blob = await res.blob();
            allBlobs.push(blob);
            if (metaArr[0]) {
                allMeta.push(metaArr[0]);
                selectedFilesData[i].optimizedSize = metaArr[0].size;
            }

            // Update row UI immediately
            const sizeInfo = document.getElementById('size-info-' + i);
            if (sizeInfo && metaArr[0]) {
                const orig = selectedFilesData[i].file.size;
                const opt  = metaArr[0].size;
                const sav  = Math.round((1 - opt/orig)*100);
                const fmt  = v => v >= 1048576 ? (v/1048576).toFixed(1)+' MB' : (v/1024).toFixed(1)+' KB';
                sizeInfo.className = 'text-xs font-black mt-0.5 italic flex items-center gap-1.5';
                sizeInfo.innerHTML = `<span class="text-white/40">${fmt(orig)}</span><span class="text-white/20">→</span><span class="text-indigo-400">${fmt(opt)}</span><span class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] border border-emerald-500/10">-${sav}%</span>`;
            }
            const st = document.getElementById('status-' + i);
            if (st) st.classList.remove('hidden');
        } catch(err) {
            console.error('Error processing file', i, err);
        }
    }

    progressBar.style.width = '100%';
    progressCount.textContent = `${selectedFilesData.length}/${selectedFilesData.length}`;

    // If multiple files, request ZIP from server with all original files
    let finalBlobUrl = '';
    let finalFileName = '';
    if (selectedFilesData.length === 1 && allBlobs[0]) {
        finalBlobUrl = URL.createObjectURL(allBlobs[0]);
        const ext = allMeta[0]?.name?.split('.').pop() || '';
        finalFileName = `toi_uu_${selectedFilesData[0].file.name.replace(/\.[^.]+$/, '')}.${ext}`;
    } else if (selectedFilesData.length > 1) {
        // Ask server to zip all at once
        try {
            const fd = buildFormData(selectedFilesData);
            const res = await fetch('/image-tool', { method:'POST', body: fd });
            if (res.ok) {
                const zipBlob = await res.blob();
                finalBlobUrl = URL.createObjectURL(zipBlob);
                finalFileName = 'ket_qua_toi_uu.zip';
            }
        } catch {}
    }

    // Show individual download buttons
    selectedFilesData.forEach((d, i) => {
        const dl = document.getElementById('dl-' + i);
        if (dl) dl.classList.remove('hidden');
    });

    // Update per-blob individual download data
    allBlobs.forEach((blob, i) => {
        selectedFilesData[i]._blob = blob;
        selectedFilesData[i]._meta = allMeta[i];
    });

    // Stats
    updateStats();

    // Final download button
    if (finalBlobUrl) {
        finalDownloadBtn.href = finalBlobUrl;
        finalDownloadBtn.download = finalFileName;
        setTimeout(() => URL.revokeObjectURL(finalBlobUrl), 120000);
    }
    resultInfo.classList.remove('hidden');
    resultInfo.scrollIntoView({ behavior: 'smooth' });
    setLoading(false);
};

// ── Stats ──────────────────────────────────────────────────────
function updateStats() {
    const processed = selectedFilesData.filter(d => d.optimizedSize != null);
    if (!processed.length) return;

    const totalOrig = processed.reduce((s, d) => s + d.file.size, 0);
    const totalOpt  = processed.reduce((s, d) => s + d.optimizedSize, 0);
    const savings   = Math.round((1 - totalOpt / totalOrig) * 100);
    const fmt = v => v >= 1048576 ? (v/1048576).toFixed(1)+' MB' : (v/1024).toFixed(0)+' KB';

    document.getElementById('statsFiles').textContent    = processed.length;
    document.getElementById('statsSavings').textContent  = savings + '%';
    document.getElementById('statsOriginal').textContent = fmt(totalOrig);
    document.getElementById('statsOptimized').textContent = fmt(totalOpt);
    statsCard.classList.remove('hidden');
}

// ── Individual Download ────────────────────────────────────────
window.downloadIndividual = async function(i) {
    const data = selectedFilesData[i];
    if (!data) return;

    // Use cached blob if available
    if (data._blob) {
        const url = URL.createObjectURL(data._blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data._meta?.name || `toi_uu_${data.file.name}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        return;
    }

    showGlobalLoading(true, 'Đang xử lý...');
    try {
        const fd = buildFormData([data]);
        const res = await fetch('/image-tool', { method:'POST', body: fd });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `toi_uu_${data.file.name}`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch(err) { alert(err.message); }
    finally { showGlobalLoading(false); }
};

// ── Preview Modal ──────────────────────────────────────────────
window.showPreviewModal = async function(i) {
    const data = selectedFilesData[i];
    if (!data) return;

    const modal       = document.getElementById('previewModal');
    const origImg     = document.getElementById('previewOriginal');
    const optImg      = document.getElementById('previewOptimized');
    const origInfo    = document.getElementById('previewOriginalInfo');
    const optInfo     = document.getElementById('previewOptimizedInfo');
    const savingsBar  = document.getElementById('previewSavingsBar');
    const savingsBadge= document.getElementById('previewSavingsBadge');

    origImg.src = data.thumbnail || '';
    optImg.src  = '';
    const fmt = v => v >= 1048576 ? (v/1048576).toFixed(1)+' MB' : (v/1024).toFixed(1)+' KB';
    origInfo.textContent = `${fmt(data.file.size)} · Gốc`;
    optInfo.textContent  = 'Đang xử lý...';
    savingsBar.classList.add('hidden');
    modal.classList.remove('hidden');

    // Fetch processed preview
    try {
        const fd = buildFormData([data]);
        const res = await fetch('/image-tool', { method:'POST', body: fd });
        if (!res.ok) throw new Error(await res.text());
        const metaStr = res.headers.get('X-Optimized-Metadata');
        let meta = [];
        try { meta = JSON.parse(metaStr || '[]'); } catch {}
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        optImg.src = url;
        if (meta[0]) {
            const sav = Math.round((1 - meta[0].size / data.file.size) * 100);
            optInfo.textContent = `${fmt(meta[0].size)} · ${meta[0].name}`;
            savingsBadge.textContent = `${sav}% nhỏ hơn · Tiết kiệm ${fmt(data.file.size - meta[0].size)}`;
            savingsBar.classList.remove('hidden');
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch(err) { optInfo.textContent = 'Lỗi: ' + err.message; }
};

window.closePreviewModal = function() {
    document.getElementById('previewModal').classList.add('hidden');
};

// ── Photopea Integration (Gỗ bỏ do yêu cầu độc lập) ────────────
// window.openPhotopea = ... (đã xóa)

// ── URL Processing ─────────────────────────────────────────────
window.processFromUrl = async function() {
    const url       = document.getElementById('urlInput').value.trim();
    const quality   = document.getElementById('urlQuality').value;
    const format    = document.getElementById('urlFormat').value;
    const maxWidth  = document.getElementById('urlMaxWidth').value;
    const blur      = document.getElementById('urlBlur').value;
    const removeBg  = document.getElementById('urlRemoveBg').checked;

    if (!url) { alert('Vui lòng nhập URL.'); return; }

    const btn    = document.getElementById('urlProcessBtn');
    const loading= document.getElementById('urlLoading');
    const btext  = document.getElementById('urlBtnText');
    const result = document.getElementById('urlResult');
    const dlLink = document.getElementById('urlDownloadLink');

    btn.disabled = true; loading.classList.remove('hidden'); btext.textContent = 'Đang tải...';
    result.classList.add('hidden');

    try {
        const fd = new FormData();
        fd.set('url', url); fd.set('quality', quality);
        if (format) fd.set('format', format);
        if (maxWidth) fd.set('maxWidth', maxWidth);
        if (blur > 0) fd.set('blur', blur);
        if (removeBg) fd.set('removeBg', 'true');

        const res = await fetch('/image-tool/from-url', { method:'POST', body: fd });
        if (!res.ok) throw new Error(await res.text());

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const cd = res.headers.get('Content-Disposition') || '';
        const name = cd.match(/filename="([^"]+)"/)?.[1] || 'optimized.webp';
        dlLink.href = blobUrl; dlLink.download = name;
        const meta = JSON.parse(res.headers.get('X-Optimized-Metadata') || '[]');
        if (meta[0]) dlLink.textContent = `⬇ ${name} (${(meta[0].size/1024).toFixed(0)} KB)`;
        result.classList.remove('hidden');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
    } catch(err) { alert('Lỗi: ' + err.message); }
    finally { btn.disabled = false; loading.classList.add('hidden'); btext.textContent = 'Tải & Xử Lý'; }
};

// ── Presets ────────────────────────────────────────────────────
function getGlobalSettings() {
    return {
        quality:   document.getElementById('quality').value,
        format:    document.getElementById('format').value,
        maxWidth:  document.getElementById('maxWidth').value,
        maxHeight: document.getElementById('maxHeight').value,
        resizeFit: document.getElementById('resizeFit').value,
        background:document.getElementById('backgroundHex').value,
        rotate:    document.getElementById('rotate').value,
        flipH:     document.getElementById('flipH').checked,
        flipV:     document.getElementById('flipV').checked,
        brightness:document.getElementById('brightness').value,
        saturation:document.getElementById('saturation').value,
        hue:       document.getElementById('hue').value,
        grayscale: document.getElementById('grayscale').checked,
        blur:      document.getElementById('blur').value,
        sharpen:   document.getElementById('sharpen').checked,
        stripExif: document.getElementById('stripExif').checked,
        removeBg:  document.getElementById('removeBg').checked,
        outputPrefix: document.getElementById('outputPrefix').value,
        outputSuffix: document.getElementById('outputSuffix').value,
    };
}

function applyGlobalSettings(s) {
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
    setVal('quality',    s.quality);    document.getElementById('qualityValue').textContent = s.quality;
    setVal('format',     s.format);
    setVal('maxWidth',   s.maxWidth);    setVal('maxHeight',  s.maxHeight);
    setVal('resizeFit',  s.resizeFit);
    setVal('backgroundHex', s.background); setVal('background', s.background);
    setVal('rotate',     s.rotate);
    setChk('flipH',      s.flipH);      setChk('flipV',      s.flipV);
    setVal('brightness', s.brightness); document.getElementById('brightnessValue').textContent = s.brightness;
    setVal('saturation', s.saturation); document.getElementById('saturationValue').textContent = s.saturation;
    setVal('hue',        s.hue);        document.getElementById('hueValue').textContent = s.hue;
    setChk('grayscale',  s.grayscale);
    setVal('blur',       s.blur);       document.getElementById('blurValue').textContent = s.blur;
    setChk('sharpen',    s.sharpen);    setChk('stripExif',  s.stripExif);
    setChk('removeBg',   s.removeBg);
    setVal('outputPrefix', s.outputPrefix); setVal('outputSuffix', s.outputSuffix);
    // Sync range pct CSS vars
    const q = document.getElementById('quality');
    q.style.setProperty('--range-pct', q.value + '%');
}

window.savePreset = function() {
    const name = document.getElementById('presetName').value.trim();
    if (!name) { alert('Nhập tên preset.'); return; }
    const presets = JSON.parse(localStorage.getItem('img-tool-presets') || '{}');
    presets[name] = getGlobalSettings();
    localStorage.setItem('img-tool-presets', JSON.stringify(presets));
    renderPresets();
    document.getElementById('presetName').value = '';
};

function renderPresets() {
    const list = document.getElementById('presetList');
    const presets = JSON.parse(localStorage.getItem('img-tool-presets') || '{}');
    list.innerHTML = '';
    Object.keys(presets).forEach(name => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2';
        row.innerHTML = `
        <button type="button" onclick="loadPreset('${name}')"
            class="flex-1 text-left px-3 py-2 rounded-xl bg-white/3 hover:bg-indigo-500/10 text-slate-400 hover:text-indigo-300 text-[10px] font-bold uppercase tracking-widest transition-all">${name}</button>
        <button type="button" onclick="deletePreset('${name}')"
            class="p-1.5 text-slate-700 hover:text-rose-500 transition-colors">✕</button>`;
        list.appendChild(row);
    });
}

window.loadPreset = function(name) {
    const presets = JSON.parse(localStorage.getItem('img-tool-presets') || '{}');
    if (presets[name]) applyGlobalSettings(presets[name]);
};
window.deletePreset = function(name) {
    const presets = JSON.parse(localStorage.getItem('img-tool-presets') || '{}');
    delete presets[name];
    localStorage.setItem('img-tool-presets', JSON.stringify(presets));
    renderPresets();
};

// ── Loading ────────────────────────────────────────────────────
function showGlobalLoading(show, text='Đang xử lý...') {
    globalLoading.classList.toggle('hidden', !show);
    loadingProgressText.textContent = text;
}

function setLoading(on) {
    processBtn.disabled = on;
    btnText.textContent  = on ? 'Đang Xử Lý...' : 'Bắt Đầu Xử Lý';
    loadingScanner.classList.toggle('hidden', !on);
    processBtn.classList.toggle('opacity-70', !on);
    showGlobalLoading(on);
    if (!on) progressContainer.classList.add('hidden');
}

// ── Reset ──────────────────────────────────────────────────────
function clearSession() {
    selectedFilesData = [];
    renderUI();
    resultInfo.classList.add('hidden');
    statsCard.classList.add('hidden');
    progressContainer.classList.add('hidden');
    if (fileInput) fileInput.value = '';
}

clearAllBtn.onclick = clearSession;
if (resetBtn) resetBtn.onclick = clearSession;

// ── Init ───────────────────────────────────────────────────────
renderPresets();
