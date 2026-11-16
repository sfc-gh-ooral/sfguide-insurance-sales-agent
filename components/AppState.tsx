'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Persona } from '@/lib/types';
import type { Mode } from '@/lib/client';

interface AppState {
  persona: Persona;
  setPersona: (p: Persona) => void;
  mode: Mode | null;
  reportMode: (m: Mode) => void;
}

const Ctx = createContext<AppState>({ persona: 'director', setPersona: () => {}, mode: null, reportMode: () => {} });

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [persona, setP] = useState<Persona>('director');
  const [mode, setMode] = useState<Mode | null>(null);
  useEffect(() => {
    const saved = localStorage.getItem('isa.persona');
    if (saved === 'rep' || saved === 'director') setP(saved);
  }, []);
  const setPersona = useCallback((p: Persona) => { setP(p); localStorage.setItem('isa.persona', p); }, []);
  const reportMode = useCallback((m: Mode) => setMode(m), []);
  return <Ctx.Provider value={{ persona, setPersona, mode, reportMode }}>{children}</Ctx.Provider>;
}

export const useAppState = () => useContext(Ctx);
