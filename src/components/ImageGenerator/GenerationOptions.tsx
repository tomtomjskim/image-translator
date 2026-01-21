import type { ImageGenerationOptions, AspectRatio, Resolution } from '../../types';

const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: 'original', label: '원본 유지' },
  { value: '1:1', label: '1:1 (정사각형)' },
  { value: '4:3', label: '4:3 (가로)' },
  { value: '3:4', label: '3:4 (세로)' },
  { value: '16:9', label: '16:9 (와이드)' },
  { value: '9:16', label: '9:16 (세로 와이드)' },
];

const RESOLUTIONS: { value: Resolution; label: string; description: string }[] = [
  { value: '1K', label: '1K', description: '빠른 생성' },
  { value: '2K', label: '2K', description: '권장' },
  { value: '4K', label: '4K', description: '고화질' },
];

interface Props {
  options: ImageGenerationOptions;
  onChange: (options: ImageGenerationOptions) => void;
  disabled?: boolean;
}

export function GenerationOptions({ options, onChange, disabled }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 비율 선택 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          이미지 비율
        </label>
        <select
          value={options.aspectRatio}
          onChange={(e) => onChange({ ...options, aspectRatio: e.target.value as AspectRatio })}
          disabled={disabled}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg
                     bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {ASPECT_RATIOS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* 해상도 선택 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          해상도
        </label>
        <div className="flex gap-2">
          {RESOLUTIONS.map(({ value, label, description }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ ...options, resolution: value })}
              disabled={disabled}
              className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors
                ${options.resolution === value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-blue-400'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              title={description}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
