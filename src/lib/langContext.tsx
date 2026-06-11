import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { type LangCode, LANGUAGE_NAMES, t as translate } from './i18n';

const LANG_KEY = 'alphaLedger_language_v1';

interface LangContextType {
  lang: LangCode;
  setLang: (code: LangCode) => Promise<void>;
  t: (key: string) => string;
  langNames: typeof LANGUAGE_NAMES;
}

const LangContext = createContext<LangContextType>({
  lang: 'en',
  setLang: async () => {},
  t: (key) => key,
  langNames: LANGUAGE_NAMES,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>('en');

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((stored) => {
      // Only apply stored preference if it's a valid language code
      const valid: LangCode[] = ['en', 'bn', 'hi', 'ar', 'es', 'fr', 'zh'];
      if (stored && valid.includes(stored as LangCode)) {
        setLangState(stored as LangCode);
      } else {
        // Default to English and clear any invalid stored value
        setLangState('en');
        AsyncStorage.removeItem(LANG_KEY);
      }
    });
  }, []);

  const setLang = useCallback(async (code: LangCode) => {
    setLangState(code);
    await AsyncStorage.setItem(LANG_KEY, code);
  }, []);

  const tFn = useCallback((key: string) => translate(lang, key), [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t: tFn, langNames: LANGUAGE_NAMES }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
