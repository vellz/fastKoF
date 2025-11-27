/**
 * 游戏UI组件
 * 提供游戏控制界面和状态显示
 */

import type { GameState, GameStats } from '@/types/game.types';
import type { TransformProgress } from '@/core/ImageTransformManager';

export interface GameUIOptions {
  container: HTMLElement;
  onReset?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onSettingsOpen?: () => void;
  onFullscreen?: () => void;
  showDebugInfo?: boolean;
  enableKeyboardShortcuts?: boolean;
}

export interface UIState {
  isVisible: boolean;
  isPaused: boolean;
  isTransforming: boolean;
  showSettings: boolean;
  showDebugInfo: boolean;
}

/**
 * 游戏UI组件类
 */
export class GameUI {
  private container: HTMLElement;
  private options: Required<GameUIOptions>;
  private state: UIState;
  private elements: { [key: string]: HTMLElement } = {};
  private keyboardHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(options: GameUIOptions) {
    this.container = options.container;
    this.options = {
      onReset: () => {},
      onPause: () => {},
      onResume: () => {},
      onSettingsOpen: () => {},
      onFullscreen: () => {},
      showDebugInfo: false,
      enableKeyboardShortcuts: true,
      ...options
    };

    this.state = {
      isVisible: true,
      isPaused: false,
      isTransforming: false,
      showSettings: false,
      showDebugInfo: this.options.showDebugInfo
    };

    this.init();
  }

  /**
   * 初始化UI
   */
  private init(): void {
    this.createUI();
    this.bindEvents();
    this.setupKeyboardShortcuts();
  }

