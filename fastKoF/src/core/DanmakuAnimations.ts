/**
 * 弹幕动画系统
 * 提供各种弹幕动画效果和样式
 */

import type { DanmakuMessage } from '@/types/game.types';

export interface AnimationConfig {
  type: 'linear' | 'bounce' | 'wave' | 'fade' | 'scale' | 'rainbow' | 'shake';
  duration?: number;
  amplitude?: number;
  frequency?: number;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

export interface DanmakuStyle {
  fontFamily?: string;
  fontWeight?: string;
  textShadow?: string;
  strokeWidth?: number;
  strokeColor?: string;
  gradient?: {
    colors: string[];
    direction: 'horizontal' | 'vertical' | 'radial';
  };
  glow?: {
    color: string;
    blur: number;
    intensity: number;
  };
}

export interface AnimatedDanmaku extends DanmakuMessage {
  animation?: AnimationConfig;
  style?: DanmakuStyle;
  animationStartTime?: number;
  originalY?: number;
  originalFontSize?: number;
  originalColor?: string;
}

/**
 * 缓动函数
 */
export class EasingFunctions {
  static linear(t: number): number {
    return t;
  }

  static easeIn(t: number): number {
    return t * t * t;
  }

  static easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  static easeInOut(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  static bounce(t: number): number {
    const n1 = 7.5625;
    const d1 = 2.75;

    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  }
}

/**
 * 弹幕动画管理器
 */
export class DanmakuAnimations {
  private animatedMessages = new Map<string, AnimatedDanmaku>();

  /**
   * 添加动画到弹幕
   */
  addAnimation(message: DanmakuMessage, animation: AnimationConfig): AnimatedDanmaku {
    const animatedMessage: AnimatedDanmaku = {
      ...message,
      animation,
      animationStartTime: Date.now(),
      originalY: message.y,
      originalFontSize: message.fontSize,
      originalColor: message.color
    };

    this.animatedMessages.set(message.id, animatedMessage);
    return animatedMessage;
  }

  /**
   * 更新所有动画
   */
  updateAnimations(deltaTime: number): void {
    const now = Date.now();

    this.animatedMessages.forEach((message, id) => {
      if (!message.animation || !message.animationStartTime) return;

      const elapsed = now - message.animationStartTime;
      const duration = message.animation.duration || 1000;
      const progress = Math.min(elapsed / duration, 1);

      this.applyAnimation(message, progress);

      // 移除完成的动画
      if (progress >= 1 && message.animation.type !== 'rainbow' && message.animation.type !== 'shake') {
        this.removeAnimation(id);
      }
    });
  }

  /**
   * 应用动画效果
   */
  private applyAnimation(message: AnimatedDanmaku, progress: number): void {
    if (!message.animation || !message.originalY) return;

    const easing = this.getEasingFunction(message.animation.easing || 'linear');
    const easedProgress = easing(progress);

    switch (message.animation.type) {
      case 'bounce':
        this.applyBounceAnimation(message, easedProgress);
        break;
      case 'wave':
        this.applyWaveAnimation(message, progress);
        break;
      case 'fade':
        this.applyFadeAnimation(message, easedProgress);
        break;
      case 'scale':
        this.applyScaleAnimation(message, easedProgress);
        break;
      case 'rainbow':
        this.applyRainbowAnimation(message, progress);
        break;
      case 'shake':
        this.applyShakeAnimation(message, progress);
        break;
    }
  }

  /**
   * 弹跳动画
   */
  private applyBounceAnimation(message: AnimatedDanmaku, progress: number): void {
    const amplitude = message.animation!.amplitude || 20;
    const bounceProgress = EasingFunctions.bounce(progress);
    message.y = message.originalY! + amplitude * (1 - bounceProgress);
  }

  /**
   * 波浪动画
   */
  private applyWaveAnimation(message: AnimatedDanmaku, progress: number): void {
    const amplitude = message.animation!.amplitude || 15;
    const frequency = message.animation!.frequency || 2;
    const waveOffset = Math.sin(progress * Math.PI * frequency) * amplitude;
    message.y = message.originalY! + waveOffset;
  }

  /**
   * 淡入淡出动画
   */
  private applyFadeAnimation(message: AnimatedDanmaku, progress: number): void {
    if (progress < 0.5) {
      // 淡入
      message.opacity = progress * 2;
    } else {
      // 淡出
      message.opacity = 2 - progress * 2;
    }
  }

