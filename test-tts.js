import 'dotenv/config';
import fs from 'fs';

async function testGroqTTS() {
  const apiKey = process.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    console.error("No API key found in .env.local");
    return;
  }

  const spokenText = `[gentle] Hello! I'm PSYCHE AI, your personal mental wellness companion. Sign in to start our conversation and get personalized stress support.`;

  const res = await fetch('https://api.groq.com/openai/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'canopylabs/orpheus-v1-english',
      input: spokenText,
      voice: 'diana',
      response_format: 'wav'
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Error from Groq API:", res.status, res.statusText);
    console.error(errorText);
  } else {
    console.log("Success! Status:", res.status);
  }
}

testGroqTTS();
