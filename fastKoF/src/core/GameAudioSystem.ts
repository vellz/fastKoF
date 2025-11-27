/**
 * 游戏音效系统
 * 集成AudioManager，提供游戏特定的音效播放逻辑
 */

import { AudioManager } from './AudioManager';
import type { GameConfig } from '@/config/game.config';

export interface GameAudioOptions {
  audioManager?: AudioManager;
  gameConfig?: GameConfig;
  enableDynamicVolume?: boolean;
  enableSpatialAudio?: boolean;
}

export interface SoundEffect {
  name: string;
  category: 'click' | 'hit' | 'transform' | 'ui' | 'ambient';
  files: string[];
  volume: number;
  variations?: number;
  cooldown?: number;
}

export interface AudioPlaybackContext {
  clickCount?: number;
  comboLevel?: number;
  gamePhase?: string;
  intensity?: number;
  position?: { x: number; y: number };
}

/**
 * 游戏音效系统类
 */
export class GameAudioSystem {
  private audioManager: AudioManager;
  private soundEffects = new Map<string, SoundEffect>();
  private lastPlayTimes = new Map<string, number>();
  private options: Required<GameAudioOptions>;
  private isInitialized = false;

  // 音效分类
  private readonly soundCategories = {
    click: {
      baseVolume: 0.6,
      maxConcurrent: 3,
      priority: 1
    },
    hit: {
      baseVolume: 0.8,
      maxConcurrent: 2,
      priority: 2
    },
    transform: {
      baseVolume: 1.0,
      maxConcurrent: 1,
      priority: 3
    },
    ui: {
      baseVolume: 0.4,
      maxConcurrent: 5,
      priority: 0
    },
    ambient: {
      baseVolume: 0.3,
      maxConcurrent: 1,
      priority: 0
    }
  };

  constructor(options: GameAudioOptions = {}) {
    this.audioManager = options.audioManager || new AudioManager();
    
    this.options = {
      audioManager: this.audioManager,
      gameConfig: undefined,
      enableDynamicVolume: true,
      enableSpatialAudio: false,
      ...options
    };

    this.init();
  }

  /**
   * 初始化游戏音效系统
   */
  private async init(): Promise<void> {
    try {
      // 定义游戏音效
      this.defineSoundEffects();
      
      // 预加载音效
      await this.preloadGameSounds();
      
      this.isInitialized = true;
      console.log('GameAudioSystem initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize GameAudioSystem:', error);
    }
  }

  /**
   * 定义游戏音效
   */
  private defineSoundEffects(): void {
    const soundEffects: SoundEffect[] = [
      // 点击音效
      {
        name: 'click_light',
        category: 'click',
        files: ['/sounds/click_light_1.mp3', '/sounds/click_light_2.mp3', '/sounds/click_light_3.mp3'],
        volume: 0.6,
        variations: 3,
        cooldown: 50
      },
      {
        name: 'click_medium',
        category: 'click',
        files: ['/sounds/click_medium_1.mp3', '/sounds/click_medium_2.mp3'],
        volume: 0.7,
        variations: 2,
        cooldown: 50
      },
      {
        name: 'click_heavy',
        category: 'click',
        files: ['/sounds/click_heavy_1.mp3', '/sounds/click_heavy_2.mp3'],
        volume: 0.8,
        variations: 2,
        cooldown: 50
      },
      
      // 打击音效
      {
        name: 'punch_impact',
        category: 'hit',
        files: ['/sounds/punch_1.mp3', '/sounds/punch_2.mp3', '/sounds/punch_3.mp3'],
        volume: 0.8,
        variations: 3,
        cooldown: 100
      },
      {
        name: 'combo_hit',
        category: 'hit',
        files: ['/sounds/combo_hit_1.mp3', '/sounds/combo_hit_2.mp3'],
        volume: 0.9,
        variations: 2,
        cooldown: 80
      },
      {
        name: 'critical_hit',
        category: 'hit',
        files: ['/sounds/critical_hit.mp3'],
        volume: 1.0,
        variations: 1,
        cooldown: 200
      },
      
      // 变形音效
      {
        name: 'transform_light',
        category: 'transform',
        files: ['/sounds/transform_light.mp3'],
        volume: 0.9,
        variations: 1,
        cooldown: 1000
      },
      {
        name: 'transform_heavy',
        category: 'transform',
        files: ['/sounds/transform_heavy.mp3'],
        volume: 1.0,
        variations: 1,
        cooldown: 1000
      },
      
      // UI音效
      {
        name: 'button_hover',
        category: 'ui',
        files: ['/sounds/ui_hover.mp3'],
        volume: 0.3,
        variations: 1,
        cooldown: 100
      },
      {
        name: 'button_click',
        category: 'ui',
        files: ['/sounds/ui_click.mp3'],
        volume: 0.4,
        variations: 1,
        cooldown: 150
      },
      {
        name: 'upload_success',
        category: 'ui',
        files: ['/sounds/upload_success.mp3'],
        volume: 0.5,
        variations: 1,
        cooldown: 500
      },
      {
        name: 'error_sound',
        category: 'ui',
        files: ['/sounds/error.mp3'],
        volume: 0.6,
        variations: 1,
        cooldown: 1000
      },
      
      // 环境音效
      {
        name: 'ambient_tension',
        category: 'ambient',
        files: ['/sounds/ambient_tension.mp3'],
        volume: 0.2,
        variations: 1,
        cooldown: 0
      }
    ];

    soundEffects.forEach(effect => {
      this.soundEffects.set(effect.name, effect);
    });
  }

