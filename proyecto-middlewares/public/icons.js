/* Iconos propios en SVG: el mismo trazo y proporción en toda la interfaz. */
window.VitalIcons = (() => {
  const paths = {
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    tasks:'<rect x="4" y="3" width="16" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>',
    health:'<path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
    achievements:'<path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v5m-4 3h8m-8 0 2-3h4l2 3"/>',
    coach:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
    settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--card)"/><circle cx="15" cy="17" r="3" fill="var(--card)"/>',
    bell:'<path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 8H3c0-1 3-1 3-8Zm4 12h4"/>',
    volume:'<path d="m11 4-6 5H2v6h3l6 5V4Zm5 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    mute:'<path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6"/>',
    moon:'<path d="M20.8 13.2A9 9 0 0 1 10.8 3.1a9 9 0 1 0 10 10.1Z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
    water:'<path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
    activity:'<path d="M2 12h4l3-8 6 16 3-8h4"/>',
    streak:'<path d="M12 2c1 6 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 2-4s0 4 2 4c3 0 3-6 2-12Z"/>'
  };
  function icon(name) { return `<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.coach}</svg>`; }
  function paint() {
    document.querySelectorAll('[data-kinetic]').forEach(el => {
      if(el.childElementCount)return;
      el.innerHTML='<div class="kinetic-orbit"><span></span></div><div class="kinetic-flower">'+Array.from({length:6},(_,i)=>`<i style="--petal:${i}"></i>`).join('')+'</div><div class="kinetic-face"><svg viewBox="0 0 50 50" aria-hidden="true"><path d="M17 20v3m16-3v3M16 31q9 9 18 0" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg></div><span class="kinetic-chip chip-check">✓</span><span class="kinetic-chip chip-plus">+</span>';
    });
    document.querySelectorAll('#main-nav a').forEach(a => { const span=a.querySelector('span');if(span)span.innerHTML=icon(a.dataset.view); });
    const put=(selector,name)=>{ const el=document.querySelector(selector);if(el)el.innerHTML=icon(name); };
    put('#theme-toggle',document.body.classList.contains('dark')?'sun':'moon');
    put('#mute-toggle',localStorage.getItem('vital-muted')==='true'?'mute':'volume');
    const bell=document.querySelector('#notification-toggle');
    if(bell){bell.querySelector('svg')?.remove();bell.firstChild?.nodeType===Node.TEXT_NODE&&bell.firstChild.remove();bell.insertAdjacentHTML('afterbegin',icon('bell'));}
    document.querySelectorAll('.stat-icon').forEach((el,i)=>{el.innerHTML=icon(['tasks','water','activity','streak'][i]);});
    const coach=document.querySelector('.coach-card h2>span');if(coach)coach.innerHTML=icon('coach');
    put('.coach-orb','coach');
  }
  return { paint };
})();
window.VitalIcons.paint();
