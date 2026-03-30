(function() {
    const iframe = document.getElementById('photopea-iframe');
    const loadingOverlay = document.getElementById('pp-loading');
    const landingScreen = document.getElementById('landing-screen');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    let currentFile = null;
    let isPPReady = false;

    // 1. Check for data from sessionStorage (optional integration fallback)
    const storedData = sessionStorage.getItem('pp_edit_file');
    if (storedData) {
        processInitialData(storedData);
    }

    async function processInitialData(dataUrl) {
        const name = sessionStorage.getItem('pp_edit_name') || 'image.png';
        const res = await fetch(dataUrl);
        const buffer = await res.arrayBuffer();
        currentFile = { buffer, name };
        startPhotopea();
    }

    // 2. Event Listeners for standalone mode
    fileInput.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    };

    dropZone.ondragleave = () => {
        dropZone.classList.remove('dragover');
    };

    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    async function handleFile(file) {
        const buffer = await file.arrayBuffer();
        currentFile = { buffer, name: file.name };
        startPhotopea();
    }

    // New: Start blank
    window.startBlank = function() {
        currentFile = null;
        startPhotopea();
    };

    function startPhotopea() {
        loadingOverlay.classList.remove('hidden');
        
        const ppConfig = {
            "environment": {
                "lang": "vi",
                "theme": 1,
                "v_tools": true,
                "v_menu": true,
                "v_layers": true,
                "v_properties": true,
                "p_ads": false, // Cố gắng ẩn quảng cáo
                "p_layers": true,
                "p_history": true
            },
            "export": true
        };

        const ppUrl = `https://www.photopea.com#${encodeURIComponent(JSON.stringify(ppConfig))}`;
        iframe.src = ppUrl;
        iframe.classList.remove('invisible');
    }

    // 3. PostMessage Handler
    window.addEventListener('message', async (e) => {
        if (e.data === "done") {
            isPPReady = true;
            loadingOverlay.classList.add('hidden');
            landingScreen.style.display = 'none'; // Hide landing completely
            
            if (currentFile) {
                iframe.contentWindow.postMessage(currentFile.buffer, "*");
                currentFile = null; // Clear to prevent re-sending
            }
        } else if (e.data instanceof ArrayBuffer) {
            downloadBuffer(e.data, sessionStorage.getItem('pp_edit_name') || 'edited_image.png');
        }
    });

    window.triggerExport = function() {
        if (!isPPReady) {
            alert('Trình sửa ảnh chưa sẵn sàng!');
            return;
        }
        const script = `app.activeDocument.saveToOE("png");`; // Default to png for quality
        iframe.contentWindow.postMessage(script, "*");
    };

    function downloadBuffer(buffer, name) {
        const blob = new Blob([buffer], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `photo_editor_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    // Clear session storage once loaded to avoid re-opening on refresh
    window.onbeforeunload = () => {
        sessionStorage.removeItem('pp_edit_file');
        sessionStorage.removeItem('pp_edit_name');
        sessionStorage.removeItem('pp_edit_type');
    };

})();
