/**
 * 交互管理器
 * 处理用户的点击、触摸等交互事件
 */

// 点击事件接口
export interface ClickEvent {
  x: number;
  y: number;
  timestamp: number;
  force?: number;
}

export interface InteractionOptions {
  canvas: HTMLCanvasElement;
  onClickEvent?: (event: ClickEvent) => void;
  onComboChange?: (combo: number) => void;
  enableVibration?: boolean;
  clickCooldown?: number; // 点击冷却时间（毫秒）
}

export interface TouchInfo {
  id: number;
  x: number;
  y: number;
  startTime: number;
  force?: number;
}

/**
 * 交互管理器类
 */
export class InteractionManager {
  private canvas: HTMLCanvasElement;
  private canvasRect!: DOMRect;
  private deviceInfo: any;
  private options: Required<InteractionOptions>;
  
  // 点击状态
  private clickCount = 0;
  private lastClickTime = 0;
  private comboCount = 0;
  private comboTimer: number | null = null;
  private clickCooldownTimer: number | null = null;
  private isInCooldown = false;
  
  // 触摸状态
  private activeTouches = new Map<number, TouchInfo>();
  private multiTouchEnabled = false;
  
  // 事件监听器
  private boundHandlers = {
    mouseDown: this.handleMouseDown.bind(this),
    mouseUp: this.handleMouseUp.bind(this),
    mouseMove: this.handleMouseMove.bind(this),
    touchStart: this.handleTouchStart.bind(this),
    touchEnd: this.handleTouchEnd.bind(this),
    touchMove: this.handleTouchMove.bind(this),
    contextMenu: this.handleContextMenu.bind(this),
    resize: this.handleResize.bind(this)
  };

  constructor(options: InteractionOptions) {
    this.canvas = options.canvas;
    this.deviceInfo = {
      supportsTouch: 'ontouchstart' in window,
      supportsVibration: 'vibrate' in navigator
    };
    
    // 设置默认选项
    this.options = {
      onClickEvent: () => {},
      onComboChange: () => {},
      enableVibration: true,
      clickCooldown: 50, // 50ms冷却时间
      ...options
    };

    this.updateCanvasRect();
    this.init();
  }

  /**
   * 初始化交互管理器
   */
  private init(): void {
    this.bindEvents();
    this.setupCanvas();
  }

  /**
   * 绑定事件监听器
   */
  private bindEvents(): void {
    // 鼠标事件
    this.canvas.addEventListener('mousedown', this.boundHandlers.mouseDown);
    this.canvas.addEventListener('mouseup', this.boundHandlers.mouseUp);
    this.canvas.addEventListener('mousemove', this.boundHandlers.mouseMove);
    
    // 触摸事件
    if (this.deviceInfo.supportsTouch) {
      this.canvas.addEventListener('touchstart', this.boundHandlers.touchStart, { passive: false });
      this.canvas.addEventListener('touchend', this.boundHandlers.touchEnd, { passive: false });
      this.canvas.addEventListener('touchmove', this.boundHandlers.touchMove, { passive: false });
    }
    
    // 禁用右键菜单
    this.canvas.addEventListener('contextmenu', this.boundHandlers.contextMenu);
    
    // 窗口大小变化
    window.addEventListener('resize', this.boundHandlers.resize);
  }

  /**
   * 设置Canvas属性
   */
  private setupCanvas(): void {
    // 设置触摸行为
    this.canvas.style.touchAction = 'none';
    this.canvas.style.userSelect = 'none';
    this.canvas.style.webkitUserSelect = 'none';
    
    // 设置光标样式
    this.canvas.style.cursor = 'crosshair';
  }

  /**
   * 处理鼠标按下事件
   */
  private handleMouseDown(event: MouseEvent): void {
    event.preventDefault();
    
    if (this.isInCooldown) return;
    
    const clickEvent = this.createClickEvent(event.clientX, event.clientY, event.force);
    this.processClick(clickEvent);
  }

