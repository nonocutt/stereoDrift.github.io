// recorder.js

console.log("recorder.js loaded");

// Get references to UI elements and global variables
const recordButton = document.getElementById("recordButton");
const stopButton = document.getElementById("stopRecordingButton");
const canvas = captureCanvas;           // Hidden canvas used for video capture
const svgElement = mainSvg;            // Main SVG element used for visualization
const audio = audioElement;            // Audio element containing music

let recorder;                          // MediaRecorder instance
let recordingChunks = [];              // Stores chunks of recorded data
let animationFrameId;                  // Frame ID for canceling animation loop
let recordingStopped = false;         // Tracks whether recording was stopped

// Record button handler
recordButton.addEventListener("click", () => {
    stopButton.disabled = false;
    recordButton.disabled = true;
    recordingStopped = false;
    console.log("Record button clicked");

    // Set canvas size to match SVG dimensions
    const width = svgElement.clientWidth;
    const height = svgElement.clientHeight;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    // Frame drawing loop that updates canvas with SVG visuals
    const drawFrame = () => {
        // Clone SVG to snapshot current state
        const clonedSvg = svgElement.cloneNode(true);
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(clonedSvg);
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();

        img.onload = () => {
            // Fill background with current theme color
            const bgColor = svgContainerDiv.style.backgroundColor || "#000000";
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw the SVG snapshot as image on canvas
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Clean up URL and schedule next frame
            URL.revokeObjectURL(url);
            animationFrameId = requestAnimationFrame(drawFrame);
        };

        img.src = url;
    };

    drawFrame(); // Start animation loop

    const canvasStream = canvas.captureStream(30); // Capture canvas at 30 FPS
    const audioDest = audioCtx.createMediaStreamDestination();

    // Create audio source if not already defined
    if (!audioSrc) {
        audioSrc = audioCtx.createMediaElementSource(audio);
    }
    audioSrc.connect(audioDest);

    // Combine canvas (video) and audio tracks into a single stream
    const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks()
    ]);

    // Set up MediaRecorder with combined stream
    recorder = new MediaRecorder(combinedStream);
    recordingChunks = [];

    // Push each recorded chunk into the array
    recorder.ondataavailable = e => recordingChunks.push(e.data);

    // Handle stop event: assemble video and prompt download
    recorder.onstop = () => {
        if (recordingStopped) return;
        recordingStopped = true;

        // Reset UI
        stopButton.disabled = true;
        recordButton.disabled = false;
        cancelAnimationFrame(animationFrameId);

        // Create video blob and download if not empty
        const blob = new Blob(recordingChunks, { type: 'video/webm' });
        console.log("Recording finished. Blob size:", blob.size);

        if (blob.size > 0) {
            const videoURL = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = videoURL;
            a.download = "visualizer_video.webm";
            a.click();
        } else {
            console.warn("Recording blob was empty.");
        }
    };

    console.log("🎥 Starting MediaRecorder...");
    recorder.start();    // Start recording
    audio.play();        // Start audio playback

    // Wait for valid audio duration before setting a timer
    const waitForDuration = () => {
        if (!isFinite(audio.duration) || audio.duration <= 0) {
            console.warn("Waiting for audio duration...");
            setTimeout(waitForDuration, 100);
            return;
        }

        const duration = audio.duration;
        console.log("⏱ Will stop in", duration.toFixed(2), "seconds");

        // Automatically stop recording when audio ends
        setTimeout(() => {
            if (!recordingStopped) {
                console.log("Auto-stopping after duration");
                recorder.stop();
                audio.pause();
                audio.currentTime = 0;
            }
        }, duration * 1000);
    };

    waitForDuration(); // Start polling for duration
});

// Manual stop handler for user interaction
stopButton.addEventListener("click", () => {
    if (recorder && recorder.state === "recording" && !recordingStopped) {
        console.log("Manually stopping recording");
        recorder.stop();
        audio.pause();
        audio.currentTime = 0;
    }

    stopButton.disabled = true;
    recordButton.disabled = false;
});