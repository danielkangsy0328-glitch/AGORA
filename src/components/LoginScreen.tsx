import React, { useState } from 'react';
import { motion } from 'motion/react';
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from '../lib/firebase';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { generateVirtualEmail, generateLegacyVirtualEmail } from '../lib/utils';
import { FirebaseError } from 'firebase/app';
import { isValidName } from '../lib/moderation';

export default function LoginScreen() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || !password) {
      setError('성함과 비밀번호를 모두 입력해 주십시오.');
      return;
    }

    if (isSignUp && !isValidName(cleanName)) {
      setError('성함에 부적절한 표현이 포함되어 있습니다. 다른 성함을 사용해 주십시오.');
      return;
    }

    setIsLoading(true);
    setError('');

    const virtualEmail = generateVirtualEmail(cleanName);

    try {
      if (isSignUp) {
        if (password.length < 6) throw { code: 'auth/weak-password' };
        
        try {
          const { user } = await createUserWithEmailAndPassword(auth, virtualEmail, password);
          await updateProfile(user, { displayName: cleanName });
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            displayName: cleanName,
            email: virtualEmail,
            createdAt: new Date()
          });
        } catch (signUpErr: any) {
          const code = signUpErr.code || '';
          if (code === 'auth/email-already-in-use') {
            // Self-correction: if name is taken, try logging in instead
            console.log("Name taken, attempting automatic login...");
            await signInWithEmailAndPassword(auth, virtualEmail, password);
          } else {
            throw signUpErr;
          }
        }
      } else {
        // Sign In logic
        try {
          await signInWithEmailAndPassword(auth, virtualEmail, password);
        } catch (signInErr: any) {
          const errorCode = (signInErr as FirebaseError).code || signInErr.code || '';
          
          // If robust login fails, try legacy login for backward compatibility
          if (errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-credential') {
            const legacyEmail = generateLegacyVirtualEmail(cleanName);
            if (legacyEmail !== virtualEmail) {
              try {
                await signInWithEmailAndPassword(auth, legacyEmail, password);
              } catch (legacyErr: any) {
                // If legacy also fails, it's a real credential/user error
                throw signInErr;
              }
            } else {
              throw signInErr;
            }
          } else {
            throw signInErr;
          }
        }
      }
    } catch (err: any) {
      console.error("Auth failed:", err);
      let message = '성함 또는 비밀번호를 확인해 주십시오.';
      
      const errorCode = (err as FirebaseError).code || err.code || '';

      if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
        message = isSignUp 
          ? '이미 가입된 성함입니다. 비밀번호가 틀렸거나 다른 분이 사용 중일 수 있습니다.'
          : '성함 또는 비밀번호가 일치하지 않습니다.';
      } else if (errorCode === 'auth/email-already-in-use') {
        message = '이미 사용 중인 성함입니다. 다른 성함을 사용하시거나 로그인을 시도해 보십시오.';
      } else if (errorCode === 'auth/weak-password') {
        message = '비밀번호가 너무 취약합니다 (최소 6자 이상).';
      } else if (errorCode === 'auth/too-many-requests') {
        message = '로그인 시도가 너무 많아 잠시 차단되었습니다. 잠시 후 다시 시도해 주십시오.';
      }

      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-160px)] px-4 py-10 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="parchment-texture p-10 md:p-16 chiseled-border max-w-xl w-full relative"
      >
        <div className="w-24 h-24 mx-auto mb-8 overflow-hidden rounded-full border-4 border-primary shadow-2xl bg-surface">
          <img 
            alt="Socrates" 
            className="w-full h-full object-cover" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDh_UNPx9X6r_eX7hBwtbbfVYiNcxbDosj-qiOUFMLxCq96ELQstn94F5DmWt2KWtjFFCLoUOqTuC9vOj8S2rfpknhCtXelo-9TRTWb6oW0Czzm7GF39x7y14GxQv0Mxsp2LivLOLgM3Rh802jHPfMzJ8vfhjIxAR8gajZWtdc7Z_ADvPnxlaKirCYJ5lfyoNYvCfm0nrylDGo9ml7vv1_cn8GlOEZ7Er_IHmL-WNdOTiGCV2XkigbISQyEixoPHox1VUVapGqy-Oib" 
          />
        </div>
        
        <h1 className="font-headline text-headline-lg text-primary mb-6 font-bold">
          {isSignUp ? '아고라 가입' : '아고라 입문'}
        </h1>

        <form onSubmit={handleAuth} className="space-y-6">
          <div className="space-y-4">
            <div className="writing-tablet p-1">
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="성함 (이름)"
                className="w-full bg-[#dcd9d9]/50 border-none focus:ring-0 px-4 py-4 font-headline text-xl text-primary text-center placeholder-primary/30 font-bold"
                required
              />
            </div>

            <div className="writing-tablet p-1">
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="w-full bg-[#dcd9d9]/50 border-none focus:ring-0 px-4 py-4 font-headline text-xl text-primary text-center placeholder-primary/30 font-bold"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-error text-sm font-label uppercase font-bold bg-error/10 py-2 border-x-4 border-error">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="bg-primary text-on-primary px-8 py-5 font-label text-lg uppercase tracking-[0.3em] font-black shadow-lg hover:bg-primary-container transition-all active:scale-95 disabled:opacity-50 w-full"
          >
            {isLoading ? '관문이 열리는 중...' : (isSignUp ? '가입하기' : '입장하기')}
          </button>
        </form>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="mt-8 font-label text-xs text-primary uppercase tracking-widest font-bold hover:underline decoration-2"
        >
          {isSignUp ? '이미 계정이 있으신가요? 입장하기' : '처음 방문하셨나요? 가입하기'}
        </button>

        <p className="mt-10 font-label text-[10px] text-outline uppercase tracking-[0.2em] font-bold opacity-60">
          "지혜는 자신의 무지를 아는 데서 시작된다"
        </p>
      </motion.div>
    </div>
  );
}
