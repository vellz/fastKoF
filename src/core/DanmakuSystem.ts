/**
 * 弹幕系统
 * 处理弹幕消息的生成、移动、渲染和碰撞检测
 */

import type { DanmakuMessage } from '@/types/game.types';
import { 
  DanmakuAnimations, 
  DanmakuStyleRenderer, 
  DanmakuAnimationPresets,
  type AnimationConfig,
  type DanmakuStyle,
  type AnimatedDanmaku
} from './DanmakuAnimations';

export interface DanmakuSystemOptions {
  canvasWidth: number;
  canvasHeight: number;
  maxMessages?: number;
  defaultSpeed?: number;
  defaultFontSize?: number;
  lineHeight?: number;
  colors?: string[];
  messages?: string[];
  enableCollisionDetection?: boolean;
  fadeOutDuration?: number;
}

export interface DanmakuSpawnOptions {
  text?: string;
  speed?: number;
  fontSize?: number;
  color?: string;
  y?: number;
  opacity?: number;
  animation?: AnimationConfig | string; // 动画配置或预设名称
  style?: DanmakuStyle | string; // 样式配置或预设名称
}

export interface DanmakuLane {
  y: number;
  occupied: boolean;
  lastMessageTime: number;
  minInterval: number;
}

/**
 * 弹幕系统类
 */
export class DanmakuSystem {
  private messages: DanmakuMessage[] = [];
  private lanes: DanmakuLane[] = [];
  private options: Required<DanmakuSystemOptions>;
  private messageIdCounter = 0;
  private lastSpawnTime = 0;
  private animationManager: DanmakuAnimations;

  constructor(options: DanmakuSystemOptions) {
    this.options = {
      maxMessages: 20,
      defaultSpeed: 2,
      defaultFontSize: 16,
      lineHeight: 24,
      colors: [
        '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', 
        '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'
      ],
      messages: [
        '求求你，别打了！',
        '我错了，我真的错了！',
        '饶了我吧！',
        '我再也不敢了！',
        '疼疼疼！',
        '住手啊！',
        '我投降！',
        '别这样对我！',
        '我害怕！',
        '放过我吧！',
        '我知道错了！',
        '不要再打了！',
        '我受不了了！',
        '太疼了！',
        '我认输！'
      ],
      enableCollisionDetection: true,
      fadeOutDuration: 500,
      ...options
    };

    this.animationManager = new DanmakuAnimations();
    this.initializeLanes();
  }

  /**
   * 初始化弹幕轨道
   */
  private initializeLanes(): void {
    const laneCount = Math.floor(this.options.canvasHeight / this.options.lineHeight);
    const startY = this.options.lineHeight;

    this.lanes = [];
    for (let i = 0; i < laneCount; i++) {
      this.lanes.push({
        y: startY + i * this.options.lineHeight,
        occupied: false,
        lastMessageTime: 0,
        minInterval: 2000 // 2秒最小间隔
      });
    }
  }

  /**
   * 添加弹幕消息
   */
  addMessage(options: DanmakuSpawnOptions = {}): DanmakuMessage | null {
    // 检查消息数量限制
    if (this.messages.length >= this.options.maxMessages) {
      // 移除最老的消息
      this.messages.shift();
    }

    // 获取可用轨道
    const lane = this.getAvailableLane();
    if (!lane) {
      return null; // 没有可用轨道
    }

    // 选择消息文本
    const text = options.text || this.getRandomMessage();
    
    // 创建弹幕消息
    const message: DanmakuMessage = {
      id: `danmaku_${++this.messageIdCounter}`,
      text,
      x: this.options.canvasWidth + 50, // 从右侧开始
      y: options.y || lane.y,
      speed: options.speed || this.options.defaultSpeed,
      color: options.color || this.getRandomColor(),
      fontSize: options.fontSize || this.options.defaultFontSize,
      opacity: options.opacity || 1,
      createdAt: Date.now()
    };

    // 处理动画配置
    if (options.animation) {
      const animationConfig = typeof options.animation === 'string' 
        ? DanmakuAnimationPresets.getPreset(options.animation)
        : options.animation;
      
      this.animationManager.addAnimation(message, animationConfig);
    }

    // 处理样式配置
    if (options.style) {
      const animatedMessage = this.animationManager.getAnimatedMessage(message.id);
      if (animatedMessage) {
        animatedMessage.style = typeof options.style === 'string'
          ? DanmakuStyleRenderer.createPresetStyle(options.style)
          : options.style;
      }
    }

    // 标记轨道为占用
    lane.occupied = true;
    lane.lastMessageTime = Date.now();

    this.messages.push(message);
    this.lastSpawnTime = Date.now();

    return message;
  }

