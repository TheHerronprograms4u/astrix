// main.js

document.addEventListener('DOMContentLoaded', () => {
  initNeuralCanvas();
  initScrollReveal();
  initChatbot();
  initNavbar();
});

// Navbar Scroll Effect
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}

// Neural Network Particles Background
function initNeuralCanvas() {
  const canvas = document.getElementById('neural-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  let particles = [];
  let w, h;
  
  const resize = () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  };
  
  window.addEventListener('resize', resize);
  resize();

  class Particle {
    constructor() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;
      this.radius = Math.random() * 1.5 + 0.5;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0 || this.x > w) this.vx *= -1;
      if (this.y < 0 || this.y > h) this.vy *= -1;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100, 255, 218, 0.4)';
      ctx.fill();
    }
  }

  for (let i = 0; i < 80; i++) {
    particles.push(new Particle());
  }

  function animate() {
    ctx.clearRect(0, 0, w, h);
    
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
      
      for (let j = i; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 150) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(100, 255, 218, ${0.1 - distance/150 * 0.1})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(animate);
  }
  
  animate();
}

// Scroll Reveal Animations
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  
  const revealOnScroll = () => {
    const windowHeight = window.innerHeight;
    const elementVisible = 120;
    
    reveals.forEach(reveal => {
      const elementTop = reveal.getBoundingClientRect().top;
      if (elementTop < windowHeight - elementVisible) {
        reveal.classList.add('active');
      }
    });
  };
  
  window.addEventListener('scroll', revealOnScroll);
  // Trigger once on load with a slight delay
  setTimeout(revealOnScroll, 100);
}

// Chatbot Interaction
function initChatbot() {
  const input = document.querySelector('.chatbot-input input');
  const sendBtn = document.querySelector('.btn-send');
  const chatMessages = document.getElementById('chat-messages');
  const typingIndicator = document.getElementById('typing-indicator');
  
  if (!input || !sendBtn || !chatMessages) return;

  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  async function getGeminiResponse(userText) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: "You are ASTRIX AI, a premium, empathetic, and highly intelligent AI companion for senior high school students. Keep responses concise (2-3 sentences max), emotionally comforting, and highly actionable. Format your response cleanly using basic HTML tags like <p>, <strong>, or <ul> if needed, but avoid markdown asterisks." }]
          },
          contents: [{
            parts: [{text: userText}]
          }]
        })
      });
      
      const data = await response.json();
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        return data.candidates[0].content.parts[0].text;
      }
      return "<p>I'm here for you. Let's take a deep breath together.</p>";
    } catch(e) {
      console.error("Gemini API Error:", e);
      return "<p>I'm having a little trouble connecting to my network right now, but please know I'm here to support you.</p>";
    }
  }

  const sendMessage = async () => {
    const text = input.value.trim();
    if (!text) return;
    
    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'message user-message fade-in-up';
    userMsg.innerHTML = `<p>${text}</p>`;
    chatMessages.insertBefore(userMsg, typingIndicator);
    
    input.value = '';
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Show typing
    typingIndicator.style.display = 'flex';
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Fetch AI response
    const responseHtml = await getGeminiResponse(text);
    
    typingIndicator.style.display = 'none';
    const aiMsg = document.createElement('div');
    aiMsg.className = 'message ai-message fade-in-up';
    
    aiMsg.innerHTML = `
      <div class="ai-avatar-small">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="margin: 8px;"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M12 6v6l4 2"/></svg>
      </div>
      <div class="message-content">
        ${responseHtml}
        <div class="message-suggestions" style="margin-top: 12px;">
          <button class="btn-suggestion">Breathing Exercise</button>
          <button class="btn-suggestion">Study tips</button>
        </div>
      </div>
    `;
    chatMessages.insertBefore(aiMsg, typingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    attachSuggestionListeners();
  };
  
  const attachSuggestionListeners = () => {
    document.querySelectorAll('.btn-suggestion').forEach(btn => {
      // Remove old listeners by cloning
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener('click', (e) => {
        input.value = e.target.textContent;
        sendMessage();
      });
    });
  };
  
  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  attachSuggestionListeners();
}
