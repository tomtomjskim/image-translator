interface Props {
  progress: number;
}

export function GenerationProgress({ progress }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
        <span>이미지 생성 중...</span>
        <span>{progress}%</span>
      </div>
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Nano Banana Pro가 번역된 텍스트로 이미지를 생성하고 있습니다...
      </p>
    </div>
  );
}
