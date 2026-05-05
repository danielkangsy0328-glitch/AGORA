import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { askSocratesDebate, Message, SocraticEvaluation, generateSocraticEvaluation } from '../services/geminiService';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { containsProfanity, maskProfanity } from '../lib/moderation';
import WarningBanner from './ui/WarningBanner';

interface DebateScreenProps {
  user: User;
  topic: string;
  onFinish: (evaluation: SocraticEvaluation, history: Message[]) => void;
}

export default function DebateScreen({ user, topic, onFinish }: DebateScreenProps) {
  const [stance, setStance] = useState<'pro' | 'con' | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Derive a consistent session ID
  const hash = topic.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const sessionId = `debate_${user?.uid}_${Math.abs(hash).toString(36)}`;

  useEffect(() => {
    if (!stance || !user) return;

    const saveInitialSession = async () => {
      try {
        const sessionRef = doc(db, 'sessions', `${user.uid}_${sessionId}`);
        await setDoc(sessionRef, {
          topic,
          timestamp: serverTimestamp(),
          mode: 'debate',
          stance,
          userId: user.uid
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'sessions');
      }
    };
    saveInitialSession();

    if (messages.length === 0) {
      const isChoiceQuestion = topic.includes('?') && topic.split('?').filter(s => s.trim()).length >= 2;
      
      let initialMsg = '';
      if (isChoiceQuestion) {
        const options = topic.split('?').map(s => s.trim()).filter(s => s);
        const selected = stance === 'pro' ? options[0] : (options[1] || options[0]);
        initialMsg = `그대는 "${selected}"의 가치가 더 크다고 생각하는구먼. 어째서 그렇게 판단하는지 그 심연의 이유를 들려주겠나?`;
      } else {
        initialMsg = stance === 'pro' 
          ? `그대는 "${topic}"에 대해 긍정하는 입장이군. 그렇다면 그 근거는 무엇인가? 내가 이해할 수 있도록 설명해주게.`
          : `그대는 "${topic}"에 대해 부정하는 입장이군. 어째서 그렇게 생각하는지 그 이유를 들려줄 수 있겠는가?`;
      }
      
      const msg: Message = { role: 'model', content: initialMsg, timestamp: new Date() };
      setMessages([msg]);
      saveMessage(msg);
    }
  }, [stance, topic, user, sessionId]);

  const saveMessage = async (msg: Message) => {
    if (!user) return;
    try {
      await addDoc(collection(db, `conversations/${sessionId}/messages`), {
        role: msg.role,
        content: msg.content,
        timestamp: serverTimestamp(),
        userId: user.uid,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `conversations/${sessionId}/messages`);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !stance) return;

    if (containsProfanity(input)) {
      setShowWarning(true);
      return;
    }

    const userMsg: Message = { role: 'user', content: input, timestamp: new Date() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    
    await saveMessage(userMsg);

    try {
      const history = newMessages.map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      const response = await askSocratesDebate(history, topic, stance);
      const socratesMsg: Message = { role: 'model', content: response, timestamp: new Date() };
      setMessages(prev => [...prev, socratesMsg]);
      await saveMessage(socratesMsg);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = async () => {
    if (messages.length < 3) return;
    setIsFinishing(true);
    try {
      const evaluation = await generateSocraticEvaluation(messages, topic);
      
      // Save evaluation to Firestore
      const sessionRef = doc(db, 'sessions', `${user.uid}_${sessionId}`);
      await setDoc(sessionRef, {
        evaluation,
        completed: true
      }, { merge: true });

      onFinish(evaluation, messages);
    } catch (error) {
      console.error(error);
    } finally {
      setIsFinishing(false);
    }
  };

  if (!stance) {
    const isChoiceQuestion = topic.includes('?') && topic.split('?').filter(s => s.trim()).length >= 2;
    const options = isChoiceQuestion ? topic.split('?').map(s => s.trim()).filter(s => s) : [];

    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="bg-white p-12 shadow-2xl border border-stone-200 rounded-3xl"
        >
          <span className="font-label text-xs text-secondary uppercase tracking-[0.3em] mb-4 block">진리의 갈림길</span>
          <h2 className="font-headline text-3xl text-primary mb-8 leading-tight">
            "{topic}"<br/>
            그대의 입장은 무엇인가?
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setStance('pro')}
              className="group p-8 border-2 border-stone-100 hover:border-primary hover:bg-primary/5 transition-all text-center rounded-2xl"
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                {isChoiceQuestion ? '🏛️' : '⚖️'}
              </div>
              <span className="font-headline text-lg font-bold text-primary block mb-1">
                {isChoiceQuestion ? options[0] : '긍정 / 찬성'}
              </span>
              <span className="text-xs text-stone-400">
                {isChoiceQuestion ? '이것이 진당하네' : '나의 주장을 증명하리라'}
              </span>
            </button>
            <button 
              onClick={() => setStance('con')}
              className="group p-8 border-2 border-stone-100 hover:border-primary hover:bg-primary/5 transition-all text-center rounded-2xl"
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                {isChoiceQuestion ? '🎭' : '🛡️'}
              </div>
              <span className="font-headline text-lg font-bold text-primary block mb-1">
                {isChoiceQuestion ? (options[1] || '다른 선택') : '복기 / 반대'}
              </span>
              <span className="text-xs text-stone-400">
                {isChoiceQuestion ? '이것이 옳으니라' : '모순을 지적하리라'}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto">
      <WarningBanner 
        message="공자께서 말씀하시기를, 예(禮)가 아니면 말하지 말라 하셨습니다. 부적절한 표현은 삼가 주십시오."
        isVisible={showWarning}
        onClose={() => setShowWarning(false)}
      />
      <header className="py-8 text-center shrink-0">
        <span className="font-label text-[10px] text-secondary uppercase tracking-widest block mb-1">끝장 토론</span>
        <h1 className="font-headline text-2xl text-primary font-bold px-4">{topic}</h1>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className={`w-2 h-2 rounded-full ${stance === 'pro' ? 'bg-blue-400' : 'bg-red-400'}`}></span>
          <span className="text-[10px] font-label text-stone-400 uppercase tracking-tighter">
            {stance === 'pro' ? 'PRO-STANCE' : 'CON-STANCE'} ACTIVE
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-10 space-y-6" ref={scrollRef}>
        <AnimatePresence>
          {messages.map((m, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: m.role === 'user' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] md:max-w-[70%] p-5 ${
                m.role === 'user' 
                ? 'bg-primary text-on-primary rounded-2xl rounded-tr-none shadow-lg' 
                : 'bg-white text-stone-800 rounded-2xl rounded-tl-none border border-stone-100 shadow-md'
              }`}>
                <p className="text-base leading-relaxed whitespace-pre-wrap">{m.content}</p>
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white p-4 rounded-2xl border border-stone-100 flex gap-1">
                <div className="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-4 bg-white/50 backdrop-blur-md border-t border-stone-200 sticky bottom-0">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-2">
            <button 
              onClick={handleFinish}
              disabled={isFinishing || messages.length < 3}
              className="text-[10px] font-label text-stone-400 hover:text-primary transition-all disabled:opacity-0"
            >
              {isFinishing ? "분석 중..." : "토론을 마치고 결과 보기"}
            </button>
          </div>
          <div className="relative flex items-center">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="자신의 주장을 논리적으로 펼치게..."
              className="w-full bg-white border-2 border-stone-200 rounded-2xl p-4 pr-16 focus:border-primary focus:ring-0 resize-none min-h-[60px] max-h-[200px]"
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="absolute right-3 bottom-3 p-2 bg-primary text-white rounded-xl hover:bg-black transition-all disabled:opacity-30"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
