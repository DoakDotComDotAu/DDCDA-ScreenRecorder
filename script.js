const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const pauseBtn = document.getElementById('pauseBtn');
const preview = document.getElementById('preview');
const bitrateSel = document.getElementById('bitrate');
const fpsSel = document.getElementById('fps');
const sysAudio = document.getElementById('sysAudio');
const micAudio = document.getElementById('micAudio');
const statusEl = document.getElementById('status');
const sizeEl = document.getElementById('size');
const dl = document.getElementById('downloadLink');
const bar = document.getElementById('progressBar');
const timerEl = document.getElementById('timer');

let displayStream = null;
let micStream = null;
let mixedStream = null;
let mediaRecorder = null;
let chunks = [];
let timerInterval = null;
let startTime = 0;

function hhmmss(ms) {
    const total = Math.floor(ms / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    return `${m}:${s}`;
}

function setStatus(t) { statusEl.textContent = t; }

async function startCapture() {
    dl.hidden = true; dl.href = '#'; bar.style.width = '0%'; sizeEl.textContent = '0.0 MB';
    const wantSysAudio = sysAudio.checked;
    const wantMic = micAudio.checked;

    try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: parseInt(fpsSel.value) },
            audio: wantSysAudio
        });

        // Build audio pipeline
        let finalAudioTrack = null;
        if (wantSysAudio || wantMic) {
            const ac = new (window.AudioContext || window.webkitAudioContext)();
            const dest = ac.createMediaStreamDestination();

            if (wantSysAudio) {
                const sysTracks = displayStream.getAudioTracks();
                if (sysTracks.length) {
                    const sysSrc = ac.createMediaStreamSource(new MediaStream([sysTracks[0]]));
                    sysSrc.connect(dest);
                }
            }
            if (wantMic) {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
                const micSrc = ac.createMediaStreamSource(micStream);
                micSrc.connect(dest);
            }
            finalAudioTrack = dest.stream.getAudioTracks()[0] || null;
        }

// ---- WATERMARK INJECTION ----
const displayTrack = displayStream.getVideoTracks()[0];
const videoEl = document.createElement("video");
videoEl.srcObject = new MediaStream([displayTrack]);
videoEl.play();

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
canvas.width = 1280; // change to your recording resolution
canvas.height = 720;

function draw() {
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    // Draw background bar
    const barHeight = 40;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; // semi-transparent black
    ctx.fillRect(0, 0, canvas.width, barHeight);

    // Draw watermark text
    ctx.font = "24px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(">>> DDCDA Screen Recorder <<<", canvas.width / 2, 28);

    requestAnimationFrame(draw);
}
draw();

const canvasStream = canvas.captureStream(parseInt(fpsSel.value));
mixedStream = new MediaStream();
mixedStream.addTrack(canvasStream.getVideoTracks()[0]);
if (finalAudioTrack) mixedStream.addTrack(finalAudioTrack);
// ---- END WATERMARK INJECTION ----

        // Preview
        preview.srcObject = mixedStream;

        // Recorder
        const vbps = parseInt(bitrateSel.value) * 1000;
        let mime = 'video/webm;codecs=vp9,opus';
        if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';

        mediaRecorder = new MediaRecorder(mixedStream, {
            mimeType: mime,
            videoBitsPerSecond: vbps
        });

        chunks = [];
        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size) {
                chunks.push(e.data);
                const totalSize = chunks.reduce((a, c) => a + c.size, 0);
                sizeEl.textContent = (totalSize / (1024 * 1024)).toFixed(1) + ' MB';
                const w = parseFloat(bar.style.width) || 0;
                bar.style.width = ((w + 3) % 100) + '%';
            }
        };

        mediaRecorder.onstart = () => {
            setStatus('Recording');
            startBtn.disabled = true;
            stopBtn.disabled = false;
            pauseBtn.disabled = false;
            startTime = Date.now();
            timerInterval = setInterval(() => {
                timerEl.textContent = hhmmss(Date.now() - startTime);
            }, 200);
        };

        mediaRecorder.onpause = () => setStatus('Paused');
        mediaRecorder.onresume = () => setStatus('Recording');

        mediaRecorder.onstop = () => {
            clearInterval(timerInterval); timerInterval = null;
            timerEl.textContent = hhmmss(Date.now() - startTime);
            const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'video/webm' });
            const url = URL.createObjectURL(blob);
            dl.href = url; dl.hidden = false;
            if (preview.srcObject) preview.srcObject.getTracks().forEach(t => t.stop());
            preview.srcObject = null;
            setStatus('Saved');
            startBtn.disabled = false;
            stopBtn.disabled = true;
            pauseBtn.disabled = true;
            pauseBtn.textContent = 'Pause';
        };

        mediaRecorder.start(250);
        setStatus('Starting…');

    } catch (err) {
        console.error(err);
        alert('Failed to start capture: ' + err.message);
        cleanup();
    }
}

function pauseResume() {
    if (!mediaRecorder) return;
    if (mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
        pauseBtn.textContent = 'Resume';
    } else if (mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
        pauseBtn.textContent = 'Pause';
    }
}

function stopCapture() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    cleanupStreams();
}

function cleanupStreams() {
    const all = [displayStream, micStream];
    all.forEach(st => {
        if (st) { st.getTracks().forEach(t => t.stop()); }
    });
    displayStream = micStream = null;
}

function cleanup() {
    try { if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop(); } catch { }
    cleanupStreams();
    startBtn.disabled = false;
    stopBtn.disabled = true;
    pauseBtn.disabled = true;
    pauseBtn.textContent = 'Pause';
    setStatus('Idle');
    bar.style.width = '0%';
}

// function openPopup() {
//     let popup = window.open(
//         "index.html",
//         "popupWindow",
//         "width=570,height=651,menubar=no,toolbar=no,location=no,status=no,scrollbars=no,resizable=no"
//     );
// }

startBtn.addEventListener('click', startCapture);
stopBtn.addEventListener('click', stopCapture);
pauseBtn.addEventListener('click', pauseResume);
window.addEventListener('beforeunload', cleanup);
