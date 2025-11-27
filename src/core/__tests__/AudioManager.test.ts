/**
 * AudioManager 单元测试
 */

import { AudioManager } from '../AudioManager';

// Mock DeviceDetector
jest.mock('@/utils/DeviceDetector', () => ({
  DeviceDetector: {
    supportsWebAudio: jest.fn(() => true)
  }
}));

// Mock Web Audio API
class MockAudioContext {
  state = 'running';
  currentTime = 0;
  destination = {};
  
  createGain = jest.fn(() => ({
    connect: jest.fn(),
    gain: {
      value: 1,
      setValueAtTime: jest.fn(),
      linearRampToValueAtTime: jest.fn()
    }
  }));
  
  createBufferSource = jest.fn(() => ({
    buffer: null,
    loop: false,
    playbackRate: { value: 1 },
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    onended: null
  }));
  
  decodeAudioData = jest.fn(() => Promise.resolve({
    duration: 2.5,
    sampleRate: 44100
  }));
  
  resume = jest.fn(() => Promise.resolve());
  close = jest.fn(() => Promise.resolve());
}

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
  })
) as jest.Mock;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock window.AudioContext
(global as any).AudioContext = MockAudioContext;
(global as any).webkitAudioContext = MockAudioContext;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('AudioManager', () => {
  let audioManager: AudioManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    audioManager = new AudioManager();
  });

  afterEach(() => {
    audioManager.destroy();
  });

  describe('初始化', () => {
    it('应该成功初始化音频管理器', () => {
      expect(audioManager.isAudioEnabled()).toBe(true);
      
      const stats = audioManager.getStats();
      expect(stats.isEnabled).toBe(true);
      expect(stats.masterVolume).toBe(0.7);
    });

    it('应该在不支持Web Audio时禁用音频', () => {
      const { DeviceDetector } = require('@/utils/DeviceDetector');
      DeviceDetector.supportsWebAudio.mockReturnValue(false);
      
      const manager = new AudioManager();
      expect(manager.isAudioEnabled()).toBe(false);
      
      manager.destroy();
    });

    it('应该尊重用户的减少动画偏好', () => {
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));
      
      const manager = new AudioManager({ respectUserPreferences: true });
      expect(manager.isAudioEnabled()).toBe(false);
      
      manager.destroy();
    });

    it('应该使用自定义选项', () => {
      const manager = new AudioManager({
        masterVolume: 0.5,
        maxConcurrentSounds: 5
      });
      
      const stats = manager.getStats();
      expect(stats.masterVolume).toBe(0.5);
      
      manager.destroy();
    });
  });

  describe('音效加载', () => {
    it('应该成功加载音效', async () => {
      await audioManager.loadSound('test-sound', '/test.mp3', 0.8);
      
      expect(audioManager.isSoundLoaded('test-sound')).toBe(true);
      expect(audioManager.getLoadedSounds()).toContain('test-sound');
    });

    it('应该处理重复加载', async () => {
      await audioManager.loadSound('test-sound', '/test.mp3');
      await audioManager.loadSound('test-sound', '/test.mp3'); // 重复加载
      
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('应该处理加载错误', async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      await expect(audioManager.loadSound('error-sound', '/error.mp3'))
        .rejects.toThrow();
    });

    it('应该批量预加载音效', async () => {
      const soundConfigs = [
        { name: 'sound1', url: '/sound1.mp3', volume: 0.8 },
        { name: 'sound2', url: '/sound2.mp3', volume: 0.6 }
      ];
      
      await audioManager.preloadSounds(soundConfigs);
      
      expect(audioManager.isSoundLoaded('sound1')).toBe(true);
      expect(audioManager.isSoundLoaded('sound2')).toBe(true);
    });
  });

  describe('音效播放', () => {
    beforeEach(async () => {
      await audioManager.loadSound('test-sound', '/test.mp3');
    });

    it('应该成功播放音效', () => {
      const soundId = audioManager.playSound('test-sound');
      
      expect(soundId).toBeTruthy();
      expect(soundId).toMatch(/^test-sound_\d+$/);
      
      const stats = audioManager.getStats();
      expect(stats.playingSounds).toBe(1);
    });

    it('应该使用播放选项', () => {
      const soundId = audioManager.playSound('test-sound', {
        volume: 0.5,
        loop: true,
        playbackRate: 1.2,
        delay: 0.1
      });
      
      expect(soundId).toBeTruthy();
    });

    it('应该处理淡入淡出效果', () => {
      const soundId = audioManager.playSound('test-sound', {
        fadeIn: 0.5,
        fadeOut: 0.3
      });
      
      expect(soundId).toBeTruthy();
    });

    it('应该在音效未加载时返回null', () => {
      const soundId = audioManager.playSound('non-existent-sound');
      
      expect(soundId).toBeNull();
    });

    it('应该播放随机音效', () => {
      const soundNames = ['test-sound'];
      const soundId = audioManager.playRandomSound(soundNames);
      
      expect(soundId).toBeTruthy();
    });

    it('应该在空数组时返回null', () => {
      const soundId = audioManager.playRandomSound([]);
      
      expect(soundId).toBeNull();
    });
  });

  describe('音效控制', () => {
    let soundId: string;

    beforeEach(async () => {
      await audioManager.loadSound('test-sound', '/test.mp3');
      soundId = audioManager.playSound('test-sound')!;
    });

    it('应该停止指定音效', () => {
      audioManager.stopSound(soundId);
      
      const stats = audioManager.getStats();
      expect(stats.playingSounds).toBe(0);
    });

    it('应该使用淡出停止音效', () => {
      audioManager.stopSound(soundId, 0.5);
      
      // 淡出期间音效仍在播放
      const stats = audioManager.getStats();
      expect(stats.playingSounds).toBe(1);
    });

    it('应该停止所有音效', () => {
      audioManager.playSound('test-sound');
      audioManager.playSound('test-sound');
      
      audioManager.stopAllSounds();
      
      const stats = audioManager.getStats();
      expect(stats.playingSounds).toBe(0);
    });

    it('应该限制并发音效数量', async () => {
      const manager = new AudioManager({ maxConcurrentSounds: 2 });
      await manager.loadSound('test-sound', '/test.mp3');
      
      // 播放超过限制的音效
      manager.playSound('test-sound');
      manager.playSound('test-sound');
      manager.playSound('test-sound'); // 应该停止最老的
      
      const stats = manager.getStats();
      expect(stats.playingSounds).toBeLessThanOrEqual(2);
      
      manager.destroy();
    });
  });

  describe('音量控制', () => {
    it('应该设置主音量', () => {
      audioManager.setMasterVolume(0.3);
      
      expect(audioManager.getMasterVolume()).toBe(0.3);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('master_volume', '0.3');
    });

    it('应该限制音量范围', () => {
      audioManager.setMasterVolume(-0.5);
      expect(audioManager.getMasterVolume()).toBe(0);
      
      audioManager.setMasterVolume(1.5);
      expect(audioManager.getMasterVolume()).toBe(1);
    });

    it('应该静音和取消静音', () => {
      audioManager.mute();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('audio_muted', 'true');
      
      audioManager.unmute();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('audio_muted', 'false');
    });

    it('应该检查静音状态', () => {
      mockLocalStorage.getItem.mockReturnValue('true');
      expect(audioManager.isMuted()).toBe(true);
      
      mockLocalStorage.getItem.mockReturnValue('false');
      expect(audioManager.isMuted()).toBe(false);
    });
  });

  describe('音频启用/禁用', () => {
    it('应该启用/禁用音频', () => {
      audioManager.setAudioEnabled(false);
      expect(audioManager.isAudioEnabled()).toBe(false);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('audio_enabled', 'false');
      
      audioManager.setAudioEnabled(true);
      expect(audioManager.isAudioEnabled()).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('audio_enabled', 'true');
    });

    it('应该在禁用音频时停止所有音效', async () => {
      await audioManager.loadSound('test-sound', '/test.mp3');
      audioManager.playSound('test-sound');
      
      audioManager.setAudioEnabled(false);
      
      const stats = audioManager.getStats();
      expect(stats.playingSounds).toBe(0);
    });
  });

  describe('音效管理', () => {
    beforeEach(async () => {
      await audioManager.loadSound('test-sound', '/test.mp3');
    });

    it('应该移除指定音效', () => {
      const soundId = audioManager.playSound('test-sound');
      
      audioManager.removeSound('test-sound');
      
      expect(audioManager.isSoundLoaded('test-sound')).toBe(false);
      const stats = audioManager.getStats();
      expect(stats.playingSounds).toBe(0);
    });

    it('应该清除所有音效', () => {
      audioManager.playSound('test-sound');
      
      audioManager.clearAllSounds();
      
      expect(audioManager.getLoadedSounds()).toHaveLength(0);
      const stats = audioManager.getStats();
      expect(stats.playingSounds).toBe(0);
    });
  });

  describe('统计信息', () => {
    it('应该提供正确的统计信息', async () => {
      await audioManager.loadSound('test-sound', '/test.mp3');
      audioManager.playSound('test-sound');
      
      const stats = audioManager.getStats();
      
      expect(stats.totalSounds).toBe(1);
      expect(stats.loadedSounds).toBe(1);
      expect(stats.playingSounds).toBe(1);
      expect(stats.masterVolume).toBe(0.7);
      expect(stats.isEnabled).toBe(true);
      expect(typeof stats.audioContextState).toBe('string');
    });

    it('应该返回已加载音效列表', async () => {
      await audioManager.loadSound('sound1', '/sound1.mp3');
      await audioManager.loadSound('sound2', '/sound2.mp3');
      
      const loadedSounds = audioManager.getLoadedSounds();
      
      expect(loadedSounds).toContain('sound1');
      expect(loadedSounds).toContain('sound2');
      expect(loadedSounds).toHaveLength(2);
    });
  });

  describe('错误处理', () => {
    it('应该处理音频上下文创建失败', () => {
      // Mock AudioContext constructor to throw
      const originalAudioContext = (global as any).AudioContext;
      (global as any).AudioContext = jest.fn(() => {
        throw new Error('AudioContext creation failed');
      });
      
      const manager = new AudioManager();
      expect(manager.isAudioEnabled()).toBe(false);
      
      // Restore
      (global as any).AudioContext = originalAudioContext;
      manager.destroy();
    });

    it('应该处理音效播放错误', async () => {
      await audioManager.loadSound('test-sound', '/test.mp3');
      
      // Mock createBufferSource to throw
      const mockContext = audioManager['audioContext'] as any;
      mockContext.createBufferSource = jest.fn(() => {
        throw new Error('Buffer source creation failed');
      });
      
      const soundId = audioManager.playSound('test-sound');
      expect(soundId).toBeNull();
    });

    it('应该处理音效停止错误', async () => {
      await audioManager.loadSound('test-sound', '/test.mp3');
      const soundId = audioManager.playSound('test-sound')!;
      
      // Mock stop to throw
      const instance = audioManager['playingSounds'].get(soundId);
      if (instance) {
        instance.source.stop = jest.fn(() => {
          throw new Error('Stop failed');
        });
      }
      
      // Should not throw
      expect(() => audioManager.stopSound(soundId)).not.toThrow();
    });
  });

  describe('销毁功能', () => {
    it('应该正确销毁音频管理器', async () => {
      await audioManager.loadSound('test-sound', '/test.mp3');
      audioManager.playSound('test-sound');
      
      audioManager.destroy();
      
      const stats = audioManager.getStats();
      expect(stats.playingSounds).toBe(0);
      expect(stats.totalSounds).toBe(0);
      expect(stats.audioContextState).toBe('not-initialized');
    });
  });

  describe('用户交互处理', () => {
    it('应该在音频上下文暂停时设置用户交互处理器', () => {
      const mockContext = new MockAudioContext();
      mockContext.state = 'suspended';
      
      const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
      
      new AudioManager({ audioContext: mockContext as any });
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function), { once: true });
      expect(addEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function), { once: true });
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), { once: true });
      
      addEventListenerSpy.mockRestore();
    });
  });
});