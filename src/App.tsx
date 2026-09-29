import { useEffect, useState } from 'react';
import { bindBackButton, initStatusBar } from './app/native';
import { useGame } from './app/useGame';
import { RulesSheet } from './ui/overlays/RulesSheet';
import { SettingsSheet } from './ui/overlays/SettingsSheet';
import { Toast } from './ui/overlays/Toast';
import { GameScreen } from './ui/screens/GameScreen';
import { StartScreen } from './ui/screens/StartScreen';

/**
 * Кореневий компонент: вибір екрана (старт / гра) плюс спільні оверлеї.
 * Уся ігрова логіка — у useGame() → game/engine.ts, налаштування — game/settings.ts.
 */
export function App() {
  const game = useGame();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { screen, toStart } = game;

  // Апаратна «Назад» на Android: вихід із партії на стартовий екран.
  useEffect(() => {
    void initStatusBar();
    let unbind: (() => void) | undefined;
    let cancelled = false;
    void bindBackButton(() => {
      if (screen === 'game') {
        toStart();
        return true;
      }
      return false;
    }).then((dispose) => {
      if (cancelled) dispose();
      else unbind = dispose;
    });
    return () => {
      cancelled = true;
      unbind?.();
    };
  }, [screen, toStart]);

  /*
   * Редактор карти (`?editor=1`) відкривається одним посиланням: у dev-режимі
   * одразу створюємо партію, щоб не доводилось вручну натискати «Почати гру»
   * й шукати, де подівся редактор. У продакшн-збірку цей блок не потрапляє —
   * умова вирізається разом із динамічним імпортом.
   */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!new URLSearchParams(window.location.search).has('editor')) return;
    const { start, state, screen: current } = game;
    if (current === 'start' && !state) start(['Гравець 1', 'Гравець 2']);
  }, [game]);

  const inGame = screen === 'game' && game.state !== null;

  return (
    <>
      {inGame ? (
        <GameScreen
          game={game}
          onOpenRules={() => setRulesOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <StartScreen
          hasSave={game.hasSave}
          onStart={game.start}
          onResume={game.resume}
          onOpenRules={() => setRulesOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {rulesOpen && (
        <RulesSheet
          onClose={() => setRulesOpen(false)}
          tradesPerTurn={game.state?.rules.tradesPerTurn ?? game.settings.tradesPerTurn}
          dicePreset={game.state?.rules.dicePreset ?? game.settings.dicePreset}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          settings={game.settings}
          inGame={screen === 'game'}
          onChange={game.updateSettings}
          onReset={game.resetSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {!inGame && <Toast message={game.toast} />}
    </>
  );
}
