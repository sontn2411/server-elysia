(function() {
    const iframe = document.getElementById('photopea-iframe');
    const loadingOverlay = document.getElementById('pp-loading');
    const landingScreen = document.getElementById('landing-screen');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    let currentFile = null;
    let isPPReady = false;

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
            alert("Không thể nạp ảnh từ phiên trước.");
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
            alert("Lỗi khi mở file hình ảnh này.");
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
            alert('Trình sửa ảnh đang khởi tạo, vui lòng đợi giây lát!');
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
