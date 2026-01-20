import { useState } from 'react';
import { Modal } from './common/Modal';
import { Button } from './common/Button';
import { useApiKey } from '../hooks/useApiKey';
import { useAppStore } from '../stores/useAppStore';

export function ApiKeyManager() {
  const { showApiKeyModal, setShowApiKeyModal, hasApiKey } = useAppStore();
  const { maskedKey, saveKey, removeKey } = useApiKey();
  const [inputKey, setInputKey] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!inputKey.trim()) {
      setError('API 키를 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setError('');

    const success = await saveKey(inputKey.trim());

    if (success) {
      setInputKey('');
      setShowApiKeyModal(false);
    } else {
      setError('API 키 저장에 실패했습니다. 올바른 키인지 확인해주세요.');
    }

    setIsSaving(false);
  };

  const handleDelete = () => {
    if (confirm('API 키를 삭제하시겠습니까?')) {
      removeKey();
      setInputKey('');
    }
  };

  return (
    <>
      {/* API Key 상태 표시 버튼 */}
      <button
        onClick={() => setShowApiKeyModal(true)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          hasApiKey
            ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
          />
        </svg>
        {hasApiKey ? 'API Key 설정됨' : 'API Key 필요'}
      </button>

      {/* Modal */}
      <Modal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        title="API Key 설정"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Google AI Studio에서 발급받은 Gemini API 키를 입력해주세요.
            키는 브라우저에 암호화되어 안전하게 저장됩니다.
          </p>

          {hasApiKey && (
            <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                현재 저장된 키
              </p>
              <code className="text-sm font-mono text-slate-700 dark:text-slate-300">
                {maskedKey}
              </code>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {hasApiKey ? '새 API Key' : 'API Key'}
            </label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="AIza..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-2 justify-end">
            {hasApiKey && (
              <Button variant="danger" onClick={handleDelete}>
                삭제
              </Button>
            )}
            <Button variant="secondary" onClick={() => setShowApiKeyModal(false)}>
              취소
            </Button>
            <Button onClick={handleSave} loading={isSaving}>
              저장
            </Button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            API 키가 없으신가요?{' '}
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Google AI Studio에서 무료로 발급받기
            </a>
          </p>
        </div>
      </Modal>
    </>
  );
}