  /**
   * 批量添加弹幕
   */
  addMultipleMessages(count: number, options: DanmakuSpawnOptions = {}): DanmakuMessage[] {
    const addedMessages: DanmakuMessage[] = [];
    
    for (let i = 0; i < count; i++) {
      const message = this.addMessage({
        ...options,
        // 为每条消息添加一些随机性
        speed: (options.speed || this.options.defaultSpeed) * (0.8 + Math.random() * 0.4),
        fontSize: (options.fontSize || this.options.defaultFontSize) * (0.9 + Math.random() * 0.2)
      });
      
      if (message) {
        addedMessages.push(message);
      }
    }

    return addedMessages;
  }

  /**
   * 更新弹幕系统
   */
  update(deltaTime: number): void {
    const now = Date.now();
    const dt = deltaTime / 16.67; // 标准化到60fps

    // 更新动画系统
    this.animationManager.updateAnimations(deltaTime);

    // 更新所有弹幕消息
    this.messages.forEach(message => {
      // 检查是否有动画版本
      const animatedMessage = this.animationManager.getAnimatedMessage(message.id);
      if (animatedMessage) {
        // 同步动画消息的基础属性到原消息
        message.x = animatedMessage.x;
        message.y = animatedMessage.y;
        message.opacity = animatedMessage.opacity;
        message.fontSize = animatedMessage.fontSize;
        message.color = animatedMessage.color;
        message.speed = animatedMessage.speed;
      }

      // 移动弹幕
      message.x -= message.speed * dt;

      // 处理淡出效果
      if (message.x < -200) {
        const fadeProgress = Math.max(0, (message.x + 200) / -100);
        message.opacity = Math.max(0, 1 - fadeProgress);
      }
    });

    // 移除已经完全移出屏幕的弹幕
    this.messages = this.messages.filter(message => {
      const isVisible = message.x > -300 && message.opacity > 0;
      
      // 如果消息不可见，释放对应的轨道并清理动画
      if (!isVisible) {
        this.releaseLane(message.y);
        this.animationManager.removeAnimation(message.id);
      }
      
      return isVisible;
    });

    // 更新轨道状态
    this.updateLanes(now);
  }

  /**
   * 渲染弹幕系统
   */
  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    this.messages.forEach(message => {
      if (message.opacity <= 0) return;

      // 检查是否有动画版本（带样式）
      const animatedMessage = this.animationManager.getAnimatedMessage(message.id);
      
      if (animatedMessage && animatedMessage.style) {
        // 使用样式渲染器渲染带样式的弹幕
        DanmakuStyleRenderer.renderStyledDanmaku(ctx, animatedMessage);
      } else {
        // 使用默认渲染
        ctx.save();
        
        // 设置透明度
        ctx.globalAlpha = message.opacity;
        
        // 设置字体样式
        ctx.font = `bold ${message.fontSize}px Arial, sans-serif`;
        ctx.fillStyle = message.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        // 添加文字描边效果
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.strokeText(message.text, message.x, message.y);
        
        // 填充文字
        ctx.fillText(message.text, message.x, message.y);
        
        ctx.restore();
      }
    });

