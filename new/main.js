import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Modality } from '@google/genai';

const h = React.createElement;

// --- App State & Constants ---
const AppView = {
  CHAT: 'chat',
  VISION: 'vision',
  CREATIVE: 'creative',
  VOICE: 'voice',
  README: 'readme'
};

// --- Utilities ---
const decodeBase64 = (base64) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
};

const encodeBase64 = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const decodeAudioData = async (data, ctx, sampleRate, numChannels) => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

// --- API Service ---
const geminiService = {
  getAI: () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' }),
  
  async chat(message) {
    const ai = this.getAI();
    const chat = ai.chats.create({
      model: 'gemini-3-pro-preview',
      config: {
        thinkingConfig: { thinkingBudget: 20000 },
        systemInstruction: "You are MantraChat. Be professional, concise, and use markdown."
      }
    });
    const response = await chat.sendMessage({ message });
    return response.text;
  },

  async analyzeImage(prompt, base64Image) {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [{ text: prompt }, { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }]
      }
    });
    return response.text;
  },

  async generateImage(prompt, config) {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: config.aspectRatio } }
    });
    for (const part of response.candidates?.[0]?.content.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return '';
  }
};

// --- Components ---

const Sidebar = ({ currentView, setView }) => {
  const items = [
    { id: AppView.CHAT, label: 'Neural Chat', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
    { id: AppView.VISION, label: 'Vision Lab', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
    { id: AppView.CREATIVE, label: 'Creative Studio', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id: AppView.VOICE, label: 'Live Pulse', icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z' },
    { id: AppView.README, label: 'Knowledge Base', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  ];

  return h('aside', { className: "w-64 bg-[#0d0d0d] border-r border-[#1a1a1a] flex flex-col h-screen sticky top-0" },
    h('div', { className: "p-6 border-b border-[#1a1a1a]" },
      h('h1', { className: "text-xl font-bold tracking-tighter flex items-center gap-2 text-white" },
        h('div', { className: "w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center" }, h('span', { className: "text-white text-xs" }, "M")),
        "MANTRA"
      )
    ),
    h('nav', { className: "flex-1 p-4 space-y-2 overflow-y-auto" },
      items.map(item => h('button', {
        key: item.id,
        onClick: () => setView(item.id),
        className: `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${currentView === item.id ? 'bg-indigo-600/10 text-indigo-500 border border-indigo-600/20' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'}`
      },
        h('svg', { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, h('path', { d: item.icon, strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2 })),
        item.label
      ))
    )
  );
};

const ChatView = () => {
  const [messages, setMessages] = React.useState([{ id: '1', role: 'assistant', content: 'Neural Core active. Awaiting instructions.', timestamp: Date.now() }]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const scrollRef = React.useRef(null);

  React.useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, loading]);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const msg = { id: Date.now().toString(), role: 'user', content: input, timestamp: Date.now() };
    setMessages(prev => [...prev, msg]);
    setInput('');
    setLoading(true);
    try {
      const res = await geminiService.chat(input);
      setMessages(prev => [...prev, { id: (Date.now()+1).toString(), role: 'assistant', content: res, timestamp: Date.now() }]);
    } catch (e) {
      setMessages(prev => [...prev, { id: 'err', role: 'system', content: 'Connection failure.', timestamp: Date.now() }]);
    } finally { setLoading(false); }
  };

  return h('div', { className: "flex flex-col h-full bg-[#0a0a0a]" },
    h('div', { className: "flex-1 overflow-y-auto p-6 space-y-6", ref: scrollRef },
      messages.map(m => h('div', { key: m.id, className: `flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}` },
        h('div', { className: `max-w-2xl px-5 py-4 rounded-2xl ${m.role === 'user' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-zinc-900 border border-zinc-800 text-zinc-100'}` },
          h('div', { className: "text-sm whitespace-pre-wrap leading-relaxed" }, m.content)
        )
      )),
      loading && h('div', { className: "text-xs text-zinc-500 mono animate-pulse" }, "Processing Neural Signals...")
    ),
    h('form', { onSubmit: send, className: "p-6 border-t border-[#1a1a1a] bg-[#0d0d0d]" },
      h('div', { className: "relative max-w-4xl mx-auto" },
        h('input', {
          value: input,
          onChange: e => setInput(e.target.value),
          className: "w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-6 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-600/50",
          placeholder: "Enter neural command..."
        }),
        h('button', { type: "submit", className: "absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl" }, "->")
      )
    )
  );
};

const VisionLab = () => {
  const [img, setImg] = React.useState(null);
  const [prompt, setPrompt] = React.useState('');
  const [res, setRes] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const fileRef = React.useRef(null);

  const analyze = async () => {
    if (!img || loading) return;
    setLoading(true); setRes('');
    try {
      const base64 = img.split(',')[1];
      const out = await geminiService.analyzeImage(prompt || "Analyze this image.", base64);
      setRes(out);
    } catch(e) { setRes('Error in vision processing.'); }
    finally { setLoading(false); }
  };

  return h('div', { className: "p-8 h-full overflow-y-auto bg-[#0a0a0a]" },
    h('h2', { className: "text-2xl font-bold mb-8" }, "Vision Lab"),
    h('div', { className: "grid grid-cols-2 gap-8 max-w-6xl mx-auto" },
      h('div', { className: "space-y-6" },
        h('div', { 
          onClick: () => fileRef.current.click(),
          className: "aspect-square bg-zinc-900 border-2 border-dashed border-zinc-800 rounded-3xl flex items-center justify-center cursor-pointer overflow-hidden" 
        },
          img ? h('img', { src: img, className: "w-full h-full object-cover" }) : h('span', { className: "text-zinc-600" }, "Upload Image")
        ),
        h('input', { type: "file", ref: fileRef, className: "hidden", onChange: e => {
          const f = e.target.files[0];
          if(f) { const r = new FileReader(); r.onload = x => setImg(x.target.result); r.readAsDataURL(f); }
        }}),
        h('textarea', { value: prompt, onChange: e => setPrompt(e.target.value), className: "w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm h-32", placeholder: "What should I analyze?" }),
        h('button', { onClick: analyze, disabled: !img || loading, className: "w-full py-4 bg-indigo-600 rounded-2xl font-bold disabled:opacity-50" }, loading ? "Processing..." : "Run Vision Engine")
      ),
      h('div', { className: "bg-[#0d0d0d] border border-zinc-800 rounded-3xl p-6 text-sm text-zinc-300 overflow-y-auto h-full min-h-[400px]" }, 
        res || (loading ? "Signal Processing..." : "Neural output will appear here.")
      )
    )
  );
};

const CreativeStudio = () => {
  const [prompt, setPrompt] = React.useState('');
  const [img, setImg] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const gen = async () => {
    setLoading(true); setImg(null);
    try { const url = await geminiService.generateImage(prompt, { aspectRatio: '1:1' }); setImg(url); }
    catch (e) { alert('API Error'); }
    finally { setLoading(false); }
  };

  return h('div', { className: "p-8 space-y-8 bg-[#0a0a0a] h-full overflow-y-auto" },
    h('header', null, h('h2', { className: "text-2xl font-bold" }, "Creative Studio")),
    h('div', { className: "grid grid-cols-3 gap-8 max-w-6xl mx-auto" },
      h('div', { className: "space-y-4" },
        h('textarea', { value: prompt, onChange: e => setPrompt(e.target.value), className: "w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 h-40", placeholder: "Synthesize visual prompt..." }),
        h('button', { onClick: gen, disabled: loading || !prompt, className: "w-full py-4 bg-indigo-600 rounded-2xl font-bold" }, loading ? "Synthesizing..." : "Generate Artwork")
      ),
      h('div', { className: "col-span-2 aspect-square bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden flex items-center justify-center" },
        img ? h('img', { src: img, className: "w-full h-full object-cover" }) : h('span', { className: "text-zinc-600" }, "Canvas Output")
      )
    )
  );
};

const VoicePulse = () => {
  const [active, setActive] = React.useState(false);
  const [status, setStatus] = React.useState('idle');
  const sessionRef = React.useRef(null);
  const sourcesRef = React.useRef(new Set());
  const nextStartRef = React.useRef(0);

  const stop = () => {
    if(sessionRef.current) sessionRef.current.close();
    setActive(false); setStatus('idle');
  };

  const start = async () => {
    try {
      setStatus('connecting');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const inCtx = new AudioContext({ sampleRate: 16000 });
      const outCtx = new AudioContext({ sampleRate: 24000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setActive(true); setStatus('listening');
            const src = inCtx.createMediaStreamSource(stream);
            const proc = inCtx.createScriptProcessor(4096, 1, 1);
            proc.onaudioprocess = e => {
              const data = e.inputBuffer.getChannelData(0);
              const i16 = new Int16Array(data.length);
              for(let i=0; i<data.length; i++) i16[i] = data[i] * 32768;
              sessPromise.then(s => s.sendRealtimeInput({ media: { data: encodeBase64(new Uint8Array(i16.buffer)), mimeType: 'audio/pcm;rate=16000' }}));
            };
            src.connect(proc); proc.connect(inCtx.destination);
          },
          onmessage: async m => {
            const base64 = m.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if(base64) {
              setStatus('speaking');
              const bytes = decodeBase64(base64);
              const buf = await decodeAudioData(bytes, outCtx, 24000, 1);
              nextStartRef.current = Math.max(nextStartRef.current, outCtx.currentTime);
              const src = outCtx.createBufferSource();
              src.buffer = buf; src.connect(outCtx.destination);
              src.onended = () => { sourcesRef.current.delete(src); if(sourcesRef.current.size===0) setStatus('listening'); };
              src.start(nextStartRef.current);
              nextStartRef.current += buf.duration;
              sourcesRef.current.add(src);
            }
          },
          onclose: stop,
          onerror: stop
        },
        config: { responseModalities: [Modality.AUDIO], systemInstruction: "You are MantraChat via voice. Be helpful." }
      });
      sessionRef.current = await sessPromise;
    } catch(e) { setStatus('idle'); alert('Mic failed'); }
  };

  return h('div', { className: "h-full flex flex-col items-center justify-center space-y-8 bg-[#0a0a0a]" },
    h('div', { className: "relative" },
      active && h('div', { className: "absolute inset-0 bg-indigo-600/20 rounded-full animate-ping" }),
      h('button', { 
        onClick: active ? stop : start,
        className: `w-32 h-32 rounded-full flex items-center justify-center transition-all ${active ? 'bg-red-500 scale-110' : 'bg-indigo-600'}` 
      }, 
        h('svg', { className: "w-12 h-12 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24" }, 
          h('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: active ? "M6 18L18 6M6 6l12 12" : "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" })
        )
      )
    ),
    h('div', { className: "text-sm text-zinc-500 mono" }, `Status: ${status.toUpperCase()}`)
  );
};

const ReadmeView = () => {
  return h('div', { className: "p-12 max-w-4xl mx-auto space-y-12 bg-[#0a0a0a] min-h-full" },
    h('header', { className: "space-y-4" },
      h('h1', { className: "text-4xl font-black text-white" }, "MANTRA SYSTEM"),
      h('p', { className: "text-zinc-400 text-lg" }, "Enterprise AI Workspace Documentation.")
    ),
    h('div', { className: "bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-6" },
      h('h3', { className: "font-bold text-white" }, "Neural Specifications"),
      h('ul', { className: "space-y-2 text-sm text-zinc-500 mono" },
        h('li', null, "• Model Core: Gemini 3 Pro / 2.5 Flash"),
        h('li', null, "• Vision Lab: Multi-modal active"),
        h('li', null, "• Live Pulse: 24kHz Audio Out")
      )
    )
  );
};

const App = () => {
  const [view, setView] = React.useState(AppView.CHAT);

  const renderContent = () => {
    switch (view) {
      case AppView.CHAT: return h(ChatView);
      case AppView.VISION: return h(VisionLab);
      case AppView.CREATIVE: return h(CreativeStudio);
      case AppView.VOICE: return h(VoicePulse);
      case AppView.README: return h(ReadmeView);
      default: return h(ChatView);
    }
  };

  return h('div', { className: "flex min-h-screen bg-[#0a0a0a] text-zinc-100" },
    h(Sidebar, { currentView: view, setView }),
    h('main', { className: "flex-1 relative overflow-hidden" }, renderContent())
  );
};

// --- Entry Point ---
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h(React.StrictMode, null, h(App)));