  /**
   * 创建UI结构
   */
  private createUI(): void {
    this.container.innerHTML = `
      <div class="game-ui" id="game-ui">
        <!-- 顶部状态栏 -->
        <div class="ui-header" id="ui-header">
          <div class="game-stats">
            <div class="stat-item">
              <span class="stat-label">点击数</span>
              <span class="stat-value" id="click-count">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">连击</span>
              <span class="stat-value" id="combo-count">0</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">阶段</span>
              <span class="stat-value" id="game-phase">初始</span>
            </div>
          </div>
          
          <div class="header-controls">
            <button class="control-btn" id="pause-btn" title="暂停/继续 (空格)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            </button>
            <button class="control-btn" id="settings-btn" title="设置 (S)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.82,11.69,4.82,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
              </svg>
            </button>
            <button class="control-btn" id="fullscreen-btn" title="全屏 (F)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 进度条 -->
        <div class="progress-container" id="progress-container" style="display: none;">
          <div class="progress-bar">
            <div class="progress-fill" id="progress-fill"></div>
          </div>
          <div class="progress-text" id="progress-text">准备中...</div>
        </div>

        <!-- 底部控制栏 -->
        <div class="ui-footer" id="ui-footer">
          <div class="footer-left">
            <button class="primary-btn" id="reset-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4c-4.42,0 -7.99,3.58 -7.99,8s3.57,8 7.99,8c3.73,0 6.84,-2.55 7.73,-6h-2.08c-0.82,2.33 -3.04,4 -5.65,4 -3.31,0 -6,-2.69 -6,-6s2.69,-6 6,-6c1.66,0 3.14,0.69 4.22,1.78L13,11h7V4L17.65,6.35z"/>
              </svg>
              重新开始
            </button>
          </div>
          
          <div class="footer-center">
            <div class="phase-indicator" id="phase-indicator">
              <div class="phase-step" data-phase="initial">初始</div>
              <div class="phase-step" data-phase="phase1">轻度</div>
              <div class="phase-step" data-phase="phase2">重度</div>
              <div class="phase-step" data-phase="completed">完成</div>
            </div>
          </div>
          
          <div class="footer-right">
            <div class="fps-counter" id="fps-counter" style="display: ${this.state.showDebugInfo ? 'block' : 'none'}">
              FPS: <span id="fps-value">60</span>
            </div>
          </div>
        </div>

        <!-- 设置面板 -->
        <div class="settings-modal" id="settings-modal" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h3>游戏设置</h3>
              <button class="close-btn" id="settings-close-btn">×</button>
            </div>
            
            <div class="modal-body">
              <div class="setting-group">
                <label class="setting-label">音效音量</label>
                <div class="setting-control">
                  <input type="range" id="volume-slider" min="0" max="100" value="70" class="slider">
                  <span class="setting-value" id="volume-value">70%</span>
                </div>
              </div>
              
              <div class="setting-group">
                <label class="setting-label">特效强度</label>
                <div class="setting-control">
                  <input type="range" id="effects-slider" min="0" max="100" value="100" class="slider">
                  <span class="setting-value" id="effects-value">100%</span>
                </div>
              </div>
              
              <div class="setting-group">
                <label class="setting-label">振动反馈</label>
                <div class="setting-control">
                  <label class="switch">
                    <input type="checkbox" id="vibration-toggle" checked>
                    <span class="switch-slider"></span>
                  </label>
                </div>
              </div>
              
              <div class="setting-group">
                <label class="setting-label">显示调试信息</label>
                <div class="setting-control">
                  <label class="switch">
                    <input type="checkbox" id="debug-toggle" ${this.state.showDebugInfo ? 'checked' : ''}>
                    <span class="switch-slider"></span>
                  </label>
                </div>
              </div>
            </div>
            
            <div class="modal-footer">
              <button class="secondary-btn" id="settings-reset-btn">恢复默认</button>
              <button class="primary-btn" id="settings-apply-btn">应用设置</button>
            </div>
          </div>
        </div>

        <!-- 提示信息 -->
        <div class="toast-container" id="toast-container"></div>
      </div>
    `;

    // 获取元素引用
    this.elements = {
      gameUI: this.container.querySelector('#game-ui')!,
      header: this.container.querySelector('#ui-header')!,
      footer: this.container.querySelector('#ui-footer')!,
      clickCount: this.container.querySelector('#click-count')!,
      comboCount: this.container.querySelector('#combo-count')!,
      gamePhase: this.container.querySelector('#game-phase')!,
      pauseBtn: this.container.querySelector('#pause-btn')!,
      settingsBtn: this.container.querySelector('#settings-btn')!,
      fullscreenBtn: this.container.querySelector('#fullscreen-btn')!,
      resetBtn: this.container.querySelector('#reset-btn')!,
      progressContainer: this.container.querySelector('#progress-container')!,
      progressFill: this.container.querySelector('#progress-fill')!,
      progressText: this.container.querySelector('#progress-text')!,
      phaseIndicator: this.container.querySelector('#phase-indicator')!,
      fpsCounter: this.container.querySelector('#fps-counter')!,
      fpsValue: this.container.querySelector('#fps-value')!,
      settingsModal: this.container.querySelector('#settings-modal')!,
      toastContainer: this.container.querySelector('#toast-container')!
    };
  }

  /**
   * 绑定事件
   */
  private bindEvents(): void {
    // 暂停/继续按钮
    this.elements.pauseBtn.addEventListener('click', () => {
      this.togglePause();
    });

    // 设置按钮
    this.elements.settingsBtn.addEventListener('click', () => {
      this.showSettings();
    });

    // 全屏按钮
    this.elements.fullscreenBtn.addEventListener('click', () => {
      this.options.onFullscreen();
    });

    // 重置按钮
    this.elements.resetBtn.addEventListener('click', () => {
      this.showConfirmDialog('确定要重新开始游戏吗？', () => {
        this.options.onReset();
      });
    });

    // 设置面板事件
    this.bindSettingsEvents();
  }