  /**
   * 缩放动画
   */
  private applyScaleAnimation(message: AnimatedDanmaku, progress: number): void {
    const maxScale = message.animation!.amplitude || 1.5;
    const scale = 1 + (maxScale - 1) * Math.sin(progress * Math.PI);
    message.fontSize = message.originalFontSize! * scale;
  }

  /**
   * 彩虹动画
   */
  private applyRainbowAnimation(message: AnimatedDanmaku, progress: number): void {
    const hue = (progress * 360) % 360;
    message.color = `hsl(${hue}, 70%, 60%)`;
  }

  /**
   * 震动动画
   */
  private applyShakeAnimation(message: AnimatedDanmaku, progress: number): void {
    const amplitude = message.animation!.amplitude || 3;
    const frequency = message.animation!.frequency || 20;
    const shakeX = Math.sin(progress * Math.PI * frequency) * amplitude * (1 - progress);
    const shakeY = Math.cos(progress * Math.PI * frequency) * amplitude * (1 - progress);
    
    message.x += shakeX;
    message.y = message.originalY! + shakeY;
  }

  /**
   * 获取缓动函数
   */
  private getEasingFunction(easing: string): (t: number) => number {
    switch (easing) {
      case 'easeIn': return EasingFunctions.easeIn;
      case 'easeOut': return EasingFunctions.easeOut;
      case 'easeInOut': return EasingFunctions.easeInOut;
      default: return EasingFunctions.linear;
    }
  }

  /**
   * 移除动画
   */
  removeAnimation(messageId: string): void {
    this.animatedMessages.delete(messageId);
  }

  /**
   * 获取动画消息
   */
  getAnimatedMessage(messageId: string): AnimatedDanmaku | undefined {
    return this.animatedMessages.get(messageId);
  }

  /**
   * 清除所有动画
   */
  clear(): void {
    this.animatedMessages.clear();
  }
}

/**
 * 弹幕样式渲染器
 */
export class DanmakuStyleRenderer {
  /**
   * 渲染带样式的弹幕
   */
  static renderStyledDanmaku(
    ctx: CanvasRenderingContext2D,
    message: AnimatedDanmaku
  ): void {
    ctx.save();

    // 设置基本属性
    ctx.globalAlpha = message.opacity;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // 应用自定义样式
    this.applyTextStyle(ctx, message);

    // 应用特殊效果
    if (message.style?.glow) {
      this.applyGlowEffect(ctx, message);
    }

    if (message.style?.gradient) {
      this.applyGradientEffect(ctx, message);
    }

    // 渲染文字
    this.renderText(ctx, message);

    ctx.restore();
  }

  /**
   * 应用文字样式
   */
  private static applyTextStyle(ctx: CanvasRenderingContext2D, message: AnimatedDanmaku): void {
    const style = message.style;
    
    // 字体设置
    const fontFamily = style?.fontFamily || 'Arial, sans-serif';
    const fontWeight = style?.fontWeight || 'bold';
    ctx.font = `${fontWeight} ${message.fontSize}px ${fontFamily}`;

    // 文字颜色
    ctx.fillStyle = message.color;

    // 描边设置
    if (style?.strokeWidth && style?.strokeColor) {
      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth;
    } else {
      // 默认描边
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = Math.max(1, message.fontSize * 0.1);
    }

    // 文字阴影
    if (style?.textShadow) {
      const shadowParts = style.textShadow.split(' ');
      if (shadowParts.length >= 4) {
        ctx.shadowOffsetX = parseInt(shadowParts[0]);
        ctx.shadowOffsetY = parseInt(shadowParts[1]);
        ctx.shadowBlur = parseInt(shadowParts[2]);
        ctx.shadowColor = shadowParts[3];
      }
    }
  }

  /**
   * 应用发光效果
   */
  private static applyGlowEffect(ctx: CanvasRenderingContext2D, message: AnimatedDanmaku): void {
    const glow = message.style!.glow!;
    
    ctx.shadowColor = glow.color;
    ctx.shadowBlur = glow.blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // 多次渲染增强发光效果
    for (let i = 0; i < glow.intensity; i++) {
      ctx.strokeText(message.text, message.x, message.y);
    }
  }

