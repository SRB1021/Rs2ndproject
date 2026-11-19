// ── Music — plays uploaded MP4 track on loop ──────────────────────────────
export const music = (() => {
  let audio = null;
  let muted = false;

  return {
    start() {
      if (audio) return;
      audio = new Audio('music.mp4');
      audio.loop   = true;
      audio.volume = 0.6;
      // Browsers require a user gesture before play(); game-start is triggered
      // by the host clicking "Start Game", so this fires inside a user gesture chain.
      audio.play().catch(() => {
        // Autoplay blocked — will start on next user interaction
        const resume = () => { audio.play(); document.removeEventListener('keydown', resume); document.removeEventListener('touchstart', resume); };
        document.addEventListener('keydown',   resume, { once: true });
        document.addEventListener('touchstart', resume, { once: true });
      });
    },

    stop() {
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
      audio = null;
    },

    toggleMute() {
      muted = !muted;
      if (audio) audio.volume = muted ? 0 : 0.6;
      const btn = document.getElementById('mute-btn');
      if (btn) btn.textContent = muted ? '♪ OFF' : '♪ ON';
    },
  };
})();
