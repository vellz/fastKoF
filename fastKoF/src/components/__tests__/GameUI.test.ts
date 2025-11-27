/**
 * GameUI 单元测试
 */

import { GameUI } from '../GameUI';
import type { GameState, GameStats } from '@/types/game.types';
import type { TransformProgress } from '@/core/ImageTransformManager';

describe('GameUI', () => {
  let container: HTMLElement;
  let gameUI: GameUI;
  let mockCallbacks: {
    onReset: jest.Mock;
    onPause: jest.Mock;
    onResume: jest.Mock;
    onSettingsOpen: jest.Mock;
    onFullscreen: jest.Mock;
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    mockCallbacks = {
      onReset: jest.fn(),
      onPause: jest.fn(),
      onResume: jest.fn(),
      onSettingsOpen: jest.fn(),
      onFullscreen: jest.fn()
    };

    gameUI = new GameUI({
      container,
      ...mockCallbacks,
      showDebugInfo: true,
      enableKeyboardShortcuts: true
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    gameUI.destroy();
    document.body.removeChild(container);
  });

  describe('初始化', () => {
    it('应该成功创建游戏UI', () => {
      expect(gameUI).toBeTruthy();
      expect(container.querySelector('.game-ui')).toBeTruthy();
    });

    it('应该创建所有必要的UI元素', () => {
      expect(container.querySelector('#ui-header')).toBeTruthy();
      expect(container.querySelector('#ui-footer')).toBeTruthy();
      expect(container.querySelector('#click-count')).toBeTruthy();
      expect(container.querySelector('#combo-count')).toBeTruthy();
      expect(container.querySelector('#game-phase')).toBeTruthy();
      expect(container.querySelector('#pause-btn')).toBeTruthy();
      expect(container.querySelector('#settings-btn')).toBeTruthy();
      expect(container.querySelector('#fullscreen-btn')).toBeTruthy();
      expect(container.querySelector('#reset-btn')).toBeTruthy();
      expect(container.querySelector('#settings-modal')).toBeTruthy();
    });

    it('应该根据选项显示调试信息', () => {
      const fpsCounter = container.querySelector('#fps-counter') as HTMLElement;
      expect(fpsCounter.style.display).toBe('block');
    });

    it('应该在禁用调试信息时隐藏FPS计数器', () => {
      const uiWithoutDebug = new GameUI({
        container: document.createElement('div'),
        showDebugInfo: false
      });
      
      const fpsCounter = uiWithoutDebug['container'].querySelector('#fps-counter') as HTMLElement;
      expect(fpsCounter.style.display).toBe('none');
      
      uiWithoutDebug.destroy();
    });
  });

  describe('游戏状态更新', () => {
    const mockGameState: GameState = {
      isPlaying: true,
      isPaused: false,
      clickCount: 42,
      currentPhase: 'phase1' as any,
      uploadedImage: null,
      transformedImages: [],
      isTransforming: false,
      lastClickTime: Date.now()
    };

    const mockStats: GameStats = {
      totalClicks: 42,
      gameStartTime: Date.now() - 10000,
      transformCount: 1,
      maxCombo: 5,
      currentCombo: 3
    };

    it('应该更新点击数显示', () => {
      gameUI.updateGameState(mockGameState, mockStats);
      
      const clickCount = container.querySelector('#click-count');
      expect(clickCount?.textContent).toBe('42');
    });

    it('应该更新连击数显示', () => {
      gameUI.updateGameState(mockGameState, mockStats);
      
      const comboCount = container.querySelector('#combo-count');
      expect(comboCount?.textContent).toBe('3');
      
      const comboItem = comboCount?.parentElement;
      expect(comboItem?.style.display).toBe('block');
    });

    it('应该隐藏连击数当连击小于等于1时', () => {
      const statsWithLowCombo = { ...mockStats, currentCombo: 1 };
      gameUI.updateGameState(mockGameState, statsWithLowCombo);
      
      const comboItem = container.querySelector('#combo-count')?.parentElement;
      expect(comboItem?.style.display).toBe('none');
    });

    it('应该更新游戏阶段显示', () => {
      gameUI.updateGameState(mockGameState, mockStats);
      
      const gamePhase = container.querySelector('#game-phase');
      expect(gamePhase?.textContent).toBe('轻度变形');
    });

    it('应该更新阶段指示器', () => {
      gameUI.updateGameState(mockGameState, mockStats);
      
      const activeStep = container.querySelector('.phase-step.active');
      expect(activeStep?.getAttribute('data-phase')).toBe('phase1');
      
      const completedStep = container.querySelector('.phase-step.completed');
      expect(completedStep?.getAttribute('data-phase')).toBe('initial');
    });

    it('应该显示变形进度容器当正在变形时', () => {
      const transformingState = { ...mockGameState, isTransforming: true };
      gameUI.updateGameState(transformingState, mockStats);
      
      const progressContainer = container.querySelector('#progress-container') as HTMLElement;
      expect(progressContainer.style.display).toBe('block');
    });
  });

  describe('变形进度更新', () => {
    const mockProgress: TransformProgress = {
      phase: 'processing',
      progress: 65,
      message: 'AI正在处理图片...',
      estimatedTimeRemaining: 5000
    };

    it('应该更新变形进度', () => {
      gameUI.updateTransformProgress(mockProgress);
      
      const progressContainer = container.querySelector('#progress-container') as HTMLElement;
      const progressFill = container.querySelector('#progress-fill') as HTMLElement;
      const progressText = container.querySelector('#progress-text');
      
      expect(progressContainer.style.display).toBe('block');
      expect(progressFill.style.width).toBe('65%');
      expect(progressText?.textContent).toBe('AI正在处理图片...');
    });

    it('应该在完成后隐藏进度容器', (done) => {
      const completedProgress: TransformProgress = {
        phase: 'completed',
        progress: 100,
        message: '变形完成！'
      };
      
      gameUI.updateTransformProgress(completedProgress);
      
      setTimeout(() => {
        const progressContainer = container.querySelector('#progress-container') as HTMLElement;
        expect(progressContainer.style.display).toBe('none');
        done();
      }, 2100);
    });

    it('应该在错误后隐藏进度容器', (done) => {
      const errorProgress: TransformProgress = {
        phase: 'error',
        progress: 50,
        message: '变形失败'
      };
      
      gameUI.updateTransformProgress(errorProgress);
      
      setTimeout(() => {
        const progressContainer = container.querySelector('#progress-container') as HTMLElement;
        expect(progressContainer.style.display).toBe('none');
        done();
      }, 2100);
    });
  });

  describe('FPS更新', () => {
    it('应该更新FPS显示', () => {
      gameUI.updateFPS(58.7);
      
      const fpsValue = container.querySelector('#fps-value');
      expect(fpsValue?.textContent).toBe('59');
    });

    it('应该在禁用调试信息时不更新FPS', () => {
      const uiWithoutDebug = new GameUI({
        container: document.createElement('div'),
        showDebugInfo: false
      });
      
      uiWithoutDebug.updateFPS(60);
      
      // 不应该抛出错误
      expect(() => uiWithoutDebug.updateFPS(60)).not.toThrow();
      
      uiWithoutDebug.destroy();
    });
  });

  describe('按钮交互', () => {
    it('应该处理暂停按钮点击', () => {
      const pauseBtn = container.querySelector('#pause-btn') as HTMLButtonElement;
      
      pauseBtn.click();
      
      expect(mockCallbacks.onPause).toHaveBeenCalled();
      expect(pauseBtn.title).toContain('继续');
    });

    it('应该处理继续按钮点击', () => {
      const pauseBtn = container.querySelector('#pause-btn') as HTMLButtonElement;
      
      // 先暂停
      pauseBtn.click();
      jest.clearAllMocks();
      
      // 再继续
      pauseBtn.click();
      
      expect(mockCallbacks.onResume).toHaveBeenCalled();
      expect(pauseBtn.title).toContain('暂停');
    });

    it('应该处理设置按钮点击', () => {
      const settingsBtn = container.querySelector('#settings-btn') as HTMLButtonElement;
      
      settingsBtn.click();
      
      expect(mockCallbacks.onSettingsOpen).toHaveBeenCalled();
      
      const settingsModal = container.querySelector('#settings-modal') as HTMLElement;
      expect(settingsModal.style.display).toBe('flex');
    });

    it('应该处理全屏按钮点击', () => {
      const fullscreenBtn = container.querySelector('#fullscreen-btn') as HTMLButtonElement;
      
      fullscreenBtn.click();
      
      expect(mockCallbacks.onFullscreen).toHaveBeenCalled();
    });

    it('应该处理重置按钮点击', () => {
      // Mock window.confirm
      const originalConfirm = window.confirm;
      window.confirm = jest.fn(() => true);
      
      const resetBtn = container.querySelector('#reset-btn') as HTMLButtonElement;
      
      resetBtn.click();
      
      expect(window.confirm).toHaveBeenCalledWith('确定要重新开始游戏吗？');
      expect(mockCallbacks.onReset).toHaveBeenCalled();
      
      // Restore
      window.confirm = originalConfirm;
    });

    it('应该在用户取消时不重置游戏', () => {
      // Mock window.confirm
      const originalConfirm = window.confirm;
      window.confirm = jest.fn(() => false);
      
      const resetBtn = container.querySelector('#reset-btn') as HTMLButtonElement;
      
      resetBtn.click();
      
      expect(mockCallbacks.onReset).not.toHaveBeenCalled();
      
      // Restore
      window.confirm = originalConfirm;
    });
  });

  describe('设置面板', () => {
    beforeEach(() => {
      // 打开设置面板
      const settingsBtn = container.querySelector('#settings-btn') as HTMLButtonElement;
      settingsBtn.click();
    });

    it('应该关闭设置面板', () => {
      const closeBtn = container.querySelector('#settings-close-btn') as HTMLButtonElement;
      
      closeBtn.click();
      
      const settingsModal = container.querySelector('#settings-modal') as HTMLElement;
      expect(settingsModal.style.display).toBe('none');
    });

    it('应该点击背景关闭设置面板', () => {
      const settingsModal = container.querySelector('#settings-modal') as HTMLElement;
      
      // 模拟点击背景
      const clickEvent = new MouseEvent('click');
      Object.defineProperty(clickEvent, 'target', { value: settingsModal });
      settingsModal.dispatchEvent(clickEvent);
      
      expect(settingsModal.style.display).toBe('none');
    });

    it('应该更新音量滑块值显示', () => {
      const volumeSlider = container.querySelector('#volume-slider') as HTMLInputElement;
      const volumeValue = container.querySelector('#volume-value');
      
      volumeSlider.value = '80';
      volumeSlider.dispatchEvent(new Event('input'));
      
      expect(volumeValue?.textContent).toBe('80%');
    });

    it('应该更新特效滑块值显示', () => {
      const effectsSlider = container.querySelector('#effects-slider') as HTMLInputElement;
      const effectsValue = container.querySelector('#effects-value');
      
      effectsSlider.value = '50';
      effectsSlider.dispatchEvent(new Event('input'));
      
      expect(effectsValue?.textContent).toBe('50%');
    });

    it('应该切换调试信息显示', () => {
      const debugToggle = container.querySelector('#debug-toggle') as HTMLInputElement;
      const fpsCounter = container.querySelector('#fps-counter') as HTMLElement;
      
      debugToggle.checked = false;
      debugToggle.dispatchEvent(new Event('change'));
      
      expect(fpsCounter.style.display).toBe('none');
      
      debugToggle.checked = true;
      debugToggle.dispatchEvent(new Event('change'));
      
      expect(fpsCounter.style.display).toBe('block');
    });

    it('应该应用设置', () => {
      const volumeSlider = container.querySelector('#volume-slider') as HTMLInputElement;
      const effectsSlider = container.querySelector('#effects-slider') as HTMLInputElement;
      const vibrationToggle = container.querySelector('#vibration-toggle') as HTMLInputElement;
      const applyBtn = container.querySelector('#settings-apply-btn') as HTMLButtonElement;
      
      volumeSlider.value = '80';
      effectsSlider.value = '60';
      vibrationToggle.checked = false;
      
      const eventSpy = jest.spyOn(container, 'dispatchEvent');
      
      applyBtn.click();
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'settingsChanged',
          detail: expect.objectContaining({
            volume: 80,
            effects: 60,
            vibration: false
          })
        })
      );
      
      // 应该保存到localStorage
      const savedSettings = localStorage.getItem('game_settings');
      expect(savedSettings).toBeTruthy();
      
      const settings = JSON.parse(savedSettings!);
      expect(settings.volume).toBe(80);
      expect(settings.effects).toBe(60);
      expect(settings.vibration).toBe(false);
    });

    it('应该重置设置', () => {
      const volumeSlider = container.querySelector('#volume-slider') as HTMLInputElement;
      const effectsSlider = container.querySelector('#effects-slider') as HTMLInputElement;
      const vibrationToggle = container.querySelector('#vibration-toggle') as HTMLInputElement;
      const debugToggle = container.querySelector('#debug-toggle') as HTMLInputElement;
      const resetBtn = container.querySelector('#settings-reset-btn') as HTMLButtonElement;
      
      // 修改设置
      volumeSlider.value = '30';
      effectsSlider.value = '40';
      vibrationToggle.checked = false;
      debugToggle.checked = true;
      
      resetBtn.click();
      
      expect(volumeSlider.value).toBe('70');
      expect(effectsSlider.value).toBe('100');
      expect(vibrationToggle.checked).toBe(true);
      expect(debugToggle.checked).toBe(false);
    });
  });

  describe('键盘快捷键', () => {
    it('应该处理空格键暂停/继续', () => {
      const spaceEvent = new KeyboardEvent('keydown', { code: 'Space' });
      spaceEvent.preventDefault = jest.fn();
      
      document.dispatchEvent(spaceEvent);
      
      expect(spaceEvent.preventDefault).toHaveBeenCalled();
      expect(mockCallbacks.onPause).toHaveBeenCalled();
    });

    it('应该处理S键打开设置', () => {
      const sEvent = new KeyboardEvent('keydown', { code: 'KeyS' });
      sEvent.preventDefault = jest.fn();
      
      document.dispatchEvent(sEvent);
      
      expect(sEvent.preventDefault).toHaveBeenCalled();
      expect(mockCallbacks.onSettingsOpen).toHaveBeenCalled();
    });

    it('应该处理F键全屏', () => {
      const fEvent = new KeyboardEvent('keydown', { code: 'KeyF' });
      fEvent.preventDefault = jest.fn();
      
      document.dispatchEvent(fEvent);
      
      expect(fEvent.preventDefault).toHaveBeenCalled();
      expect(mockCallbacks.onFullscreen).toHaveBeenCalled();
    });

    it('应该处理Ctrl+R重置', () => {
      const rEvent = new KeyboardEvent('keydown', { code: 'KeyR', ctrlKey: true });
      rEvent.preventDefault = jest.fn();
      
      document.dispatchEvent(rEvent);
      
      expect(rEvent.preventDefault).toHaveBeenCalled();
      expect(mockCallbacks.onReset).toHaveBeenCalled();
    });

    it('应该处理Escape关闭设置', () => {
      // 先打开设置
      const settingsBtn = container.querySelector('#settings-btn') as HTMLButtonElement;
      settingsBtn.click();
      
      const escEvent = new KeyboardEvent('keydown', { code: 'Escape' });
      
      document.dispatchEvent(escEvent);
      
      const settingsModal = container.querySelector('#settings-modal') as HTMLElement;
      expect(settingsModal.style.display).toBe('none');
    });

    it('应该在输入框中忽略快捷键', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      
      const spaceEvent = new KeyboardEvent('keydown', { code: 'Space' });
      Object.defineProperty(spaceEvent, 'target', { value: input });
      
      document.dispatchEvent(spaceEvent);
      
      expect(mockCallbacks.onPause).not.toHaveBeenCalled();
      
      document.body.removeChild(input);
    });

    it('应该在禁用快捷键时不响应', () => {
      const uiWithoutShortcuts = new GameUI({
        container: document.createElement('div'),
        enableKeyboardShortcuts: false
      });
      
      const spaceEvent = new KeyboardEvent('keydown', { code: 'Space' });
      
      document.dispatchEvent(spaceEvent);
      
      // 不应该有任何响应
      expect(mockCallbacks.onPause).not.toHaveBeenCalled();
      
      uiWithoutShortcuts.destroy();
    });
  });

  describe('Toast通知', () => {
    it('应该显示Toast通知', () => {
      gameUI.showToast('测试消息', 'success');
      
      const toast = container.querySelector('.toast');
      expect(toast).toBeTruthy();
      expect(toast?.textContent).toBe('测试消息');
      expect(toast?.classList.contains('toast-success')).toBe(true);
    });

    it('应该自动隐藏Toast通知', (done) => {
      gameUI.showToast('自动隐藏消息', 'info');
      
      const toast = container.querySelector('.toast');
      expect(toast).toBeTruthy();
      
      setTimeout(() => {
        expect(toast?.classList.contains('show')).toBe(false);
        done();
      }, 3100);
    });

    it('应该支持不同类型的Toast', () => {
      gameUI.showToast('错误消息', 'error');
      gameUI.showToast('警告消息', 'warning');
      gameUI.showToast('信息消息', 'info');
      
      const toasts = container.querySelectorAll('.toast');
      expect(toasts).toHaveLength(3);
      
      expect(toasts[0].classList.contains('toast-error')).toBe(true);
      expect(toasts[1].classList.contains('toast-warning')).toBe(true);
      expect(toasts[2].classList.contains('toast-info')).toBe(true);
    });
  });

  describe('UI可见性', () => {
    it('应该显示/隐藏UI', () => {
      const gameUIElement = container.querySelector('.game-ui') as HTMLElement;
      
      gameUI.setVisible(false);
      expect(gameUIElement.style.display).toBe('none');
      
      gameUI.setVisible(true);
      expect(gameUIElement.style.display).toBe('block');
    });
  });

  describe('状态获取', () => {
    it('应该返回当前UI状态', () => {
      const state = gameUI.getState();
      
      expect(state.isVisible).toBe(true);
      expect(state.isPaused).toBe(false);
      expect(state.isTransforming).toBe(false);
      expect(state.showSettings).toBe(false);
      expect(state.showDebugInfo).toBe(true);
    });
  });

  describe('销毁功能', () => {
    it('应该正确销毁UI', () => {
      const keydownSpy = jest.spyOn(document, 'removeEventListener');
      
      gameUI.destroy();
      
      expect(keydownSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      expect(container.innerHTML).toBe('');
      
      keydownSpy.mockRestore();
    });
  });
});