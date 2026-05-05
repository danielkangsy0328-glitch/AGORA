import { motion } from 'motion/react';

interface DifficultyScreenProps {
  onSelect: (difficulty: string) => void;
}

export default function DifficultyScreen({ onSelect }: DifficultyScreenProps) {
  const difficulties = [
    {
      id: 'beginner',
      title: '아테네의 산책',
      description: '문답법적 탐구를 위한 완만한 입문. 안내된 사색을 통해 기초적인 덕목에 대한 명료함을 추구하는 분들에게 적합합니다.',
      icon: 'directions_walk',
      color: 'bg-primary-fixed',
      buttonText: '길 선택하기',
    },
    {
      id: 'intermediate',
      title: '아고라의 토론',
      description: '열띤 공적 담론 속에서 지배적인 논리에 도전하십시오. 복잡한 윤리적 딜레마와 역사적 반론에 맞서 당신의 추론을 정교하게 다듬으세요.',
      icon: 'forum',
      color: 'bg-secondary-container',
      buttonText: '담론 시작하기',
      recommended: true,
    },
    {
      id: 'advanced',
      title: '법정의 심판',
      description: '성실성과 수사적 정밀함에 대한 궁극적인 시험. 민회의 가장 가혹한 감시 아래 당신의 철학을 수호하십시오.',
      icon: 'gavel',
      color: 'bg-tertiary-container text-on-tertiary-container',
      buttonText: '배심원 대면하기',
    },
  ];

  return (
    <div className="max-w-container-max mx-auto px-margin-page py-unit w-full flex flex-col items-center justify-center min-h-[calc(100vh-160px)]">
      <section className="text-center mb-section-gap">
        <span className="font-label text-label text-secondary uppercase tracking-widest mb-4 block">스토아에 오르다</span>
        <h2 className="font-headline text-headline-xl text-primary mb-6">난이도 선택</h2>
        <p className="font-body text-body-lg text-on-surface-variant max-w-2xl mx-auto italic">
          "변화의 비결은 모든 에너지를 과거와 싸우는 데가 아니라, 새로운 것을 짓는 데 집중하는 것이다."
        </p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter w-full pb-10">
        {difficulties.map((diff, index) => (
          <motion.div
            key={diff.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onSelect(diff.id)}
            className={`parchment-texture p-8 flex flex-col items-center text-center relative group cursor-pointer transition-all duration-300 hover:border-secondary shadow-sm ${
              diff.recommended ? 'border-2 border-secondary' : 'chiseled-border'
            }`}
          >
            {diff.recommended && (
              <div className="absolute top-0 right-0 p-2">
                <span className="font-label text-[10px] bg-secondary text-on-secondary px-2 py-1 uppercase tracking-tighter">추천</span>
              </div>
            )}
            <div className={`w-16 h-16 mb-8 flex items-center justify-center rounded-full ${diff.color} border border-outline-variant shadow-inner`}>
              <span className="material-symbols-outlined text-4xl">{diff.icon}</span>
            </div>
            <h3 className="font-headline text-headline-lg text-primary mb-4">{diff.title}</h3>
            <div className={`w-12 h-[2px] ${diff.recommended ? 'bg-secondary' : 'bg-outline-variant'} mb-6`}></div>
            <p className="font-body text-body-md text-on-surface-variant mb-8 leading-relaxed">
              {diff.description}
            </p>
            <div className="mt-auto w-full">
              <button className={`w-full uppercase font-label text-label-md py-4 transition-all duration-300 ${
                diff.recommended 
                  ? 'bg-primary text-on-primary shadow-md active:translate-y-px' 
                  : 'bg-transparent border border-outline hover:bg-primary hover:text-on-primary'
              }`}>
                {diff.buttonText}
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-unit w-full flex justify-center opacity-10 pointer-events-none mb-10">
        <div className="h-24 w-12 column-fluting border-x border-outline-variant"></div>
        <div className="h-24 w-12 column-fluting border-x border-outline-variant mx-12"></div>
        <div className="h-24 w-12 column-fluting border-x border-outline-variant"></div>
      </div>
    </div>
  );
}
