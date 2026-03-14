import React, { useEffect, useMemo, useState } from 'react';
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
import { useGameDimensions } from './hooks/useGameDimensions';
import {
  getGuestId,
  getGuestHighScore,
  getGuestUsername,
} from './services/guestSession';
import { apiErrorMessage, apiUrl, parseJsonResponse } from './services/http';

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

// ── Star field ────────────────────────────────────────────
const StarField: React.FC = () => {
  const stars = useMemo(() => {
    const sizes = ['star-s', 'star-m', 'star-l'] as const;
    return Array.from({ length: 60 }, (_, i) => ({
      id:    i,
      left:  `${Math.random() * 100}%`,
      top:   `${Math.random() * 100}%`,
      size:  sizes[Math.floor(Math.random() * 3)],
      delay: `${(Math.random() * 4).toFixed(2)}s`,
      dur:   `${(2 + Math.random() * 3).toFixed(2)}s`,
    }));
  }, []);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((s) => (
        <div
          key={s.id}
          className={`star ${s.size}`}
          style={{
            left:             s.left,
            top:              s.top,
            animationName:    'star-twinkle',
            animationDuration: s.dur,
            animationDelay:   s.delay,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          }}
        />
      ))}
    </div>
  );
};

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
      // If user followed a /join/:roomId link, send them straight to the lobby
      const pending = useGameStore.getState().pendingJoinRoomId;
      setScreen(pending ? 'lobby' : 'menu');
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:gap-6 w-full max-w-sm">
      {/* Logo */}
      <motion.div
        animate={{ y: [0, -12, 0], rotate: [-4, 4, -4] }}
        transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut' }}
        className="text-5xl sm:text-7xl filter drop-shadow-[0_0_20px_rgba(255,165,0,0.7)]"
      >
        🐦
      </motion.div>
      <div className="text-center">
        <h1 className="arcade-title text-3xl sm:text-5xl font-black tracking-tight">Flappy Birds</h1>
        <p className="text-white/40 text-xs sm:text-sm mt-1 tracking-widest uppercase">Multiplayer Edition</p>
      </div>

      <form onSubmit={submit} className="glass-dark w-full max-w-sm rounded-3xl p-6 flex flex-col gap-4 shadow-arcade">
        <div className="flex gap-1 p-1 bg-white/10 rounded-xl">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); play('menuClick'); }}
              className={[
                'flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200',
                mode === m
                  ? 'bg-gradient-to-r from-brand-yellow/60 to-brand-orange/40 text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70',
              ].join(' ')}
            >
              {m === 'login' ? '🔓 Log In' : '🎮 Register'}
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
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-neon-yellow/60 focus:shadow-[0_0_12px_rgba(255,224,0,0.2)] transition-all"
            />
          )}
        </AnimatePresence>

        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-neon-yellow/60 focus:shadow-[0_0_12px_rgba(255,224,0,0.2)] transition-all"
        />

        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-neon-yellow/60 focus:shadow-[0_0_12px_rgba(255,224,0,0.2)] transition-all"
        />

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-400 text-sm text-center bg-red-500/10 rounded-xl px-3 py-2 border border-red-500/20"
          >
            ⚠️ {error}
          </motion.p>
        )}

        <button type="submit" disabled={loading} className="btn-arcade py-3 mt-1 disabled:opacity-60">
          {loading ? '⏳ Please wait…' : (mode === 'login' ? '🔓 Log In' : '🎉 Create Account')}
        </button>
      </form>

      {/* Guest separator */}
      {/* <div className="flex items-center gap-3 w-full max-w-sm">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/30 text-xs">or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

    {  <button
        onPointerDown={(e) => { e.preventDefault(); playAsGuest(); }}
        className="btn-secondary w-full max-w-sm font-semibold"
        style={{ minHeight: 52, fontSize: '1rem', touchAction: 'manipulation' }}
      >
        👤 Play as Guest
      </button> } */}
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
      const res  = await fetch(apiUrl('/api/rooms'), {
        method:      'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user!.token}` },
        body:    JSON.stringify({ maxPlayers: 50 }),
      });
      const data = await parseJsonResponse<{ roomId: string; message?: string; error?: string }>(res);
      if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to create room'));
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
    <div className="flex flex-col items-center gap-4 sm:gap-5 w-full max-w-sm relative">
      {/* Decorative star field */}
      <div className="fixed inset-0 pointer-events-none">
        <StarField />
      </div>

      {/* Animated bird logo */}
      <motion.div
        animate={{ y: [0, -14, 0], rotate: [-5, 5, -5] }}
        transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut' }}
        className="text-6xl sm:text-8xl mt-1 sm:mt-2 relative z-10 filter drop-shadow-[0_0_24px_rgba(255,165,0,0.75)]"
        style={{ lineHeight: 1 }}
      >
        🐦
      </motion.div>

      <div className="text-center relative z-10">
        <h1 className="arcade-title text-3xl sm:text-5xl font-black tracking-tight">Flappy Birds</h1>
        <p className="text-white/45 text-xs mt-1 tracking-widest uppercase font-semibold">
          Multiplayer Arcade
        </p>
      </div>

      {user && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl px-4 py-2.5 flex items-center gap-3 relative z-10 -mt-2"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-yellow to-brand-orange
                          flex items-center justify-center text-sm font-black text-white shadow-glow">
            {user.username[0].toUpperCase()}
          </div>
          <div>
            <p className="text-white/55 text-xs">Welcome back</p>
            <p className="text-white font-bold text-sm leading-tight">
              {user.username}
              <span className="ml-2 text-brand-yellow text-xs">⭐ {user.highScore}</span>
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Skin selector ── */}
      <div className="glass-dark rounded-3xl p-4 w-full relative z-10">
        <p className="text-white/50 text-xs uppercase tracking-widest text-center mb-3 font-semibold">
          Choose your bird
        </p>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(BIRD_SKINS) as BirdSkinId[]).map((id) => {
            const s      = BIRD_SKINS[id];
            const active = id === selectedSkin;
            const locked = user ? (user.highScore < s.unlockScore) : (s.unlockScore > 0);
            const rarityColor =
              s.rarity === 'legendary' ? '#fbbf24'
              : s.rarity === 'epic'    ? '#c084fc'
              : s.rarity === 'rare'    ? '#60a5fa'
              :                          '#94a3b8';
            return (
              <button
                key={id}
                title={locked ? `🔒 Unlock at ${s.unlockScore} pts` : s.name}
                disabled={locked}
                onClick={() => { setSkin(id); play('menuClick'); }}
                className={[
                  'skin-card',
                  active  ? 'active'  : '',
                  locked  ? 'locked'  : '',
                ].join(' ')}
                style={active ? { boxShadow: s.glowColor ? `0 0 16px ${s.glowColor}` : undefined } : {}}
              >
                {/* Bird glow circle */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xl shadow-md"
                  style={{
                    backgroundColor: s.bodyColor,
                    boxShadow: active && s.glowColor ? `0 0 14px ${s.glowColor}` : undefined,
                  }}
                >
                  {s.emoji}
                </div>
                <span className="text-white text-[10px] font-bold leading-tight truncate w-full text-center">
                  {s.name}
                </span>
                {locked ? (
                  <span className="text-white/35 text-[9px]">{s.unlockScore}pts</span>
                ) : (
                  <span
                    className="text-[9px] font-bold"
                    style={{ color: rarityColor }}
                  >
                    {(s.rarity ?? 'common').charAt(0).toUpperCase() + (s.rarity ?? 'common').slice(1)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div className="flex flex-col gap-3 w-full relative z-10">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => requireAuth(createRoom)}
          className="btn-arcade py-4 text-lg"
        >
          🏆 {user ? 'Create Room' : '🔒 Create Room'}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => requireAuth(() => setShowJoinModal(true))}
          className="btn-secondary py-3 font-bold"
        >
          🚀 {user ? 'Join Room' : '🔒 Join Room'}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            play('menuClick');
            const best = user ? user.highScore : getGuestHighScore();
            setSoloHighScore(best);
            setScreen('solo');
          }}
          className="btn-secondary py-3 text-sm font-semibold"
        >
          🎮 Play Solo
        </motion.button>
      </div>

      {/* Join Room modal — only shown after auth guard passes */}
      <JoinRoomModal
        open={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoined={handleJoined}
      />

      <button
        onClick={() => { logout(); play('menuClick'); }}
        className="text-white/50 text-sm hover:text-white/80 transition-colors relative z-10
                   py-2 px-4 rounded-xl border border-white/10 hover:border-white/25"
      >
        ↩ Log out
      </button>
    </div>
  );
};

// ── Solo screen ───────────────────────────────────────
const SoloScreen: React.FC = () => {
  const { width, height } = useGameDimensions('solo');
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
    <div className="flex flex-col items-center gap-2 w-full h-full px-2 pt-2 pb-2">
      {/* Top bar */}
      <div className="flex items-center justify-between w-full" style={{ maxWidth: width }}>
        <button
          onClick={handleBackToMenu}
          className="text-white/40 hover:text-white text-sm transition-colors py-2 pr-4"
          style={{ touchAction: 'manipulation', minHeight: 44, minWidth: 44 }}
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

      <SoloCanvas width={width} height={height} onBackToMenu={handleBackToMenu} />
    </div>
  );
};

// ── Game screen ───────────────────────────────────────────────
const GameScreen: React.FC<{ socket: ReturnType<typeof useWebSocket> }> = ({ socket }) => {
  const { width, height } = useGameDimensions('game');
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
  // Default to hidden on mobile so game canvas is unobstructed
  const [showBoard, setShowBoard] = useState(false);

  const handleDismissFinal = () => {
    // Reset per-round state but keep the room — go back to lobby
    // so the host can start a new round with all players.
    useGameStore.getState().setFinalRanking(null);
    useGameStore.getState().setScore(0);
    useGameStore.getState().setIsAlive(true);
    useGameStore.getState().setCountdown(null);
    useGameStore.getState().setLeaderboard([]);
    useGameStore.getState().setTimerRemaining(null);
    useGameStore.getState().setTimerTotal(null);
    useGameStore.getState().setIsTimerMode(false);
    setScreen('lobby');
  };

  return (
    <>
      <div className="absolute inset-0 flex items-center justify-center md:relative md:inset-auto md:items-start w-full h-full">
        {/* Canvas column — absolute centered fullscreen on mobile */}
        <div className="flex flex-col items-center gap-1 w-full md:w-auto">
          {/* HUD — hide on mobile to maximise canvas space */}
          <div className="hidden md:block">
            <HUD score={score} highScore={highScore} />
          </div>
          <GameCanvas
            width={width}
            height={height}
            socket={socket}
            roomId={room?.id ?? null}
          />
        </div>

        {/* Sidebar leaderboard — hidden on mobile, shown on md+ */}
        <div className="hidden md:flex flex-col gap-2 ml-2">
          <button
            onClick={() => setShowBoard((v) => !v)}
            className="btn-secondary text-xs px-3 py-1.5 self-end"
          >
            {showBoard ? 'Hide' : 'Rankings'}
          </button>
          <Leaderboard visible={showBoard} />
        </div>

        {/* Mobile: floating toggle for leaderboard overlay */}
        <div className="md:hidden absolute top-2 right-2 z-20">
          <button
            onPointerDown={(e) => { e.preventDefault(); setShowBoard((v) => !v); }}
            className="w-10 h-10 rounded-full bg-black/50 border border-white/20
                       text-white text-lg flex items-center justify-center backdrop-blur-sm"
            style={{ touchAction: 'manipulation' }}
          >
            🏆
          </button>
        </div>

        {/* Mobile: overlay leaderboard */}
        <AnimatePresence>
          {showBoard && (
            <motion.div
              key="mobile-board"
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 80 }}
              className="md:hidden absolute top-14 right-2 z-20 w-56
                         bg-gray-900/90 border border-white/10 rounded-xl
                         backdrop-blur-md shadow-2xl overflow-hidden"
            >
              <Leaderboard visible />
            </motion.div>
          )}
        </AnimatePresence>
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
    // Check if the user followed a /join/:roomId invite link.
    // Store the room ID so Lobby emits join_room after the socket connects.
    const pathMatch = window.location.pathname.match(/^\/join\/([^/]+)/);
    if (pathMatch) {
      // Preserve exact case — room IDs are base64url (case-sensitive)
      const joinRoomId = pathMatch[1];
      useGameStore.getState().setPendingJoinRoomId(joinRoomId);
      // Clean up the URL so refreshing doesn't re-trigger the join
      window.history.replaceState({}, '', '/');
    }

    setIsRestoring(true);
    restoreSession().then((authUser) => {
      if (authUser) {
        // Valid session found — go to lobby if a room is pending, else menu
        const pending = useGameStore.getState().pendingJoinRoomId;
        useGameStore.getState().setScreen(pending ? 'lobby' : 'menu');
      }
      setIsRestoring(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Boot splash while restoring ───────────────────────────────
  if (isRestoring) {
    return (
      <div
        className="bg-gradient-to-b from-arcade-bg via-arcade-surface to-arcade-bg
                    flex flex-col items-center justify-center gap-6 relative overflow-hidden"
        style={{ width: '100%', height: '100%' }}
      >
        <StarField />
        {/* Glow orb */}
        <div className="absolute w-80 h-80 rounded-full pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(255,165,0,0.12) 0%, transparent 70%)',
                      top: '30%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        <motion.div
          animate={{ y: [0, -14, 0], rotate: [-5, 5, -5] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
          className="text-8xl relative z-10 filter drop-shadow-[0_0_30px_rgba(255,165,0,0.8)]"
          style={{ lineHeight: 1 }}
        >
          🐦
        </motion.div>
        <div className="text-center relative z-10">
          <h1 className="arcade-title text-5xl font-black tracking-tight">Flappy Birds</h1>
          <p className="text-white/35 text-xs mt-2 tracking-[0.35em] uppercase font-semibold">
            Multiplayer Arcade
          </p>
        </div>
        {/* Loading bar */}
        <div className="relative z-10 w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #FFD700, #FF9500, #FF4500)' }}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.4, ease: 'easeInOut' }}
          />
        </div>
        <p className="text-white/25 text-xs relative z-10 tracking-widest">Loading…</p>
      </div>
    );
  }

  return (
    <div
      className="bg-gradient-to-b from-arcade-bg via-arcade-surface to-arcade-bg relative overflow-hidden"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Persistent subtle glow orb at the top */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-xl h-64
                    rounded-full pointer-events-none opacity-30"
        style={{ background: 'radial-gradient(ellipse, rgba(255,165,0,0.18) 0%, transparent 70%)' }}
      />

      {/* ── Page screens (auth / menu / lobby) — scrollable on small viewports ── */}
      <div
        className="absolute inset-0 overflow-x-hidden overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        <div className="min-h-full w-full max-w-full flex items-center justify-center px-4 py-8">
          <AnimatePresence mode="wait">
            {screen === 'auth' && (
              <motion.div
                key="auth"
                variants={SCREEN_VARIANTS} initial="initial" animate="animate" exit="exit"
                className="w-full max-w-sm"
              >
                <AuthScreen />
              </motion.div>
            )}
            {screen === 'menu' && (
              <motion.div
                key="menu"
                variants={SCREEN_VARIANTS} initial="initial" animate="animate" exit="exit"
                className="w-full max-w-sm"
              >
                <MenuScreen />
              </motion.div>
            )}
            {screen === 'lobby' && (
              <motion.div
                key="lobby"
                variants={SCREEN_VARIANTS} initial="initial" animate="animate" exit="exit"
                className="w-full max-w-md"
              >
                <Lobby socket={socket} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Full-screen layers (solo / game) — no scroll, canvas-direct touch ── */}
      <AnimatePresence>
        {screen === 'solo' && (
          <motion.div
            key="solo"
            className="absolute inset-0 overflow-hidden"
            style={{ touchAction: 'none' }}
            variants={SCREEN_VARIANTS}
            initial="initial" animate="animate" exit="exit"
          >
            <SoloScreen />
          </motion.div>
        )}
        {screen === 'game' && (
          <motion.div
            key="game"
            className="absolute inset-0 overflow-hidden"
            style={{ touchAction: 'none' }}
            variants={SCREEN_VARIANTS}
            initial="initial" animate="animate" exit="exit"
          >
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
