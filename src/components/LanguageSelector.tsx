import { useAppStore } from '../stores/useAppStore';
import { LANGUAGES, TARGET_LANGUAGES, TRANSLATION_TONES } from '../utils/constants';

export function LanguageSelector() {
  const { settings, updateSettings } = useAppStore();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
        번역 설정
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Source Language */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            소스 언어
          </label>
          <select
            value={settings.sourceLanguage}
            onChange={(e) => updateSettings({ sourceLanguage: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeName} ({lang.name})
              </option>
            ))}
          </select>
        </div>

        {/* Arrow */}
        <div className="hidden sm:flex items-end justify-center pb-2">
          <svg
            className="w-6 h-6 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </div>

        {/* Target Language */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            타겟 언어
          </label>
          <select
            value={settings.targetLanguage}
            onChange={(e) => updateSettings({ targetLanguage: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {TARGET_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeName} ({lang.name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Translation Tone */}
      <div className="mt-4">
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
          번역 톤
        </label>
        <div className="flex flex-wrap gap-2">
          {TRANSLATION_TONES.map((tone) => (
            <button
              key={tone.value}
              onClick={() => updateSettings({ translationTone: tone.value })}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                settings.translationTone === tone.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
              title={tone.description}
            >
              {tone.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
