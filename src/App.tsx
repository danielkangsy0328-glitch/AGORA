/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import DifficultyScreen from './components/DifficultyScreen';
import DialogueScreen from './components/DialogueScreen';
import DebateScreen from './components/DebateScreen';
import SummaryScreen from './components/SummaryScreen';
import LoginScreen from './components/LoginScreen';
import TopicScreen from './components/TopicScreen';
import ForumScreen from './components/ForumScreen';
import GuideScreen from './components/GuideScreen';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { SocraticEvaluation, Message } from './services/geminiService';
import { doc, getDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';

type Screen = 'login' | 'topic' | 'difficulty' | 'dialogue' | 'debate' | 'summary' | 'forum' | 'guide';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('beginner');
  const [mode, setMode] = useState<'dialogue' | 'debate'>('dialogue');
  const [evaluation, setEvaluation] = useState<SocraticEvaluation | null>(null);
  const [reportGuide, setReportGuide] = useState<any>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    // Detect URL parameters for external integration
    const params = new URLSearchParams(window.location.search);
    const externalTopic = params.get('topic');
    const externalDifficulty = params.get('difficulty');
    const embeddedMode = params.get('embed') === 'true';

    if (embeddedMode) setIsEmbedded(true);

    if (externalTopic && user) {
      setTopic(externalTopic);
      if (externalDifficulty) {
        setDifficulty(externalDifficulty);
        setCurrentScreen('dialogue');
      } else {
        setCurrentScreen('difficulty');
      }
    }
  }, [user]);

  useEffect(() => {
    // Safety timeout: if auth takes more than 10 seconds, stop loading
    // to at least allow the UI to try and render or show an error.
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("Auth check timed out.");
        setLoading(false);
      }
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      clearTimeout(timer);
      if (u) {
        setUser({ ...u }); // Spread to ensure fresh state
        if (currentScreen === 'login') setCurrentScreen('topic');
      } else {
        setUser(null);
        setCurrentScreen('login');
      }
      setLoading(false);
    }, (error) => {
      console.error("Auth Error:", error);
      clearTimeout(timer);
      setLoading(false);
      setCurrentScreen('login');
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [currentScreen]);

  const handleTopicSet = (selectedTopic: string) => {
    setTopic(selectedTopic);
    setCurrentScreen('difficulty');
  };

  const handleDifficultySelect = (diff: string) => {
    setDifficulty(diff);
    setCurrentScreen(mode === 'debate' ? 'debate' : 'dialogue');
  };

  const handleDialogueFinish = (evalData: SocraticEvaluation, chatHistory: Message[]) => {
    setEvaluation(evalData);
    setHistory(chatHistory);
    setReportGuide(null);
    setCurrentScreen('summary');
  };

  const handleSessionSelect = async (selectedTopic: string) => {
    if (!user) return;
    
    setTopic(selectedTopic);
    setLoading(true);

    try {
      const hash = selectedTopic.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      
      const chatSideId = `chat_${user.uid}_${Math.abs(hash).toString(36)}`;
      const debateSideId = `debate_${user.uid}_${Math.abs(hash).toString(36)}`;
      
      const chatRef = doc(db, 'sessions', `${user.uid}_${chatSideId}`);
      const debateRef = doc(db, 'sessions', `${user.uid}_${debateSideId}`);
      
      const [chatSnap, debateSnap] = await Promise.all([getDoc(chatRef), getDoc(debateRef)]);
      
      let sessionData = null;
      let finalSessionId = '';
      
      if (chatSnap.exists()) {
        sessionData = chatSnap.data();
        finalSessionId = chatSideId;
        setMode('dialogue');
      } else if (debateSnap.exists()) {
        sessionData = debateSnap.data();
        finalSessionId = debateSideId;
        setMode('debate');
      }

      if (sessionData) {
        const messagesQuery = query(
          collection(db, `conversations/${finalSessionId}/messages`),
          where('userId', '==', user.uid),
          orderBy('timestamp', 'asc')
        );
        const msgsSnap = await getDocs(messagesQuery);
        const fetchedMessages = msgsSnap.docs.map(d => ({
          role: d.data().role,
          content: d.data().content,
          timestamp: d.data().timestamp?.toDate() || new Date(),
        } as Message));

        setHistory(fetchedMessages);

        if (sessionData.completed) {
          setEvaluation(sessionData.evaluation);
          setReportGuide(sessionData.reportGuide || null);
          setCurrentScreen('summary');
        } else {
          setCurrentScreen(sessionData.mode === 'debate' ? 'debate' : 'dialogue');
        }
      } else {
        setCurrentScreen('dialogue');
      }
    } catch (error) {
      console.error("Error loading session:", error);
      setCurrentScreen('dialogue');
    } finally {
      setLoading(false);
    }
  };

  const resetSession = () => {
    setTopic('');
    setDifficulty('beginner');
    setEvaluation(null);
    setCurrentScreen('topic');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen marble-bg bg-background">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full shadow-lg"></div>
      </div>
    );
  }

  const handleExport = () => {
    if (window.parent !== window) {
      window.parent.postMessage({
        type: 'SOCRATIC_SESSION_RESULT',
        payload: {
          topic,
          difficulty,
          evaluation,
          timestamp: new Date().toISOString(),
          user: {
            email: user?.email,
            displayName: user?.displayName,
          }
        }
      }, '*');
      alert('분석 결과가 성공적으로 전송되었습니다.');
    }
  };

  const renderScreen = () => {
    if (!user) return <LoginScreen />;

    switch (currentScreen) {
      case 'login':
        return <LoginScreen />;
      case 'topic':
        return <TopicScreen 
          onContinue={handleTopicSet} 
          mode={mode} 
          onModeChange={(m) => setMode(m as 'dialogue' | 'debate')} 
        />;
      case 'difficulty':
        return (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-160px)]">
            <div className="flex gap-4 mb-12">
              <button 
                onClick={() => setMode('dialogue')}
                className={`px-8 py-3 rounded-full border-2 transition-all font-label text-xs tracking-widest ${mode === 'dialogue' ? 'bg-primary text-white border-primary shadow-lg scale-105' : 'bg-transparent text-stone-400 border-stone-200 hover:border-stone-400'}`}
              >
                사유 탐구 (답을 찾아가는 과정)
              </button>
              <button 
                onClick={() => setMode('debate')}
                className={`px-8 py-3 rounded-full border-2 transition-all font-label text-xs tracking-widest ${mode === 'debate' ? 'bg-[#28301c] text-white border-[#28301c] shadow-lg scale-105' : 'bg-transparent text-stone-400 border-stone-200 hover:border-stone-400'}`}
              >
                찬반 토론 (소크라테스와의 논쟁)
              </button>
            </div>
            <DifficultyScreen onSelect={handleDifficultySelect} />
          </div>
        );
      case 'dialogue':
        return <DialogueScreen user={user} difficulty={difficulty} topic={topic} onFinish={handleDialogueFinish} />;
      case 'debate':
        return <DebateScreen user={user} topic={topic} onFinish={handleDialogueFinish} />;
      case 'summary':
        return <SummaryScreen 
          topic={topic} 
          evaluation={evaluation} 
          history={history}
          user={user}
          mode={mode}
          initialReportGuide={reportGuide}
          onRestart={resetSession} 
          onExport={handleExport}
          isEmbedded={isEmbedded}
        />;
      case 'forum':
        return <ForumScreen user={user} onSelectSession={handleSessionSelect} />;
      case 'guide':
        return <GuideScreen user={user} />;
      default:
        return <TopicScreen onContinue={handleTopicSet} mode={mode} />;
    }
  };

  return (
    <Layout 
      currentScreen={currentScreen} 
      mode={mode}
      onNavigate={(s) => {
        if (!user) return;
        if (s === 'debate-start') {
          setMode('debate');
          setCurrentScreen('topic');
        } else if (s === 'topic') {
          setMode('dialogue');
          setCurrentScreen('topic');
        } else {
          setCurrentScreen(s as Screen);
        }
      }} 
      user={user}
      hideNav={currentScreen === 'login'}
    >
      {renderScreen()}
    </Layout>
  );
}

