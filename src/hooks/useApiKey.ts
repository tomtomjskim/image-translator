import { useState, useCallback, useEffect } from 'react';
import { saveApiKey, loadApiKey, deleteApiKey, maskApiKey } from '../services/crypto';
import { initGemini } from '../services/gemini';
import { useAppStore } from '../stores/useAppStore';

export function useApiKey() {
  const [maskedKey, setMaskedKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const { hasApiKey, setHasApiKey } = useAppStore();

  // 초기 로드 시 API 키 확인 및 초기화
  useEffect(() => {
    const initializeApiKey = async () => {
      try {
        const key = await loadApiKey();
        if (key) {
          initGemini(key);
          setMaskedKey(maskApiKey(key));
          setHasApiKey(true);
        } else {
          setHasApiKey(false);
        }
      } catch (error) {
        console.error('Failed to load API key:', error);
        setHasApiKey(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApiKey();
  }, [setHasApiKey]);

  // API 키 저장
  const saveKey = useCallback(async (apiKey: string): Promise<boolean> => {
    try {
      // API 키 유효성 간단 체크
      if (!apiKey || apiKey.length < 20) {
        throw new Error('Invalid API key format');
      }

      await saveApiKey(apiKey);
      initGemini(apiKey);
      setMaskedKey(maskApiKey(apiKey));
      setHasApiKey(true);
      return true;
    } catch (error) {
      console.error('Failed to save API key:', error);
      return false;
    }
  }, [setHasApiKey]);

  // API 키 삭제
  const removeKey = useCallback(() => {
    deleteApiKey();
    setMaskedKey('');
    setHasApiKey(false);
  }, [setHasApiKey]);

  return {
    hasApiKey,
    maskedKey,
    isLoading,
    saveKey,
    removeKey,
  };
}