  /**
   * 预加载游戏音效
   */
  private async preloadGameSounds(): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    this.soundEffects.forEach((effect, name) => {
      effect.files.forEach((file, index) => {
        const soundName = effect.variations && effect.variations > 1 
          ? `${name}_${index + 1}`
          : name;
        
        loadPromises.push(
          this.audioManager.loadSound(soundName, file, effect.volume)
        );
      });
    });

    try {
      await Promise.all(loadPromises);
      console.log('All game sounds preloaded');
    } catch (error) {
      console.error('Failed to preload some game sounds:', error);
    }
  }

  /**
   * 播放点击音效
   */
  playClickSound(context: AudioPlaybackContext = {}): string | null {
    if (!this.isInitialized) return null;

    const clickCount = context.clickCount || 0;
    const comboLevel = context.comboLevel || 0;
    
    // 根据连击数选择音效
    let soundName: string;
    if (comboLevel >= 10) {
      soundName = 'critical_hit';
    } else if (comboLevel >= 5) {
      soundName = 'combo_hit';
    } else if (clickCount > 50) {
      soundName = 'click_heavy';
    } else if (clickCount > 20) {
      soundName = 'click_medium';
    } else {
      soundName = 'click_light';
    }

    return this.playGameSound(soundName, context);
  }

  /**
   * 播放打击音效
   */
  playHitSound(intensity: number = 1, context: AudioPlaybackContext = {}): string | null {
    if (!this.isInitialized) return null;

    const comboLevel = context.comboLevel || 0;
    
    let soundName: string;
    if (comboLevel >= 10 || intensity >= 0.8) {
      soundName = 'critical_hit';
    } else if (comboLevel >= 3 || intensity >= 0.5) {
      soundName = 'combo_hit';
    } else {
      soundName = 'punch_impact';
    }

    return this.playGameSound(soundName, {
      ...context,
      intensity
    });
  }

  /**
   * 播放变形音效
   */
  playTransformSound(transformType: 'light' | 'heavy'): string | null {
    if (!this.isInitialized) return null;

    const soundName = transformType === 'heavy' ? 'transform_heavy' : 'transform_light';
    
    return this.playGameSound(soundName, {
      intensity: transformType === 'heavy' ? 1.0 : 0.7
    });
  }

  /**
   * 播放UI音效
   */
  playUISound(type: 'hover' | 'click' | 'success' | 'error'): string | null {
    if (!this.isInitialized) return null;

    const soundMap = {
      hover: 'button_hover',
      click: 'button_click',
      success: 'upload_success',
      error: 'error_sound'
    };

    const soundName = soundMap[type];
    return this.playGameSound(soundName);
  }

  /**
   * 播放环境音效
   */
  playAmbientSound(type: 'tension', loop: boolean = true): string | null {
    if (!this.isInitialized) return null;

    const soundName = `ambient_${type}`;
    
    return this.playGameSound(soundName, {}, {
      loop,
      volume: 0.2
    });
  }

  /**
   * 播放游戏音效（核心方法）
   */
  private playGameSound(
    soundName: string, 
    context: AudioPlaybackContext = {},
    options: any = {}
  ): string | null {
    const effect = this.soundEffects.get(soundName);
    if (!effect) {
      console.warn(`Sound effect not found: ${soundName}`);
      return null;
    }

    // 检查冷却时间
    if (this.isOnCooldown(soundName, effect.cooldown)) {
      return null;
    }

    // 计算音量
    const volume = this.calculateVolume(effect, context);
    
    // 选择音效变体
    const actualSoundName = this.selectSoundVariation(soundName, effect);
    
    // 应用空间音频效果
    const spatialOptions = this.applySpatialAudio(context, options);
    
    // 播放音效
    const soundId = this.audioManager.playSound(actualSoundName, {
      volume,
      ...spatialOptions,
      ...options
    });

    // 记录播放时间
    if (soundId) {
      this.lastPlayTimes.set(soundName, Date.now());
    }

    return soundId;
  }

  /**
   * 检查冷却时间
   */
  private isOnCooldown(soundName: string, cooldown?: number): boolean {
    if (!cooldown || cooldown <= 0) return false;

    const lastPlayTime = this.lastPlayTimes.get(soundName);
    if (!lastPlayTime) return false;

    return (Date.now() - lastPlayTime) < cooldown;
  }

  /**
   * 计算音量
   */
  private calculateVolume(effect: SoundEffect, context: AudioPlaybackContext): number {
    let volume = effect.volume;
    
    if (!this.options.enableDynamicVolume) {
      return volume;
    }

    // 根据游戏状态调整音量
    const intensity = context.intensity || 1;
    const comboLevel = context.comboLevel || 0;
    
    // 连击加成
    if (comboLevel > 0) {
      const comboBonus = Math.min(comboLevel * 0.05, 0.3); // 最多30%加成
      volume += comboBonus;
    }

    // 强度调整
    volume *= intensity;

    // 分类基础音量
    const categoryConfig = this.soundCategories[effect.category];
    if (categoryConfig) {
      volume *= categoryConfig.baseVolume;
    }

    return Math.min(volume, 1.0);
  }

  /**
   * 选择音效变体
   */
  private selectSoundVariation(soundName: string, effect: SoundEffect): string {
    if (!effect.variations || effect.variations <= 1) {
      return soundName;
    }

    const variationIndex = Math.floor(Math.random() * effect.variations) + 1;
    return `${soundName}_${variationIndex}`;
  }

  /**
   * 应用空间音频效果
   */
  private applySpatialAudio(context: AudioPlaybackContext, options: any): any {
    if (!this.options.enableSpatialAudio || !context.position) {
      return options;
    }

    // 简单的立体声平移效果
    const canvasWidth = 800; // 假设画布宽度
    const normalizedX = (context.position.x / canvasWidth) * 2 - 1; // -1 到 1
    
    // 这里可以扩展更复杂的空间音频效果
    return {
      ...options,
      // 注意：Web Audio API的立体声平移需要在AudioManager中实现
      spatialX: normalizedX
    };
  }

  /**
   * 停止特定类别的音效
   */
  stopSoundsByCategory(category: SoundEffect['category'], fadeOut: number = 0): void {
    // 这需要AudioManager支持按标签停止音效
    // 目前简化实现
    if (category === 'ambient') {
      this.audioManager.stopAllSounds(fadeOut);
    }
  }

  /**
   * 设置分类音量
   */
  setCategoryVolume(category: SoundEffect['category'], volume: number): void {
    const categoryConfig = this.soundCategories[category];
    if (categoryConfig) {
      categoryConfig.baseVolume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * 获取分类音量
   */
  getCategoryVolume(category: SoundEffect['category']): number {
    const categoryConfig = this.soundCategories[category];
    return categoryConfig ? categoryConfig.baseVolume : 1.0;
  }

  /**
   * 启用/禁用动态音量
   */
  setDynamicVolumeEnabled(enabled: boolean): void {
    this.options.enableDynamicVolume = enabled;
  }

  /**
   * 启用/禁用空间音频
   */
  setSpatialAudioEnabled(enabled: boolean): void {
    this.options.enableSpatialAudio = enabled;
  }

  /**
   * 获取音效统计信息
   */
  getAudioStats(): {
    totalEffects: number;
    loadedEffects: number;
    categoryCounts: Record<string, number>;
    audioManagerStats: any;
  } {
    const categoryCounts: Record<string, number> = {};
    
    this.soundEffects.forEach(effect => {
      categoryCounts[effect.category] = (categoryCounts[effect.category] || 0) + 1;
    });

    return {
      totalEffects: this.soundEffects.size,
      loadedEffects: this.audioManager.getLoadedSounds().length,
      categoryCounts,
      audioManagerStats: this.audioManager.getStats()
    };
  }

  /**
   * 重新加载音效资源
   */
  async reloadSounds(): Promise<void> {
    this.audioManager.clearAllSounds();
    await this.preloadGameSounds();
  }

  /**
   * 获取AudioManager实例
   */
  getAudioManager(): AudioManager {
    return this.audioManager;
  }

  /**
   * 销毁游戏音效系统
   */
  destroy(): void {
    this.audioManager.destroy();
    this.soundEffects.clear();
    this.lastPlayTimes.clear();
    this.isInitialized = false;
  }
}