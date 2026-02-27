import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from './store/gameStore';
import { useWebSocket } from './hooks/useWebSocket';
import { useAuthGuard } from './hooks/useAuthGuard';
import { useAuth } from './hooks/useAuth';
import { GameCanvas } from './components/Game/GameCanvas';
import { SoloCanvas } from './components/Game/SoloCanvas';
import { Leaderboard } from './components/UI/Leaderboard';
import { HUD } from './components/UI/HUD';
import { Lobby } from './components/UI/Lobby';
import { InviteModal } from './components/UI/InviteModal';
import { AuthModal } from './components/UI/AuthModal';
import { JoinRoomModal } from './components/UI/JoinRoomModal';
import { FinalRankingOverlay } from './components/UI/FinalRanking';
import { BIRD_SKINS } from './game/BirdSkins';
import { BirdSkinId } from './types';
import { useSound } from './hooks/useSound';
import {
  getGuestId,
  getGuestHighScore,
  getGuestUsername,
} from './services/guestSession';

const CANVAS_W = 400;
const CANVAS_H = 600;

// ── ErrorBoundary ─────────────────────────────────────────
// Catches any unexpected React render error and shows a friendly
// recovery screen instead of a white page.
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info);
  }

  handleReset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f172a',
            color: '#f8fafc',
            fontFamily: 'sans-serif',
            padding: '2rem',
            textAlign: 'center',
            gap: '1rem',
          }}
        >
          <div style={{ fontSize: '4rem' }}>🐦‍💨</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Something crashed!</h1>
          <p style={{ color: '#94a3b8', maxWidth: 360 }}>
            {(this.state.error as Error).message}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 2rem',
              borderRadius: '1rem',
              background: '#38bdf8',
              color: '#0f172a',
              fontWeight: 'bold',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Reload game
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Auth forms ────────────────────────────────────────────────
const AuthScreen: React.FC = () => {
  const { play } = useSound();
  const { login, register } = useAuth();
  const { setUser, setScreen, setGuest, setSoloHighScore } = useGameStore((s) => ({
    setUser:          s.setUser,
    setScreen:        s.setScreen,
    setGuest:         s.setGuest,
    setSoloHighScore: s.setSoloHighScore,
  }));

  const [mode,     setMode]     = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const playAsGuest = () => {
    play('menuClick');
    const id    = getGuestId();
    const best  = getGuestHighScore();
    setUser(null);
    setGuest({ id, username: getGuestUsername(id), highScore: best });
    setSoloHighScore(best);
    setScreen('solo');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    play('menuClick');

    try {
      // useAuth handles HTTP-only cookie + localStorage persistence
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(username, email, password);
      }
      setScreen('menu');
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Logo */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 2.4 }}
        className="text-6xl"
      >
        🐦
      </motion.div>
      <h1 className="gradient-text text-5xl font-black tracking-tight">Flappy Birds</h1>

      <form onSubmit={submit} className="glass-dark w-full max-w-sm rounded-3xl p-6 flex flex-col gap-4">
        <div className="flex gap-1 p-1 bg-white/10 rounded-xl">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); play('menuClick'); }}
              className={[
                'flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all',
                mode === m ? 'bg-white/20 text-white' : 'text-white/40',
              ].join(' ')}
            >
              {m === 'login' ? 'Log In' : 'Register'}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {mode === 'register' && (
            <motion.input
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-sky-400"
            />
          )}
        </AnimatePresence>

        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-sky-400"
        />

        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-sky-400"
        />

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary py-3 mt-1 disabled:opacity-60">
          {loading ? 'Please wait…' : (mode === 'login' ? 'Log In' : 'Create Account')}
        </button>
      </form>

      {/* Guest separator */}
      <div className="flex items-center gap-3 w-full max-w-sm">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/30 text-xs">or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <button
        onClick={playAsGuest}
        className="btn-secondary w-full max-w-sm py-3 text-sm font-semibold"
      >
        👤 Play as Guest
      </button>
    </div>
  );
};

