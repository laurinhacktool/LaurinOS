import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, LogOut, Mail, Key, UserPlus, LogIn, Loader2, User, Clock } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, doc, setDoc, serverTimestamp, getDoc } from '../firebase';

interface AuthScreenProps {
  onAuthSuccess: (userData: any) => void;
  onPowerOff: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess, onPowerOff }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const time = new Date();
  const hours = String(time.getHours()).padStart(2, '0');
  const minutes = String(time.getMinutes()).padStart(2, '0');
  const day = String(time.getDate()).padStart(2, '0');
  const month = String(time.getMonth() + 1).padStart(2, '0');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let user;
      if (isLogin) {
        const result = await signInWithEmailAndPassword(auth, email, password);
        user = result.user;
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        user = result.user;
      }

      if (!user) throw new Error("Nepodarilo sa overiť používateľa.");

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: isLogin ? (userSnap.exists() ? userSnap.data().displayName : user.email?.split('@')[0]) : (displayName || user.email?.split('@')[0]),
        photoURL: user.photoURL || null,
        role: 'user',
        isOnline: true,
        updatedAt: serverTimestamp()
      };

      if (!userSnap.exists() || !isLogin) {
        await setDoc(userRef, {
          ...userData,
          createdAt: serverTimestamp(),
        }, { merge: true });
      } else {
        await setDoc(userRef, { isOnline: true, updatedAt: serverTimestamp() }, { merge: true });
      }

      onAuthSuccess({
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL
      });
    } catch (err: any) {
      console.error("Auth Error:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Nesprávny e-mail alebo heslo.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Tento e-mail sa už používa.');
      } else if (err.code === 'auth/weak-password') {
        setError('Heslo musí mať aspoň 6 znakov.');
      } else {
        setError(err.message || "Vyskytla sa chyba pri autentifikácii.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0],
        photoURL: user.photoURL,
        role: 'user',
        isOnline: true,
        updatedAt: serverTimestamp()
      };

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          ...userData,
          createdAt: serverTimestamp(),
        });
      } else {
        await setDoc(userRef, { isOnline: true, updatedAt: serverTimestamp() }, { merge: true });
      }

      onAuthSuccess({
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL
      });
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      setError(err.message || "Chyba pri prihlasovaní cez Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden text-white flex flex-col items-center justify-center" style={{ background: 'linear-gradient(135deg, #2e1065 0%, #0f172a 40%, #082f49 100%)' }}>
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(147,51,234,0.3) 0%, rgba(0,0,0,0) 70%)' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.2) 0%, rgba(0,0,0,0) 70%)' }} />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 flex flex-col items-center w-full max-w-md px-4"
      >
        <div className="text-6xl font-black tracking-tighter mb-2 drop-shadow-lg">{hours}:{minutes}</div>
        <div className="text-lg font-medium opacity-80 mb-8 tracking-widest">{day}.{month}.</div>
        
        <div className="glass-panel p-8 rounded-3xl flex flex-col items-center gap-6 w-full shadow-2xl border border-white/10">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-2 relative group overflow-hidden">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                </motion.div>
              ) : (
                <motion.div
                  key="lock"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center w-full h-full"
                >
                  <Lock className="w-8 h-8 text-white/80 group-hover:opacity-0 transition-opacity" />
                  <button 
                    onClick={onPowerOff}
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/20"
                    title="Vypnúť"
                  >
                    <LogOut className="w-8 h-8 text-red-400" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-black tracking-tight mb-1">LaurinOS</h1>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
              {isLogin ? 'Prihlásenie do systému' : 'Vytvorenie nového uzla'}
            </p>
          </div>
          
          <form onSubmit={handleEmailAuth} className="w-full flex flex-col gap-4">
            {!isLogin && (
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider ml-1">Meno / Alias</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Tvoje meno"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required={!isLogin}
                    className="w-full bg-black/30 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-all"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider ml-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  placeholder="napr. roman@lau.mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-black/30 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider ml-1">Heslo</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-black/30 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-all"
                />
              </div>
            </div>
            
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-red-400 text-[10px] font-bold text-center bg-red-400/10 py-2 px-3 rounded-lg border border-red-400/20"
              >
                {error}
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-3 rounded-xl transition-all mt-2 shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />
              )}
              {isLogin ? 'VSTÚPIŤ' : 'REGISTROVAŤ'}
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4 text-white/40 text-[10px] font-bold uppercase tracking-widest">alebo</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white text-gray-900 hover:bg-gray-100 font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google Auth
            </button>

            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-[10px] text-gray-400 hover:text-white transition-colors uppercase font-bold tracking-widest mt-2"
            >
              {isLogin ? 'Nemáš účet? Vytvor si ho' : 'Už máš účet? Prihlás sa'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

