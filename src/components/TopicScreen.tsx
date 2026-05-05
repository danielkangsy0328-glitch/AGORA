import { useState } from 'react';
import { motion } from 'motion/react';
import { containsProfanity } from './../lib/moderation';
import WarningBanner from './ui/WarningBanner';

interface TopicScreenProps {
  onContinue: (topic: string) => void;
  mode: 'dialogue' | 'debate';
  onModeChange?: (mode: string) => void;
}

export default function TopicScreen({ onContinue, mode, onModeChange }: TopicScreenProps) {
  const [topic, setTopic] = useState('');
  const [showWarning, setShowWarning] = useState(false);

  const handleSubmit = () => {
    const cleanTopic = topic.trim();
    if (cleanTopic) {
      if (containsProfanity(cleanTopic)) {
        setShowWarning(true);
        return;
      }
      onContinue(cleanTopic);
    }
  };

  const isDebate = mode === 'debate';

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-160px)] px-margin-page">
      <WarningBanner 
        message="주제에 부적절한 표현이 포함되어 있습니다. 바른 언어로 다시 작성해 주십시오."
        isVisible={showWarning}
        onClose={() => setShowWarning(false)}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        key={mode} // Re-animate on mode switch
        className={`parchment-texture p-10 md:p-16 chiseled-border max-w-2xl w-full text-center relative transition-colors duration-500 ${isDebate ? 'border-[#28301c]/30 shadow-[0_0_40px_rgba(40,48,28,0.1)]' : ''}`}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-2">
          <button 
            onClick={() => onModeChange?.('dialogue')}
            className={`px-4 py-1 rounded-full text-[10px] font-label tracking-widest uppercase border transition-all ${!isDebate ? 'bg-primary text-white border-primary shadow-md scale-105' : 'bg-white text-stone-300 border-stone-100 hover:border-stone-300'}`}
          >
            사유 탐구
          </button>
          <button 
            onClick={() => onModeChange?.('debate')}
            className={`px-4 py-1 rounded-full text-[10px] font-label tracking-widest uppercase border transition-all ${isDebate ? 'bg-[#28301c] text-white border-[#28301c] shadow-md scale-105' : 'bg-white text-stone-300 border-stone-100 hover:border-stone-300'}`}
          >
            끝장 토론
          </button>
        </div>

        <span className="font-label text-label-md text-secondary uppercase tracking-widest mb-4 block mt-4">
          {isDebate ? '논쟁의 전열' : '사유의 시작'}
        </span>
        <h2 className="font-headline text-headline-xl text-primary mb-8">
          {isDebate ? '무엇에 대해 증명하시겠습니까?' : '무엇에 대해 탐구하시겠습니까?'}
        </h2>
        
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {[
            { label: '정의의 본질', icon: '⚖️' },
            { label: '행복의 조건', icon: '☀️' },
            { label: '수리적 진리', icon: '🔢' },
            { label: '우주의 질서', icon: '🧬' }
          ].map((t) => (
            <button
              key={t.label}
              onClick={() => setTopic(t.label)}
              className="px-4 py-2 bg-secondary/5 border border-secondary/20 hover:bg-secondary/10 hover:border-secondary/40 transition-all rounded-full flex items-center gap-2 cursor-pointer"
            >
              <span className="text-lg">{t.icon}</span>
              <span className="font-label text-xs uppercase tracking-wider text-secondary">{t.label}</span>
            </button>
          ))}
        </div>
        
        <div className="writing-tablet p-1 mb-10 shadow-xl">
          <div className="bg-[#dcd9d9] p-8 min-h-[200px] flex flex-col items-center justify-center">
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="예: 수리적 진리, 우주의 질서, 정의의 본질..."
              className="w-full bg-transparent border-none focus:ring-0 font-body text-4xl text-tertiary placeholder-tertiary/30 text-center resize-none leading-tight"
              autoFocus
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!topic.trim()}
          className={`${isDebate ? 'bg-[#28301c]' : 'bg-primary'} text-on-primary px-12 py-5 font-label text-label-md uppercase tracking-[0.2em] transform transition-all active:scale-95 shadow-xl disabled:opacity-30`}
        >
          {isDebate ? '토론 대결 신청' : '탐구 주제 확정'}
        </button>

        <p className="mt-8 font-label text-xs text-outline uppercase italic">
          "반성하지 않는 삶은 살 가치가 없다."
        </p>
      </motion.div>
    </div>
  );
}