  /**
   * 处理鼠标抬起事件
   */
  private handleMouseUp(event: MouseEvent): void {
    event.preventDefault();
    // 可以在这里处理长按等逻辑
  }

  /**
   * 处理鼠标移动事件
   */
  private handleMouseMove(event: MouseEvent): void {
    // 可以在这里处理悬停效果
  }

  /**
   * 处理触摸开始事件
   */
  private handleTouchStart(event: TouchEvent): void {
    event.preventDefault();
    
    if (this.isInCooldown) return;
    
    const touches = event.changedTouches;
    
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      const touchInfo: TouchInfo = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        startTime: Date.now(),
        force: (touch as any).force || 1
      };
      
      this.activeTouches.set(touch.identifier, touchInfo);
      
      // 处理点击
      const clickEvent = this.createClickEvent(touch.clientX, touch.clientY, touchInfo.force);
      this.processClick(clickEvent);
    }
  }

  /**
   * 处理触摸结束事件
   */
  private handleTouchEnd(event: TouchEvent): void {
    event.preventDefault();
    
    const touches = event.changedTouches;
    
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      this.activeTouches.delete(touch.identifier);
    }
  }

  /**
   * 处理触摸移动事件
   */
  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();
    
    const touches = event.changedTouches;
    
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      const touchInfo = this.activeTouches.get(touch.identifier);
      
      if (touchInfo) {
        touchInfo.x = touch.clientX;
        touchInfo.y = touch.clientY;
      }
    }
  }

  /**
   * 处理右键菜单事件
   */
  private handleContextMenu(event: Event): void {
    event.preventDefault();
  }

  /**
   * 处理窗口大小变化
   */
  private handleResize(): void {
    this.updateCanvasRect();
  }

  /**
   * 创建点击事件对象
   */
  private createClickEvent(clientX: number, clientY: number, force?: number): ClickEvent {
    const canvasX = clientX - this.canvasRect.left;
    const canvasY = clientY - this.canvasRect.top;
    
    // 考虑Canvas的缩放比例
    const scaleX = this.canvas.width / this.canvasRect.width;
    const scaleY = this.canvas.height / this.canvasRect.height;
    
    return {
      x: canvasX * scaleX,
      y: canvasY * scaleY,
      timestamp: Date.now(),
      force: force || 1
    };
  }

  /**
   * 处理点击逻辑
   */
  private processClick(clickEvent: ClickEvent): void {
    // 应用冷却时间
    this.applyCooldown();
    
    // 更新点击计数
    this.clickCount++;
    this.lastClickTime = clickEvent.timestamp;
    
    // 处理连击
    this.handleCombo(clickEvent);
    
    // 触发振动反馈
    this.triggerVibration();
    
    // 触发回调
    this.options.onClickEvent(clickEvent);
  }

  /**
   * 处理连击逻辑
   */
  private handleCombo(clickEvent: ClickEvent): void {
    const comboWindow = 1000; // 1秒连击窗口
    const timeSinceLastClick = clickEvent.timestamp - this.lastClickTime;
    
    if (timeSinceLastClick <= comboWindow) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
    }
    
    // 重置连击计时器
    if (this.comboTimer) {
      clearTimeout(this.comboTimer);
    }
    
    this.comboTimer = window.setTimeout(() => {
      this.comboCount = 0;
      this.options.onComboChange(0);
    }, comboWindow);
    
    this.options.onComboChange(this.comboCount);
  }

  /**
   * 应用点击冷却
   */
  private applyCooldown(): void {
    if (this.options.clickCooldown <= 0) return;
    
    this.isInCooldown = true;
    
    if (this.clickCooldownTimer) {
      clearTimeout(this.clickCooldownTimer);
    }
    
    this.clickCooldownTimer = window.setTimeout(() => {
      this.isInCooldown = false;
    }, this.options.clickCooldown);
  }

  /**
   * 触发振动反馈
   */
  private triggerVibration(): void {
    if (!this.options.enableVibration || !this.deviceInfo.supportsVibration) {
      return;
    }
    
    // 根据连击数调整振动强度
    let pattern: number | number[];
    
    if (this.comboCount <= 1) {
      pattern = 50; // 单次短振动
    } else if (this.comboCount <= 5) {
      pattern = [30, 20, 30]; // 双重振动
    } else {
      pattern = [50, 30, 50, 30, 50]; // 强烈振动
    }
    
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  /**
   * 更新Canvas矩形信息
   */
  private updateCanvasRect(): void {
    this.canvasRect = this.canvas.getBoundingClientRect();
  }

  /**
   * 检查点击是否在指定区域内
   */
  isClickInArea(
    clickEvent: ClickEvent,
    area: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      clickEvent.x >= area.x &&
      clickEvent.x <= area.x + area.width &&
      clickEvent.y >= area.y &&
      clickEvent.y <= area.y + area.height
    );
  }

  /**
   * 检查点击是否在圆形区域内
   */
  isClickInCircle(
    clickEvent: ClickEvent,
    center: { x: number; y: number },
    radius: number
  ): boolean {
    const dx = clickEvent.x - center.x;
    const dy = clickEvent.y - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= radius;
  }

  /**
   * 获取点击统计信息
   */
  getClickStats(): {
    totalClicks: number;
    currentCombo: number;
    lastClickTime: number;
    clicksPerSecond: number;
  } {
    const now = Date.now();
    const timeSinceStart = now - (this.lastClickTime - (this.clickCount - 1) * 100); // 估算
    const clicksPerSecond = timeSinceStart > 0 ? (this.clickCount / (timeSinceStart / 1000)) : 0;
    
    return {
      totalClicks: this.clickCount,
      currentCombo: this.comboCount,
      lastClickTime: this.lastClickTime,
      clicksPerSecond: Math.round(clicksPerSecond * 10) / 10
    };
  }

  /**
   * 重置点击统计
   */
  resetStats(): void {
    this.clickCount = 0;
    this.lastClickTime = 0;
    this.comboCount = 0;
    
    if (this.comboTimer) {
      clearTimeout(this.comboTimer);
      this.comboTimer = null;
    }
  }

  /**
   * 设置振动开关
   */
  setVibrationEnabled(enabled: boolean): void {
    this.options.enableVibration = enabled;
  }

  /**
   * 设置点击冷却时间
   */
  setClickCooldown(cooldown: number): void {
    this.options.clickCooldown = Math.max(0, cooldown);
  }

  /**
   * 启用/禁用多点触控
   */
  setMultiTouchEnabled(enabled: boolean): void {
    this.multiTouchEnabled = enabled;
  }

  /**
   * 获取当前活跃的触摸点
   */
  getActiveTouches(): TouchInfo[] {
    return Array.from(this.activeTouches.values());
  }

  /**
   * 销毁交互管理器
   */
  destroy(): void {
    // 移除事件监听器
    this.canvas.removeEventListener('mousedown', this.boundHandlers.mouseDown);
    this.canvas.removeEventListener('mouseup', this.boundHandlers.mouseUp);
    this.canvas.removeEventListener('mousemove', this.boundHandlers.mouseMove);
    
    if (this.deviceInfo.supportsTouch) {
      this.canvas.removeEventListener('touchstart', this.boundHandlers.touchStart);
      this.canvas.removeEventListener('touchend', this.boundHandlers.touchEnd);
      this.canvas.removeEventListener('touchmove', this.boundHandlers.touchMove);
    }
    
    this.canvas.removeEventListener('contextmenu', this.boundHandlers.contextMenu);
    window.removeEventListener('resize', this.boundHandlers.resize);
    
    // 清理计时器
    if (this.comboTimer) {
      clearTimeout(this.comboTimer);
    }
    
    if (this.clickCooldownTimer) {
      clearTimeout(this.clickCooldownTimer);
    }
    
    // 清理状态
    this.activeTouches.clear();
  }
}