  /**
   * 绑定设置面板事件
   */
  private bindSettingsEvents(): void {
    const closeBtn = this.container.querySelector('#settings-close-btn');
    const applyBtn = this.container.querySelector('#settings-apply-btn');
    const resetBtn = this.container.querySelector('#settings-reset-btn');
    const volumeSlider = this.container.querySelector('#volume-slider') as HTMLInputElement;
    const effectsSlider = this.container.querySelector('#effects-slider') as HTMLInputElement;
    const vibrationToggle = this.container.querySelector('#vibration-toggle') as HTMLInputElement;
    const debugToggle = this.container.querySelector('#debug-toggle') as HTMLInputElement;

    // 关闭设置
    closeBtn?.addEventListener('click', () => {
      this.hideSettings();
    });

    // 应用设置
    applyBtn?.addEventListener('click', () => {
      this.applySettings();
      this.hideSettings();
    });

    // 重置设置
    resetBtn?.addEventListener('click', () => {
      this.resetSettings();
    });

    // 音量滑块
    volumeSlider?.addEventListener('input', () => {
      const value = volumeSlider.value;
      const valueDisplay = this.container.querySelector('#volume-value');
      if (valueDisplay) {
        valueDisplay.textContent = `${value}%`;
      }
    });

    // 特效滑块
    effectsSlider?.addEventListener('input', () => {
      const value = effectsSlider.value;
      const valueDisplay = this.container.querySelector('#effects-value');
      if (valueDisplay) {
        valueDisplay.textContent = `${value}%`;
      }
    });

    // 调试信息切换
    debugToggle?.addEventListener('change', () => {
      this.state.showDebugInfo = debugToggle.checked;
      this.elements.fpsCounter.style.display = this.state.showDebugInfo ? 'block' : 'none';
    });

    // 点击模态框背景关闭
    this.elements.settingsModal.addEventListener('click', (e) => {
      if (e.target === this.elements.settingsModal) {
        this.hideSettings();
      }
    });
  }

