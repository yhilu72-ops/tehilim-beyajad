/* Room reading uses the same bundled text and atomic seats as the existing app. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const relevant = () => ['#sala_real', '#mis_capitulos', '#leer_sala'].includes(location.hash);
  const room = () => window.selectedRealRoom || null;
  const get = (key, fallback = '') => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
  const put = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  let context = null, rows = [], generation = 0, textPromise, chosenChapter = 0, loadedChapter = '', channel, listSignature = '';
  const saving = new Set();
  const own = status => rows.filter(r => r.is_mine && r.status === status).sort((a,b) => a.chapter_number - b.chapter_number);
  const key = (ctx, chapter) => `tbj_reading_choice:${ctx.user}:${ctx.room}:${ctx.round}:${chapter}`;
  const current = ctx => context === ctx && room()?.id === ctx.room && relevant();
  const notice = (message, error = false) => {
    for (const id of ['tbjMyReadingStatus','tbjRoomReaderStatus']) {
      const node = $(id); if (node) { node.textContent = message; node.classList.toggle('is-error', error); }
    }
  };
  function bookChoice(chapter) { return context ? get(key(context, chapter)) : ''; }
  function renderList() {
    const pending = own('claimed'), done = own('completed');
    const summary = $('tbjRoomReadingSummary');
    if (summary) summary.textContent = pending.length
      ? `${pending.length} ${pending.length === 1 ? 'capítulo pendiente' : 'capítulos pendientes'} · ${done.length} leídos por ti en esta vuelta`
      : done.length ? `Ya leíste ${done.length} ${done.length === 1 ? 'capítulo' : 'capítulos'} en esta vuelta.` : 'Elige tus capítulos y lee aquí o en tu libro.';
    const main = $('tbjRoomReadingOpen');
    if (main) { main.href = pending.length || done.length ? '#mis_capitulos' : '#seleccionar'; main.textContent = pending.length ? 'Leer mis capítulos' : done.length ? 'Ver mis capítulos' : 'Elegir capítulos'; }
    if ($('tbjMyReadingContext')) $('tbjMyReadingContext').textContent = context ? `Vuelta ${context.round} · ${pending.length} pendientes · ${done.length} leídos` : '';
    if (!$('tbjMyReadingList')) return;
    const signature = JSON.stringify(pending.map(r => [r.chapter_number, bookChoice(Number(r.chapter_number)), saving.has(Number(r.chapter_number))]));
    if (signature !== listSignature) $('tbjMyReadingList').innerHTML = pending.map(r => {
      const ch = Number(r.chapter_number), choice = bookChoice(ch);
      const label = choice === 'later' ? 'Para leer después' : choice === 'book' ? 'Lectura en tu libro' : 'Pendiente de lectura';
      return `<article class="tbj-reading-item" data-reading-item="${ch}"><div class="tbj-reading-item-title"><h3>Capítulo ${ch}</h3><span class="tbj-reading-badge">${label}</span></div>
        <div class="tbj-reading-actions"><button type="button" class="btn" data-read-chapter="${ch}">Leer en la app</button><button type="button" class="btn soft" data-book-chapter="${ch}" aria-expanded="false" aria-controls="tbjBookChoice${ch}">Leer en mi libro</button></div>
        <div id="tbjBookChoice${ch}" class="tbj-book-choice" hidden><p>Puedes leerlo ahora o dejarlo para después. Seguirá pendiente hasta que marques que lo terminaste.</p><div class="tbj-reading-actions"><button type="button" class="btn soft" data-book-now="${ch}">Lo leo ahora en mi libro</button><button type="button" class="btn soft" data-book-later="${ch}">Lo leeré después</button></div></div>
        <button type="button" class="tbj-read-done" data-complete-chapter="${ch}" ${saving.has(ch) ? 'disabled' : ''}>${saving.has(ch) ? 'Guardando…' : '✓ Ya terminé este capítulo'}</button></article>`;
    }).join('') || '<div class="tbj-reading-empty"><h3>No tienes capítulos pendientes</h3><p>Puedes elegir otros capítulos disponibles para seguir participando.</p><a class="btn" href="#seleccionar">Elegir capítulos</a></div>';
    listSignature = signature;
    $('tbjMyReadingDone').hidden = !done.length;
    $('tbjMyReadingDoneCount').textContent = `Leídos por mí (${done.length})`;
    $('tbjMyReadingDoneList').textContent = done.map(r => r.chapter_number).join(' · ');
  }
  function clear() {
    context = null; rows = []; loadedChapter = ''; listSignature = ''; chosenChapter = 0; generation++;
    $('tbjMyReadingList').replaceChildren();
    $('tbjMyReadingDone').hidden = true;
    $('tbjRoomReaderText').replaceChildren();
    $('tbjRoomReaderComplete').disabled = true;
    $('tbjRoomReadingSummary').textContent = 'Entra a la sala para ver tus capítulos.';
  }
  async function call(name, args) {
    const {data, error} = await window.sb.rpc(name, args);
    if (error) throw error;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }
  function subscribe(ctx) {
    if (channel?.room === ctx.room) return;
    if (channel) window.sb.removeChannel(channel.subscription);
    channel = null;
    if (!window.sb.channel) return;
    const subscription = window.sb.channel(`tbj_room_reading_${ctx.room}`)
      .on('postgres_changes', {event:'*', schema:'public', table:'chapter_claims', filter:`room_id=eq.${ctx.room}`}, () => refresh())
      .subscribe();
    channel = {room:ctx.room, subscription};
  }
  async function refresh() {
    if (!relevant()) return;
    if (context && room()?.id !== context.room) clear();
    const ticket = ++generation, selected = room();
    try {
      if (!selected?.id || !window.sb) throw Error('Primero entra a una sala.');
      const {data, error} = await window.sb.auth.getUser();
      if (error || !data?.user) throw Error('Inicia sesión para ver tus capítulos.');
      const roundResult = await window.sb.from('rooms').select('current_round').eq('id', selected.id).single();
      if (roundResult.error || !roundResult.data) throw Error('No se pudo consultar esta sala.');
      const next = {room:selected.id, user:data.user.id, round:Number(roundResult.data.current_round || 1)};
      const result = await call('tbj_seat_list', {p_room_id:next.room, p_round_number:next.round, p_read_mode:'normal'});
      if (ticket !== generation || room()?.id !== selected.id || !relevant()) return;
      // Keep context identity stable so an unrelated refresh cannot cancel an in-flight save.
      if (!context || ['room','user','round'].some(k => context[k] !== next[k])) { context = next; loadedChapter = ''; listSignature = ''; chosenChapter = 0; }
      rows = (Array.isArray(result) ? result : []).filter(r => Number.isInteger(Number(r.chapter_number)) && r.chapter_number >= 1 && r.chapter_number <= 150);
      renderList(); subscribe(context);
      if (location.hash === '#leer_sala') await renderReader();
    } catch (error) {
      if (ticket !== generation || !relevant()) return;
      clear(); notice('No se pudieron cargar tus capítulos. ' + (error.message || 'Vuelve a intentar.'), true);
      $('tbjRoomReadingSummary').textContent = 'No se pudieron consultar tus capítulos. Entra para volver a intentar.';
      $('tbjRoomReadingOpen').href = '#mis_capitulos';
    }
  }
  function loadText() {
    if (!textPromise) textPromise = fetch('tehilim.json').then(r => { if (!r.ok) throw Error('No se pudo cargar el texto.'); return r.json(); }).catch(e => { textPromise = null; throw e; });
    return textPromise;
  }
  async function renderReader() {
    const ctx = context; if (!ctx) return;
    const pending = own('claimed');
    if (!chosenChapter) chosenChapter = Number(get(`tbj_reading_cursor:${ctx.user}:${ctx.room}:${ctx.round}`, String(pending[0]?.chapter_number || 0)));
    let row = rows.find(r => r.is_mine && Number(r.chapter_number) === chosenChapter && ['claimed','completed'].includes(r.status));
    if (!row) { chosenChapter = Number(pending[0]?.chapter_number || 0); row = pending[0]; }
    const ch = chosenChapter;
    $('tbjRoomReaderNext').hidden = true;
    if (!row) {
      $('tbjRoomReaderTitle').textContent = 'Tus lecturas';
      $('tbjRoomReaderText').innerHTML = '<p>Ya no tienes capítulos pendientes en esta vuelta.</p><a class="btn" href="#mis_capitulos">Ver mis capítulos</a>';
      $('tbjRoomReaderComplete').hidden = true; return;
    }
    $('tbjRoomReaderTitle').textContent = `Capítulo ${ch}`;
    $('tbjRoomReaderContext').textContent = `Tu sala · vuelta ${ctx.round}`;
    const button = $('tbjRoomReaderComplete'), completed = row.status === 'completed';
    button.hidden = false; button.disabled = completed || saving.has(ch); button.dataset.completeChapter = ch;
    button.textContent = completed ? '✓ Lectura registrada' : saving.has(ch) ? 'Guardando…' : `Ya terminé el capítulo ${ch}`;
    const next = pending.find(r => Number(r.chapter_number) > ch) || pending.find(r => Number(r.chapter_number) !== ch);
    if (completed && next) { $('tbjRoomReaderNext').hidden = false; $('tbjRoomReaderNext').dataset.readChapter = next.chapter_number; }
    const language = ['he','en','both'].includes(get('tbj_language')) ? get('tbj_language') : 'he';
    $('tbjRoomReaderLanguage').value = language;
    const id = `${ctx.user}:${ctx.room}:${ctx.round}:${ch}:${language}`;
    if (loadedChapter === id) return;
    loadedChapter = id;
    $('tbjRoomReaderText').textContent = 'Cargando capítulo…'; button.disabled = true;
    try {
      const all = await loadText();
      if (!current(ctx) || loadedChapter !== id || location.hash !== '#leer_sala') return;
      const chapter = all.chapters[ch];
      if (!chapter?.hebrew?.length) throw Error('No se encontró el texto de este capítulo.');
      const verses = (values, cls, lang, dir) => `<div class="${cls}" lang="${lang}" dir="${dir}">${values.map((v,i) => `<p><sup>${i+1}</sup> ${esc(v)}</p>`).join('')}</div>`;
      $('tbjRoomReaderText').innerHTML = (language !== 'en' ? verses(chapter.hebrew, 'tbj-room-hebrew', 'he', 'rtl') : '') + (language !== 'he' ? verses(chapter.english, 'tbj-english', 'en', 'ltr') : '');
      button.disabled = completed || saving.has(ch);
      put(`tbj_reading_cursor:${ctx.user}:${ctx.room}:${ctx.round}`, String(ch));
    } catch (error) {
      if (!current(ctx) || loadedChapter !== id) return;
      loadedChapter = ''; $('tbjRoomReaderText').textContent = 'No pudimos cargar el texto. Vuelve a intentar o lee este capítulo en tu libro.';
      button.disabled = true; notice(error.message, true);
    }
  }
  async function complete(chapter) {
    const ctx = context;
    if (!ctx || !current(ctx) || saving.has(chapter) || !own('claimed').some(r => Number(r.chapter_number) === chapter)) return;
    saving.add(chapter); renderList(); if (location.hash === '#leer_sala') renderReader();
    try {
      const result = await call('tbj_seat_complete_chapter', {p_room_id:ctx.room, p_round_number:ctx.round, p_chapter_number:chapter, p_read_mode:'normal'});
      if (!result?.ok) throw Error('Este capítulo ya no aparece entre tus pendientes. Actualiza la lista.');
      if (!current(ctx)) return;
      rows = rows.map(r => r.is_mine && Number(r.chapter_number) === chapter ? {...r, status:'completed'} : r);
      notice(`✓ Capítulo ${chapter} registrado como leído. Gracias por participar.`);
      window.dispatchEvent(new Event('tbj:chapters-changed'));
      if (typeof window.loadRoomProgressV59 === 'function') window.loadRoomProgressV59();
    } catch (error) { if (current(ctx)) notice('No se guardó la lectura. ' + (error.message || 'Vuelve a intentar.'), true); }
    finally { saving.delete(chapter); if (current(ctx)) { renderList(); if (location.hash === '#leer_sala') renderReader(); } }
  }
  document.addEventListener('click', event => {
    const b = event.target.closest('[data-read-chapter],[data-book-chapter],[data-book-now],[data-book-later],[data-complete-chapter]');
    if (!b || b.disabled || !context || !current(context)) return;
    const ch = Number(b.dataset.readChapter || b.dataset.bookChapter || b.dataset.bookNow || b.dataset.bookLater || b.dataset.completeChapter);
    if (!Number.isInteger(ch) || ch < 1 || ch > 150) return;
    if (b.dataset.completeChapter) { complete(ch); return; }
    if (b.dataset.readChapter) {
      chosenChapter = ch; loadedChapter = ''; notice('');
      if (location.hash === '#leer_sala') { renderReader(); window.scrollTo(0,0); } else location.hash = '#leer_sala';
    } else if (b.dataset.bookChapter) {
      const box = $(`tbjBookChoice${ch}`); box.hidden = !box.hidden; b.setAttribute('aria-expanded', String(!box.hidden));
    } else {
      const later = !!b.dataset.bookLater;
      put(key(context, ch), later ? 'later' : 'book'); renderList();
      notice(later ? `Capítulo ${ch} guardado para después. Lo encontrarás en «Mis capítulos» de esta sala.` : `Lee el capítulo ${ch} en tu libro. Cuando termines, toca «Ya terminé este capítulo».`);
    }
  });
  $('tbjRoomReaderLanguage').addEventListener('change', e => { put('tbj_language', e.target.value); loadedChapter = ''; renderReader(); });
  $('tbjRoomReaderFont').value = get('tbj_font','30');
  $('tbjRoomReaderFont').addEventListener('change', e => { put('tbj_font', e.target.value); document.documentElement.style.setProperty('--tbj-reading-size', e.target.value + 'px'); });
  $('tbjReadingRetry').addEventListener('click', () => { notice(''); refresh(); });
  $('tbjReaderRetry').addEventListener('click', () => { loadedChapter = ''; notice(''); refresh(); });
  function route() {
    if (!relevant()) { generation++; if (channel) window.sb.removeChannel(channel.subscription); channel = null; return; }
    notice(''); refresh();
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('tbj:chapters-changed', refresh);
  window.addEventListener('tbj:resume', refresh);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  // Realtime is best-effort. The fallback keeps a second session in sync.
  setInterval(() => { if (!document.hidden && relevant()) refresh(); }, 15000);
  window.sb?.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') { clear(); notice('Inicia sesión para ver tus capítulos.'); } });
  route();
})();
