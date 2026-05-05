import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

type Screen = 'login' | 'topic' | 'difficulty' | 'dialogue' | 'debate' | 'summary' | 'forum' | 'guide';

interface LayoutProps {
  children: ReactNode;
  currentScreen: Screen;
  onNavigate: (screen: string) => void;
  user: User | null;
  mode?: 'dialogue' | 'debate';
  hideNav?: boolean;
}

export default function Layout({ children, currentScreen, onNavigate, user, mode, hideNav }: LayoutProps) {
  const handleLogout = () => {
    signOut(auth);
  };

  const showBottomNav = user && !hideNav;
  const showTopBar = !hideNav || currentScreen === 'forum'; // Always show top bar in forum or if not hidden

  return (
    <div className="min-h-screen flex flex-col marble-bg bg-background font-body transition-colors duration-500">
      {/* Top Bar */}
      {showTopBar && (
        <header className="fixed top-0 z-50 w-full bg-[#f4f1ea] border-b-2 border-[#d1cebd] shadow-[0_1px_0_0_rgba(255,255,255,0.5)] flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 overflow-hidden rounded-full border-2 border-primary shadow-sm">
              <img 
                alt="Socrates" 
                className="w-full h-full object-cover" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDh_UNPx9X6r_eX7hBwtbbfVYiNcxbDosj-qiOUFMLxCq96ELQstn94F5DmWt2KWtjFFCLoUOqTuC9vOj8S2rfpknhCtXelo-9TRTWb6oW0Czzm7GF39x7y14GxQv0Mxsp2LivLOLgM3Rh802jHPfMzJ8vfhjIxAR8gajZWtdc7Z_ADvPnxlaKirCYJ5lfyoNYvCfm0nrylDGo9ml7vv1_cn8GlOEZ7Er_IHmL-WNdOTiGCV2XkigbISQyEixoPHox1VUVapGqy-Oib" 
              />
            </div>
            <span className="text-xl font-bold tracking-[0.2em] text-primary font-headline uppercase hidden sm:inline">AGORA</span>
          </div>
          
          <div className="flex items-center gap-6">
            {user && (
              <div className="flex items-center gap-4">
                <div className="hidden md:block text-right">
                  <p className="font-label text-[10px] text-outline uppercase tracking-wider">현명한 탐구자</p>
                  <p className="font-headline text-sm text-primary font-bold">{user.displayName || '이름 없음'}</p>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 hover:bg-[#e9e6d9] transition-colors rounded-full flex items-center justify-center group"
                  title="Log Out"
                >
                  <span className="material-symbols-outlined text-primary group-hover:scale-110 transition-transform">logout</span>
                </button>
              </div>
            )}
            {!user && currentScreen !== 'login' && (
              <button className="material-symbols-outlined text-primary">settings</button>
            )}
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={`flex-1 ${showTopBar ? 'mt-20' : ''} ${showBottomNav ? 'mb-20' : ''} overflow-x-hidden`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Bar */}
      {showBottomNav && (
        <nav className="fixed bottom-0 left-0 w-full z-50 h-20 bg-[#f4f1ea] backdrop-blur-sm border-t-2 border-[#d1cebd] flex justify-around items-center px-4 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <button 
            onClick={() => onNavigate('topic')}
            className={`flex flex-col items-center justify-center h-full px-6 transition-all duration-300 ${((currentScreen === 'topic' || currentScreen === 'dialogue' || currentScreen === 'difficulty') && mode === 'dialogue') ? 'text-primary border-t-4 border-primary -mt-[2px]' : 'text-stone-400 opacity-60 hover:opacity-100'}`}
          >
            <span className={`material-symbols-outlined mb-1 ${((currentScreen === 'topic' || currentScreen === 'dialogue' || currentScreen === 'difficulty') && mode === 'dialogue') ? 'fill-1' : ''}`}>edit_note</span>
            <span className="font-headline text-[10px] font-semibold tracking-tighter uppercase">탐구</span>
          </button>

          <button 
            onClick={() => onNavigate('debate-start')}
            className={`flex flex-col items-center justify-center h-full px-6 transition-all duration-300 ${(currentScreen === 'debate' || ((currentScreen === 'topic' || currentScreen === 'difficulty') && mode === 'debate')) ? 'text-[#28301c] border-t-4 border-[#28301c] -mt-[2px]' : 'text-stone-400 opacity-60 hover:opacity-100'}`}
          >
            <span className={`material-symbols-outlined mb-1 ${(currentScreen === 'debate' || ((currentScreen === 'topic' || currentScreen === 'difficulty') && mode === 'debate')) ? 'fill-1' : ''}`}>gavel</span>
            <span className="font-headline text-[10px] font-semibold tracking-tighter uppercase">토론</span>
          </button>

          <button 
            onClick={() => onNavigate('forum')}
            className={`flex flex-col items-center justify-center h-full px-6 transition-all duration-300 ${currentScreen === 'forum' ? 'text-primary border-t-4 border-primary -mt-[2px]' : 'text-stone-400 opacity-60 hover:opacity-100'}`}
          >
            <span className={`material-symbols-outlined mb-1 ${currentScreen === 'forum' ? 'fill-1' : ''}`}>forum</span>
            <span className="font-headline text-[10px] font-semibold tracking-tighter uppercase">기록</span>
          </button>

          <button 
            onClick={() => onNavigate('guide')}
            className={`flex flex-col items-center justify-center h-full px-6 transition-all duration-300 ${currentScreen === 'guide' ? 'text-primary border-t-4 border-primary -mt-[2px]' : 'text-stone-400 opacity-60 hover:opacity-100'}`}
          >
            <span className={`material-symbols-outlined mb-1 ${currentScreen === 'guide' ? 'fill-1' : ''}`}>help_center</span>
            <span className="font-headline text-[10px] font-semibold tracking-tighter uppercase">도움</span>
          </button>
          

        </nav>
      )}

      <style dangerouslySetInnerHTML={{ __html: `.fill-1 { font-variation-settings: 'FILL' 1; }` }} />
    </div>
  );
}