  /**
   * 应用渐变效果
   */
  private static applyGradientEffect(ctx: CanvasRenderingContext2D, message: AnimatedDanmaku): void {
    const gradient = message.style!.gradient!;
    const textWidth = ctx.measureText(message.text).width;
    
    let grad: CanvasGradient;

    switch (gradient.direction) {
      case 'horizontal':
        grad = ctx.createLinearGradient(message.x, 0, message.x + textWidth, 0);
        break;
      case 'vertical':
        grad = ctx.createLinearGradient(0, message.y - message.fontSize/2, 0, message.y + message.fontSize/2);
        break;
      case 'radial':
        grad = ctx.createRadialGradient(
          message.x + textWidth/2, message.y, 0,
          message.x + textWidth/2, message.y, textWidth/2
        );
        break;
      default:
        grad = ctx.createLinearGradient(message.x, 0, message.x + textWidth, 0);
    }

    // 添加颜色停止点
    gradient.colors.forEach((color, index) => {
      grad.addColorStop(index / (gradient.colors.length - 1), color);
    });

    ctx.fillStyle = grad;
  }

  /**
   * 渲染文字
   */
  private static renderText(ctx: CanvasRenderingContext2D, message: AnimatedDanmaku): void {
    // 先绘制描边
    if (ctx.lineWidth > 0) {
      ctx.strokeText(message.text, message.x, message.y);
    }
    
    // 再绘制填充
    ctx.fillText(message.text, message.x, message.y);
  }

  /**
   * 创建预设样式
   */
  static createPresetStyle(preset: string): DanmakuStyle {
    switch (preset) {
      case 'neon':
        return {
          fontFamily: 'Arial Black, sans-serif',
          fontWeight: 'bold',
          strokeWidth: 2,
          strokeColor: '#000000',
          glow: {
            color: '#00ffff',
            blur: 10,
            intensity: 3
          }
        };
      
      case 'fire':
        return {
          fontFamily: 'Impact, sans-serif',
          fontWeight: 'bold',
          gradient: {
            colors: ['#ff4500', '#ff6347', '#ffd700'],
            direction: 'vertical'
          },
          glow: {
            color: '#ff4500',
            blur: 8,
            intensity: 2
          }
        };
      
      case 'ice':
        return {
          fontFamily: 'Arial, sans-serif',
          fontWeight: 'bold',
          gradient: {
            colors: ['#87ceeb', '#b0e0e6', '#ffffff'],
            direction: 'horizontal'
          },
          strokeWidth: 1,
          strokeColor: '#4682b4'
        };
      
      case 'rainbow':
        return {
          fontFamily: 'Comic Sans MS, cursive',
          fontWeight: 'bold',
          strokeWidth: 2,
          strokeColor: '#000000',
          textShadow: '2 2 4 rgba(0,0,0,0.5)'
        };
      
      case 'retro':
        return {
          fontFamily: 'Courier New, monospace',
          fontWeight: 'bold',
          strokeWidth: 1,
          strokeColor: '#000000',
          glow: {
            color: '#00ff00',
            blur: 5,
            intensity: 2
          }
        };
      
      default:
        return {
          fontFamily: 'Arial, sans-serif',
          fontWeight: 'bold',
          strokeWidth: 2,
          strokeColor: 'rgba(0, 0, 0, 0.8)'
        };
    }
  }
}

/**
 * 弹幕动画预设
 */
export class DanmakuAnimationPresets {
  static getPreset(name: string): AnimationConfig {
    switch (name) {
      case 'bounce':
        return {
          type: 'bounce',
          duration: 800,
          amplitude: 20,
          easing: 'easeOut'
        };
      
      case 'wave':
        return {
          type: 'wave',
          duration: 2000,
          amplitude: 15,
          frequency: 3,
          easing: 'linear'
        };
      
      case 'pulse':
        return {
          type: 'scale',
          duration: 1000,
          amplitude: 1.3,
          easing: 'easeInOut'
        };
      
      case 'rainbow':
        return {
          type: 'rainbow',
          duration: 3000,
          easing: 'linear'
        };
      
      case 'shake':
        return {
          type: 'shake',
          duration: 500,
          amplitude: 5,
          frequency: 30,
          easing: 'easeOut'
        };
      
      case 'fadeInOut':
        return {
          type: 'fade',
          duration: 2000,
          easing: 'easeInOut'
        };
      
      default:
        return {
          type: 'linear',
          duration: 1000,
          easing: 'linear'
        };
    }
  }

  static getAllPresets(): string[] {
    return ['bounce', 'wave', 'pulse', 'rainbow', 'shake', 'fadeInOut'];
  }
}