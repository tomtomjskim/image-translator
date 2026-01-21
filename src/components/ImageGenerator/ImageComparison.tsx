import { useState } from 'react';
import { Button } from '../common/Button';

interface Props {
  originalImage: string;
  generatedImage: string;
  mimeType: string;
  onReset: () => void;
}

export function ImageComparison({ originalImage, generatedImage, mimeType, onReset }: Props) {
  const [viewMode, setViewMode] = useState<'side-by-side' | 'generated-only'>('side-by-side');

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `data:${mimeType};base64,${generatedImage}`;
    link.download = `translated_image_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyToClipboard = async () => {
    try {
      // Base64를 Blob으로 변환
      const response = await fetch(`data:${mimeType};base64,${generatedImage}`);
      const blob = await response.blob();

      // 클립보드에 복사
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);

      alert('이미지가 클립보드에 복사되었습니다.');
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-4">
      {/* 뷰 모드 토글 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setViewMode('side-by-side')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            viewMode === 'side-by-side'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
          }`}
        >
          나란히 보기
        </button>
        <button
          type="button"
          onClick={() => setViewMode('generated-only')}
          className={`px-3 py-1 rounded text-sm transition-colors ${
            viewMode === 'generated-only'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
          }`}
        >
          생성 이미지만
        </button>
      </div>

      {/* 이미지 비교 영역 */}
      {viewMode === 'side-by-side' ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">원본</p>
            <img
              src={originalImage.startsWith('data:') ? originalImage : `data:image/jpeg;base64,${originalImage}`}
              alt="Original"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700"
            />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">번역 이미지</p>
            <img
              src={`data:${mimeType};base64,${generatedImage}`}
              alt="Generated"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700"
            />
          </div>
        </div>
      ) : (
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">번역 이미지</p>
          <img
            src={`data:${mimeType};base64,${generatedImage}`}
            alt="Generated"
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700"
          />
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex gap-2">
        <Button onClick={handleDownload} className="flex-1">
          다운로드
        </Button>
        <Button variant="secondary" onClick={handleCopyToClipboard}>
          복사
        </Button>
        <Button variant="ghost" onClick={onReset}>
          다시 생성
        </Button>
      </div>
    </div>
  );
}
