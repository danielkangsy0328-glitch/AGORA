import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { sendMessageToSocrates, generateSocraticEvaluation, Message, SocraticEvaluation } from '../services/geminiService';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { containsProfanity } from '../lib/moderation';
import WarningBanner from './ui/WarningBanner';

interface DialogueScreenProps {
  user: User;
  difficulty: string;
  topic: string;
  onFinish: (evalData: SocraticEvaluation, history: Message[]) => void;
}

export default function DialogueScreen({ user, difficulty, topic, onFinish }: DialogueScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Derive a consistent session ID only containing safe characters (letters/numbers)
  // We include user.uid to ensure private access governed by firestore rules
  const hash = topic.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const sessionId = `chat_${user?.uid}_${Math.abs(hash).toString(36)}`;

  useEffect(() => {
    if (!user) return;

    // Save session overview for the history list
    const saveSessionInfo = async () => {
      try {
        const sessionRef = doc(db, 'sessions', `${user.uid}_${sessionId}`);
        const now = serverTimestamp();
        await setDoc(sessionRef, {
          topic,
          timestamp: now,
          difficulty,
          userId: user.uid
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'sessions');
      }
    };
    saveSessionInfo();

    const messagesQuery = query(
      collection(db, `conversations/${sessionId}/messages`),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          role: data.role,
          content: data.content,
          timestamp: data.timestamp?.toDate() || new Date(),
        } as Message;
      });

      if (fetchedMessages.length === 0) {
        // If no history, add the first message from Socrates
        const firstMsg: Message = {
          role: 'model',
          content: `"말씀해 보게나, 나의 친구여. 오늘 우리는 '${topic}'이라는 주제를 두고 사유의 바다를 건너보려 하네. 그대는 이에 대해 어떻게 생각하는가?"`,
          timestamp: new Date(),
        };
        saveMessage(firstMsg);
      } else {
        setMessages(fetchedMessages);
      }
      setIsInitialLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `conversations/${sessionId}/messages`);
    });

    return () => unsubscribe();
  }, [user, sessionId, topic]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

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

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    if (containsProfanity(input)) {
      setShowWarning(true);
      return;
    }

    const userMsg: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setInput('');
    setIsLoading(true);
    
    // Save user message to Firestore
    await saveMessage(userMsg);

    const history = messages.map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    try {
      const response = await sendMessageToSocrates(history, input, difficulty, topic);

      const socratesMsg: Message = {
        role: 'model',
        content: response,
        timestamp: new Date(),
      };

      // Save socrates response to Firestore
      await saveMessage(socratesMsg);
    } catch (error) {
      console.error("AI service error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = async () => {
    if (messages.length < 3) {
      alert("탐구를 마치기에는 아직 대화가 부족하구먼. 조금 더 사유를 나눠보지 않겠나?");
      return;
    }

    setIsFinishing(true);
    try {
      const evalData = await generateSocraticEvaluation(messages, topic);
      // Save evaluation to Firestore session
      const sessionRef = doc(db, 'sessions', `${user.uid}_${sessionId}`);
      await setDoc(sessionRef, {
        evaluation: evalData,
        completed: true
      }, { merge: true });

      onFinish(evalData, messages);
    } catch (error) {
      console.error("Error generating evaluation:", error);
      // Fallback evaluation if API fails
      onFinish({
        scores: [
          { name: '초기 편향', value: 50, label: 'PREFACE' },
          { name: '엘렌쿠스', value: 50, label: 'ELENCHUS' },
          { name: '주제 심화', value: 50, label: 'DERIVATION' },
          { name: '종합', value: 50, label: 'SYNTHESIS' },
        ],
        initialHypothesis: "그대의 첫 생각은 마치 흔들리는 갈대와 같았네.",
        elenchusPoint: "그대가 주장하던 그 전제가 스스로 무너지는 지점이 있었구먼.",
        reachedReason: "무지의 지를 깨달음으로써 비로소 지혜의 문턱을 밟았구먼.",
        keywords: ['사유', '탐구', '본질']
      }, messages);
    } finally {
      setIsFinishing(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
        <p className="font-label text-sm text-outline uppercase tracking-widest">사유의 기록을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col px-4 md:px-margin-page pb-10">
      <WarningBanner 
        message="진리를 구하는 자의 언어는 맑고 올발라야 함을 잊지 마시게. 부적절한 표현은 사유를 흐리게 할 뿐이라네."
        isVisible={showWarning}
        onClose={() => setShowWarning(false)}
      />
      {/* Header */}
      <section className="py-6 md:py-10 text-center shrink-0 flex flex-col items-center">
        <span className="font-label text-[10px] md:text-xs text-secondary uppercase tracking-widest mb-1 md:mb-2 block">오늘의 탐구</span>
        <h1 className="font-headline text-2xl md:text-headline-lg text-primary mb-1 md:mb-2 line-clamp-2 max-w-xl px-4">{topic}</h1>
        <div className="w-16 md:w-24 h-[1px] bg-primary mx-auto opacity-20"></div>
      </section>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-10 md:space-y-16 pr-2 custom-scrollbar pb-10 md:pb-20"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-start gap-3 md:gap-4 max-w-[98%] md:max-w-[85%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
            >
              <div className={`shrink-0 w-8 md:w-14 h-8 md:h-14 border-2 flex items-center justify-center overflow-hidden shadow-sm ${
                msg.role === 'model' ? 'bg-surface-container-highest border-outline-variant' : 'bg-primary border-primary'
              }`}>
                {msg.role === 'model' ? (
                  <img 
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuBbXUWPWgdk7QYaLunFKBUFBJHBfl69AaxudGJC5OrZknbtMIzvxo7ioRUrkS0F2LVxZxPPZnJy_Ky1SsldfyFQS-jgomovSX1pNXH7Q7ONWYkJbPf6As05ckRLB4jkw_1qcMenL4KK4dJa9dQj3UhqbB0scsWtIsfpsK5IoHR0OiseLRt1vB2YII-JoKqkOjvtpoeJuDrQgdjIpoe89PBW5JGJuYLSLO8R-BzMlLVqAwlXKwjtr3eBG_3fWOluE0UmjylQhkuI2sgU"
                    alt="Socrates"
                    className="w-full h-full object-cover grayscale opacity-90"
                  />
                ) : (
                  <span className="material-symbols-outlined text-on-primary text-base md:text-xl">person</span>
                )}
              </div>
              <div className={`p-5 md:p-10 relative transition-all duration-300 shadow-sm ${
                msg.role === 'model' 
                  ? 'parchment-texture chiseled-border text-on-surface' 
                  : 'bg-primary-container border border-primary text-on-primary shadow-xl'
              }`}>
                <p className="font-body text-lg md:text-3xl leading-relaxed whitespace-pre-wrap font-medium">
                  {msg.content}
                </p>
                <span className={`font-label text-[8px] md:text-sm absolute -bottom-6 md:bottom-[-2.5rem] ${msg.role === 'user' ? 'right-0 text-primary' : 'left-0 text-outline'} uppercase font-bold tracking-widest`}>
                  {msg.role === 'model' ? '소크라테스' : '나'} • {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 self-start mt-4 md:mt-6 opacity-50"
          >
            <div className="flex gap-1">
              <span className="w-1 md:w-1.5 h-1 md:h-1.5 bg-outline rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
              <span className="w-1 md:w-1.5 h-1 md:h-1.5 bg-outline rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
              <span className="w-1 md:w-1.5 h-1 md:h-1.5 bg-outline rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
            </div>
            <span className="font-label text-[8px] md:text-[10px] text-outline ml-1 md:ml-2 uppercase tracking-tight">소크라테스가 사유하는 중...</span>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <section className="mt-6 md:mt-10 pb-4 sticky bottom-0 bg-background/80 backdrop-blur-sm z-40">
        <div className="writing-tablet p-1 relative shadow-2xl">
          <div className="bg-[#dcd9d9] p-3 md:p-4 min-h-[100px] md:min-h-[140px] flex flex-col">
            <label className="font-label text-[8px] md:text-[10px] text-tertiary uppercase mb-1 md:mb-2 opacity-60 font-bold tracking-widest">생각을 새기십시오...</label>
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 bg-transparent border-none focus:ring-0 font-body text-base md:text-body-lg text-tertiary placeholder-tertiary/40 resize-none p-0 leading-relaxed" 
              placeholder="말씀하시게, 소크라테스여..."
            />
            <div className="flex justify-between items-center mt-2">
              <button 
                onClick={handleFinish}
                disabled={isFinishing || messages.length < 3}
                className="text-stone-500 font-label text-[8px] md:text-[10px] uppercase tracking-widest hover:text-black transition-all disabled:opacity-0"
                title={messages.length < 3 ? "대화를 조금 더 나누어야 평가가 가능하네" : "탐구 종료 및 분석"}
              >
                {isFinishing ? "정리 중..." : "대화 끝내기"}
              </button>
              <button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="bg-primary text-on-primary px-5 md:px-8 py-2 md:py-3 font-label text-[10px] md:text-label-md uppercase tracking-widest flex items-center gap-2 md:gap-3 active:scale-95 transition-all hover:bg-opacity-90 disabled:opacity-50 shadow-lg"
              >
                답변
                <span className="material-symbols-outlined text-xs md:text-sm">send</span>
              </button>
            </div>
          </div>
          {/* Stylus Decoration - Hidden on mobile */}
          <div className="absolute -right-10 top-1/2 -translate-y-1/2 w-3 h-40 bg-tertiary hidden lg:block shadow-xl rotate-12 opacity-80 pointer-events-none"></div>
        </div>
        <p className="text-center mt-3 md:mt-4 font-label text-[8px] md:text-[10px] text-outline uppercase tracking-tighter opacity-70">
          신중히 숙고하십시오. 언어는 지혜를 낳는 산파와 같습니다.
        </p>
      </section>
    </div>
  );
}