    ctx.restore();
  }

  /**
   * 获取可用轨道
   */
  private getAvailableLane(): DanmakuLane | null {
    const now = Date.now();
    
    // 首先尝试找到完全空闲的轨道
    for (const lane of this.lanes) {
      if (!lane.occupied && (now - lane.lastMessageTime) > lane.minInterval) {
        return lane;
      }
    }

    // 如果没有完全空闲的轨道，找到最久未使用的轨道
    let oldestLane = this.lanes[0];
    for (const lane of this.lanes) {
      if (lane.lastMessageTime < oldestLane.lastMessageTime) {
        oldestLane = lane;
      }
    }

    // 检查最久未使用的轨道是否可以使用
    if ((now - oldestLane.lastMessageTime) > oldestLane.minInterval / 2) {
      return oldestLane;
    }

    return null;
  }

  /**
   * 释放轨道
   */
  private releaseLane(y: number): void {
    const lane = this.lanes.find(l => Math.abs(l.y - y) < 5);
    if (lane) {
      lane.occupied = false;
    }
  }

  /**
   * 更新轨道状态
   */
  private updateLanes(now: number): void {
    this.lanes.forEach(lane => {
      // 检查轨道上是否还有弹幕
      const hasMessage = this.messages.some(message => 
        Math.abs(message.y - lane.y) < 5 && message.x > -100
      );
      
      if (!hasMessage) {
        lane.occupied = false;
      }
    });
  }

  /**
   * 获取随机消息
   */
  private getRandomMessage(): string {
    const messages = this.options.messages;
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * 获取随机颜色
   */
  private getRandomColor(): string {
    const colors = this.options.colors;
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * 检查弹幕碰撞
   */
  checkCollision(x: number, y: number, width: number, height: number): DanmakuMessage[] {
    if (!this.options.enableCollisionDetection) {
      return [];
    }

    return this.messages.filter(message => {
      // 估算文字宽度
      const textWidth = message.text.length * message.fontSize * 0.6;
      const textHeight = message.fontSize;

      // 简单的矩形碰撞检测
      return !(
        message.x > x + width ||
        message.x + textWidth < x ||
        message.y - textHeight / 2 > y + height ||
        message.y + textHeight / 2 < y
      );
    });
  }

  /**
   * 移除指定的弹幕消息
   */
  removeMessage(messageId: string): boolean {
    const index = this.messages.findIndex(message => message.id === messageId);
    if (index !== -1) {
      const message = this.messages[index];
      this.releaseLane(message.y);
      this.messages.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 移除多条弹幕消息
   */
  removeMessages(messageIds: string[]): number {
    let removedCount = 0;
    messageIds.forEach(id => {
      if (this.removeMessage(id)) {
        removedCount++;
      }
    });
    return removedCount;
  }

  /**
   * 清除所有弹幕
   */
  clear(): void {
    this.messages = [];
    this.animationManager.clear();
    this.lanes.forEach(lane => {
      lane.occupied = false;
      lane.lastMessageTime = 0;
    });
  }

  /**
   * 暂停所有弹幕
   */
  pause(): void {
    // 可以通过设置速度为0来暂停
    this.messages.forEach(message => {
      (message as any).originalSpeed = message.speed;
      message.speed = 0;
    });
  }

  /**
   * 恢复所有弹幕
   */
  resume(): void {
    this.messages.forEach(message => {
      if ((message as any).originalSpeed !== undefined) {
        message.speed = (message as any).originalSpeed;
        delete (message as any).originalSpeed;
      }
    });
  }

  /**
   * 设置弹幕速度倍率
   */
  setSpeedMultiplier(multiplier: number): void {
    this.messages.forEach(message => {
      if (!(message as any).originalSpeed) {
        (message as any).originalSpeed = message.speed;
      }
      message.speed = (message as any).originalSpeed * multiplier;
    });
  }

  /**
   * 获取弹幕统计信息
   */
  getStats(): {
    totalMessages: number;
    activeMessages: number;
    availableLanes: number;
    occupiedLanes: number;
    averageSpeed: number;
    oldestMessageAge: number;
  } {
    const now = Date.now();
    const activeMessages = this.messages.filter(m => m.opacity > 0).length;
    const occupiedLanes = this.lanes.filter(l => l.occupied).length;
    const availableLanes = this.lanes.length - occupiedLanes;
    
    const totalSpeed = this.messages.reduce((sum, m) => sum + m.speed, 0);
    const averageSpeed = this.messages.length > 0 ? totalSpeed / this.messages.length : 0;
    
    const oldestMessage = this.messages.reduce((oldest, current) => 
      current.createdAt < oldest.createdAt ? current : oldest, 
      this.messages[0]
    );
    const oldestMessageAge = oldestMessage ? now - oldestMessage.createdAt : 0;

    return {
      totalMessages: this.messages.length,
      activeMessages,
      availableLanes,
      occupiedLanes,
      averageSpeed: Math.round(averageSpeed * 10) / 10,
      oldestMessageAge
    };
  }

  /**
   * 获取所有弹幕消息
   */
  getMessages(): DanmakuMessage[] {
    return [...this.messages];
  }

  /**
   * 获取指定区域内的弹幕
   */
  getMessagesInArea(x: number, y: number, width: number, height: number): DanmakuMessage[] {
    return this.messages.filter(message => {
      return message.x >= x && 
             message.x <= x + width && 
             message.y >= y && 
             message.y <= y + height;
    });
  }

  /**
   * 更新系统选项
   */
  updateOptions(newOptions: Partial<DanmakuSystemOptions>): void {
    Object.assign(this.options, newOptions);
    
    // 如果画布尺寸改变，重新初始化轨道
    if (newOptions.canvasWidth || newOptions.canvasHeight || newOptions.lineHeight) {
      this.initializeLanes();
    }
  }

  /**
   * 获取当前选项
   */
  getOptions(): DanmakuSystemOptions {
    return { ...this.options };
  }

  /**
   * 销毁弹幕系统
   */
  destroy(): void {
    this.clear();
    this.lanes = [];
  }
}