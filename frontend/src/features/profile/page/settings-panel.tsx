import { Globe, Moon, Sun } from 'lucide-react';
import * as React from 'react';

import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { usePreferencesStore } from '@/stores/preferences';
import type { Language, Theme } from '@/stores/preferences';

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface OptionCardProps {
  readonly label: string;
  readonly description: string;
  readonly icon: IconComponent;
  readonly selected: boolean;
  readonly onClick: () => void;
}

interface ThemeOption {
  readonly value: Theme;
  readonly label: string;
  readonly description: string;
  readonly icon: IconComponent;
}

interface LanguageOption {
  readonly value: Language;
  readonly label: string;
  readonly description: string;
  readonly icon: IconComponent;
}

/** Single selectable option card for theme or language selection. */
function OptionCard({ label, description, icon: Icon, selected, onClick }: OptionCardProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all duration-150',
        selected
          ? 'border-accent bg-accent-muted shadow-accent-glow-sm'
          : 'border-surface-border bg-surface-card hover:border-accent/50 hover:bg-surface-elevated',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          selected ? 'bg-accent/20' : 'bg-surface-elevated',
        )}
      >
        <Icon
          className={cn('h-4 w-4', selected ? 'text-accent-light' : 'text-content-muted')}
          aria-hidden
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className={cn('text-sm font-medium', selected ? 'text-accent-light' : 'text-content-primary')}>
          {label}
        </span>
        <span className="text-xs text-content-subtle">{description}</span>
      </div>
      {selected && (
        <div className="ml-auto h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
      )}
    </button>
  );
}

/**
 * Settings panel rendered inside the "Settings" tab of ProfilePage.
 * Provides immediate (no-save-button) selection of visual theme and UI language.
 * Theme changes are applied globally via the `<html>` class synced in app.tsx.
 * Language preference is persisted for future i18n integration.
 */
export function SettingsPanel(): React.JSX.Element {
  const theme = usePreferencesStore((s) => s.theme);
  const language = usePreferencesStore((s) => s.language);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const setLanguage = usePreferencesStore((s) => s.setLanguage);
  const t = useTranslation();

  const themeOptions: ThemeOption[] = [
    { value: 'dark', label: t.settings.darkLabel, description: t.settings.darkDescription, icon: Moon as IconComponent },
    { value: 'light', label: t.settings.lightLabel, description: t.settings.lightDescription, icon: Sun as IconComponent },
  ];

  const languageOptions: LanguageOption[] = [
    { value: 'en', label: 'English', description: 'Interface and content in English', icon: Globe as IconComponent },
    { value: 'pt-BR', label: 'Português (BR)', description: 'Interface e conteúdo em português', icon: Globe as IconComponent },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-content-primary">{t.settings.themeLabel}</h2>
          <p className="text-xs text-content-subtle">{t.settings.themeHint}</p>
        </div>
        <div className="flex flex-col gap-2">
          {themeOptions.map((opt) => (
            <OptionCard
              key={opt.value}
              label={opt.label}
              description={opt.description}
              icon={opt.icon}
              selected={theme === opt.value}
              onClick={() => {
                setTheme(opt.value);
              }}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-content-primary">{t.settings.languageLabel}</h2>
          <p className="text-xs text-content-subtle">{t.settings.languageHint}</p>
        </div>
        <div className="flex flex-col gap-2">
          {languageOptions.map((opt) => (
            <OptionCard
              key={opt.value}
              label={opt.label}
              description={opt.description}
              icon={opt.icon}
              selected={language === opt.value}
              onClick={() => {
                setLanguage(opt.value);
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
