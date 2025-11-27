/**
 * 特效系统
 * 处理各种视觉特效，包括点击特效、粒子效果、震动效果等
 */

import type { Effect, Particle } from '@/types/game.types';

export interface EffectSystemOptions {
  maxEffects?: number;
  maxParticles?: number;
  enableParticles?: boolean;
  enableShake?: boolean;
}

export interface ClickEffectOptions {
  duration?: number;
  size?: number;
  color?: string;
  style?: 'pulse' | 'ripple' | 'explosion' | 'punch';
}

export interface ParticleEffectOptions {
  count?: number;
  speed?: number;
  size?: number;
  colors?: string[];
  gravity?: number;
  spread?: number;
}

export interface ShakeEffectOptions {
  intensity?: number;
  duration?: number;
  frequency?: number;
}

/**
 * 基础特效类
 */
abstract class BaseEffect implements Effect {
  id: string;
  type: Effect['type'];
  x: number;
  y: number;
  duration: number;
  elapsed: number;
  intensity?: number;
  color?: string;

  constructor(
    type: Effect['type'],
    x: number,
    y: number,
    duration: number,
    options: { intensity?: number; color?: string } = {}
  ) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.type = type;
    this.x = x;
    this.y = y;
    this.duration = duration;
    this.elapsed = 0;
    this.intensity = options.intensity;
    this.color = options.color;
  }

  abstract render(ctx: CanvasRenderingContext2D): void;

  update(deltaTime: number): boolean {
    this.elapsed += deltaTime;
    return this.elapsed < this.duration;
  }

  protected getProgress(): number {
    return Math.min(this.elapsed / this.duration, 1);
  }

  protected easeOut(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  protected easeIn(t: number): number {
    return t * t * t;
  }

  protected easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }
}

/**
 * 点击脉冲特效
 */
class PulseEffect extends BaseEffect {
  private maxSize: number;

  constructor(x: number, y: number, options: ClickEffectOptions = {}) {
    super('click', x, y, options.duration || 500, options);
    this.maxSize = options.size || 50;
    this.color = options.color || '#ff6b6b';
  }

