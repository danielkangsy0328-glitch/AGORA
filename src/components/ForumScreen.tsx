import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { User } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { generateVirtualEmail } from '../lib/utils';

interface ForumScreenProps {
  user: User;
  onSelectSession: (topic: string) => void;
}

interface Session {
  id: string;
  topic: string;
  userId: string;
  mode?: 'dialogue' | 'debate';
  completed?: boolean;
  reportGuide?: any;
  timestamp: Date;
}

export default function ForumScreen({ user, onSelectSession }: ForumScreenProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [resetTarget, setResetTarget] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!user) return;
    setIsAdmin(user.email === 'danielkangsy0328@gmail.com');

    const sessionsQuery = query(
      collection(db, 'sessions'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(sessionsQuery, (snapshot) => {
      const fetchedSessions = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date(),
        } as Session));

      setSessions(fetchedSessions);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sessions');
    });

    return () => unsubscribe();
  }, [user]);

  const handleAdminReset = async () => {
    if (!resetTarget.trim()) return;
    if (!window.confirm(`"${resetTarget}" 계정의 모든 대화 기록을 초기화하시겠습니까?`)) return;

    setIsResetting(true);
    try {
      // 1. Find user by email or name
      const targetEmail = generateVirtualEmail(resetTarget);
      
      // Try finding by email first (exact match)
      let usersQuery = query(collection(db, 'users'), where('email', '==', targetEmail));
      let userSnap = await getDocs(usersQuery);

      // If not found, try finding by displayName (exact match)
      if (userSnap.empty) {
        usersQuery = query(collection(db, 'users'), where('displayName', '==', resetTarget.trim()));
        userSnap = await getDocs(usersQuery);
      }

      if (userSnap.empty) {
        // As a last resort, we'll try the OLD virtual email format or just alert
        const oldVirtualEmail = `${resetTarget.trim().toLowerCase().replace(/\s/g, '_')}@agora.internal`;
        usersQuery = query(collection(db, 'users'), where('email', '==', oldVirtualEmail));
        userSnap = await getDocs(usersQuery);
      }

      if (userSnap.empty) {
        alert('해당 성함의 계정을 찾을 수 없습니다. (users 컬렉션에 등록되지 않은 구형 계정일 수 있습니다)');
        return;
      }

      const targetUserId = userSnap.docs[0].id;
      const batch = writeBatch(db);

      // 2. Find sessions
      const sessionsQuery = query(collection(db, 'sessions'), where('userId', '==', targetUserId));
      const sessionsSnap = await getDocs(sessionsQuery);

      for (const sessionDoc of sessionsSnap.docs) {
        const topic = sessionDoc.data().topic;
        const hash = topic.split('').reduce((a: number, b: string) => {
          a = ((a << 5) - a) + b.charCodeAt(0);
          return a & a;
        }, 0);
        
        const chatConvId = `chat_${targetUserId}_${Math.abs(hash).toString(36)}`;
        const debateConvId = `debate_${targetUserId}_${Math.abs(hash).toString(36)}`;

        batch.delete(sessionDoc.ref);

        // Clear messages
        const msgsChat = await getDocs(collection(db, `conversations/${chatConvId}/messages`));
        msgsChat.forEach(d => batch.delete(d.ref));
        
        const msgsDebate = await getDocs(collection(db, `conversations/${debateConvId}/messages`));
        msgsDebate.forEach(d => batch.delete(d.ref));
      }

      await batch.commit();
      alert(`"${resetTarget}" 계정의 모든 기록이 초기화되었습니다.`);
      setResetTarget('');
    } catch (error) {
      console.error("Admin reset failed:", error);
      alert('초기화 중 오류가 발생했습니다.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSelfDelete = async () => {
    setIsResetting(true);
    try {
      const batch = writeBatch(db);
      const sessionsQuery = query(collection(db, 'sessions'), where('userId', '==', user.uid));
      const sessionsSnap = await getDocs(sessionsQuery);

      for (const sDoc of sessionsSnap.docs) {
        batch.delete(sDoc.ref);
        // Messages are hard to batch without recursion on client, but we try session first
      }
      
      await batch.commit();
      
      // Also delete the user document in 'users' collection
      await deleteDoc(doc(db, 'users', user.uid));

      alert('모든 기록이 삭제되었습니다. 계정 정보도 초기화되니 다시 가입해 주십시오.');
      
      // Finally delete the Auth user
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          await currentUser.delete();
        } catch (authErr: any) {
          if (authErr.code === 'auth/requires-recent-login') {
            alert('보안을 위해 다시 로그인한 후 탈퇴를 진행해 주십시오.');
            auth.signOut();
          }
        }
      }
    } catch (error) {
      console.error("Self cleanup failed:", error);
    } finally {
      setIsResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-10">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
        <p className="font-label text-xs uppercase tracking-widest text-outline">사유의 기록을 모으는 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-margin-page py-10 w-full">
      <section className="mb-16 text-center">
        <span className="font-label text-xs text-secondary uppercase tracking-[0.4em] mb-4 block underline decoration-dotted decoration-secondary/30 underline-offset-8">AGORA ARCHIVE</span>
        <h1 className="font-headline text-headline-lg text-primary italic">지혜의 광장</h1>
        <p className="font-body text-xl text-on-surface-variant max-w-xl mx-auto mt-6">
          그대가 거쳐온 사유의 발자취이자, 다시금 들여다볼 가치가 있는 문답의 기록입니다.
        </p>
      </section>

      {isAdmin && (
        <div className="mb-12 parchment-texture p-6 chiseled-border border-secondary/40">
          <h2 className="font-headline text-xl text-secondary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined">admin_panel_settings</span>
            관리자 도구 (계정 초기화)
          </h2>
          <div className="flex gap-4">
            <input 
              type="text" 
              value={resetTarget}
              onChange={(e) => setResetTarget(e.target.value)}
              placeholder="초기화할 계정 성함"
              className="flex-1 bg-stone-100 border-none px-4 py-2 font-body text-primary focus:ring-1 focus:ring-secondary"
            />
            <button 
              onClick={handleAdminReset}
              disabled={isResetting || !resetTarget.trim()}
              className="bg-secondary text-white px-6 py-2 font-label text-[10px] uppercase tracking-widest hover:bg-secondary-container transition-all disabled:opacity-50"
            >
              {isResetting ? '처리 중...' : '데이터 초기화'}
            </button>
          </div>
          <p className="mt-2 text-[10px] text-outline italic">* 해당 사용자의 모든 대화 기록(세션 및 메시지)이 삭제됩니다. 로그인 계정 자체는 유지됩니다.</p>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="parchment-texture p-20 text-center chiseled-border border-outline-variant/40">
          <span className="material-symbols-outlined text-outline text-6xl mb-6 opacity-20">history_edu</span>
          <p className="font-body text-2xl text-outline italic">아직 새겨진 사유가 없습니다. 첫 탐구를 시작해 보십시오.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {sessions.map((session) => (
            <motion.button
              key={session.id}
              whileHover={{ scale: 1.01, x: 10 }}
              onClick={() => onSelectSession(session.topic)}
              className="group text-left parchment-texture p-8 border-l-8 border-primary chiseled-border transition-all flex justify-between items-center hover:bg-white/40"
            >
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-2">
                  <span className="font-label text-[10px] text-secondary uppercase tracking-widest">
                    {session.timestamp.toLocaleDateString()}
                  </span>
                  <div className="h-[1px] w-12 bg-outline opacity-20"></div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter ${session.mode === 'debate' ? 'bg-[#28301c] text-white' : 'bg-primary text-white'}`}>
                    {session.mode === 'debate' ? '끝장 토론' : '사유 탐구'}
                  </span>
                  {session.reportGuide && (
                    <span className="material-symbols-outlined text-sm text-secondary" title="보고서 가이드 포함">description</span>
                  )}
                </div>
                <h3 className="font-headline text-2xl text-primary mb-2 group-hover:text-secondary transition-colors">
                  {session.topic}
                </h3>
              </div>
              <span className="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0">chevron_right</span>
            </motion.button>
          ))}
        </div>
      )}

      <div className="mt-20 pt-10 border-t border-outline/10 text-center">
        {!showDeleteConfirm ? (
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isResetting}
            className="text-outline hover:text-error transition-colors font-label text-[10px] uppercase tracking-widest flex items-center gap-2 mx-auto"
          >
            <span className="material-symbols-outlined text-sm">no_accounts</span>
            나의 모든 기록 삭제 및 계정 탈퇴
          </button>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="parchment-texture p-8 chiseled-border border-error/30 max-w-md mx-auto"
          >
            <p className="font-headline text-lg text-error mb-4">정말로 탈퇴하시겠습니까?</p>
            <p className="font-body text-sm text-on-surface-variant mb-6">
              지금까지의 모든 문답 기록과 계정 정보가 영구히 삭제됩니다.<br/>이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-4 justify-center">
              <button 
                onClick={handleSelfDelete}
                disabled={isResetting}
                className="bg-error text-white px-6 py-2 font-label text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg active:scale-95"
              >
                {isResetting ? '삭제 처리 중...' : '확인, 탈퇴함'}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isResetting}
                className="bg-stone-200 text-stone-600 px-6 py-2 font-label text-[10px] uppercase tracking-widest hover:bg-stone-300 transition-all active:scale-95"
              >
                취소
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
