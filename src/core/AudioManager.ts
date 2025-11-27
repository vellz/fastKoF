/**
 * 音效管理器
 * 处理游戏中的音频加载、播放和管理
 */

import { DeviceDetector } from '@/utils/DeviceDetector';
import type { GameError } from '@/types/error.types';

export interface AudioManagerOptions {
  masterVolume?: number;
  enableAudio?: boolean;
  maxConcurrentSounds?: number;
  audioContext?: AudioContext;
  respectUserPreferences?: boolean;
}

export interface SoundOptions {
  volume?: number;
  loop?: boolean;
  playbackRate?: number;
  fadeIn?: number;
  fadeOut?: number;
  delay?: number;
}

export interface AudioResource {
  name: string;
  buffer: AudioBuffer;
  volume: number;
  url: string;
  loaded: boolean;
}

export interface PlayingSoundInstance {
  id: string;
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  startTime: number;
  duration: number;
  volume: number;
  loop: boolean;
  onEnded?: () => void;
}

/**
 * 音效管理器类
 */
export class AudioManager {
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private sounds = new Map<string, AudioResource>();
  private playingSounds = new Map<string, PlayingSoundInstance>();
  private options: Required<AudioManagerOptions>;
  private isInitialized = false;
  private loadingPromises = new Map<string, Promise<AudioBuffer>>();
  private soundIdCounter = 0;

  constructor(options: AudioManagerOptions = {}) {
    this.options = {
      masterVolume: 0.7,
      enableAudio: true,
      maxConcurrentSounds: 10,
      audioContext: undefined,
      respectUserPreferences: true,
      ...options
    };

    this.init();
  }

  /**
   * 初始化音频系统
   */
  private async init(): Promise<void> {
    try {
      // 检查浏览器支持
      if (!DeviceDetector.supportsWebAudio()) {
        console.warn('Web Audio API not supported');
        this.options.enableAudio = false;
        return;
      }

      // 检查用户偏好
      if (this.options.respectUserPreferences && this.shouldRespectUserPreferences()) {
        this.options.enableAudio = false;
        return;
      }

      // 创建音频上下文
      this.audioContext = this.options.audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // 创建主增益节点
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.connect(this.audioContext.destination);
      this.masterGainNode.gain.value = this.options.masterVolume;

      // 处理音频上下文状态
      if (this.audioContext.state === 'suspended') {
        // 等待用户交互后恢复
        this.setupUserInteractionHandler();
      }

      this.isInitialized = true;
      console.log('AudioManager initialized successfully');

    } catch (error) {
      console.error('Failed to initialize AudioManager:', error);
      this.options.enableAudio = false;
    }
  }

  /**
   * 检查是否应该尊重用户偏好
   */
  private shouldRespectUserPreferences(): boolean {
    // 检查用户是否设置了减少动画偏好
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return true;
    }

    // 检查本地存储的音频偏好
    const audioPreference = localStorage.getItem('audio_enabled');
    if (audioPreference === 'false') {
      return true;
    }

