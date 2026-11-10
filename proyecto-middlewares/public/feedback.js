/* Audio propio, sin archivos externos. Se habilita tras una interacción real. */
(function (root) {
  let audio;
  const melodies = {
    task: [587.33, 783.99],
    level: [523.25, 659.25, 783.99, 1046.5],
    badge: [659.25, 783.99, 1046.5],
    notification: [880, 659.25, 880]
  };
  async function unlock() {
    try {
      const Audio = root.AudioContext || root.webkitAudioContext;
      if (!Audio) return false;
      audio ||= new Audio();
      if (audio.state === 'suspended') await audio.resume();
      return audio.state === 'running';
    } catch { return false; }
  }
  function play(type, muted = false) {
    if (muted || !audio || audio.state !== 'running') return false;
    try {
      (melodies[type] || melodies.task).forEach((frequency, i) => {
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        const start = audio.currentTime + i * .14;
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        oscillator.connect(gain); gain.connect(audio.destination);
        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(type === 'notification' ? .075 : .055, start + .015);
        gain.gain.exponentialRampToValueAtTime(.0001, start + .4);
        oscillator.start(start); oscillator.stop(start + .42);
      });
      return true;
    } catch { return false; }
  }
  // Agrupa avisos pendientes: una melodía por lote, sin volver a sonar al recargar.
  function announce(reminders, options) {
    const fresh = reminders.filter(r => r.due && !r.read && !options.storage.getItem(`vital-sounded:${options.user}:${r.id}`));
    if (!fresh.length) return 0;
    if (!options.muted && !options.play('notification')) return 0;
    for (const r of fresh) options.storage.setItem(`vital-sounded:${options.user}:${r.id}`, '1');
    if (!options.muted) options.toast(fresh.length === 1 ? `Recordatorio: ${fresh[0].titulo}` : `Tienes ${fresh.length} recordatorios pendientes. Revisa tu bandeja.`);
    return fresh.length;
  }
  root.VitalFeedback = { unlock, play, announce };
})(typeof window !== 'undefined' ? window : globalThis);
