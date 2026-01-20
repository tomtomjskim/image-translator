# Phase 4: 번역 용어집 기능 상세 구현 가이드

## 문서 정보

| 항목 | 내용 |
|------|------|
| **Phase** | 4 |
| **기능** | 사용자 정의 번역 용어집 |
| **우선순위** | P2 (중요) |
| **예상 소요** | 1주 |
| **상태** | 📋 설계 완료 |
| **의존성** | Phase 3 (IndexedDB) 완료 필요 |

---

## 1. 기능 개요

### 1.1 목적
- 사용자 정의 번역 쌍 등록
- 브랜드명, 기술 용어 등 일관된 번역 보장
- 번역 품질 및 생산성 향상

### 1.2 주요 기능

| 기능 | 설명 |
|------|------|
| 용어 등록 | 원문 → 번역 쌍 등록 |
| 카테고리 분류 | 브랜드, 기술, 일반 등 |
| 대소문자 구분 | 옵션으로 설정 |
| 자동 적용 | 번역 시 자동으로 용어집 적용 |
| CSV 가져오기/내보내기 | 일괄 관리 |

---

## 2. 데이터 모델

### 2.1 스키마

```typescript
// src/types/glossary.ts

export interface GlossaryEntry {
  id: string;
  createdAt: Date;
  updatedAt: Date;

  // 언어 쌍
  sourceLanguage: string;
  targetLanguage: string;

  // 용어
  sourceTerm: string;
  targetTerm: string;

  // 옵션
  caseSensitive: boolean;
  category: GlossaryCategory;

  // 메타데이터
  notes?: string;
  usageCount: number;
  lastUsed?: Date;
}

export type GlossaryCategory =
  | 'brand'        // 브랜드명
  | 'technical'    // 기술 용어
  | 'marketing'    // 마케팅 용어
  | 'common'       // 일반
  | 'custom';      // 사용자 정의

export const GLOSSARY_CATEGORIES: { value: GlossaryCategory; label: string }[] = [
  { value: 'brand', label: '브랜드' },
  { value: 'technical', label: '기술 용어' },
  { value: 'marketing', label: '마케팅' },
  { value: 'common', label: '일반' },
  { value: 'custom', label: '사용자 정의' },
];
```

### 2.2 IndexedDB 스키마

```typescript
// src/services/db/index.ts 확장

class TranslationDatabase extends Dexie {
  translations!: Table<TranslationRecord, string>;
  glossary!: Table<GlossaryEntry, string>;
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('ImageTranslatorDB');

    this.version(2).stores({
      translations: 'id, createdAt, sourceLanguage, targetLanguage, isFavorite',
      glossary: 'id, sourceLanguage, targetLanguage, sourceTerm, category, [sourceLanguage+targetLanguage]',
      settings: 'key',
    });
  }
}
```

---

## 3. 서비스 레이어

### 3.1 CRUD 함수

