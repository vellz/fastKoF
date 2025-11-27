/**
 * Canvas渲染器
 * 处理游戏的Canvas渲染和响应式布局
 */

import { DeviceDetector } from '@/utils/DeviceDetector';
import type { GameState } from '@/types/game.types';

export interface CanvasRendererOptions {
  container: HTMLElement;
  enableResponsive?: boolean;
  enableHighDPI?: boolean;
  maintainAspectRatio?: boolean;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface ViewportInfo {
  width: number;
  height: number;
  pixelRatio: number;
  isMobile: boolean;
  isTablet: boolean;
  orientation: 'portrait' | 'landscape';
}

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  viewport: ViewportInfo;
  scale: number;
  offset: { x: number; y: number };
}

/**
 * Canvas渲染器类
 */
export class CanvasRenderer {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private options: Required<CanvasRendererOptions>;
  private viewport: ViewportInfo;
  private resizeObserver: ResizeObserver | null = null;
  private orientationChangeHandler: (() => void) | null = null;
  private deviceInfo: any;

  constructor(options: CanvasRendererOptions) {
    this.container = options.container;
    this.deviceInfo = DeviceDetector.getDeviceInfo();
    
    this.options = {
      enableResponsive: true,
      enableHighDPI: true,
      maintainAspectRatio: true,
      minWidth: 320,
      minHeight: 240,
      maxWidth: 1920,
      maxHeight: 1080,
      ...options
    };

    this.viewport = this.calculateViewport();
    this.canvas = this.createCanvas();
    this.ctx = this.canvas.getContext('2d')!;

    this.init();
  }

  /**
   * 初始化渲染器
   */
  private init(): void {
    this.setupCanvas();
    this.setupResponsiveHandlers();
    this.updateCanvasSize();
  }

  /**
   * 创建Canvas元素
   */
  private createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    canvas.style.cssText = `
      display: block;
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    `;
    
