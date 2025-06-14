/**
 * Speech Analysis Module
 * @author Nerding I/O - JD Fiscus
 *
 * Handles speech recognition and LLM-based analysis of speaking performance
 */

export class SpeechAnalyzer {
  constructor(llm, logger) {
    this.llm = llm;
    this.log = logger;
    this.setupRecognition();
  }

  setupRecognition() {
    window.SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new window.SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true; // Keeps recognition active until explicitly stopped
    recognition.interimResults = true; // Provides real-time results as the user speaks
    recognition.lang = "en-US"; // Sets the language to English (United States)

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");
      console.log("Transcript:", transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
    };

    // Start the speech recognition
    recognition.start();
  }

  // ... move speech analysis related methods here ...
}