    return false;
  }

  /**
   * 设置用户交互处理器
   */
  private setupUserInteractionHandler(): void {
    const resumeAudio = async () => {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
          console.log('Audio context resumed');
        } catch (error) {
          console.error('Failed to resume audio context:', error);
        }
      }
      
      // 移除事件监听器
      document.removeEventListener('click', resumeAudio);
      document.removeEventListener('touchstart', resumeAudio);
      document.removeEventListener('keydown', resumeAudio);
    };

    document.addEventListener('click', resumeAudio, { once: true });
    document.addEventListener('touchstart', resumeAudio, { once: true });
    document.addEventListener('keydown', resumeAudio, { once: true });
  }

  /**
   * 加载音频文件
   */
  async loadSound(name: string, url: string, volume: number = 1): Promise<void> {
    if (!this.options.enableAudio || !this.audioContext) {
      return;
    }

    // 检查是否已经在加载
    if (this.loadingPromises.has(name)) {
      await this.loadingPromises.get(name);
      return;
    }

    // 检查是否已经加载
    if (this.sounds.has(name)) {
      return;
    }

    const loadingPromise = this.loadAudioBuffer(url);
    this.loadingPromises.set(name, loadingPromise);

    try {
      const buffer = await loadingPromise;
      
      const audioResource: AudioResource = {
        name,
        buffer,
        volume,
        url,
        loaded: true
      };

      this.sounds.set(name, audioResource);
      console.log(`Sound loaded: ${name}`);

    } catch (error) {
      console.error(`Failed to load sound: ${name}`, error);
      throw this.createAudioError('AUDIO_ERROR', `Failed to load sound: ${name}`, error);
    } finally {
      this.loadingPromises.delete(name);
    }
  }

  /**
   * 加载音频缓冲区
   */
  private async loadAudioBuffer(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return this.audioContext!.decodeAudioData(arrayBuffer);
  }

  /**
   * 播放音效
   */
  playSound(name: string, options: SoundOptions = {}): string | null {
    if (!this.options.enableAudio || !this.audioContext || !this.masterGainNode) {
      return null;
    }

    const audioResource = this.sounds.get(name);
    if (!audioResource || !audioResource.loaded) {
      console.warn(`Sound not found or not loaded: ${name}`);
      return null;
    }

    // 检查并发音效限制
    if (this.playingSounds.size >= this.options.maxConcurrentSounds) {
      this.stopOldestSound();
    }

    try {
      const soundId = `${name}_${++this.soundIdCounter}`;
      const instance = this.createSoundInstance(audioResource, options, soundId);
      
      this.playingSounds.set(soundId, instance);
      
      // 开始播放
      const delay = options.delay || 0;
      const when = this.audioContext.currentTime + delay;
      
      instance.source.start(when);
      
      // 设置结束回调
      instance.source.onended = () => {
        this.playingSounds.delete(soundId);
        if (options.fadeOut) {
          // 淡出已经在createSoundInstance中处理
        }
        instance.onEnded?.();
      };

      return soundId;

    } catch (error) {
      console.error(`Failed to play sound: ${name}`, error);
      return null;
    }
  }

  /**
   * 创建音效实例
   */
  private createSoundInstance(
    audioResource: AudioResource, 
    options: SoundOptions, 
    soundId: string
  ): PlayingSoundInstance {
    const source = this.audioContext!.createBufferSource();
    const gainNode = this.audioContext!.createGain();

    source.buffer = audioResource.buffer;
    source.loop = options.loop || false;
    source.playbackRate.value = options.playbackRate || 1;

    // 连接音频节点
    source.connect(gainNode);
    gainNode.connect(this.masterGainNode!);

    // 设置音量
    const volume = (options.volume || 1) * audioResource.volume;
    gainNode.gain.value = volume;

    // 处理淡入效果
    if (options.fadeIn && options.fadeIn > 0) {
      gainNode.gain.setValueAtTime(0, this.audioContext!.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        volume, 
        this.audioContext!.currentTime + options.fadeIn
      );
    }

    // 处理淡出效果
    if (options.fadeOut && options.fadeOut > 0 && !options.loop) {
      const fadeStartTime = this.audioContext!.currentTime + audioResource.buffer.duration - options.fadeOut;
      gainNode.gain.setValueAtTime(volume, fadeStartTime);
      gainNode.gain.linearRampToValueAtTime(0, fadeStartTime + options.fadeOut);
    }

    return {
      id: soundId,
      source,
      gainNode,
      startTime: this.audioContext!.currentTime,
      duration: audioResource.buffer.duration,
      volume,
      loop: options.loop || false,
      onEnded: options.fadeOut ? undefined : () => {}
    };
  }

  /**
   * 停止音效
   */
  stopSound(soundId: string, fadeOut: number = 0): void {
    const instance = this.playingSounds.get(soundId);
    if (!instance) return;

    try {
      if (fadeOut > 0) {
        // 淡出停止
        const currentTime = this.audioContext!.currentTime;
        instance.gainNode.gain.setValueAtTime(instance.volume, currentTime);
        instance.gainNode.gain.linearRampToValueAtTime(0, currentTime + fadeOut);
        
        setTimeout(() => {
          instance.source.stop();
          this.playingSounds.delete(soundId);
        }, fadeOut * 1000);
      } else {
        // 立即停止
        instance.source.stop();
        this.playingSounds.delete(soundId);
      }
    } catch (error) {
      console.error('Error stopping sound:', error);
      this.playingSounds.delete(soundId);
    }
  }

  /**
   * 停止所有音效
   */
  stopAllSounds(fadeOut: number = 0): void {
    const soundIds = Array.from(this.playingSounds.keys());
    soundIds.forEach(id => this.stopSound(id, fadeOut));
  }

  /**
   * 停止最老的音效
   */
  private stopOldestSound(): void {
    let oldestId = '';
    let oldestTime = Infinity;

    this.playingSounds.forEach((instance, id) => {
      if (instance.startTime < oldestTime) {
        oldestTime = instance.startTime;
        oldestId = id;
      }
    });

    if (oldestId) {
      this.stopSound(oldestId);
    }
  }

  /**
   * 播放随机音效
   */
  playRandomSound(soundNames: string[], options: SoundOptions = {}): string | null {
    if (soundNames.length === 0) return null;
    
    const randomName = soundNames[Math.floor(Math.random() * soundNames.length)];
    return this.playSound(randomName, options);
  }

  /**
   * 设置主音量
   */
  setMasterVolume(volume: number): void {
    this.options.masterVolume = Math.max(0, Math.min(1, volume));
    
    if (this.masterGainNode) {
      this.masterGainNode.gain.setValueAtTime(
        this.options.masterVolume, 
        this.audioContext!.currentTime
      );
    }

    // 保存到本地存储
    localStorage.setItem('master_volume', this.options.masterVolume.toString());
  }

  /**
   * 获取主音量
   */
  getMasterVolume(): number {
    return this.options.masterVolume;
  }

  /**
   * 静音
   */
  mute(): void {
    if (this.masterGainNode) {
      this.masterGainNode.gain.setValueAtTime(0, this.audioContext!.currentTime);
    }
    localStorage.setItem('audio_muted', 'true');
  }

  /**
   * 取消静音
   */
  unmute(): void {
    if (this.masterGainNode) {
      this.masterGainNode.gain.setValueAtTime(
        this.options.masterVolume, 
        this.audioContext!.currentTime
      );
    }
    localStorage.setItem('audio_muted', 'false');
  }

  /**
   * 检查是否静音
   */
  isMuted(): boolean {
    return localStorage.getItem('audio_muted') === 'true';
  }

  /**
   * 启用/禁用音频
   */
  setAudioEnabled(enabled: boolean): void {
    this.options.enableAudio = enabled;
    
    if (!enabled) {
      this.stopAllSounds();
    }

    localStorage.setItem('audio_enabled', enabled.toString());
  }

  /**
   * 检查音频是否启用
   */
  isAudioEnabled(): boolean {
    return this.options.enableAudio && this.isInitialized;
  }

  /**
   * 预加载音效组
   */
  async preloadSounds(soundConfigs: Array<{ name: string; url: string; volume?: number }>): Promise<void> {
    const loadPromises = soundConfigs.map(config => 
      this.loadSound(config.name, config.url, config.volume)
    );

    try {
      await Promise.all(loadPromises);
      console.log('All sounds preloaded successfully');
    } catch (error) {
      console.error('Failed to preload some sounds:', error);
    }
  }

  /**
   * 获取音效统计信息
   */
  getStats(): {
    totalSounds: number;
    loadedSounds: number;
    playingSounds: number;
    audioContextState: string;
    masterVolume: number;
    isEnabled: boolean;
    isMuted: boolean;
  } {
    return {
      totalSounds: this.sounds.size,
      loadedSounds: Array.from(this.sounds.values()).filter(s => s.loaded).length,
      playingSounds: this.playingSounds.size,
      audioContextState: this.audioContext?.state || 'not-initialized',
      masterVolume: this.options.masterVolume,
      isEnabled: this.options.enableAudio,
      isMuted: this.isMuted()
    };
  }

  /**
   * 获取已加载的音效列表
   */
  getLoadedSounds(): string[] {
    return Array.from(this.sounds.keys()).filter(name => 
      this.sounds.get(name)?.loaded
    );
  }

  /**
   * 检查音效是否已加载
   */
  isSoundLoaded(name: string): boolean {
    const sound = this.sounds.get(name);
    return sound ? sound.loaded : false;
  }

  /**
   * 移除音效
   */
  removeSound(name: string): void {
    // 停止所有该音效的播放实例
    const instancesToStop: string[] = [];
    this.playingSounds.forEach((instance, id) => {
      if (id.startsWith(name + '_')) {
        instancesToStop.push(id);
      }
    });
    
    instancesToStop.forEach(id => this.stopSound(id));
    
    // 移除音效资源
    this.sounds.delete(name);
  }

  /**
   * 清除所有音效
   */
  clearAllSounds(): void {
    this.stopAllSounds();
    this.sounds.clear();
    this.loadingPromises.clear();
  }

  /**
   * 创建音频错误
   */
  private createAudioError(type: string, message: string, details?: any): GameError {
    return {
      type: type as any,
      message,
      details,
      timestamp: Date.now(),
      recoverable: true
    };
  }

  /**
   * 销毁音频管理器
   */
  destroy(): void {
    this.stopAllSounds();
    this.clearAllSounds();
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    this.audioContext = null;
    this.masterGainNode = null;
    this.isInitialized = false;
  }
}