```typescript
// src/services/db/glossary.ts

import { db } from './index';
import { v4 as uuidv4 } from 'uuid';
import type { GlossaryEntry, GlossaryCategory } from '../../types';

// 용어 추가
export async function addGlossaryEntry(entry: Omit<GlossaryEntry, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<string> {
  const id = uuidv4();

  // 중복 체크
  const existing = await db.glossary
    .where('[sourceLanguage+targetLanguage]')
    .equals([entry.sourceLanguage, entry.targetLanguage])
    .filter(e => e.sourceTerm.toLowerCase() === entry.sourceTerm.toLowerCase())
    .first();

  if (existing) {
    throw new Error(`이미 등록된 용어입니다: "${entry.sourceTerm}"`);
  }

  await db.glossary.add({
    ...entry,
    id,
    createdAt: new Date(),
    updatedAt: new Date(),
    usageCount: 0,
  });

  return id;
}

// 용어 조회 (페이지네이션)
export async function getGlossaryEntries(options: {
  page?: number;
  limit?: number;
  sourceLanguage?: string;
  targetLanguage?: string;
  category?: GlossaryCategory;
  searchQuery?: string;
}): Promise<{ entries: GlossaryEntry[]; total: number }> {
  const {
    page = 1,
    limit = 50,
    sourceLanguage,
    targetLanguage,
    category,
    searchQuery,
  } = options;

  let collection = db.glossary.toCollection();

  // 필터링
  if (sourceLanguage && targetLanguage) {
    collection = db.glossary
      .where('[sourceLanguage+targetLanguage]')
      .equals([sourceLanguage, targetLanguage]);
  } else if (sourceLanguage) {
    collection = db.glossary.where('sourceLanguage').equals(sourceLanguage);
  } else if (targetLanguage) {
    collection = db.glossary.where('targetLanguage').equals(targetLanguage);
  }

  if (category) {
    collection = collection.filter(e => e.category === category);
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    collection = collection.filter(e =>
      e.sourceTerm.toLowerCase().includes(query) ||
      e.targetTerm.toLowerCase().includes(query)
    );
  }

  const total = await collection.count();
  const entries = await collection
    .offset((page - 1) * limit)
    .limit(limit)
    .sortBy('sourceTerm');

  return { entries, total };
}

// 용어 수정
export async function updateGlossaryEntry(
  id: string,
  updates: Partial<GlossaryEntry>
): Promise<void> {
  await db.glossary.update(id, {
    ...updates,
    updatedAt: new Date(),
  });
}

// 용어 삭제
export async function deleteGlossaryEntry(id: string): Promise<void> {
  await db.glossary.delete(id);
}

// 일괄 삭제
export async function deleteGlossaryEntries(ids: string[]): Promise<void> {
  await db.glossary.bulkDelete(ids);
}

// 사용 횟수 증가
export async function incrementUsageCount(id: string): Promise<void> {
  const entry = await db.glossary.get(id);
  if (entry) {
    await db.glossary.update(id, {
      usageCount: entry.usageCount + 1,
      lastUsed: new Date(),
    });
  }
}

// 언어 쌍별 용어집 가져오기 (번역 시 사용)
export async function getGlossaryForTranslation(
  sourceLanguage: string,
  targetLanguage: string
): Promise<GlossaryEntry[]> {
  return db.glossary
    .where('[sourceLanguage+targetLanguage]')
    .equals([sourceLanguage, targetLanguage])
    .toArray();
}
```

### 3.2 CSV 가져오기/내보내기

```typescript
// src/services/db/glossaryExport.ts

import { db } from './index';
import type { GlossaryEntry, GlossaryCategory } from '../../types';

// CSV 내보내기
export async function exportGlossaryToCSV(
  sourceLanguage?: string,
  targetLanguage?: string
): Promise<string> {
  let entries = await db.glossary.toArray();

  if (sourceLanguage && targetLanguage) {
    entries = entries.filter(
      e => e.sourceLanguage === sourceLanguage && e.targetLanguage === targetLanguage
    );
  }

  const headers = ['Source Language', 'Target Language', 'Source Term', 'Target Term', 'Category', 'Case Sensitive', 'Notes'];

  const rows = entries.map(e => [
    e.sourceLanguage,
    e.targetLanguage,
    `"${e.sourceTerm.replace(/"/g, '""')}"`,
    `"${e.targetTerm.replace(/"/g, '""')}"`,
    e.category,
    e.caseSensitive ? 'Yes' : 'No',
    e.notes ? `"${e.notes.replace(/"/g, '""')}"` : '',
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

