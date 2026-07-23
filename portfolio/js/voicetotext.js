const voiceButton = document.querySelector(".voice-search-button");
const searchInput = document.querySelector(".search-bar");

const SpeechRecognition = window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();

let isListening = false;

voiceButton.addEventListener("click", () => {
    if (isListening) {
        recognition.stop();
    } else {
        recognition.start();
    }
});

recognition.addEventListener("start", () => {
    isListening = true;
    voiceButton.classList.add("is-listening");
});

recognition.addEventListener("end", () => {
    isListening = false;
    voiceButton.classList.remove("is-listening");
});

recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript;
    searchInput.value = transcript;
    searchInput.dispatchEvent(new Event("input"));
    searchInput.focus();
});
