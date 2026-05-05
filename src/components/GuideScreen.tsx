import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { askSocratesGuide, Message } from '../services/geminiService';

interface GuideScreenProps {
  user: User;
}

export default function GuideScreen({ user }: GuideScreenProps) {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'model', 
      content: "어서 오게나, 나의 친구여. 무엇이 그대의 지적인 성장을 가로막고 있는가? 가지고 있는 고민이나 자료가 있다면 보여주게나.", 
      timestamp: new Date() 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() && !attachedFileName) return;

    const userMessage: Message = { role: 'user', content: input, timestamp: new Date() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const history = newMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const response = await askSocratesGuide(
        history, 
        input, 
        attachedFileName ? `사용자가 '${attachedFileName}' 자료를 참고하고 있음` : undefined
      );

      setMessages(prev => [...prev, { role: 'model', content: response, timestamp: new Date() }]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFileName(file.name);
      // In a real app we would upload the file here
    }
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto px-4">
      <section className="py-8 text-center bg-[#f4f1ea] border-b-2 border-stone-200 shadow-sm mb-4">
        <span className="font-label text-xs text-secondary uppercase tracking-[0.2em] mb-2 block">지적 동반자</span>
        <h1 className="font-headline text-2xl text-primary font-bold">AGORA GUIDE</h1>
        <p className="text-stone-500 text-sm italic mt-1 text-balance">사유의 매듭을 함께 푸는 곳</p>
      </section>

      <div className="flex-1 overflow-y-auto space-y-6 pb-6 px-2 scroll-smooth" ref={scrollRef}>
        <AnimatePresence>
          {messages.map((m, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] md:max-w-[70%] p-5 shadow-sm relative ${
                m.role === 'user' 
                ? 'bg-[#2d3436] text-white rounded-2xl rounded-tr-none' 
                : 'bg-white text-stone-800 rounded-2xl rounded-tl-none border border-stone-200'
              }`}>
                {m.role === 'model' && (
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full border-2 border-primary bg-[#f4f1ea] overflow-hidden">
                    <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDh_UNPx9X6r_eX7hBwtbbfVYiNcxbDosj-qiOUFMLxCq96ELQstn94F5DmWt2KWtjFFCLoUOqTuC9vOj8S2rfpknhCtXelo-9TRTWb6oW0Czzm7GF39x7y14GxQv0Mxsp2LivLOLgM3Rh802jHPfMzJ8vfhjIxAR8gajZWtdc7Z_ADvPnxlaKirCYJ5lfyoNYvCfm0nrylDGo9ml7vv1_cn8GlOEZ7Er_IHmL-WNdOTiGCV2XkigbISQyEixoPHox1VUVapGqy-Oib" className="w-full h-full object-cover" />
                  </div>
                )}
                <p className="text-base leading-relaxed whitespace-pre-wrap">{m.content}</p>
                <span className="text-[10px] opacity-40 mt-2 block text-right">
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-2xl border border-stone-200 flex gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-4 bg-white border-2 border-stone-200 shadow-xl mb-4 rounded-3xl">
        {attachedFileName && (
          <div className="flex items-center gap-2 mb-3 bg-secondary/5 p-2 rounded-xl text-xs text-secondary border border-secondary/20">
            <span className="material-symbols-outlined text-sm">description</span>
            <span className="flex-1 truncate">{attachedFileName}</span>
            <button onClick={() => setAttachedFileName(null)} className="material-symbols-outlined text-sm opacity-50 hover:opacity-100">close</button>
          </div>
        )}
        <div className="flex items-end gap-3">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-stone-400 hover:text-primary transition-colors flex flex-col items-center gap-1"
          >
            <span className="material-symbols-outlined">attachment</span>
            <span className="text-[8px] font-label uppercase">자료</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="어떤 벽에 부딪혔는가?"
            className="flex-1 min-h-[50px] max-h-[150px] bg-transparent border-none focus:ring-0 p-0 text-stone-700 leading-relaxed overflow-y-auto py-3"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && !attachedFileName)}
            className="h-12 w-12 bg-primary text-white rounded-2xl flex items-center justify-center hover:bg-stone-800 transition-all active:scale-95 disabled:opacity-30"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
