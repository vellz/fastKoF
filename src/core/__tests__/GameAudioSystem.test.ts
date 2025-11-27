/**
 * GameAudioSystem 单元测试
 */

import { GameAudioSystem } from '../GameAudioSystem';
import { AudioManager } from '../AudioManager';

// Mock AudioManager
jest.mock('../AudioManager');

describe('GameAudioSystem', () => {
  let gameAudioSystem: GameAudioSystem;
  let mockAudioManager: jest.Mocked<AudioManager>;

  beforeEach(() => {
    // 创建AudioManager的mock实例
    mockAudioManager = {
      loadSound: jest.fn().mockResolvedValue(undefined),
      playSound: jest.fn().mockReturnValue('sound-id-123'),
      stopSound: jest.fn(),
      stopAllSounds: jest.fn(),
      setMasterVolume: jest.fn(),
      getMasterVolume: jest.fn().mockReturnValue(0.7),
      mute: jest.fn(),
      unmute: jest.fn(),
      isMuted: jest.fn().mockReturnValue(false),
      setAudioEnabled: jest.fn(),
      isAudioEnabled: jest.fn().mockReturnValue(true),
      getStats: jest.fn().mockReturnValue({
        totalSounds: 10,
        loadedSounds: 10,
        playingSounds: 0,
        audioContextState: 'running',
        masterVolume: 0.7,
        isEnabled: true,
        isMuted: false
      }),
      getLoadedSounds: jest.fn().mockReturnValue(['click_light', 'punch_impact']),
      isSoundLoaded: jest.fn().mockReturnValue(true),
      destroy: jest.fn()
    } as any;

    gameAudioSystem = new GameAudioSystem({
      audioManager: mockAudioManager
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    gameAudioSystem.destroy();
  });

  describe('初始化', () => {
    it('应该成功初始化游戏音效系统', async () => {
      // 等待初始化完成
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockAudioManager.loadSound).toHaveBeenCalled();
      
      const stats = gameAudioSystem.getAudioStats();
      expect(stats.totalEffects).toBeGreaterThan(0);
    });

    it('应该预加载所有游戏音效', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 验证加载了各种音效
      expect(mockAudioManager.loadSound).toHaveBeenCalledWith(
        expect.stringContaining('click_light'),
        expect.stringContaining('.mp3'),
        expect.any(Number)
      );
      expect(mockAudioManager.loadSound).toHaveBeenCalledWith(
        expect.stringContaining('punch_impact'),
        expect.stringContaining('.mp3'),
        expect.any(Number)
      );
    });

    it('应该使用自定义选项', () => {
      const customSystem = new GameAudioSystem({
        enableDynamicVolume: false,
        enableSpatialAudio: true
      });
      
      expect(customSystem).toBeTruthy();
      customSystem.destroy();
    });
  });

  describe('点击音效', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该根据点击数播放不同音效', () => {
      // 轻点击
      gameAudioSystem.playClickSound({ clickCount: 5 });
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        expect.stringContaining('click_light'),
        expect.any(Object)
      );

      // 中等点击
      gameAudioSystem.playClickSound({ clickCount: 30 });
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        expect.stringContaining('click_medium'),
        expect.any(Object)
      );

      // 重击
      gameAudioSystem.playClickSound({ clickCount: 60 });
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        expect.stringContaining('click_heavy'),
        expect.any(Object)
      );
    });

    it('应该根据连击数播放特殊音效', () => {
      // 高连击
      gameAudioSystem.playClickSound({ comboLevel: 15 });
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        expect.stringContaining('critical_hit'),
        expect.any(Object)
      );

      // 中等连击
      gameAudioSystem.playClickSound({ comboLevel: 7 });
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        expect.stringContaining('combo_hit'),
        expect.any(Object)
      );
    });

    it('应该返回音效ID', () => {
      const soundId = gameAudioSystem.playClickSound();
      expect(soundId).toBe('sound-id-123');
    });
  });

  describe('打击音效', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该根据强度播放不同音效', () => {
      // 轻打击
      gameAudioSystem.playHitSound(0.3);
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        expect.stringContaining('punch_impact'),
        expect.any(Object)
      );

      // 中等打击
      gameAudioSystem.playHitSound(0.6);
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        expect.stringContaining('combo_hit'),
        expect.any(Object)
      );

      // 重击
      gameAudioSystem.playHitSound(0.9);
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        expect.stringContaining('critical_hit'),
        expect.any(Object)
      );
    });

    it('应该考虑连击等级', () => {
      gameAudioSystem.playHitSound(0.3, { comboLevel: 12 });
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        expect.stringContaining('critical_hit'),
        expect.any(Object)
      );
    });
  });

  describe('变形音效', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该播放轻微变形音效', () => {
      gameAudioSystem.playTransformSound('light');
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        'transform_light',
        expect.objectContaining({
          intensity: 0.7
        })
      );
    });

    it('应该播放严重变形音效', () => {
      gameAudioSystem.playTransformSound('heavy');
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        'transform_heavy',
        expect.objectContaining({
          intensity: 1.0
        })
      );
    });
  });

  describe('UI音效', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该播放悬停音效', () => {
      gameAudioSystem.playUISound('hover');
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        'button_hover',
        expect.any(Object)
      );
    });

    it('应该播放点击音效', () => {
      gameAudioSystem.playUISound('click');
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        'button_click',
        expect.any(Object)
      );
    });

    it('应该播放成功音效', () => {
      gameAudioSystem.playUISound('success');
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        'upload_success',
        expect.any(Object)
      );
    });

    it('应该播放错误音效', () => {
      gameAudioSystem.playUISound('error');
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        'error_sound',
        expect.any(Object)
      );
    });
  });

  describe('环境音效', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该播放环境音效', () => {
      gameAudioSystem.playAmbientSound('tension');
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        'ambient_tension',
        expect.objectContaining({
          loop: true,
          volume: 0.2
        })
      );
    });

    it('应该支持非循环播放', () => {
      gameAudioSystem.playAmbientSound('tension', false);
      expect(mockAudioManager.playSound).toHaveBeenCalledWith(
        'ambient_tension',
        expect.objectContaining({
          loop: false
        })
      );
    });
  });

  describe('音量控制', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该根据连击调整音量', () => {
      gameAudioSystem.playClickSound({ comboLevel: 5 });
      
      const playCall = mockAudioManager.playSound.mock.calls[0];
      const options = playCall[1];
      
      // 连击应该增加音量
      expect(options.volume).toBeGreaterThan(0.6); // 基础音量
    });

    it('应该根据强度调整音量', () => {
      gameAudioSystem.playHitSound(0.5, { intensity: 0.8 });
      
      const playCall = mockAudioManager.playSound.mock.calls[0];
      const options = playCall[1];
      
      expect(options.volume).toBeDefined();
    });

    it('应该设置分类音量', () => {
      gameAudioSystem.setCategoryVolume('click', 0.3);
      expect(gameAudioSystem.getCategoryVolume('click')).toBe(0.3);
    });

    it('应该限制音量范围', () => {
      gameAudioSystem.setCategoryVolume('click', -0.5);
      expect(gameAudioSystem.getCategoryVolume('click')).toBe(0);
      
      gameAudioSystem.setCategoryVolume('click', 1.5);
      expect(gameAudioSystem.getCategoryVolume('click')).toBe(1);
    });
  });

  describe('冷却系统', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该在冷却期间阻止重复播放', () => {
      // 第一次播放
      const soundId1 = gameAudioSystem.playClickSound();
      expect(soundId1).toBeTruthy();
      
      // 立即再次播放（应该被冷却阻止）
      const soundId2 = gameAudioSystem.playClickSound();
      expect(soundId2).toBeNull();
    });

    it('应该在冷却结束后允许播放', (done) => {
      // 第一次播放
      gameAudioSystem.playClickSound();
      
      // 等待冷却时间结束
      setTimeout(() => {
        const soundId = gameAudioSystem.playClickSound();
        expect(soundId).toBeTruthy();
        done();
      }, 100); // 假设冷却时间为50ms，等待100ms确保结束
    });
  });

  describe('动态音量', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该启用/禁用动态音量', () => {
      gameAudioSystem.setDynamicVolumeEnabled(false);
      
      // 禁用动态音量后，连击不应该影响音量
      gameAudioSystem.playClickSound({ comboLevel: 10 });
      
      const playCall = mockAudioManager.playSound.mock.calls[0];
      const options = playCall[1];
      
      // 应该使用基础音量
      expect(options.volume).toBe(0.6 * 0.6); // effect.volume * category.baseVolume
    });
  });

  describe('空间音频', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该启用/禁用空间音频', () => {
      gameAudioSystem.setSpatialAudioEnabled(true);
      
      gameAudioSystem.playClickSound({
        position: { x: 400, y: 300 }
      });
      
      const playCall = mockAudioManager.playSound.mock.calls[0];
      const options = playCall[1];
      
      expect(options.spatialX).toBeDefined();
    });

    it('应该计算正确的空间位置', () => {
      gameAudioSystem.setSpatialAudioEnabled(true);
      
      // 左侧位置
      gameAudioSystem.playClickSound({
        position: { x: 0, y: 300 }
      });
      
      let playCall = mockAudioManager.playSound.mock.calls[0];
      let options = playCall[1];
      expect(options.spatialX).toBe(-1);
      
      // 右侧位置
      gameAudioSystem.playClickSound({
        position: { x: 800, y: 300 }
      });
      
      playCall = mockAudioManager.playSound.mock.calls[1];
      options = playCall[1];
      expect(options.spatialX).toBe(1);
    });
  });

  describe('音效管理', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该停止特定分类的音效', () => {
      gameAudioSystem.stopSoundsByCategory('ambient', 0.5);
      expect(mockAudioManager.stopAllSounds).toHaveBeenCalledWith(0.5);
    });

    it('应该重新加载音效', async () => {
      await gameAudioSystem.reloadSounds();
      
      expect(mockAudioManager.clearAllSounds).toHaveBeenCalled();
      // loadSound应该被再次调用
      expect(mockAudioManager.loadSound).toHaveBeenCalled();
    });

    it('应该返回AudioManager实例', () => {
      const audioManager = gameAudioSystem.getAudioManager();
      expect(audioManager).toBe(mockAudioManager);
    });
  });

  describe('统计信息', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该提供音效统计信息', () => {
      const stats = gameAudioSystem.getAudioStats();
      
      expect(stats.totalEffects).toBeGreaterThan(0);
      expect(stats.loadedEffects).toBeDefined();
      expect(stats.categoryCounts).toBeDefined();
      expect(stats.categoryCounts.click).toBeGreaterThan(0);
      expect(stats.categoryCounts.hit).toBeGreaterThan(0);
      expect(stats.categoryCounts.transform).toBeGreaterThan(0);
      expect(stats.categoryCounts.ui).toBeGreaterThan(0);
      expect(stats.categoryCounts.ambient).toBeGreaterThan(0);
      expect(stats.audioManagerStats).toBeDefined();
    });
  });

  describe('错误处理', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该处理不存在的音效', () => {
      // 模拟音效不存在的情况
      const soundId = gameAudioSystem['playGameSound']('non_existent_sound');
      expect(soundId).toBeNull();
    });

    it('应该在AudioManager返回null时处理', () => {
      mockAudioManager.playSound.mockReturnValue(null);
      
      const soundId = gameAudioSystem.playClickSound();
      expect(soundId).toBeNull();
    });
  });

  describe('销毁功能', () => {
    it('应该正确销毁游戏音效系统', () => {
      gameAudioSystem.destroy();
      
      expect(mockAudioManager.destroy).toHaveBeenCalled();
      
      const stats = gameAudioSystem.getAudioStats();
      expect(stats.totalEffects).toBe(0);
    });
  });

  describe('音效变体选择', () => {
    beforeEach(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('应该随机选择音效变体', () => {
      // 多次播放同一音效，应该选择不同变体
      const playedSounds = new Set();
      
      for (let i = 0; i < 10; i++) {
        gameAudioSystem.playClickSound();
        const lastCall = mockAudioManager.playSound.mock.calls[mockAudioManager.playSound.mock.calls.length - 1];
        if (lastCall) {
          playedSounds.add(lastCall[0]);
        }
      }
      
      // 应该有多个不同的变体被播放
      expect(playedSounds.size).toBeGreaterThan(1);
    });
  });
});