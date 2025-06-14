import { KokoroTTS } from "https://cdn.jsdelivr.net/npm/kokoro-js@1.1.1/dist/kokoro.web.js";
import {
  FilesetResolver,
  LlmInference,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai";
import FileProxyCache from "https://cdn.jsdelivr.net/gh/jasonmayes/web-ai-model-proxy-cache@main/FileProxyCache.min.js";

class HeartRateMonitor {
  constructor() {
    this.initElements();
    this.initState();
    this.addEventListeners();
    this.setupDebugPanel();
    this.startWebcam();
    this.setupSpeech();
    this.initLLM();
  }

  initElements() {
    this.connectBtn = document.querySelector(".connect-btn");
    this.startBtn = document.querySelector(".start-btn");
    this.stopBtn = document.querySelector(".stop-btn");
    this.bpmText = document.querySelector(".bpm");
    this.heartUI = document.querySelector(".heart");
    this.debugPanel = document.querySelector("#debug");
    this.video = document.querySelector("#webcam");

    // New speech control elements
    this.speechControls = document.createElement("div");
    this.speechControls.className = "speech-controls";

    this.holdToTalkBtn = document.createElement("button");
    this.holdToTalkBtn.textContent = "Hold to Talk";
    this.holdToTalkBtn.className = "hold-talk-btn";

    this.toggleTalkBtn = document.createElement("button");
    this.toggleTalkBtn.textContent = "Auto Listen: Off";
    this.toggleTalkBtn.className = "toggle-talk-btn";

    this.speechControls.appendChild(this.holdToTalkBtn);
    this.speechControls.appendChild(this.toggleTalkBtn);
    document.querySelector(".controls").appendChild(this.speechControls);

    // Debug toggle
    this.debugToggle = document.createElement("button");
    this.debugToggle.textContent = "Toggle Debug";
    this.debugToggle.className = "debug-toggle";
    document.body.appendChild(this.debugToggle);

    // Add loading modal
    this.loadingModal = document.createElement('div');
    this.loadingModal.className = 'loading-modal';
    this.loadingModal.innerHTML = `
      <div class="loading-content">
        <h3>Loading AI Model</h3>
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
        <p class="loading-status">Initializing...</p>
      </div>
    `;
    document.body.appendChild(this.loadingModal);
  }

  initState() {
    this.isAutoListening = false;
    this.isHoldingToTalk = false;
    this.conversation = [];

    // Initialize speech recognition
    window.SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new window.SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
  }

  async initLLM() {
    try {
      this.log("Initializing LLM...");
      const genai = await FilesetResolver.forGenAiTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-genai@latest/wasm"
      );

      // Use local then remote model file URLs
      const modelFileNameLocal = "http://localhost/gemma2-2b-it-gpu-int8.bin";
      const modelFileNameRemote =
        "https://storage.googleapis.com/jmstore/WebAIDemos/models/Gemma2/gemma2-2b-it-gpu-int8.bin";

      // Progress callback for model loading
      const fileProgressCallback = (status) => {
        this.log(status);
        
        // Show loading modal
        this.loadingModal.classList.add("visible");
        
        // Extract number from status if it's a string
        let progress = status;
        if (typeof status === "string") {
          const match = status.match(/(\d+(\.\d+)?)/);
          progress = match ? parseFloat(match[1]) : null;
        }
        
        // Update progress bar and status
        const progressFill = this.loadingModal.querySelector(".progress-fill");
        const statusText = this.loadingModal.querySelector(".loading-status");
        
        if (typeof progress === "number") {
          // Status is a percentage
          progressFill.style.width = `${progress}%`;
          statusText.textContent = `Loading model: ${Math.round(progress)}%`;
        } else {
          // Status is a message
          statusText.textContent = status;
        }
        
        // Hide modal when complete
        if (progress === 100) {
          setTimeout(() => {
            this.loadingModal.classList.remove('visible');
          }, 1000);
        }
      };

      // Try local file first, then remote if needed
      let dataUrl = await FileProxyCache.loadFromURL(
        modelFileNameLocal,
        fileProgressCallback
      );
      if (dataUrl === null) {
        dataUrl = await FileProxyCache.loadFromURL(
          modelFileNameRemote,
          fileProgressCallback
        );
      }

      this.log("Model downloaded. Initializing on GPU... Please wait.");

      this.llm = await LlmInference.createFromOptions(genai, {
        baseOptions: {
          modelAssetPath: dataUrl,
        },
        maxTokens: 8000,
        topK: 1,
        temperature: 0.01,
        randomSeed: 64,
      });

      this.log("LLM initialized successfully", "success");
    } catch (error) {
      this.log(`LLM initialization error: ${error.message}`, "error");
    }
  }

  setupSpeech() {
    this.recognition.addEventListener("result", (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0])
        .map((result) => result.transcript)
        .join("");

      if (event.results[0].isFinal) {
        this.log(`Speech detected: ${transcript}`);
        this.analyzeText(transcript);
      }
    });

    this.recognition.addEventListener("error", (event) => {
      this.log(`Speech recognition error: ${event.error}`, "error");
    });
  }

  async analyzeText(text) {
    try {
      const bpm = this.bpmText.textContent;
      if (!bpm || bpm === "--") return;

      // Updated prompt to force clean JSON response
      const prompt = `You are a speech coach AI. Analyze this real-time speaking performance. 
IMPORTANT: Respond ONLY with a valid JSON object, no markdown, no explanation, just the JSON.

Heart Rate: ${bpm} BPM
Speech Content: "${text}"

Required JSON structure:
{
  "summary": "Brief overall assessment",
  "confidence": {
    "score": 1-10,
    "feedback": "Confidence level feedback based on heart rate"
  },
  "clarity": {
    "score": 1-10,
    "feedback": "Speech clarity analysis"
  },
  "emotional_control": {
    "score": 1-10,
    "feedback": "Analysis of emotional state vs heart rate"
  },
  "engagement": {
    "score": 1-10,
    "feedback": "How engaging the speech was"
  },
  "improvements": ["specific action item 1", "specific action item 2"]
}`;

      this.log("Analyzing speech performance...");
      const analysis = await this.llm.generateResponse(prompt);

      // Clear previous error messages
      if (this.feedbackPanel) {
        this.feedbackPanel.classList.remove("error");
      }

      // Parse JSON from response (more robust cleanup)
      const cleanJson = analysis
        .replace(/```json\n?|\n?```/g, "") // Remove code blocks
        .replace(/^(?:json\s*)?\{/, "{") // Remove "json" prefix if present
        .replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/, "$1") // Extract just the JSON object
        .trim();

      console.log("Analysis: ");
      console.log(analysis);
      console.log("Clean JSON: ");
      console.log(cleanJson);

      const feedback = JSON.parse(cleanJson);

      // Update where we append the feedback panel
      if (!this.feedbackPanel) {
        this.feedbackPanel = document.createElement("div");
        this.feedbackPanel.className = "speech-coach-feedback";
        document.querySelector(".analysis").appendChild(this.feedbackPanel);
      }

      // Update feedback display with structured data
      this.feedbackPanel.innerHTML = `
        <h3>Speech Coach Feedback</h3>
        <p class="summary">${feedback.summary}</p>
        
        <div class="metrics">
          <div class="metric">
            <h4>Confidence (${feedback.confidence.score}/10)</h4>
            <div class="score-bar" style="width: ${
              feedback.confidence.score * 10
            }%"></div>
            <p>${feedback.confidence.feedback}</p>
          </div>
          <div class="metric">
            <h4>Clarity (${feedback.clarity.score}/10)</h4>
            <div class="score-bar" style="width: ${
              feedback.clarity.score * 10
            }%"></div>
            <p>${feedback.clarity.feedback}</p>
          </div>
          <div class="metric">
            <h4>Emotional Control (${feedback.emotional_control.score}/10)</h4>
            <div class="score-bar" style="width: ${
              feedback.emotional_control.score * 10
            }%"></div>
            <p>${feedback.emotional_control.feedback}</p>
          </div>
          <div class="metric">
            <h4>Engagement (${feedback.engagement.score}/10)</h4>
            <div class="score-bar" style="width: ${
              feedback.engagement.score * 10
            }%"></div>
            <p>${feedback.engagement.feedback}</p>
          </div>
        </div>

        <div class="improvements">
          <h4>Improvements:</h4>
          <ul>
            ${feedback.improvements.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        </div>
      `;

      // Add to conversation history
      this.conversation.push({
        text,
        bpm,
        feedback,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.log(`Analysis error: ${error.message}`, "error");

      // Show error in feedback panel
      if (this.feedbackPanel) {
        this.feedbackPanel.className = "speech-coach-feedback error";
        this.feedbackPanel.innerHTML = `
          <h3>Analysis Error</h3>
          <p>${error.message}</p>
        `;
      }
    }
  }

  startListening() {
    try {
      this.recognition.start();
      this.log("Started listening");
    } catch (error) {
      this.log(`Error starting speech recognition: ${error.message}`, "error");
    }
  }

  stopListening() {
    try {
      this.recognition.stop();
      this.log("Stopped listening");
    } catch (error) {
      this.log(`Error stopping speech recognition: ${error.message}`, "error");
    }
  }

  async startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: "user",
        },
      });
      this.video.srcObject = stream;
      this.log("Webcam started successfully", "success");
    } catch (error) {
      this.log(`Webcam error: ${error.message}`, "error");
    }
  }

  setupDebugPanel() {
    if (!this.debugPanel) {
      this.debugPanel = document.createElement("div");
      this.debugPanel.id = "debug";
      this.debugPanel.style.display = "none"; // Hidden by default
      document.body.appendChild(this.debugPanel);
    }
  }

  toggleDebug = () => {
    if (this.debugPanel) {
      this.debugPanel.style.display =
        this.debugPanel.style.display === "none" ? "block" : "none";
    }
  };

  log(message, type = "info") {
    console.log(message);
    const entry = document.createElement("div");
    entry.className = `debug-entry ${type}`;

    // Add heart rate color coding if message contains BPM
    if (message.includes("BPM")) {
      const bpm = parseInt(message.match(/\d+/)[0]);
      let color = "#ffffff"; // default white

      // Color ranges based on heart rate zones
      if (bpm < 60) color = "#3498db"; // Low - blue
      else if (bpm < 100) color = "#2ecc71"; // Normal - green
      else if (bpm < 120) color = "#f1c40f"; // Elevated - yellow
      else if (bpm < 140) color = "#e67e22"; // High - orange
      else color = "#e74c3c"; // Very high - red

      entry.style.color = color;
    }

    entry.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
    this.debugPanel.insertBefore(entry, this.debugPanel.firstChild);
  }

  async requestDevice() {
    try {
      this.log("Requesting Bluetooth device...");

      if (!navigator.bluetooth) {
        throw new Error("Bluetooth not supported");
      }

      // Use a more permissive device request
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ["heart_rate"] }], // Only show heart rate devices
        optionalServices: [
          "heart_rate",
          "generic_access",
          "generic_attribute",
          "device_information",
        ],
      });

      this.log(`Device selected: ${this.device.name}`);

      // Add more detailed connection state logging
      this.device.addEventListener("gattserverdisconnected", () => {
        this.log("Device disconnected - attempting to reconnect...", "error");
        // Wait a bit before trying to reconnect
        setTimeout(() => this.connectDevice(), 1000);
      });

      await this.connectDevice();
    } catch (error) {
      this.log(`Error selecting device: ${error.message}`, "error");
    }
  }

  async connectDevice() {
    try {
      if (!this.device) {
        throw new Error("No device selected");
      }

      this.log("Connecting to device GATT server...");

      // Disconnect first if already connected
      if (this.device.gatt.connected) {
        this.log("Disconnecting existing connection...");
        this.device.gatt.disconnect();
      }

      const server = await this.device.gatt.connect();
      this.log("GATT server connected");

      // Optional: Get device information
      try {
        const deviceService = await server.getPrimaryService(
          "device_information"
        );
        const manufacturer = await deviceService.getCharacteristic(
          "manufacturer_name_string"
        );
        const manufacturerValue = await manufacturer.readValue();
        this.log(
          `Manufacturer: ${new TextDecoder().decode(manufacturerValue)}`
        );
      } catch (e) {
        this.log("Could not read device information", "info");
      }

      this.log("Getting heart rate service...");
      const service = await server.getPrimaryService("heart_rate");
      this.log("Heart rate service found");

      this.log("Getting heart rate measurement characteristic...");
      this.heartRate = await service.getCharacteristic(
        "heart_rate_measurement"
      );
      this.log("Heart rate characteristic found");

      // Remove any existing event listeners to prevent duplicates
      this.heartRate.removeEventListener(
        "characteristicvaluechanged",
        this.handleRateChange
      );

      this.heartRate.addEventListener(
        "characteristicvaluechanged",
        this.handleRateChange
      );
      this.log("Event listener added");

      this.log("Connected successfully!", "success");
      this.startBtn.classList.remove("hide");
      this.stopBtn.classList.remove("hide");
      this.connectBtn.classList.add("hide");
    } catch (error) {
      this.log(`Connection error: ${error.message}`, "error");
      // If connection fails, show the connect button again
      this.startBtn.classList.add("hide");
      this.stopBtn.classList.add("hide");
      this.connectBtn.classList.remove("hide");
    }
  }

  handleRateChange = (event) => {
    try {
      const value = event.target.value;
      const bpm = this.parseHeartRate(value);
      this.log(`Heart rate: ${bpm} BPM`);
      this.bpmText.textContent = bpm;
      this.heartUI.style.animationDuration = `${60 / bpm}s`;
    } catch (error) {
      this.log(`Error reading heart rate: ${error.message}`, "error");
    }
  };

  parseHeartRate(value) {
    const flags = value.getUint8(0);
    const rate16Bits = flags & 0x1;
    if (rate16Bits) {
      return value.getUint16(1, true);
    }
    return value.getUint8(1);
  }

  async startMonitoring() {
    try {
      this.log("Starting heart rate monitoring...");
      await this.heartRate.startNotifications();
      document.body.classList.add("monitoring");
      this.log("Monitoring started", "success");
    } catch (error) {
      this.log(`Error starting monitoring: ${error.message}`, "error");
    }
  }

  async stopMonitoring() {
    try {
      this.log("Stopping heart rate monitoring...");
      await this.heartRate.stopNotifications();
      document.body.classList.remove("monitoring");
      this.log("Monitoring stopped");
    } catch (error) {
      this.log(`Error stopping monitoring: ${error.message}`, "error");
    }
  }

  addEventListeners() {
    this.connectBtn.addEventListener("click", () => this.requestDevice());
    this.startBtn.addEventListener("click", () => this.startMonitoring());
    this.stopBtn.addEventListener("click", () => this.stopMonitoring());
    this.debugToggle.addEventListener("click", this.toggleDebug);

    // Speech control listeners
    this.holdToTalkBtn.addEventListener("mousedown", () => {
      this.isHoldingToTalk = true;
      this.startListening();
    });

    this.holdToTalkBtn.addEventListener("mouseup", () => {
      this.isHoldingToTalk = false;
      if (!this.isAutoListening) {
        this.stopListening();
      }
    });

    this.holdToTalkBtn.addEventListener("mouseleave", () => {
      if (this.isHoldingToTalk && !this.isAutoListening) {
        this.isHoldingToTalk = false;
        this.stopListening();
      }
    });

    this.toggleTalkBtn.addEventListener("click", this.toggleAutoListen);
  }

  toggleAutoListen = () => {
    this.isAutoListening = !this.isAutoListening;
    this.toggleTalkBtn.textContent = `Auto Listen: ${
      this.isAutoListening ? "On" : "Off"
    }`;

    if (this.isAutoListening) {
      this.startListening();
    } else {
      this.stopListening();
    }
  };
}

// Initialize the app
const monitor = new HeartRateMonitor();
