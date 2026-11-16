'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Persona } from '@/lib/types';
import { setRequestedMode, type Mode } from '@/lib/client';
import { HOSTED_EXAMPLE } from '@/lib/hosted';

interface AppState {
  persona: Persona;
  setPersona: (p: Persona) => void;
  mode: Mode | null;                  // what the last response actually came from
  reportMode: (m: Mode) => void;
  preferred: Mode;                    // what the reader picked in the header switch
  setPreferred: (m: Mode) => void;
  configured: boolean | null;         // is a Snowflake connection set up in .env.local? null while checking
}

const Ctx = createContext<AppState>({
  persona: 'director', setPersona: () => {}, mode: null, reportMode: () => {},
  preferred: 'sample', setPreferred: () => {}, configured: null,
});

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [persona, setP] = useState<Persona>('director');
  const [mode, setMode] = useState<Mode | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(HOSTED_EXAMPLE ? false : null);
  const [preferred, setPref] = useState<Mode>('sample');
  useEffect(() => {
    const saved = localStorage.getItem('isa.persona');
    if (saved === 'rep' || saved === 'director') setP(saved);
    if (HOSTED_EXAMPLE) return;
    fetch('/api/status').then((r) => r.json()).then((s: { configured: boolean }) => {
      setConfigured(s.configured);
      // Default to Live when a connection exists, unless the reader chose Sample before.
      const pick: Mode = s.configured && localStorage.getItem('isa.mode') !== 'sample' ? 'live' : 'sample';
      setRequestedMode(pick); setPref(pick);
    }).catch(() => setConfigured(false));
  }, []);
  const setPersona = useCallback((p: Persona) => { setP(p); localStorage.setItem('isa.persona', p); }, []);
  const setPreferred = useCallback((m: Mode) => { setRequestedMode(m); setPref(m); localStorage.setItem('isa.mode', m); }, []);
  const reportMode = useCallback((m: Mode) => setMode(m), []);
  return <Ctx.Provider value={{ persona, setPersona, mode, reportMode, preferred, setPreferred, configured }}>{children}</Ctx.Provider>;
}

export const useAppState = () => useContext(Ctx);
