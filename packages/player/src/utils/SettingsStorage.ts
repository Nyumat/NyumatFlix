
interface PlayerSettings {
  volume?: number;
  muted?: boolean;
  playbackRate?: number;
  stableVolume?: boolean;
  ambientMode?: boolean;
  hdr?: boolean;
}

const SETTINGS_FILE = 'movi_settings.json';

export class SettingsStorage {
  private static instance: SettingsStorage;
  private settings: PlayerSettings = {};
  private savePromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): SettingsStorage {
    if (!SettingsStorage.instance) {
      SettingsStorage.instance = new SettingsStorage();
    }
    return SettingsStorage.instance;
  }

  async load(): Promise<PlayerSettings> {
    try {
      const root = await navigator.storage.getDirectory();
      try {
        const fileHandle = await root.getFileHandle(SETTINGS_FILE);
        const file = await fileHandle.getFile();
        const text = await file.text();
        this.settings = JSON.parse(text);
      } catch (e) {
        // File doesn't exist or is invalid, use defaults
        this.settings = {};
      }
    } catch (e) {
      console.warn('OPFS not supported or accessible:', e);
      this.settings = {};
    }
    return this.settings;
  }

  async save(settings: Partial<PlayerSettings>): Promise<void> {
    this.settings = { ...this.settings, ...settings };
    
    // Debounce/Queue save
    if (this.savePromise) return this.savePromise;

    this.savePromise = new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const root = await navigator.storage.getDirectory();
          const fileHandle = await root.getFileHandle(SETTINGS_FILE, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(this.settings));
          await writable.close();
        } catch (e) {
          console.warn('Failed to save settings to OPFS:', e);
        } finally {
          this.savePromise = null;
          resolve();
        }
      }, 500); // 500ms debounce
    });
    
    return this.savePromise;
  }

  get(): PlayerSettings {
    return this.settings;
  }
}
