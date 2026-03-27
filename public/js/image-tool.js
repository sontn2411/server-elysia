const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const previewContainer = document.getElementById('previewContainer');
const fileCountTxt = document.getElementById('fileCount');
const qualitySlider = document.getElementById('quality');
const qualityValue = document.getElementById('qualityValue');
const processBtn = document.getElementById('processBtn');
const btnText = document.getElementById('btnText');
const loadingScanner = document.getElementById('loadingScanner');
const resultInfo = document.getElementById('resultInfo');
const downloadLink = document.getElementById('downloadLink');
const clearAllBtn = document.getElementById('clearAll');

let selectedFilesData = [];

qualitySlider.oninput = function () {
    qualityValue.textContent = qualitySlider.value;
    qualitySlider.style.setProperty('--range-pct', qualitySlider.value + '%');
};

dropZone.ondragover = function (e) { e.preventDefault(); dropZone.classList.add('dragover'); };
dropZone.ondragleave = function () { dropZone.classList.remove('dragover'); };
dropZone.ondrop = function (e) { e.preventDefault(); dropZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); };
fileInput.onchange = function (e) { handleFiles(e.target.files); };

function handleFiles(files) {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        selectedFilesData.push({ file: file, settings: { quality: null, format: null, maxWidth: null } });
    }
    updateUI();
}

function updateUI() {
    fileList.innerHTML = '';
    fileCountTxt.textContent = selectedFilesData.length;
    if (selectedFilesData.length > 0) {
        previewContainer.classList.remove('hidden');
    } else {
        previewContainer.classList.add('hidden');
    }

    selectedFilesData.forEach(function (data, index) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const row = document.createElement('div');
            row.className = 'list-row rounded-3xl p-4 lg:p-5 transition-all';
            row.innerHTML = ' \
                <div class="flex items-center gap-4 lg:gap-6 relative"> \
                    <div id="status-' + index + '" class="hidden absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-emerald-500/90 text-white flex items-center justify-center z-20 shadow-[0_0_10px_rgba(16,185,129,0.5)] anim-in zoom-in duration-300 border border-emerald-400/20"> \
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></path></svg> \
                    </div> \
                    <div class="w-14 h-14 rounded-xl overflow-hidden glass flex-shrink-0 border border-white/5 shadow-lg relative"> \
                        <img src="' + e.target.result + '" class="w-full h-full object-cover"> \
                    </div> \
                    <div class="flex-1 min-w-0 pr-2"> \
                        <div class="text-xs font-bold text-white/90 truncate">' + data.file.name + '</div> \
                        <div id="size-info-' + index + '" class="text-xs font-black text-slate-600 uppercase tracking-normal mt-1 italic">' + (data.file.size / 1024).toFixed(0) + ' KB &bull; Đã Chọn</div> \
                    </div> \
                    <div class="flex items-center gap-2"> \
                        <button id="dl-' + index + '" type="button" onclick="downloadIndividual(' + index + ')" class="hidden p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all border border-emerald-500/10" title="Tải xuống bản này"> \
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg> \
                        </button> \
                        <button type="button" onclick="toggleRowSettings(' + index + ', this)" class="p-2.5 rounded-xl bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-400 transition-all border border-indigo-500/10"> \
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" stroke-width="2"></path></svg> \
                        </button> \
                        <button type="button" onclick="removeFile(' + index + ')" class="p-2.5 rounded-xl bg-rose-500/5 hover:bg-rose-500/10 text-rose-500/60 hover:text-rose-500 transition-all border border-rose-500/10"> \
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-width="2" stroke-linecap="round"></path></svg> \
                        </button> \
                    </div> \
                </div> \
                <div id="row-settings-' + index + '" class="settings-expand"> \
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4"> \
                        <div class="field-group"> \
                            <label class="field-label accent">Ghi Đè Chất Lượng</label> \
                            <input type="number" min="1" max="100" \
                                onchange="updateIndividualSetting(' + index + ', \'quality\', this.value)" \
                                placeholder="Mặc định (' + qualitySlider.value + '%)" \
                                class="pro-input" \
                                value="' + (data.settings.quality || '') + '"> \
                        </div> \
                        <div class="field-group"> \
                            <label class="field-label accent">Định Dạng Riêng</label> \
                            <select onchange="updateIndividualSetting(' + index + ', \'format\', this.value)" class="pro-select"> \
                                <option value="" ' + (!data.settings.format ? "selected" : "") + '>— Theo mặc định —</option> \
                                <option value="jpeg" ' + (data.settings.format === "jpeg" ? "selected" : "") + '>JPEG</option> \
                                <option value="png" ' + (data.settings.format === "png" ? "selected" : "") + '>PNG</option> \
                                <option value="webp" ' + (data.settings.format === "webp" ? "selected" : "") + '>WebP</option> \
                                <option value="avif" ' + (data.settings.format === "avif" ? "selected" : "") + '>AVIF</option> \
                            </select> \
                        </div> \
                        <div class="field-group"> \
                            <label class="field-label accent">Rộng Tối Đa (px)</label> \
                            <input type="number" \
                                onchange="updateIndividualSetting(' + index + ', \'maxWidth\', this.value)" \
                                placeholder="Tự động — kích cỡ gốc" \
                                class="pro-input" \
                                value="' + (data.settings.maxWidth || '') + '"> \
                        </div> \
                    </div> \
                </div> \
            ';
            fileList.appendChild(row);
        };
        reader.readAsDataURL(data.file);
    });
}