// ── Main menu ─────────────────────────────────────────────────
const MenuScreen: React.FC = () => {
  const { play } = useSound();
  const { requireAuth } = useAuthGuard();
  const { logout } = useAuth();
  const { user, setScreen, selectedSkin, setSkin, setSoloHighScore,
          setPendingJoinRoomId } = useGameStore((s) => ({
    user:                 s.user,
    setScreen:            s.setScreen,
    selectedSkin:         s.selectedSkin,
    setSkin:              s.setSkin,
    setSoloHighScore:     s.setSoloHighScore,
    setPendingJoinRoomId: s.setPendingJoinRoomId,
  }));

  const [showJoinModal, setShowJoinModal] = useState(false);

  // ── Create room (auth-guarded) ─────────────────────────────
  const createRoom = async () => {
    play('menuClick');
    try {
      const res  = await fetch('/api/rooms', {
        method:      'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user!.token}` },
        body:    JSON.stringify({ maxPlayers: 50 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      // Lobby's useEffect will emit join_room → server fires room_joined → sets room in store
      setPendingJoinRoomId(data.roomId);
      setScreen('lobby');
    } catch (err) {
      console.error(err);
    }
  };

  // ── Join room (auth-guarded) ───────────────────────────────
  const handleJoined = (roomId: string) => {
    setPendingJoinRoomId(roomId);
    setScreen('lobby');
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-sm">
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 2.4 }}
        className="text-7xl"
      >
        🐦
      </motion.div>
      <h1 className="gradient-text text-5xl font-black tracking-tight">Flappy Birds</h1>

      {user && (
        <p className="text-white/60 text-sm -mt-4">
          Welcome back, <span className="text-white font-semibold">{user.username}</span>
          &nbsp;· Best: <span className="text-yellow-300 font-bold">{user.highScore}</span>
        </p>
      )}

      {/* Skin selector */}
      <div className="glass rounded-2xl p-4 w-full flex flex-col gap-3">
        <p className="text-white/60 text-xs uppercase tracking-widest text-center">Choose your bird</p>
        <div className="flex justify-center gap-3 flex-wrap">
          {(Object.keys(BIRD_SKINS) as BirdSkinId[]).map((id) => {
            const s = BIRD_SKINS[id];
            const active = id === selectedSkin;
            const locked = user ? (user.highScore < s.unlockScore) : true;
            return (
              <button
                key={id}
                title={locked ? `Unlock at ${s.unlockScore} pts` : s.name}
                disabled={locked}
                onClick={() => { setSkin(id); play('menuClick'); }}
                className={[
                  'flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all',
                  active  ? 'border-white bg-white/10 scale-110' : 'border-transparent opacity-60',
                  locked  ? 'cursor-not-allowed grayscale opacity-30' : 'hover:opacity-90',
                ].join(' ')}
              >
                <div
                  className="w-8 h-8 rounded-full shadow"
                  style={{ backgroundColor: s.bodyColor, boxShadow: s.glowColor ? `0 0 10px ${s.glowColor}` : undefined }}
                />
                <span className="text-white text-xs">{s.name}</span>
                {locked && (
                  <span className="text-white/30 text-xs">{s.unlockScore}pts</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full">
        <button
          onClick={() => requireAuth(createRoom)}
          className="btn-primary py-4 text-lg font-bold"
        >
          {user ? 'Create Room' : '🔒 Create Room'}
        </button>
        <button
          onClick={() => requireAuth(() => setShowJoinModal(true))}
          className="btn-secondary py-3"
        >
          {user ? 'Join Room' : '🔒 Join Room'}
        </button>
        <button
          onClick={() => {
            play('menuClick');
            // Logged-in: use server-persisted best; guest: use localStorage
            const best = user ? user.highScore : getGuestHighScore();
            setSoloHighScore(best);
            setScreen('solo');
          }}
          className="btn-secondary py-3 text-sm"
        >
          🎮 Play Solo
        </button>
      </div>

      {/* Join Room modal — only shown after auth guard passes */}
      <JoinRoomModal
        open={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoined={handleJoined}
      />

      <button
        onClick={() => { logout(); play('menuClick'); }}
        className="text-white/30 text-xs hover:text-white/70 transition-colors"
      >
        Log out
      </button>
    </div>
  );
};

// ── Solo screen ───────────────────────────────────────
const SoloScreen: React.FC = () => {
  const { play } = useSound();
  const { user, guest, soloHighScore, setScreen, setGuest } = useGameStore((s) => ({
    user:          s.user,
    guest:         s.guest,
    soloHighScore: s.soloHighScore,
    setScreen:     s.setScreen,
    setGuest:      s.setGuest,
  }));

  const displayName = user?.username ?? guest?.username ?? 'Player';

  const handleBackToMenu = () => {
    play('menuClick');
    if (user) {
      setScreen('menu');
    } else {
      // guest → back to auth
      setGuest(null);
      setScreen('auth');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between w-full" style={{ maxWidth: 400 }}>
        <button
          onClick={handleBackToMenu}
          className="text-white/40 hover:text-white text-sm transition-colors"
        >
          ← Menu
        </button>
        <span className="text-white/50 text-xs">
          👤 {displayName}
          {soloHighScore > 0 && (
            <>&nbsp;· Best: <span className="text-yellow-300 font-bold">{soloHighScore}</span></>
          )}
        </span>
      </div>

      <SoloCanvas width={400} height={600} onBackToMenu={handleBackToMenu} />
    </div>
  );
};

// ── Game screen ───────────────────────────────────────────────
const GameScreen: React.FC<{ socket: ReturnType<typeof useWebSocket> }> = ({ socket }) => {
  const { score, room, leaderboard, finalRanking, resetGameState, setScreen } =
    useGameStore((s) => ({
      score:          s.score,
      room:           s.room,
      leaderboard:    s.leaderboard,
      finalRanking:   s.finalRanking,
      resetGameState: s.resetGameState,
      setScreen:      s.setScreen,
    }));

  const highScore  = leaderboard[0]?.score ?? 0;
  const [showBoard, setShowBoard] = useState(true);

  const handleDismissFinal = () => {
    resetGameState(); // clears score, leaderboard, room, finalRanking
    setScreen('menu');
  };

  return (
    <>
      <div className="flex items-start gap-4">
        <div className="flex flex-col gap-2">
          <HUD score={score} highScore={highScore} />
          <GameCanvas
            width={400}
            height={600}
            socket={socket}
            roomId={room?.id ?? null}
          />
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowBoard((v) => !v)}
            className="btn-secondary text-xs px-3 py-1.5 self-end"
          >
            {showBoard ? 'Hide' : 'Rankings'}
          </button>
          <Leaderboard visible={showBoard} />
        </div>
      </div>

      {/* Final ranking modal — appears when the server sends final_ranking */}
      <AnimatePresence>
        {finalRanking && (
          <FinalRankingOverlay onDismiss={handleDismissFinal} />
        )}
      </AnimatePresence>
    </>
  );
};

// ── Root ──────────────────────────────────────────────────────
const SCREEN_VARIANTS = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -16 },
};

const App: React.FC = () => {
  const { screen, user, showInviteModal, setShowInviteModal, room, isRestoring, setIsRestoring } =
    useGameStore((s) => ({
      screen:             s.screen,
      user:               s.user,
      showInviteModal:    s.showInviteModal,
      setShowInviteModal: s.setShowInviteModal,
      room:               s.room,
      isRestoring:        s.isRestoring,
      setIsRestoring:     s.setIsRestoring,
    }));

  const socket = useWebSocket();
  const { restoreSession } = useAuth();

  // ── Session restore on app mount ────────────────────────────────
  useEffect(() => {
    setIsRestoring(true);
    restoreSession().then((authUser) => {
      if (authUser) {
        // Valid session found — jump straight to menu
        useGameStore.getState().setScreen('menu');
      }
      setIsRestoring(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Boot splash while restoring ───────────────────────────────
  if (isRestoring) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#020B18] via-[#0a1628] to-[#020B18]
                      flex flex-col items-center justify-center gap-5">
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          className="text-6xl"
        >
          🐦
        </motion.div>
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-4 border-white/10" />
          <div className="absolute inset-0 rounded-full border-4 border-sky-400 border-t-transparent animate-spin" />
        </div>
        <p className="text-white/30 text-sm">Restoring session…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#020B18] via-[#0a1628] to-[#020B18]
                    flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        {screen === 'auth' && (
          <motion.div key="auth" variants={SCREEN_VARIANTS} initial="initial" animate="animate" exit="exit">
            <AuthScreen />
          </motion.div>
        )}

        {screen === 'menu' && (
          <motion.div key="menu" variants={SCREEN_VARIANTS} initial="initial" animate="animate" exit="exit">
            <MenuScreen />
          </motion.div>
        )}

        {screen === 'solo' && (
          <motion.div key="solo" variants={SCREEN_VARIANTS} initial="initial" animate="animate" exit="exit">
            <SoloScreen />
          </motion.div>
        )}

        {screen === 'lobby' && (
          <motion.div key="lobby" variants={SCREEN_VARIANTS} initial="initial" animate="animate" exit="exit">
            <Lobby socket={socket} />
          </motion.div>
        )}

        {screen === 'game' && (
          <motion.div key="game" variants={SCREEN_VARIANTS} initial="initial" animate="animate" exit="exit">
            <GameScreen socket={socket} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global invite modal (can appear on any screen) */}
      <AnimatePresence>
        {showInviteModal && room && (
          <InviteModal roomId={room.id} onClose={() => setShowInviteModal(false)} />
        )}
      </AnimatePresence>

      {/* Global auth modal — shown when a guest attempts a multiplayer action */}
      <AuthModal />
    </div>
  );
};

export default App;
