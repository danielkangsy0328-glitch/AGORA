import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { SocraticEvaluation, Message, InquiryReportGuide, generateInquiryReportGuide } from '../services/geminiService';
import { useState } from 'react';
import { User } from 'firebase/auth';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';

interface SummaryScreenProps {
  topic: string;
  evaluation: SocraticEvaluation | null;
  history: Message[];
  user: User;
  mode: 'dialogue' | 'debate';
  initialReportGuide?: InquiryReportGuide | null;
  onRestart: () => void;
  onExport?: () => void;
  isEmbedded?: boolean;
}

export default function SummaryScreen({ topic, evaluation, history, user, mode, initialReportGuide, onRestart, onExport, isEmbedded }: SummaryScreenProps) {
  const [reportGuide, setReportGuide] = useState<InquiryReportGuide | null>(initialReportGuide || null);
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const hash = topic.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const sessionId = `${mode === 'debate' ? 'debate' : 'chat'}_${user?.uid}_${Math.abs(hash).toString(36)}`;

  const chartData = evaluation?.scores || [
    { name: '초기 편향', value: 0, label: 'PREFACE' },
    { name: '엘렌쿠스', value: 0, label: 'ELENCHUS' },
    { name: '주제 심화', value: 0, label: 'DERIVATION' },
    { name: '종합', value: 0, label: 'SYNTHESIS' },
  ];

  const handleGenerateGuide = async () => {
    if (reportGuide) {
      setShowGuide(true);
      return;
    }

    setIsGeneratingGuide(true);
    try {
      const guide = await generateInquiryReportGuide(history, topic);
      
      // Save report guide to Firestore
      const sessionRef = doc(db, 'sessions', `${user.uid}_${sessionId}`);
      await setDoc(sessionRef, {
        reportGuide: guide
      }, { merge: true });

      setReportGuide(guide);
      setShowGuide(true);
    } catch (error) {
      console.error(error);
      alert("가이드를 생성하는 중 오류가 발생했네.");
    } finally {
      setIsGeneratingGuide(false);
    }
  };

  const getBarColor = (index: number, value: number) => {
    if (value === 0) return '#f0f0f0';
    if (value > 80) return '#28301c'; // Strong
    if (value < 40) return '#fdcb9b'; // Weak/High Bias
    return index % 2 === 0 ? '#4a5338' : '#76786f';
  };

  return (
    <div className="max-w-container-max mx-auto px-4 md:px-margin-page py-unit w-full flex flex-col items-center">
      {(!evaluation || evaluation.scores.length === 0) && (
         <div className="w-full text-center py-6 parchment-texture border border-outline/30 opacity-60 mb-6 bg-white/30">
           <p className="font-label text-[10px] uppercase tracking-widest text-outline">분석 데이터가 아직 도달하지 않았네. 사유를 더 나누어 보지 않겠나?</p>
         </div>
      )}
      <div className="w-full max-w-[800px] mb-20 mt-10">
        {/* Scroll Header */}
        <div className="flex flex-col items-center">
          <div className="w-full h-4 bg-secondary-container rounded-t-full shadow-sm"></div>
          <div className="w-[96%] h-2 bg-on-secondary-fixed-variant opacity-20"></div>
          
          <section className="parchment-texture border-x border-outline-variant w-full py-20 px-10 md:px-20 relative overflow-hidden shadow-2xl">
            <div className="text-center mb-16">
              <span className="font-label text-label-md text-secondary uppercase tracking-widest block mb-4">세션 요약</span>
              <h1 className="font-headline text-headline-xl text-primary mb-6 italic leading-tight">{topic}</h1>
              <p className="font-body text-2xl text-on-surface-variant max-w-prose mx-auto">
                {topic}에 관한 질의응답을 통한 사유의 궤적입니다.
              </p>
            </div>

            {/* Chart Section */}
            <div className="mb-section-gap">
              <div className="flex justify-between items-end mb-10">
                <h3 className="font-headline text-headline-lg text-primary">문답법적 추진력</h3>
                <div className="flex gap-6">
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 bg-primary"></span>
                    <span className="font-label text-xs uppercase text-outline font-bold">지식</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 bg-secondary-container border border-outline"></span>
                    <span className="font-label text-xs uppercase text-outline font-bold">아포리아</span>
                  </div>
                </div>
              </div>

              <div className="h-80 w-full mb-10">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 20 }}>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: '#76786f', fontFamily: 'Work Sans', fontWeight: 'bold' }}
                    />
                    <Tooltip 
                      cursor={{ fill: 'rgba(0,0,0,0.02)' }} 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white/90 p-3 border border-outline text-xs uppercase font-label font-bold shadow-xl">
                              추진력: {payload[0].value}%
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="value" radius={[2, 2, 0, 0]} minPointSize={5}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getBarColor(index, entry.value)} stroke="#76786f" strokeWidth={1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Core Definitions Bento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter mb-16">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white/40 p-8 border border-outline-variant/60 relative overflow-hidden group hover:bg-white/60 transition-all duration-300 shadow-sm"
              >
                <span className="absolute top-2 right-4 font-headline text-headline-xl text-black/5 select-none transition-transform group-hover:scale-110">I</span>
                <h4 className="font-label text-label-md text-secondary uppercase mb-4 font-bold tracking-tighter">초기 가설</h4>
                <p className="font-body text-xl italic text-on-surface leading-relaxed">
                  "{evaluation?.initialHypothesis || '사유의 시작점이 아직 정리되지 않았구먼.'}"
                </p>
                <div className="mt-6 pt-6 border-t border-outline/10 text-on-surface-variant text-base">
                   <strong className="text-primary uppercase text-xs font-bold block mb-2">엘렌쿠스 지점:</strong> 
                  {evaluation?.elenchusPoint || '논박의 지점을 분석하는 중이네.'}
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-white/40 p-8 border border-outline-variant/60 relative overflow-hidden group hover:bg-white/60 transition-all duration-300 shadow-sm"
              >
                <span className="absolute top-2 right-4 font-headline text-headline-xl text-black/5 select-none transition-transform group-hover:scale-110">II</span>
                <h4 className="font-label text-label-md text-secondary uppercase mb-4 font-bold tracking-tighter">도달한 사유</h4>
                <p className="font-body text-xl text-on-surface leading-relaxed font-medium">
                  {evaluation?.reachedReason || '탐구의 끝에서 얻은 열매를 갈무리하고 있네.'}
                </p>
                <div className="flex flex-col items-center gap-4 mt-8 pt-8 border-t border-stone-200">
                <button 
                  onClick={handleGenerateGuide}
                  disabled={isGeneratingGuide}
                  className="w-full bg-secondary text-white py-4 font-label text-sm uppercase tracking-[0.3em] font-bold hover:bg-[#61401b] transition-all active:scale-95 shadow-lg flex items-center justify-center gap-3"
                >
                  <span className="material-symbols-outlined">description</span>
                  {isGeneratingGuide ? '가이드 생성 중...' : '탐구 보고서 작성 가이드'}
                </button>
                <p className="text-[10px] text-stone-400 font-label uppercase tracking-tighter">학교 제출용 보고서의 뼈대를 잡아보게나.</p>
              </div>
            </motion.div>
          </div>

            {/* Actions */}
            <div className="flex flex-col items-center gap-8 mt-16 pt-16 border-t border-outline/10">
              {isEmbedded && onExport && (
                <button 
                  onClick={onExport}
                  className="bg-[#28301c] text-white px-12 py-5 font-label text-label-md uppercase tracking-[0.3em] font-bold hover:bg-black transition-all active:scale-95 shadow-2xl flex items-center gap-4"
                >
                  <span className="material-symbols-outlined">send</span>
                  수행평가 결과 전송
                </button>
              )}
              
              <button 
                onClick={onRestart}
                className={`${isEmbedded ? 'text-outline' : 'bg-primary text-on-primary'} px-12 py-5 font-label text-label-md uppercase tracking-[0.3em] font-bold hover:bg-primary-container transition-all active:scale-95 ${!isEmbedded ? 'shadow-2xl' : ''}`}
              >
                {isEmbedded ? '탐구 다시 하기' : '새로운 탐구 시작'}
              </button>
              {!isEmbedded && (
                <button className="text-secondary font-label text-sm uppercase tracking-[0.2em] font-bold border-b-2 border-secondary/30 hover:border-secondary transition-all pb-2 mb-10">
                  성찰 기록 보관
                </button>
              )}
            </div>

            {/* Decorative Overlay */}
            <div className="absolute top-0 left-0 w-full h-10 bg-gradient-to-b from-black/[0.03] to-transparent pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-full h-10 bg-gradient-to-t from-black/[0.03] to-transparent pointer-events-none"></div>
          </section>

          <div className="w-[96%] h-2 bg-on-secondary-fixed-variant opacity-20"></div>
          <div className="w-full h-4 bg-secondary-container rounded-b-full shadow-md"></div>
        </div>
      </div>

      <AnimatePresence>
        {showGuide && reportGuide && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 pointer-events-none"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" onClick={() => setShowGuide(false)}></div>
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white max-w-4xl w-full max-h-full overflow-y-auto chiseled-border shadow-2xl relative z-10 pointer-events-auto p-10 md:p-16 parchment-texture"
            >
               <button 
                onClick={() => setShowGuide(false)}
                className="absolute top-6 right-6 text-stone-400 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-4xl">close</span>
              </button>

              <div className="text-center mb-12">
                <span className="font-label text-xs text-secondary uppercase tracking-[0.4em] block mb-2">Academic Scaffolding</span>
                <h2 className="font-headline text-headline-xl text-primary mb-4">탐구 보고서 설계도</h2>
                <p className="text-stone-500 italic max-w-md mx-auto school-stamp py-2 px-4 border border-stone-200">이 가이드는 사유의 뼈대일 뿐입니다. 문장은 그대의 손으로 직접 완성하십시오.</p>
              </div>

              <div className="space-y-12">
                <section>
                  <h4 className="font-label text-label-md text-secondary uppercase border-b border-stone-200 pb-2 mb-6">1. 권장 제목 (그대의 질문을 제목으로)</h4>
                  <ul className="space-y-3">
                    {reportGuide.suggestedTitles.map((title, i) => (
                      <li key={i} className="flex gap-4 items-start">
                        <span className="text-stone-300 font-headline font-bold">Q{i+1}.</span>
                        <p className="font-headline text-xl text-primary">{title}</p>
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h4 className="font-label text-label-md text-secondary uppercase border-b border-stone-200 pb-2 mb-6">2. 탐구의 동기와 목적 (작성을 위한 발문)</h4>
                  <div className="grid md:grid-cols-2 gap-6">
                    {reportGuide.motivationPrompts.map((prompt, i) => (
                      <div key={i} className="bg-white/50 p-6 border border-stone-100 italic text-stone-600 font-body text-lg">
                        "{prompt}"
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h4 className="font-label text-label-md text-secondary uppercase border-b border-stone-200 pb-2 mb-6">3. 탐구 수행 과정 (Socrates와의 대화 요약)</h4>
                  <div className="space-y-4">
                    {reportGuide.dialogueSummaryPoints.map((point, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0 text-stone-400 text-xs font-bold">{i+1}</div>
                        <p className="text-stone-800 font-body text-lg leading-relaxed">{point}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h4 className="font-label text-label-md text-secondary uppercase border-b border-stone-200 pb-2 mb-6">4. 비판적 성찰 (가장 중요한 깨달음)</h4>
                  <div className="bg-[#28301c] text-white p-8 rounded-sm relative overflow-hidden">
                    <span className="absolute -bottom-4 -right-4 material-symbols-outlined text-8xl opacity-10">lightbulb_circle</span>
                    {reportGuide.criticalThinkingPoints.map((point, i) => (
                      <p key={i} className="mb-4 last:mb-0 text-xl font-medium leading-relaxed italic">
                        {point}
                      </p>
                    ))}
                  </div>
                </section>

                <section className="mb-12">
                  <h4 className="font-label text-label-md text-secondary uppercase border-b border-stone-200 pb-2 mb-6">5. 후속 탐구 과제</h4>
                  <div className="flex flex-wrap gap-3">
                    {reportGuide.futureInquiryQuestions.map((q, i) => (
                      <div key={i} className="px-4 py-2 border border-stone-200 bg-stone-50 rounded-full text-stone-600 text-sm italic">
                        # {q}
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="text-center pt-10 border-t border-stone-100">
                <button 
                  onClick={() => setShowGuide(false)}
                  className="px-10 py-4 bg-stone-800 text-white font-label uppercase tracking-widest hover:bg-black transition-all"
                >
                  사유의 숲으로 돌아가기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