window.toggleRowSettings = function (index, btn) {
    const el = document.getElementById('row-settings-' + index);
    if (el) {
        el.classList.toggle('show');
        btn.classList.toggle('bg-indigo-500/20');
        btn.classList.toggle('text-white');
    }
};

window.updateIndividualSetting = function (index, key, value) {
    if (value === '' || value === null) {
        selectedFilesData[index].settings[key] = null;
    } else {
        selectedFilesData[index].settings[key] = key === 'format' ? value : parseInt(value);
    }
};

window.removeFile = function (index) {
    selectedFilesData.splice(index, 1);
    updateUI();
};

window.downloadIndividual = function (index) {
    const data = selectedFilesData[index];
    if (!data) return;

    showGlobalLoading(true);
    const formData = new FormData();
    formData.append('files', data.file);

    const quality = data.settings.quality || qualitySlider.value;
    const formatSelection = document.getElementById('format').value;
    const format = data.settings.format || formatSelection;
    const maxWidth = data.settings.maxWidth || document.getElementById('maxWidth').value;

    formData.set('quality', quality);
    formData.set('format', format);
    if (maxWidth) formData.set('maxWidth', maxWidth);

    fetch('/image-tool', {
        method: 'POST',
        body: formData
    }).then(function (res) {
        if (!res.ok) throw new Error('Lỗi xử lý file');

        const metaStr = res.headers.get('X-Optimized-Metadata');
        if (metaStr) {
            try {
                const meta = JSON.parse(metaStr);
                updateRowSizeUI(index, meta[0].size);
            } catch (e) { }
        }

        return res.blob();
    }).then(function (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'toi_uu_' + data.file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }).catch(function (err) {
        alert(err.message);
    }).finally(function () {
        showGlobalLoading(false);
    });
};

function updateRowSizeUI(index, optimizedSize) {
    const data = selectedFilesData[index];
    const originalSize = data.file.size;
    const sizeInfo = document.getElementById('size-info-' + index);
    const statusTag = document.getElementById('status-' + index);

    if (sizeInfo) {
        const savings = Math.round((1 - optimizedSize / originalSize) * 100);
        sizeInfo.className = "text-xs font-black tracking-normal mt-1 italic flex items-center gap-1.5";
        sizeInfo.innerHTML = ' \
            <span class="text-white/40">' + (originalSize / 1024).toFixed(1) + 'KB</span> \
            <span class="text-white/20">→</span> \
            <span class="text-indigo-400 font-bold">' + (optimizedSize / 1024).toFixed(1) + 'KB</span> \
            <span class="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[9px] border border-emerald-500/10">-' + savings + '%</span> \
        ';
    }
    if (statusTag) statusTag.classList.remove('hidden');
}

