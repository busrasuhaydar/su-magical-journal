import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CalendarHeart, CheckSquare, FolderHeart, Home, Settings, Files, Plus, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, LogOut, Sparkles, Megaphone, Users, Lightbulb, Landmark, Images } from 'lucide-react';
import { formatLong, minutesOf, hhmm, todayKey } from '../lib/dates';
import { useProfile } from '../lib/data';
import { supabase } from '../lib/supabase';
import { useEditors } from './Editors';
import { NotificationBell } from './NotificationBell';
import { QuickSearch } from './QuickSearch';

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(t); }, []);
  return now;
}

// Open-Meteo: anahtarsız, Bursa
const WMO: [number[], string, typeof Sun][] = [
  [[0, 1], 'Açık', Sun], [[2, 3], 'Parçalı bulutlu', Cloud], [[45, 48], 'Sisli', CloudFog],
  [[51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82], 'Yağmurlu', CloudRain],
  [[71, 73, 75, 77, 85, 86], 'Karlı', CloudSnow], [[95, 96, 99], 'Fırtınalı', CloudLightning],
];
export function useWeather() {
  return useQuery({
    queryKey: ['weather', 'bursa'],
    staleTime: 30 * 60_000,
    retry: 0,
    queryFn: async () => {
      const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=40.19&longitude=29.06&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FIstanbul&forecast_days=1');
      if (!r.ok) throw new Error('hava durumu');
      const j = await r.json();
      const code = j.current.weather_code as number;
      const m = WMO.find(([codes]) => codes.includes(code)) ?? WMO[1];
      const temp = Math.round(j.current.temperature_2m as number);
      const rain = Math.round((j.daily.precipitation_probability_max?.[0] ?? 0) as number);
      const hi = Math.round(j.daily.temperature_2m_max[0] as number), lo = Math.round(j.daily.temperature_2m_min[0] as number);
      const wind = Math.round(j.current.wind_speed_10m as number);
      const tips: string[] = [];
      if (rain >= 50 || m[1] === 'Yağmurlu') tips.push('Şemsiyeni al ☂');
      if (m[1] === 'Karlı') tips.push('Kar var, sıcak giyin ❄');
      if (m[1] === 'Fırtınalı') tips.push('Fırtına olası, dışarı çıkacaksan dikkat');
      if (temp <= 8) tips.push('Soğuk, mont şart');
      else if (temp <= 16) tips.push('Serin, ince bir ceket iyi olur');
      else if (temp >= 29) tips.push('Sıcak, bol su iç');
      if (wind >= 30) tips.push('Rüzgâr sert');
      if (!tips.length) tips.push(m[1] === 'Açık' ? 'Hava güzel, kısa bir yürüyüş iyi gelir' : 'Çıkmak için uygun bir gün');
      return { temp, feels: Math.round(j.current.apparent_temperature as number), label: m[1], Icon: m[2], rain, hi, lo, wind, tip: tips.join(' · ') };
    },
  });
}

export function Clock() {
  const now = useNow();
  const w = useWeather();
  return (
    <div className="glass clock">
      <div>
        <div className="date">{formatLong(todayKey())}</div>
        <div className="time">{hhmm(minutesOf(now))}</div>
      </div>
      {w.data && (
        <div className="weather" title="Open-Meteo">
          <w.data.Icon size={20} color="var(--orange-500)" />
          <span><b>{w.data.temp}°C</b><br />Bursa · {w.data.label}</span>
        </div>
      )}
    </div>
  );
}

const NAV: [string, string, typeof Home][] = [
  ['/', 'Ana Sayfa', Home], ['/takvim/yil', 'Takvim', CalendarDays], ['/gun', 'Günlük Plan', CalendarHeart],
  ['/gorevler', 'Görevler', CheckSquare], ['/projeler', 'Projelerim', FolderHeart], ['/sosyal', 'Sosyal Medya', Megaphone], ['/firsatlar', 'Sergiler ve Fırsatlar', Landmark],
  ['/kisiler', 'Kişiler', Users], ['/fikirler', 'Fikirler ve Notlar', Lightbulb], ['/galeri', 'Ortak Galeri', Images], ['/dosyalar', 'Dosyalar', Files], ['/ayarlar', 'Ayarlar', Settings],
];

export function Shell() {
  const profile = useProfile();
  const { openTask } = useEditors();
  const nav = useNavigate();
  return (
    <div className="app">
      <aside className="sidebar glass" style={{ borderRadius: 0, borderTop: 0, borderBottom: 0, borderLeft: 0 }}>
        <NavLink to="/" className="brand">Su's Magical Journal</NavLink>
        <div className="hello">
          <b>Merhaba {profile.data?.display_name ?? ''} ♡</b>
          <span className="small muted">Hayallerin her zaman seninle.</span>
        </div>
        <nav className="nav" aria-label="Ana menü">
          {NAV.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} end={to === '/'} title={label}><Icon size={18} strokeWidth={1.75} /><span className="lbl">{label}</span></NavLink>
          ))}
        </nav>
        <div style={{ marginTop: 'auto', display: 'grid', gap: 8 }}>
          <button type="button" className="btn btn-primary" onClick={() => openTask({ due_date: todayKey() })}><Plus size={16} /><span className="lbl">Hızlı görev</span></button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => supabase.auth.signOut().then(() => nav('/'))}><LogOut size={14} /><span className="lbl">Çıkış yap</span></button>
        </div>
      </aside>
      <main className="main">
        <QuickSearch />
        <NotificationBell />
        <Outlet />
      </main>
      <nav className="tabbar" aria-label="Alt menü">
        <NavLink to="/" end><Home size={22} />Bugün</NavLink>
        <NavLink to="/takvim/ay"><CalendarDays size={22} />Takvim</NavLink>
        <button type="button" onClick={() => openTask({ due_date: todayKey() })} aria-label="Görev ekle"><span className="plus"><Plus size={24} /></span></button>
        <NavLink to="/gorevler"><CheckSquare size={22} />Görevler</NavLink>
        <NavLink to="/ayarlar"><Sparkles size={22} />Daha fazla</NavLink>
      </nav>
    </div>
  );
}

export function PageHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="topbar">
      <h1>{title}</h1>
      <div className="row">{children}</div>
    </div>
  );
}