    this.container.appendChild(canvas);
    return canvas;
  }

  /**
   * 设置Canvas属性
   */
  private setupCanvas(): void {
    // 设置Canvas样式
    this.canvas.style.cursor = 'crosshair';
    
    // 禁用右键菜单
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // 设置Canvas渲染上下文属性
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  /**
   * 设置响应式处理器
   */
  private setupResponsiveHandlers(): void {
    if (!this.options.enableResponsive) return;

    // 使用ResizeObserver监听容器大小变化
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(this.container);
    } else {
      // 降级到window resize事件
      window.addEventListener('resize', this.handleResize.bind(this));
    }

    // 监听设备方向变化
    if (this.deviceInfo.isMobile || this.deviceInfo.isTablet) {
      this.orientationChangeHandler = () => {
        // 延迟处理，等待浏览器完成方向变化
        setTimeout(() => {
          this.handleOrientationChange();
        }, 100);
      };

      window.addEventListener('orientationchange', this.orientationChangeHandler);
      screen.orientation?.addEventListener('change', this.orientationChangeHandler);
    }
  }

  /**
   * 计算视口信息
   */
  private calculateViewport(): ViewportInfo {
    const containerRect = this.container.getBoundingClientRect();
    const pixelRatio = this.options.enableHighDPI ? this.deviceInfo.pixelRatio : 1;
    
    return {
      width: containerRect.width,
      height: containerRect.height,
      pixelRatio,
      isMobile: this.deviceInfo.isMobile,
      isTablet: this.deviceInfo.isTablet,
      orientation: window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
    };
  }

  /**
   * 更新Canvas尺寸
   */
  private updateCanvasSize(): void {
    const containerRect = this.container.getBoundingClientRect();
    let { width, height } = containerRect;

    // 应用尺寸限制
    width = Math.max(this.options.minWidth, Math.min(this.options.maxWidth, width));
    height = Math.max(this.options.minHeight, Math.min(this.options.maxHeight, height));

    // 保持宽高比
    if (this.options.maintainAspectRatio) {
      const aspectRatio = 4 / 3; // 默认4:3比例
      const currentRatio = width / height;
      
      if (currentRatio > aspectRatio) {
        width = height * aspectRatio;
      } else {
        height = width / aspectRatio;
      }
    }

    // 考虑像素比
    const pixelRatio = this.viewport.pixelRatio;
    const displayWidth = Math.floor(width);
    const displayHeight = Math.floor(height);
    const canvasWidth = Math.floor(width * pixelRatio);
    const canvasHeight = Math.floor(height * pixelRatio);

    // 设置Canvas实际尺寸
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;

    // 设置Canvas显示尺寸
    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;

    // 缩放上下文以匹配像素比
    this.ctx.scale(pixelRatio, pixelRatio);

    // 更新视口信息
    this.viewport = {
      ...this.viewport,
      width: displayWidth,
      height: displayHeight
    };

    console.log(`Canvas resized: ${canvasWidth}x${canvasHeight} (display: ${displayWidth}x${displayHeight}, ratio: ${pixelRatio})`);
  }

  /**
   * 处理窗口大小变化
   */
  private handleResize(): void {
    this.viewport = this.calculateViewport();
    this.updateCanvasSize();
    
    // 触发自定义事件
    this.container.dispatchEvent(new CustomEvent('canvasResize', {
      detail: { viewport: this.viewport }
    }));
  }

  /**
   * 处理设备方向变化
   */
  private handleOrientationChange(): void {
    this.viewport = this.calculateViewport();
    this.updateCanvasSize();
    
    // 触发自定义事件
    this.container.dispatchEvent(new CustomEvent('orientationChange', {
      detail: { 
        viewport: this.viewport,
        orientation: this.viewport.orientation
      }
    }));
  }

  /**
   * 获取渲染上下文
   */
  getRenderContext(): RenderContext {
    return {
      canvas: this.canvas,
      ctx: this.ctx,
      viewport: this.viewport,
      scale: this.viewport.pixelRatio,
      offset: { x: 0, y: 0 }
    };
  }

  /**
   * 清除Canvas
   */
  clear(color?: string): void {
    this.ctx.save();
    
    if (color) {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);
    } else {
      this.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
    }
    
    this.ctx.restore();
  }

  /**
   * 渲染背景
   */
  renderBackground(gradient?: { colors: string[]; direction?: 'horizontal' | 'vertical' | 'radial' }): void {
    this.ctx.save();
    
    if (gradient) {
      let grad: CanvasGradient;
      
      switch (gradient.direction) {
        case 'horizontal':
          grad = this.ctx.createLinearGradient(0, 0, this.viewport.width, 0);
          break;
        case 'vertical':
          grad = this.ctx.createLinearGradient(0, 0, 0, this.viewport.height);
          break;
        case 'radial':
          grad = this.ctx.createRadialGradient(
            this.viewport.width / 2, this.viewport.height / 2, 0,
            this.viewport.width / 2, this.viewport.height / 2, Math.max(this.viewport.width, this.viewport.height) / 2
          );
          break;
        default:
          grad = this.ctx.createLinearGradient(0, 0, this.viewport.width, this.viewport.height);
      }
      
      gradient.colors.forEach((color, index) => {
        grad.addColorStop(index / (gradient.colors.length - 1), color);
      });
      
      this.ctx.fillStyle = grad;
    } else {
      this.ctx.fillStyle = '#f0f0f0';
    }
    
    this.ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);
    this.ctx.restore();
  }

  /**
   * 渲染图片
   */
  renderImage(
    image: HTMLImageElement | HTMLCanvasElement,
    options: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      fit?: 'contain' | 'cover' | 'fill' | 'none';
      opacity?: number;
      filter?: string;
    } = {}
  ): void {
    if (!image) return;

    this.ctx.save();

    // 设置透明度
    if (options.opacity !== undefined) {
      this.ctx.globalAlpha = options.opacity;
    }

    // 设置滤镜
    if (options.filter) {
      this.ctx.filter = options.filter;
    }

    // 计算渲染位置和尺寸
    const { x, y, width, height } = this.calculateImageBounds(image, options);

    // 渲染图片
    this.ctx.drawImage(image, x, y, width, height);

    this.ctx.restore();
  }

  /**
   * 计算图片渲染边界
   */
  private calculateImageBounds(
    image: HTMLImageElement | HTMLCanvasElement,
    options: any
  ): { x: number; y: number; width: number; height: number } {
    const imageWidth = image.width;
    const imageHeight = image.height;
    const canvasWidth = this.viewport.width;
    const canvasHeight = this.viewport.height;

    let { x = 0, y = 0, width = imageWidth, height = imageHeight, fit = 'contain' } = options;

    if (fit === 'contain') {
      // 保持宽高比，完全显示图片
      const scale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight);
      width = imageWidth * scale;
      height = imageHeight * scale;
      x = (canvasWidth - width) / 2;
      y = (canvasHeight - height) / 2;
    } else if (fit === 'cover') {
      // 保持宽高比，填满容器
      const scale = Math.max(canvasWidth / imageWidth, canvasHeight / imageHeight);
      width = imageWidth * scale;
      height = imageHeight * scale;
      x = (canvasWidth - width) / 2;
      y = (canvasHeight - height) / 2;
    } else if (fit === 'fill') {
      // 拉伸填满容器
      width = canvasWidth;
      height = canvasHeight;
      x = 0;
      y = 0;
    }

    return { x, y, width, height };
  }

  /**
   * 渲染文本
   */
  renderText(
    text: string,
    x: number,
    y: number,
    options: {
      font?: string;
      color?: string;
      align?: CanvasTextAlign;
      baseline?: CanvasTextBaseline;
      maxWidth?: number;
      stroke?: { color: string; width: number };
      shadow?: { color: string; blur: number; offsetX: number; offsetY: number };
    } = {}
  ): void {
    this.ctx.save();

    // 设置字体
    if (options.font) {
      this.ctx.font = options.font;
    }

    // 设置颜色
    if (options.color) {
      this.ctx.fillStyle = options.color;
    }

    // 设置对齐
    if (options.align) {
      this.ctx.textAlign = options.align;
    }

    if (options.baseline) {
      this.ctx.textBaseline = options.baseline;
    }

    // 设置阴影
    if (options.shadow) {
      this.ctx.shadowColor = options.shadow.color;
      this.ctx.shadowBlur = options.shadow.blur;
      this.ctx.shadowOffsetX = options.shadow.offsetX;
      this.ctx.shadowOffsetY = options.shadow.offsetY;
    }

    // 绘制描边
    if (options.stroke) {
      this.ctx.strokeStyle = options.stroke.color;
      this.ctx.lineWidth = options.stroke.width;
      this.ctx.strokeText(text, x, y, options.maxWidth);
    }

    // 绘制填充
    this.ctx.fillText(text, x, y, options.maxWidth);

    this.ctx.restore();
  }

  /**
   * 坐标转换：屏幕坐标到Canvas坐标
   */
  screenToCanvas(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.viewport.width / rect.width;
    const scaleY = this.viewport.height / rect.height;

    return {
      x: (screenX - rect.left) * scaleX,
      y: (screenY - rect.top) * scaleY
    };
  }

  /**
   * 坐标转换：Canvas坐标到屏幕坐标
   */
  canvasToScreen(canvasX: number, canvasY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width / this.viewport.width;
    const scaleY = rect.height / this.viewport.height;

    return {
      x: canvasX * scaleX + rect.left,
      y: canvasY * scaleY + rect.top
    };
  }

  /**
   * 获取Canvas元素
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * 获取渲染上下文
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /**
   * 获取视口信息
   */
  getViewport(): ViewportInfo {
    return { ...this.viewport };
  }

  /**
   * 设置Canvas光标样式
   */
  setCursor(cursor: string): void {
    this.canvas.style.cursor = cursor;
  }

  /**
   * 截图Canvas内容
   */
  screenshot(format: 'png' | 'jpeg' = 'png', quality?: number): string {
    return this.canvas.toDataURL(`image/${format}`, quality);
  }

  /**
   * 全屏显示Canvas
   */
  async requestFullscreen(): Promise<void> {
    try {
      if (this.canvas.requestFullscreen) {
        await this.canvas.requestFullscreen();
      } else if ((this.canvas as any).webkitRequestFullscreen) {
        await (this.canvas as any).webkitRequestFullscreen();
      } else if ((this.canvas as any).msRequestFullscreen) {
        await (this.canvas as any).msRequestFullscreen();
      }
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
      throw error;
    }
  }

  /**
   * 退出全屏
   */
  async exitFullscreen(): Promise<void> {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
      throw error;
    }
  }

  /**
   * 销毁渲染器
   */
  destroy(): void {
    // 移除事件监听器
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    } else {
      window.removeEventListener('resize', this.handleResize.bind(this));
    }

    if (this.orientationChangeHandler) {
      window.removeEventListener('orientationchange', this.orientationChangeHandler);
      screen.orientation?.removeEventListener('change', this.orientationChangeHandler);
    }

    // 移除Canvas
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}