function clearSession() {
    selectedFilesData = [];
    updateUI();
    resultInfo.classList.add('hidden');
    if (fileInput) fileInput.value = '';
}

clearAllBtn.onclick = clearSession;

const imageForm = document.getElementById('imageForm');
const globalLoading = document.getElementById('globalLoading');
const finalDownloadBtn = document.getElementById('finalDownloadBtn');
const resetBtn = document.getElementById('resetBtn');

if (resetBtn) resetBtn.onclick = clearSession;

imageForm.onsubmit = function (e) {
    e.preventDefault();
    if (selectedFilesData.length === 0) {
        alert('Hàng đợi đang trống.');
        return;
    }

    showGlobalLoading(true);
    resultInfo.classList.add('hidden');

    for (let i = 0; i < selectedFilesData.length; i++) {
        const tag = document.getElementById('status-' + i);
        if (tag) tag.classList.add('hidden');
        const dlBtn = document.getElementById('dl-' + i);
        if (dlBtn) dlBtn.classList.add('hidden');
    }

    const formData = new FormData(imageForm);
    const settingsList = [];
    for (let j = 0; j < selectedFilesData.length; j++) {
        const s = selectedFilesData[j].settings;
        if (s.quality || s.format || s.maxWidth) {
            settingsList.push({ index: j, quality: s.quality, format: s.format, maxWidth: s.maxWidth });
        }
    }

    formData.set('individualSettings', JSON.stringify(settingsList));
    formData.delete('files');
    for (let k = 0; k < selectedFilesData.length; k++) {
        formData.append('files', selectedFilesData[k].file);
    }

    fetch('/image-tool', {
        method: 'POST',
        body: formData
    }).then(function (response) {
        if (!response.ok) throw new Error('Có lỗi xảy ra trong quá trình xử lý.');

        const metaStr = response.headers.get('X-Optimized-Metadata');
        if (metaStr) {
            try {
                const metaList = JSON.parse(metaStr);
                metaList.forEach(function (meta, idx) {
                    updateRowSizeUI(idx, meta.size);
                });
            } catch (e) { }
        }

        return response.blob();
    }).then(function (blob) {
        const url = URL.createObjectURL(blob);
        for (let l = 0; l < selectedFilesData.length; l++) {
            const dlBtn = document.getElementById('dl-' + l);
            if (dlBtn) dlBtn.classList.remove('hidden');
        }

        finalDownloadBtn.href = url;
        const isBatch = selectedFilesData.length > 1;
        const fileName = isBatch ? 'ket_qua_toi_uu.zip' : 'toi_uu_' + selectedFilesData[0].file.name;
        finalDownloadBtn.download = fileName;

        resultInfo.classList.remove('hidden');
        resultInfo.scrollIntoView({ behavior: 'smooth' });
    }).catch(function (error) {
        alert('Lỗi: ' + error.message);
    }).finally(function () {
        showGlobalLoading(false);
    });
};

function showGlobalLoading(show) {
    if (globalLoading) {
        globalLoading.classList.toggle('hidden', !show);
    }
}

function setLoading(isLoading) {
    if (processBtn) {
        processBtn.disabled = isLoading;
        btnText.textContent = isLoading ? 'Đang Xử Lý...' : 'Bắt Đầu Xử Lý';
        loadingScanner.classList.toggle('hidden', !isLoading);
        processBtn.classList.toggle('opacity-70', isLoading);
    }
}