// CSV 가져오기
export async function importGlossaryFromCSV(csvContent: string): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
}> {
  const lines = csvContent.split('\n').filter(l => l.trim());
  const errors: string[] = [];
  let imported = 0;
  let skipped = 0;

  // 헤더 스킵
  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = parseCSVLine(lines[i]);

      if (cols.length < 4) {
        errors.push(`Line ${i + 1}: 필수 컬럼 부족`);
        skipped++;
        continue;
      }

      const [sourceLang, targetLang, sourceTerm, targetTerm, category, caseSensitive, notes] = cols;

      // 중복 체크
      const existing = await db.glossary
        .where('[sourceLanguage+targetLanguage]')
        .equals([sourceLang, targetLang])
        .filter(e => e.sourceTerm.toLowerCase() === sourceTerm.toLowerCase())
        .first();

      if (existing) {
        skipped++;
        continue;
      }

      await db.glossary.add({
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        sourceTerm,
        targetTerm,
        category: (category as GlossaryCategory) || 'custom',
        caseSensitive: caseSensitive?.toLowerCase() === 'yes',
        notes: notes || undefined,
        usageCount: 0,
      });

      imported++;
    } catch (err) {
      errors.push(`Line ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      skipped++;
    }
  }

  return { imported, skipped, errors };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}
```

---

## 4. 프롬프트 통합

### 4.1 번역 프롬프트에 용어집 추가

```typescript
// src/services/gemini.ts 수정

import { getGlossaryForTranslation, incrementUsageCount } from './db/glossary';

export async function translateImage(
  imageBase64: string,
  sourceLanguage: string,
  targetLanguage: string,
  options: TranslationOptions
): Promise<TranslationResult> {
  // 용어집 가져오기
  const glossary = await getGlossaryForTranslation(sourceLanguage, targetLanguage);

  // 프롬프트 생성
  const prompt = buildTranslationPrompt(targetLanguage, options, glossary);

  // API 호출
  const result = await model.generateContent([...]);

  // 사용된 용어 카운트 증가
  await updateGlossaryUsage(result.translatedText, glossary);

  return result;
}

function buildTranslationPrompt(
  targetLanguage: string,
  options: TranslationOptions,
  glossary: GlossaryEntry[]
): string {
  let prompt = `You are an expert OCR and translation assistant specialized in product descriptions.

Task:
1. Extract ALL text from the provided image accurately
2. Translate the extracted text to ${targetLanguage}
3. Optimize the translation for e-commerce product descriptions

Rules:
- Preserve formatting (line breaks, bullet points)
- Keep brand names, model numbers unchanged
- Use natural, fluent ${targetLanguage}`;

  // 용어집 추가
  if (glossary.length > 0) {
    prompt += `

CRITICAL - Use these exact translations for the following terms (do not deviate):`;

    glossary.forEach(entry => {
      const caseNote = entry.caseSensitive ? ' (case-sensitive)' : '';
      prompt += `\n• "${entry.sourceTerm}" → "${entry.targetTerm}"${caseNote}`;
    });
  }

  prompt += `

Response format (JSON):
{
  "detected_language": "detected language name",
  "original_text": "extracted original text",
  "translated_text": "translated text",
  "confidence": "high/medium/low"
}`;

  return prompt;
}

async function updateGlossaryUsage(
  translatedText: string,
  glossary: GlossaryEntry[]
): Promise<void> {
  for (const entry of glossary) {
    const searchTerm = entry.caseSensitive
      ? entry.targetTerm
      : entry.targetTerm.toLowerCase();
    const textToSearch = entry.caseSensitive
      ? translatedText
      : translatedText.toLowerCase();

    if (textToSearch.includes(searchTerm)) {
      await incrementUsageCount(entry.id);
    }
  }
}
```

---

## 5. 컴포넌트 설계

### 5.1 디렉토리 구조

```
src/components/Glossary/
├── index.ts
├── GlossaryManager.tsx         # 메인 관리 페이지
├── GlossaryList.tsx            # 용어 목록
├── GlossaryItem.tsx            # 개별 용어
├── GlossaryForm.tsx            # 용어 추가/수정 폼
├── GlossaryImport.tsx          # CSV 가져오기
├── GlossaryExport.tsx          # CSV 내보내기
└── GlossaryFilter.tsx          # 필터링
```

### 5.2 GlossaryManager 컴포넌트

```tsx
// src/components/Glossary/GlossaryManager.tsx

import { useState } from 'react';
import { GlossaryList } from './GlossaryList';
import { GlossaryForm } from './GlossaryForm';
import { GlossaryImport } from './GlossaryImport';
import { GlossaryExport } from './GlossaryExport';
import { GlossaryFilter } from './GlossaryFilter';
import { useGlossary } from '../../hooks/useGlossary';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

export function GlossaryManager() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GlossaryEntry | null>(null);

  const {
    entries,
    total,
    isLoading,
    filters,
    setFilters,
    addEntry,
    updateEntry,
    deleteEntry,
    refresh,
  } = useGlossary();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200">
          번역 용어집
        </h1>
        <div className="flex gap-2">
          <GlossaryImport onImport={refresh} />
          <GlossaryExport filters={filters} />
          <Button onClick={() => setShowAddModal(true)}>
            + 용어 추가
          </Button>
        </div>
      </div>

      {/* 필터 */}
      <GlossaryFilter filters={filters} onChange={setFilters} />

      {/* 목록 */}
      <GlossaryList
        entries={entries}
        isLoading={isLoading}
        onEdit={setEditingEntry}
        onDelete={deleteEntry}
      />

      {/* 하단 정보 */}
      <div className="mt-4 text-sm text-slate-500">
        총 {total}개 용어 등록됨
      </div>

      {/* 추가/수정 모달 */}
      <Modal
        isOpen={showAddModal || !!editingEntry}
        onClose={() => {
          setShowAddModal(false);
          setEditingEntry(null);
        }}
        title={editingEntry ? '용어 수정' : '용어 추가'}
      >
        <GlossaryForm
          initialData={editingEntry}
          onSubmit={async (data) => {
            if (editingEntry) {
              await updateEntry(editingEntry.id, data);
            } else {
              await addEntry(data);
            }
            setShowAddModal(false);
            setEditingEntry(null);
          }}
          onCancel={() => {
            setShowAddModal(false);
            setEditingEntry(null);
          }}
        />
      </Modal>
    </div>
  );
}
```

### 5.3 GlossaryForm 컴포넌트

```tsx
// src/components/Glossary/GlossaryForm.tsx

import { useState } from 'react';
import { LANGUAGES, TARGET_LANGUAGES } from '../../utils/constants';
import { GLOSSARY_CATEGORIES } from '../../types';
import { Button } from '../common/Button';

interface Props {
  initialData?: GlossaryEntry | null;
  onSubmit: (data: Omit<GlossaryEntry, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => Promise<void>;
  onCancel: () => void;
}

export function GlossaryForm({ initialData, onSubmit, onCancel }: Props) {
  const [formData, setFormData] = useState({
    sourceLanguage: initialData?.sourceLanguage || 'zh-CN',
    targetLanguage: initialData?.targetLanguage || 'ko',
    sourceTerm: initialData?.sourceTerm || '',
    targetTerm: initialData?.targetTerm || '',
    category: initialData?.category || 'common',
    caseSensitive: initialData?.caseSensitive || false,
    notes: initialData?.notes || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.sourceTerm.trim() || !formData.targetTerm.trim()) {
      setError('원문과 번역문을 모두 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 언어 선택 */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">소스 언어</label>
          <select
            value={formData.sourceLanguage}
            onChange={(e) => setFormData({ ...formData, sourceLanguage: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          >
            {LANGUAGES.filter(l => l.code !== 'auto').map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.nativeName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">타겟 언어</label>
          <select
            value={formData.targetLanguage}
            onChange={(e) => setFormData({ ...formData, targetLanguage: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          >
            {TARGET_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.nativeName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 용어 입력 */}
      <div>
        <label className="block text-sm font-medium mb-1">원문</label>
        <input
          type="text"
          value={formData.sourceTerm}
          onChange={(e) => setFormData({ ...formData, sourceTerm: e.target.value })}
          placeholder="예: Free Shipping"
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">번역</label>
        <input
          type="text"
          value={formData.targetTerm}
          onChange={(e) => setFormData({ ...formData, targetTerm: e.target.value })}
          placeholder="예: 무료배송"
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      {/* 카테고리 */}
      <div>
        <label className="block text-sm font-medium mb-1">카테고리</label>
        <select
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value as GlossaryCategory })}
          className="w-full px-3 py-2 border rounded-lg"
        >
          {GLOSSARY_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* 옵션 */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="caseSensitive"
          checked={formData.caseSensitive}
          onChange={(e) => setFormData({ ...formData, caseSensitive: e.target.checked })}
          className="rounded"
        />
        <label htmlFor="caseSensitive" className="text-sm">대소문자 구분</label>
      </div>

      {/* 메모 */}
      <div>
        <label className="block text-sm font-medium mb-1">메모 (선택)</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="용어에 대한 설명이나 사용 맥락"
          rows={2}
          className="w-full px-3 py-2 border rounded-lg"
        />
      </div>

      {/* 에러 */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* 버튼 */}
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" onClick={onCancel}>취소</Button>
        <Button type="submit" loading={isSubmitting}>저장</Button>
      </div>
    </form>
  );
}
```

---

## 6. Hook 설계

```typescript
// src/hooks/useGlossary.ts

import { useState, useEffect, useCallback } from 'react';
import {
  getGlossaryEntries,
  addGlossaryEntry,
  updateGlossaryEntry,
  deleteGlossaryEntry,
} from '../services/db/glossary';
import type { GlossaryEntry, GlossaryCategory } from '../types';

interface GlossaryFilters {
  sourceLanguage: string;
  targetLanguage: string;
  category: GlossaryCategory | '';
  searchQuery: string;
}

export function useGlossary() {
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<GlossaryFilters>({
    sourceLanguage: '',
    targetLanguage: '',
    category: '',
    searchQuery: '',
  });

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const { entries, total } = await getGlossaryEntries({
        sourceLanguage: filters.sourceLanguage || undefined,
        targetLanguage: filters.targetLanguage || undefined,
        category: filters.category || undefined,
        searchQuery: filters.searchQuery || undefined,
      });
      setEntries(entries);
      setTotal(total);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const addEntry = useCallback(async (data: Omit<GlossaryEntry, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => {
    await addGlossaryEntry(data);
    await loadEntries();
  }, [loadEntries]);

  const updateEntry = useCallback(async (id: string, updates: Partial<GlossaryEntry>) => {
    await updateGlossaryEntry(id, updates);
    await loadEntries();
  }, [loadEntries]);

  const deleteEntry = useCallback(async (id: string) => {
    await deleteGlossaryEntry(id);
    await loadEntries();
  }, [loadEntries]);

  return {
    entries,
    total,
    isLoading,
    filters,
    setFilters,
    addEntry,
    updateEntry,
    deleteEntry,
    refresh: loadEntries,
  };
}
```

---

## 7. 구현 체크리스트

### 7.1 데이터베이스
- [ ] IndexedDB 스키마 확장 (glossary 테이블)
- [ ] CRUD 함수
- [ ] CSV 가져오기/내보내기

### 7.2 서비스
- [ ] 프롬프트 통합 로직
- [ ] 사용 카운트 업데이트

### 7.3 컴포넌트
- [ ] GlossaryManager
- [ ] GlossaryList
- [ ] GlossaryForm
- [ ] GlossaryImport
- [ ] GlossaryFilter

### 7.4 Hook
- [ ] useGlossary

### 7.5 라우팅
- [ ] /glossary 페이지 추가 (또는 설정 내 탭)

---

## 8. 예시 CSV 형식

```csv
Source Language,Target Language,Source Term,Target Term,Category,Case Sensitive,Notes
zh-CN,ko,免费配送,무료배송,common,No,배송 관련 용어
zh-CN,ko,正品保证,정품 보증,marketing,No,품질 보증 관련
en,ko,Premium Quality,프리미엄 품질,marketing,Yes,브랜드 강조 시 사용
```

---

*문서 버전: 1.0.0*
*최종 수정: 2026-01-20*
