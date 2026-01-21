import { db } from './index';

// JSON 내보내기
export async function exportToJSON(includeImages = false): Promise<string> {
  const records = await db.translations.toArray();

  // 이미지 데이터 제외 옵션
  const exportData = records.map(r => ({
    ...r,
    image: includeImages ? r.image : { ...r.image, thumbnail: '[EXCLUDED]' },
    generatedImage: r.generatedImage
      ? (includeImages ? r.generatedImage : { ...r.generatedImage, data: '[EXCLUDED]' })
      : undefined,
  }));

  return JSON.stringify(exportData, null, 2);
}

// CSV 내보내기
export async function exportToCSV(): Promise<string> {
  const records = await db.translations.toArray();

  const headers = [
    'ID',
    'Created At',
    'Source Language',
    'Target Language',
    'Original Text',
    'Translated Text',
    'Confidence',
    'Is Favorite'
  ];

  const rows = records.map(r => [
    r.id,
    r.createdAt.toISOString(),
    r.sourceLanguage,
    r.targetLanguage,
    `"${r.originalText.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
    `"${r.translatedText.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
    r.metadata.confidence,
    r.isFavorite ? 'Yes' : 'No',
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

// 다운로드 트리거
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// JSON 다운로드
export async function downloadAsJSON(filename?: string): Promise<void> {
  const json = await exportToJSON();
  downloadFile(
    json,
    filename || `translations_${new Date().toISOString().split('T')[0]}.json`,
    'application/json'
  );
}

// CSV 다운로드
export async function downloadAsCSV(filename?: string): Promise<void> {
  const csv = await exportToCSV();
  downloadFile(
    csv,
    filename || `translations_${new Date().toISOString().split('T')[0]}.csv`,
    'text/csv'
  );
}
