# Heart Rate Web AI Coach

This web application connects to a Bluetooth heart rate monitor and uses a local Large Language Model (LLM) to provide real-time speech coaching based on your heart rate and what you say. It's built with modern web technologies like Web Bluetooth and on-device AI with MediaPipe.

## Features

-   **Real-time Heart Rate Monitoring**: Connects to any standard Bluetooth heart rate device.
-   **Live Webcam Feed**: Shows your video feed.
-   **On-Device AI Analysis**: Uses Google's Gemma 2 model running entirely in your browser to analyze your speech. No data is sent to the cloud for analysis.
-   **Speech Coaching**: Provides feedback on:
    -   Confidence (correlating with heart rate)
    -   Clarity of speech
    -   Emotional control
    -   Audience engagement
-   **Actionable Improvements**: Suggests specific ways to improve your public speaking.
-   **Multiple Listening Modes**: "Hold to Talk" and "Auto Listen" modes for convenience.
-   **Debug Panel**: A toggleable panel for viewing logs and connection status.

## How to Run Locally

To run this project, you need a local web server to serve the files, especially the AI model.

### Prerequisites

1.  A browser that supports Web Bluetooth and WebGPU (like Chrome or Edge).
2.  A Bluetooth-enabled heart rate monitor.
3.  A local web server. If you have Node.js, you can use `http-server`.

### Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/heartrate-webai.git
    cd heartrate-webai
    ```

2.  **Download the AI Model:**
    The application is configured to load the `gemma2-2b-it-gpu-int8.bin` model. You can download it from [here](https://storage.googleapis.com/jmstore/WebAIDemos/models/Gemma2/gemma2-2b-it-gpu-int8.bin). Place the `.bin` file in the root of the project directory.

    *Note: The app will first try to load the model from `http://localhost/gemma2-2b-it-gpu-int8.bin`. You may need to adjust your local server setup to serve the model from this path or change the path in `app.js`.*

3.  **Start your local server:**
    For example, using `http-server`:
    ```bash
    npx http-server
    ```

4.  **Open the application:**
    Open your browser and navigate to the address provided by your local server (e.g., `http://localhost:8080`).

## How to Use

1.  **Connect Device**: Click the "Connect" button and select your heart rate monitor from the Bluetooth device list.
2.  **Start Monitoring**: Once connected, click "Start" to begin receiving heart rate data.
3.  **Use the Speech Coach**:
    -   **Hold to Talk**: Press and hold the "Hold to Talk" button while you speak. Release to get feedback.
    -   **Auto Listen**: Click the "Auto Listen" button to toggle continuous listening. The AI will provide feedback whenever you pause.
4.  **View Feedback**: The analysis will appear in the "Speech Coach Feedback" panel.

## Technologies Used

-   **Web Bluetooth API**: For connecting to the heart rate monitor.
-   **MediaPipe GenAI Task**: For running the LLM in the browser.
-   **Gemma 2**: The powerhouse LLM for speech analysis.
-   **Vanilla JS, HTML, CSS**: No frameworks, just the web platform. 