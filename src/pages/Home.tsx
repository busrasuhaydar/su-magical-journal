import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, Star } from 'lucide-react';
import { Clock } from '../components/Shell';
import { useEditors } from '../components/Editors';
import { TaskRow } from '../components/TaskRow';
import { Empty, useToast } from '../components/ui';
import { ensureJournalDay, useCalendarRange, useHolidays, useJournal, useOverdue, useProfile, useProgress, useProjects } from '../lib/data';
import { addDays, dayKeyOf, formatRelative, hhmm, minutesOf, todayKey, formatShort } from '../lib/dates';
import { supabase } from '../lib/supabase';
import { flag } from '../lib/countries';
import { usePostsRange } from '../lib/data';
import { OPP_DATE_LABEL, PLATFORM_LABEL, POST_STATUS_LABEL, type Platform } from '../lib/types';
import { EVENT_KIND_LABEL, PRIORITY_ORDER, PROJECT_STATUS_LABEL } from '../lib/types';

export default function Home() {
  const today = todayKey();
  const { openTask } = useEditors();
  const profile = useProfile();
  const day = useCalendarRange(today, today);
  const upcoming = useCalendarRange(addDays(today, 1), addDays(today, 30));
  const hol = useHolidays(today, addDays(today, 30));
  const overdue = useOverdue();
  const projects = useProjects();
  const progress = useProgress();

  const tasks = (day.data?.tasks ?? []).filter((t) => t.status !== 'cancelled');
  const done = tasks.filter((t) => t.status === 'done').length;
  const priorities = tasks.filter((t) => t.status !== 'done').sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const schedule = [
    ...tasks.filter((t) => t.starts_at).map((t) => ({ id: t.id, at: minutesOf(t.starts_at!), title: t.title, sub: 'Görev', done: t.status === 'done' })),
    ...(day.data?.events ?? []).map((e) => ({ id: e.id, at: e.all_day || dayKeyOf(e.starts_at) < today ? -1 : minutesOf(e.starts_at), title: e.title, sub: EVENT_KIND_LABEL[e.kind], done: false })),
  ].sort((a, b) => a.at - b.at);
  const upcomingEvents = (upcoming.data?.events ?? []).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 6);
  const upcomingHol = hol.list.filter((h) => h.country === 'TR' && h.kind === 'public' && h.day > today).slice(0, 3);
  const deadlines = (projects.data ?? []).filter((p) => p.target_date && p.target_date >= today && p.status !== 'completed').sort((a, b) => a.target_date!.localeCompare(b.target_date!)).slice(0, 3);
  const active = (projects.data ?? []).filter((p) => p.status === 'active' || p.status === 'planning').slice(0, 4);

  return (
    <>
      <div className="topbar">
        <div>
          <span className="script" style={{ fontSize: 40, lineHeight: 1 }}>Merhaba {profile.data?.display_name ?? ''}</span>
          <div className="muted">Bugün harika şeyler başaracaksın.</div>
        </div>
        <Clock />
      </div>

      <div className="home-grid">
        <section className="glass panel">
          <div className="panel-head"><h2>Bugünün özeti <Star size={16} color="var(--orange-500)" fill="var(--peach-300)" /></h2></div>
          <DailyGoal />
          <div className="stat-row" style={{ marginTop: 14 }}>
            <div className="stat"><b>{tasks.length}</b><span>Bugünkü görev</span></div>
            <div className="stat"><b>{done}</b><span>Tamamlanan</span></div>
            <div className="stat"><b>{tasks.length - done}</b><span>Kalan</span></div>
          </div>
          {tasks.length > 0 && <div className="prog" style={{ marginTop: 12 }}><b style={{ width: `${Math.round((done / tasks.length) * 100)}%` }} /></div>}
          <h3 style={{ marginTop: 20, marginBottom: 8 }}>Öncelikli görevler</h3>
          {priorities.length === 0 ? <p className="small muted">{tasks.length ? 'Bugünün bütün görevleri tamam ♡' : 'Bugün için görev yok.'}</p> :
            <div className="task-list">{priorities.slice(0, 5).map((t) => <TaskRow key={t.id} task={t} />)}</div>}
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => openTask({ due_date: today })}><Plus size={14} />Görev ekle</button>
            <Link className="btn btn-glass btn-sm" to={`/gun/${today}`}>Günün detayları <ArrowRight size={14} /></Link>
          </div>
        </section>

        <section className="glass panel">
          <div className="panel-head"><h2>Bugünün planı</h2><span className="count">{schedule.length}</span></div>
          {schedule.length === 0 ? <Empty title="Sakin bir gün">Saatlik planınıza görev veya etkinlik ekleyin.</Empty> : (
            <div className="agenda-mini">
              {schedule.map((s) => (
                <div key={s.id} className="it" style={{ opacity: s.done ? 0.55 : 1 }}>
                  <span className="mono">{s.at < 0 ? 'Tüm gün' : hhmm(s.at)}</span>
                  <span><b style={{ fontWeight: 600, textDecoration: s.done ? 'line-through' : undefined }}>{s.title}</b> <span className="small muted">· {s.sub}</span></span>
                </div>
              ))}
            </div>
          )}
          {(overdue.data?.length ?? 0) > 0 && (
            <>
              <h3 style={{ marginTop: 20, marginBottom: 8, color: 'var(--orange-600)' }}>Bekleyen {overdue.data!.length} görev</h3>
              <div className="task-list">{overdue.data!.slice(0, 3).map((t) => <TaskRow key={t.id} task={t} overdue />)}</div>
              {overdue.data!.length > 3 && <Link className="small" to={`/gun/${today}`}>Tümünü gör</Link>}
            </>
          )}
        </section>

        <section className="glass panel">
          <div className="panel-head"><h2>Yaklaşanlar</h2><Link className="small" to="/takvim/ajanda">Ajanda</Link></div>
          <div className="agenda-mini">
            {upcomingEvents.map((e) => (
              <div key={e.id} className="it"><span className="mono">{formatShort(dayKeyOf(e.starts_at))}</span><span><b style={{ fontWeight: 600 }}>{e.title}</b> <span className="small muted">· {EVENT_KIND_LABEL[e.kind]}{e.all_day ? '' : ` · ${hhmm(minutesOf(e.starts_at))}`}</span></span></div>
            ))}
            {deadlines.map((p) => (
              <div key={p.id} className="it"><span className="mono" style={{ color: 'var(--orange-600)' }}>{formatShort(p.target_date!)}</span><span><b style={{ fontWeight: 600 }}>{p.title}</b> <span className="small muted">· proje hedef tarihi</span></span></div>
            ))}
            {(upcoming.data?.oppDates ?? []).filter((d) => d.opportunities && ['deadline', 'opening', 'delivery'].includes(d.kind)).slice(0, 4).map((d) => (
              <div key={d.id} className="it"><span className="mono" style={{ color: 'var(--lilac-500)' }}>{formatShort(d.day)}</span><span><Link to={`/firsatlar/${d.opportunity_id}`} style={{ color: 'inherit', fontWeight: 600, textDecoration: 'none' }}>{d.opportunities!.title}</Link> <span className="small muted">· {OPP_DATE_LABEL[d.kind]}{d.certainty !== 'confirmed' ? ' (kesinleşmedi)' : ''}</span></span></div>
            ))}
            {upcomingHol.map((h) => (
              <div key={h.id} className="it"><span className="mono">{formatShort(h.day)}</span><span>{flag('TR')} {h.local_name}{h.certainty !== 'confirmed' && <span className="small muted"> · kesinleşmedi</span>}</span></div>
            ))}
            {!upcomingEvents.length && !deadlines.length && !upcomingHol.length && <p className="small muted">Önümüzdeki 30 günde kayıt yok.</p>}
          </div>
        </section>

        <QuickIdeas />
        <section className="glass panel span-all">
          <div className="panel-head"><h2>Projelerim</h2><Link className="small" to="/projeler">Tümünü gör →</Link></div>
          {active.length === 0 ? <Empty title="Henüz proje yok"><Link to="/projeler">İlk projenizi ekleyin</Link>, görevleri ona bağlayın; ilerleme yüzdesi kendiliğinden hesaplanır.</Empty> : (
            <div className="cards">
              {active.map((p) => {
                const pr = progress.data?.get(p.id);
                return (
                  <Link key={p.id} to={`/projeler/${p.slug}`} className="card proj-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}><b>{p.title}</b><span className="mono" style={{ color: 'var(--rose-600)' }}>%{pr?.progress ?? 0}</span></div>
                    <div className="prog"><b style={{ width: `${pr?.progress ?? 0}%`, background: `linear-gradient(90deg, ${p.color}88, ${p.color})` }} /></div>
                    <span className="small muted">{PROJECT_STATUS_LABEL[p.status]} · {pr?.done_tasks ?? 0}/{pr?.total_tasks ?? 0} görev{p.target_date ? ` · hedef ${formatRelative(p.target_date)}` : ''}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass panel">
          <SocialSummary />
          <div className="panel-head" style={{ marginTop: 18 }}><h2>Yakında</h2></div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="soon-card"><b>Akıllı Asistan</b> · Faz 5. Yalnız sizin kayıtlarınıza dayanarak öneri yapacak.</div>
            <div className="soon-card"><b>Zaman Makinesi</b> · Faz 5. Değişiklik geçmişi şimdiden kaydediliyor.</div>
          </div>
        </section>
      </div>
    </>
  );
}

function DailyGoal() {
  const today = todayKey();
  const j = useJournal(today);
  const qc = useQueryClient();
  const toast = useToast();
  const [v, setV] = useState('');
  useEffect(() => { setV(j.data?.day?.goal ?? ''); }, [j.data?.day?.goal]);
  async function save() {
    if ((j.data?.day?.goal ?? '') === v) return;
    try {
      const jd = await ensureJournalDay(today);
      const { error } = await supabase.from('journal_days').update({ goal: v || null }).eq('id', jd.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['journal'] }); toast.ok('Günün hedefi kaydedildi');
    } catch (x) { toast.fail(x); }
  }
  return <input id="home-goal" className="goal" aria-label="Günün hedefi" value={v} onChange={(e) => setV(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} placeholder="Günün hedefi: bugün neyi başarmak istiyorsun?" />;
}

function SocialSummary() {
  const today = todayKey();
  const week = usePostsRange(today, addDays(today, 6));
  const posts = week.data ?? [];
  const todays = posts.filter((p) => dayKeyOf(p.scheduled_at!) === today);
  const count = (pl: Platform) => posts.filter((p) => p.status !== 'published' && p.post_targets?.some((t) => t.platform === pl)).length;
  const failed = posts.filter((p) => p.status === 'failed').length;
  return (
    <>
      <div className="panel-head"><h2>Sosyal Medya</h2><Link className="small" to="/sosyal">Tümü →</Link></div>
      <div className="stat-row">{(['instagram', 'x', 'youtube', 'website'] as Platform[]).map((pl) => <div key={pl} className="stat" style={{ minWidth: 70 }}><b>{count(pl)}</b><span>{PLATFORM_LABEL[pl]}</span></div>)}</div>
      <p className="small muted" style={{ margin: '8px 0' }}>Önümüzdeki 7 günde planlı · {posts.filter((p) => p.status === 'published').length} yayınlandı{failed ? ` · ${failed} başarısız` : ''}</p>
      {todays.length > 0 && <div className="agenda-mini">{todays.map((p) => <div key={p.id} className="it"><span className="mono">{hhmm(minutesOf(p.scheduled_at!))}</span><span><b style={{ fontWeight: 600 }}>{p.title}</b> <span className="small muted">· {POST_STATUS_LABEL[p.status]}</span></span></div>)}</div>}
    </>
  );
}

function QuickIdeas() {
  const qc = useQueryClient();
  const toast = useToast();
  const [t, setT] = useState('');
  const overdue = useOverdue().data?.length ?? 0;
  const today = todayKey();
  const up = useCalendarRange(today, addDays(today, 7)).data;
  const dl = up?.oppDates?.find((d) => d.kind === 'deadline');
  const tip = overdue ? `${overdue} bekleyen görevin var; önce onları bugüne al ya da ertele.` : dl ? `${dl.opportunities?.title} için son başvuru ${formatShort(dl.day)}. Hazırlık görevlerine bak.` : 'Takvimin bu hafta sakin; yeni bir fikri projeye dönüştürmek için iyi zaman.';
  async function save() {
    const v = t.trim(); if (!v) return;
    const [first, ...rest] = v.split('\n');
    const { error } = await supabase.from('ideas').insert({ title: first.slice(0, 200), body: rest.join('\n').trim() || null, category: 'art' });
    if (error) return toast.fail(error);
    setT(''); qc.invalidateQueries({ queryKey: ['ideas'] }); toast.ok('Fikir kaydedildi ✦');
  }
  return (
    <section className="glass panel">
      <div className="panel-head"><h2>Aklımdakiler</h2><Link className="small" to="/fikirler">Tüm fikirler →</Link></div>
      <p className="small" style={{ marginTop: 0, color: 'var(--rose-600)' }}>✦ {tip}</p>
      <textarea id="qi" className="textarea" style={{ minHeight: 110 }} value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); }} placeholder="Aklına gelen her şeyi yaz… (ilk satır başlık · ⌘+Enter kaydeder)" />
      <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={save}>Fikri kaydet</button>
    </section>
  );
}
