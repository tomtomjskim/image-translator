import Dexie, { type Table } from 'dexie';
import type { TranslationRecord, SettingsRecord } from './schema';

class TranslationDatabase extends Dexie {
  translations!: Table<TranslationRecord, string>;
  settings!: Table<SettingsRecord, string>;

  constructor() {
    super('ImageTranslatorDB');

    this.version(1).stores({
      translations: 'id, createdAt, sourceLanguage, targetLanguage, isFavorite, [sourceLanguage+targetLanguage]',
      settings: 'key',
    });
  }
}

export const db = new TranslationDatabase();

// 데이터베이스 초기화 확인
export async function initDatabase(): Promise<void> {
  try {
    await db.open();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

// 데이터베이스 삭제 (개발용)
export async function resetDatabase(): Promise<void> {
  await db.delete();
  await db.open();
}
