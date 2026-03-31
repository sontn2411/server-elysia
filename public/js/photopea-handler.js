(function() {
    const iframe = document.getElementById('photopea-iframe');
    const loadingOverlay = document.getElementById('pp-loading');
    const landingScreen = document.getElementById('landing-screen');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    let currentFile = null;
    let isPPReady = false;

    // ── Toast Logic ────────────────────────────────────────────
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        let icon = '';
        if (type === 'success') icon = '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
        else if (type === 'error') icon = '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
        else if (type === 'warning') icon = '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
        else icon = '<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

        toast.innerHTML = `${icon}<span class="toast-msg">${message}</span>`;
        container.appendChild(toast);

        const timer = setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, 4000);

        toast.onclick = () => {
            clearTimeout(timer);
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        };
    }

    // ── Pre-defined Config for performance ─────────────────────
    const PP_CONFIG = {
        "environment": {
            "lang": "vi",
            "theme": 1,
            "v_tools": true,
            "v_menu": true,
            "v_layers": true,
            "v_properties": true,
            "p_ads": false,
            "p_layers": true,
            "p_history": true
        },
        "export": true
    };

    // ── Initial Data Intake (from Image Tool) ──────────────────
    try {
        const storedData = sessionStorage.getItem('pp_edit_file');
        if (storedData) {
            processInitialData(storedData);
            // Clear immediately after intake to prevent re-load on refreshes
            sessionStorage.removeItem('pp_edit_file');
        }
    } catch (err) {
        console.error("Lỗi khi đọc dữ liệu lưu trữ:", err);
    }

    async function processInitialData(dataUrl) {
        try {
            const name = sessionStorage.getItem('pp_edit_name') || 'image.png';
            const res = await fetch(dataUrl);
            const buffer = await res.arrayBuffer();
            currentFile = { buffer, name };
            startPhotopea();
        } catch (err) {
            console.error("Lỗi khi nạp ảnh ban đầu:", err);
            showToast("Không thể nạp ảnh từ phiên trước.", "error");
        }
    }

    // ── Event Listeners (Standalone Mode) ──────────────────────
    fileInput.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('border-indigo-500', 'bg-indigo-500/5');
    };

    dropZone.ondragleave = () => {
        dropZone.classList.remove('border-indigo-500', 'bg-indigo-500/5');
    };

    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-indigo-500', 'bg-indigo-500/5');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    async function handleFile(file) {
        try {
            const buffer = await file.arrayBuffer();
            currentFile = { buffer, name: file.name };
            startPhotopea();
        } catch (err) {
            console.error("Lỗi khi đọc file:", err);
            showToast("Lỗi khi mở file hình ảnh này.", "error");
        }
    }

    window.startBlank = function() {
        currentFile = null;
        startPhotopea();
    };

    function startPhotopea() {
        loadingOverlay.classList.remove('hidden');
        const ppUrl = `https://www.photopea.com#${encodeURIComponent(JSON.stringify(PP_CONFIG))}`;
        iframe.src = ppUrl;
        iframe.classList.remove('invisible');
    }

    // ── PostMessage Communication ──────────────────────────────
    window.addEventListener('message', async (e) => {
        // Safe check for origin if needed (Photopea uses *)
        
        if (e.data === "done") {
            isPPReady = true;
            loadingOverlay.classList.add('hidden');
            landingScreen.style.display = 'none'; // Hide landing
            
            if (currentFile) {
                iframe.contentWindow.postMessage(currentFile.buffer, "*");
                currentFile = null; // Memory management: Clear reference
            }
        } else if (e.data instanceof ArrayBuffer) {
            downloadBuffer(e.data, "photo_" + Date.now() + ".png");
        }
    });

    window.triggerExport = function() {
        if (!isPPReady) {
            showToast('Trình sửa ảnh đang khởi tạo, vui lòng đợi giây lát!', 'warning');
            return;
        }
        // Tell Photopea to send result back as binary
        iframe.contentWindow.postMessage('app.activeDocument.saveToOE("png");', "*");
    };

    function downloadBuffer(buffer, name) {
        const blob = new Blob([buffer], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        
        // Immediate cleanup to free memory
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100); 
    }

    // Comprehensive Cleanup
    window.onbeforeunload = () => {
        sessionStorage.removeItem('pp_edit_file');
        sessionStorage.removeItem('pp_edit_name');
        sessionStorage.removeItem('pp_edit_type');
    };

})();