  render(ctx: CanvasRenderingContext2D): void {
    const progress = this.getProgress();
    const size = this.maxSize * this.easeOut(progress);
    const opacity = 1 - progress;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = this.color!;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * 涟漪特效
 */
class RippleEffect extends BaseEffect {
  private maxSize: number;
  private rings: number;

  constructor(x: number, y: number, options: ClickEffectOptions = {}) {
    super('click', x, y, options.duration || 800, options);
    this.maxSize = options.size || 80;
    this.color = options.color || '#45b7d1';
    this.rings = 3;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const progress = this.getProgress();

    ctx.save();
    
    for (let i = 0; i < this.rings; i++) {
      const ringProgress = Math.max(0, progress - (i * 0.2));
      const size = this.maxSize * this.easeOut(ringProgress);
      const opacity = (1 - ringProgress) * 0.6;

      if (opacity > 0) {
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = this.color!;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    
    ctx.restore();
  }
}

/**
 * 爆炸特效
 */
class ExplosionEffect extends BaseEffect {
  private particles: Particle[];

  constructor(x: number, y: number, options: ParticleEffectOptions = {}) {
    super('explosion', x, y, options.count ? options.count * 50 : 1000, options);
    this.particles = this.createParticles(options);
  }

  private createParticles(options: ParticleEffectOptions): Particle[] {
    const count = options.count || 20;
    const colors = options.colors || ['#ff6b6b', '#ffa500', '#ffff00', '#ff4757'];
    const particles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = (options.speed || 3) * (0.5 + Math.random() * 0.5);
      const size = (options.size || 4) * (0.5 + Math.random() * 0.5);

      particles.push({
        x: this.x,
        y: this.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        size,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: options.gravity || 0.1
      });
    }

    return particles;
  }

  update(deltaTime: number): boolean {
    const dt = deltaTime / 16.67; // 标准化到60fps

    this.particles.forEach(particle => {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += (particle.gravity || 0) * dt;
      particle.life -= dt / 60; // 1秒生命周期
    });

    this.particles = this.particles.filter(particle => particle.life > 0);

    return super.update(deltaTime) && this.particles.length > 0;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    this.particles.forEach(particle => {
      const opacity = particle.life / particle.maxLife;
      ctx.globalAlpha = opacity;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * opacity, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }
}

/**
 * 拳头特效
 */
class PunchEffect extends BaseEffect {
  private size: number;

  constructor(x: number, y: number, options: ClickEffectOptions = {}) {
    super('click', x, y, options.duration || 300, options);
    this.size = options.size || 30;
    this.color = options.color || '#ff4757';
  }

  render(ctx: CanvasRenderingContext2D): void {
    const progress = this.getProgress();
    const scale = 1 + this.easeOut(progress) * 0.5;
    const opacity = 1 - this.easeIn(progress);

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);
    
    // 绘制拳头图标
    ctx.fillStyle = this.color!;
    ctx.font = `${this.size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👊', 0, 0);
    
    ctx.restore();
  }
}

/**
 * 震动特效
 */
class ShakeEffect extends BaseEffect {
  private frequency: number;
  private originalIntensity: number;

  constructor(options: ShakeEffectOptions = {}) {
    super('shake', 0, 0, options.duration || 500, { intensity: options.intensity || 10 });
    this.frequency = options.frequency || 30;
    this.originalIntensity = this.intensity!;
  }

  update(deltaTime: number): boolean {
    const progress = this.getProgress();
    // 震动强度随时间衰减
    this.intensity = this.originalIntensity * (1 - this.easeOut(progress));
    return super.update(deltaTime);
  }

  render(ctx: CanvasRenderingContext2D): void {
    // 震动特效通过修改Canvas变换矩阵实现
    if (this.intensity! > 0) {
      const offsetX = (Math.random() - 0.5) * this.intensity! * 2;
      const offsetY = (Math.random() - 0.5) * this.intensity! * 2;
      ctx.translate(offsetX, offsetY);
    }
  }

  getShakeOffset(): { x: number; y: number } {
    if (this.intensity! <= 0) return { x: 0, y: 0 };
    
    return {
      x: (Math.random() - 0.5) * this.intensity! * 2,
      y: (Math.random() - 0.5) * this.intensity! * 2
    };
  }
}

/**
 * 特效系统主类
 */
export class EffectSystem {
  private effects: Effect[] = [];
  private options: Required<EffectSystemOptions>;
  private shakeEffect: ShakeEffect | null = null;

  constructor(options: EffectSystemOptions = {}) {
    this.options = {
      maxEffects: 50,
      maxParticles: 200,
      enableParticles: true,
      enableShake: true,
      ...options
    };
  }

  /**
   * 添加点击特效
   */
  addClickEffect(x: number, y: number, options: ClickEffectOptions = {}): void {
    const style = options.style || 'pulse';
    let effect: Effect;

    switch (style) {
      case 'pulse':
        effect = new PulseEffect(x, y, options);
        break;
      case 'ripple':
        effect = new RippleEffect(x, y, options);
        break;
      case 'explosion':
        effect = new ExplosionEffect(x, y, options as ParticleEffectOptions);
        break;
      case 'punch':
        effect = new PunchEffect(x, y, options);
        break;
      default:
        effect = new PulseEffect(x, y, options);
    }

    this.addEffect(effect);
  }

  /**
   * 添加震动特效
   */
  addShakeEffect(options: ShakeEffectOptions = {}): void {
    if (!this.options.enableShake) return;

    // 如果已有震动特效，增强强度
    if (this.shakeEffect && this.shakeEffect.intensity) {
      this.shakeEffect.intensity = Math.min(
        this.shakeEffect.intensity + (options.intensity || 10),
        50 // 最大震动强度
      );
      this.shakeEffect.elapsed = 0; // 重置时间
      return;
    }

    this.shakeEffect = new ShakeEffect(options);
  }

  /**
   * 添加粒子爆炸特效
   */
  addParticleExplosion(x: number, y: number, options: ParticleEffectOptions = {}): void {
    if (!this.options.enableParticles) return;

    const effect = new ExplosionEffect(x, y, options);
    this.addEffect(effect);
  }

  /**
   * 添加自定义特效
   */
  addEffect(effect: Effect): void {
    this.effects.push(effect);

    // 限制特效数量
    if (this.effects.length > this.options.maxEffects) {
      this.effects.shift();
    }
  }

  /**
   * 更新所有特效
   */
  update(deltaTime: number): void {
    // 更新普通特效
    this.effects = this.effects.filter(effect => effect.update(deltaTime));

    // 更新震动特效
    if (this.shakeEffect) {
      if (!this.shakeEffect.update(deltaTime)) {
        this.shakeEffect = null;
      }
    }
  }

  /**
   * 渲染所有特效
   */
  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // 应用震动效果
    if (this.shakeEffect) {
      const offset = this.shakeEffect.getShakeOffset();
      ctx.translate(offset.x, offset.y);
    }

    // 渲染所有特效
    this.effects.forEach(effect => {
      ctx.save();
      effect.render(ctx);
      ctx.restore();
    });

    ctx.restore();
  }

  /**
   * 获取当前震动偏移
   */
  getShakeOffset(): { x: number; y: number } {
    return this.shakeEffect ? this.shakeEffect.getShakeOffset() : { x: 0, y: 0 };
  }

  /**
   * 清除所有特效
   */
  clear(): void {
    this.effects = [];
    this.shakeEffect = null;
  }

  /**
   * 清除指定类型的特效
   */
  clearEffectsByType(type: Effect['type']): void {
    this.effects = this.effects.filter(effect => effect.type !== type);
    
    if (type === 'shake') {
      this.shakeEffect = null;
    }
  }

  /**
   * 获取特效统计信息
   */
  getStats(): {
    totalEffects: number;
    effectsByType: Record<string, number>;
    hasShake: boolean;
  } {
    const effectsByType: Record<string, number> = {};
    
    this.effects.forEach(effect => {
      effectsByType[effect.type] = (effectsByType[effect.type] || 0) + 1;
    });

    return {
      totalEffects: this.effects.length,
      effectsByType,
      hasShake: this.shakeEffect !== null
    };
  }

  /**
   * 设置特效选项
   */
  setOptions(options: Partial<EffectSystemOptions>): void {
    Object.assign(this.options, options);
  }

  /**
   * 获取当前选项
   */
  getOptions(): EffectSystemOptions {
    return { ...this.options };
  }

  /**
   * 销毁特效系统
   */
  destroy(): void {
    this.clear();
  }
}