  /**
   * 设置键盘快捷键
   */
  private setupKeyboardShortcuts(): void {
    if (!this.options.enableKeyboardShortcuts) return;

    this.keyboardHandler = (event: KeyboardEvent) => {
      // 防止在输入框中触发
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          this.togglePause();
          break;
        case 'KeyS':
          event.preventDefault();
          this.showSettings();
          break;
        case 'KeyF':
          event.preventDefault();
          this.options.onFullscreen();
          break;
        case 'KeyR':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            this.options.onReset();
          }
          break;
        case 'Escape':
          if (this.state.showSettings) {
            this.hideSettings();
          }
          break;
      }
    };

    document.addEventListener('keydown', this.keyboardHandler);
  }

  /**
   * 更新游戏状态显示
   */
  updateGameState(gameState: GameState, stats?: GameStats): void {
    // 更新点击数
    this.elements.clickCount.textContent = gameState.clickCount.toString();

    // 更新连击数
    if (stats?.currentCombo) {
      this.elements.comboCount.textContent = stats.currentCombo.toString();
      this.elements.comboCount.parentElement!.style.display = stats.currentCombo > 1 ? 'block' : 'none';
    }

    // 更新游戏阶段
    const phaseNames = {
      initial: '初始',
      phase1: '轻度变形',
      phase2: '重度变形',
      completed: '完成'
    };
    this.elements.gamePhase.textContent = phaseNames[gameState.currentPhase] || '未知';

    // 更新阶段指示器
    this.updatePhaseIndicator(gameState.currentPhase);

    // 更新变形状态
    this.state.isTransforming = gameState.isTransforming;
    if (gameState.isTransforming) {
      this.elements.progressContainer.style.display = 'block';
    }
  }

  /**
   * 更新阶段指示器
   */
  private updatePhaseIndicator(currentPhase: string): void {
    const steps = this.elements.phaseIndicator.querySelectorAll('.phase-step');
    steps.forEach((step, index) => {
      const phase = step.getAttribute('data-phase');
      step.classList.remove('active', 'completed');
      
      if (phase === currentPhase) {
        step.classList.add('active');
      } else if (this.isPhaseCompleted(phase!, currentPhase)) {
        step.classList.add('completed');
      }
    });
  }

  /**
   * 检查阶段是否已完成
   */
  private isPhaseCompleted(phase: string, currentPhase: string): boolean {
    const phaseOrder = ['initial', 'phase1', 'phase2', 'completed'];
    const phaseIndex = phaseOrder.indexOf(phase);
    const currentIndex = phaseOrder.indexOf(currentPhase);
    return phaseIndex < currentIndex;
  }

  /**
   * 更新变形进度
   */
  updateTransformProgress(progress: TransformProgress): void {
    this.elements.progressContainer.style.display = 'block';
    this.elements.progressFill.style.width = `${progress.progress}%`;
    this.elements.progressText.textContent = progress.message;

    if (progress.phase === 'completed' || progress.phase === 'error') {
      setTimeout(() => {
        this.elements.progressContainer.style.display = 'none';
      }, 2000);
    }
  }

  /**
   * 更新FPS显示
   */
  updateFPS(fps: number): void {
    if (this.state.showDebugInfo) {
      this.elements.fpsValue.textContent = Math.round(fps).toString();
    }
  }

  /**
   * 切换暂停状态
   */
  private togglePause(): void {
    this.state.isPaused = !this.state.isPaused;
    
    if (this.state.isPaused) {
      this.options.onPause();
      this.elements.pauseBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      `;
      this.elements.pauseBtn.title = '继续 (空格)';
    } else {
      this.options.onResume();
      this.elements.pauseBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      `;
      this.elements.pauseBtn.title = '暂停 (空格)';
    }
  }

  /**
   * 显示设置面板
   */
  private showSettings(): void {
    this.state.showSettings = true;
    this.elements.settingsModal.style.display = 'flex';
    this.elements.settingsModal.classList.add('fade-in');
    this.options.onSettingsOpen();
  }

  /**
   * 隐藏设置面板
   */
  private hideSettings(): void {
    this.state.showSettings = false;
    this.elements.settingsModal.style.display = 'none';
    this.elements.settingsModal.classList.remove('fade-in');
  }

  /**
   * 应用设置
   */
  private applySettings(): void {
    const volumeSlider = this.container.querySelector('#volume-slider') as HTMLInputElement;
    const effectsSlider = this.container.querySelector('#effects-slider') as HTMLInputElement;
    const vibrationToggle = this.container.querySelector('#vibration-toggle') as HTMLInputElement;

    // 保存设置到本地存储
    const settings = {
      volume: parseInt(volumeSlider.value),
      effects: parseInt(effectsSlider.value),
      vibration: vibrationToggle.checked,
      debugInfo: this.state.showDebugInfo
    };

    localStorage.setItem('game_settings', JSON.stringify(settings));
    
    // 触发设置变更事件
    this.container.dispatchEvent(new CustomEvent('settingsChanged', {
      detail: settings
    }));

    this.showToast('设置已保存', 'success');
  }

  /**
   * 重置设置
   */
  private resetSettings(): void {
    const volumeSlider = this.container.querySelector('#volume-slider') as HTMLInputElement;
    const effectsSlider = this.container.querySelector('#effects-slider') as HTMLInputElement;
    const vibrationToggle = this.container.querySelector('#vibration-toggle') as HTMLInputElement;
    const debugToggle = this.container.querySelector('#debug-toggle') as HTMLInputElement;

    volumeSlider.value = '70';
    effectsSlider.value = '100';
    vibrationToggle.checked = true;
    debugToggle.checked = false;

    // 更新显示
    this.container.querySelector('#volume-value')!.textContent = '70%';
    this.container.querySelector('#effects-value')!.textContent = '100%';
    this.state.showDebugInfo = false;
    this.elements.fpsCounter.style.display = 'none';

    this.showToast('设置已重置', 'info');
  }

  /**
   * 显示确认对话框
   */
  private showConfirmDialog(message: string, onConfirm: () => void): void {
    if (confirm(message)) {
      onConfirm();
    }
  }

  /**
   * 显示提示信息
   */
  showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    this.elements.toastContainer.appendChild(toast);

    // 显示动画
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    // 自动隐藏
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  /**
   * 显示/隐藏UI
   */
  setVisible(visible: boolean): void {
    this.state.isVisible = visible;
    this.elements.gameUI.style.display = visible ? 'block' : 'none';
  }

  /**
   * 获取当前状态
   */
  getState(): UIState {
    return { ...this.state };
  }

  /**
   * 销毁UI
   */
  destroy(): void {
    // 移除键盘事件监听器
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
    }

    // 清空容器
    this.container.innerHTML = '';
  }
}