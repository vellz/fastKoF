/**
 * DanmakuAnimations 单元测试
 */

import { 
  DanmakuAnimations, 
  DanmakuStyleRenderer, 
  DanmakuAnimationPresets,
  EasingFunctions 
} from '../DanmakuAnimations';
import type { DanmakuMessage } from '@/types/game.types';

// Mock Canvas Context
class MockCanvasContext {
  save = jest.fn();
  restore = jest.fn();
  fillText = jest.fn();
  strokeText = jest.fn();
  createLinearGradient = jest.fn(() => ({
    addColorStop: jest.fn()
  }));
  createRadialGradient = jest.fn(() => ({
    addColorStop: jest.fn()
  }));
  measureText = jest.fn(() => ({ width: 100 }));
  
  globalAlpha = 1;
  font = '';
  fillStyle = '';
  strokeStyle = '';
  textAlign = '';
  textBaseline = '';
  lineWidth = 1;
  shadowColor = '';
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;
}

describe('EasingFunctions', () => {
  it('应该提供线性缓动', () => {
    expect(EasingFunctions.linear(0)).toBe(0);
    expect(EasingFunctions.linear(0.5)).toBe(0.5);
    expect(EasingFunctions.linear(1)).toBe(1);
  });

  it('应该提供缓入缓动', () => {
    expect(EasingFunctions.easeIn(0)).toBe(0);
    expect(EasingFunctions.easeIn(1)).toBe(1);
    expect(EasingFunctions.easeIn(0.5)).toBeLessThan(0.5);
  });

  it('应该提供缓出缓动', () => {
    expect(EasingFunctions.easeOut(0)).toBe(0);
    expect(EasingFunctions.easeOut(1)).toBe(1);
    expect(EasingFunctions.easeOut(0.5)).toBeGreaterThan(0.5);
  });

  it('应该提供缓入缓出缓动', () => {
    expect(EasingFunctions.easeInOut(0)).toBe(0);
    expect(EasingFunctions.easeInOut(1)).toBe(1);
    expect(EasingFunctions.easeInOut(0.5)).toBe(0.5);
  });

  it('应该提供弹跳缓动', () => {
    expect(EasingFunctions.bounce(0)).toBe(0);
    expect(EasingFunctions.bounce(1)).toBeCloseTo(1, 5);
    expect(EasingFunctions.bounce(0.5)).toBeGreaterThan(0);
  });
});

describe('DanmakuAnimations', () => {
  let animationManager: DanmakuAnimations;
  let mockMessage: DanmakuMessage;

  beforeEach(() => {
    animationManager = new DanmakuAnimations();
    mockMessage = {
      id: 'test-message-1',
      text: '测试弹幕',
      x: 100,
      y: 50,
      speed: 2,
      color: '#ff0000',
      fontSize: 16,
      opacity: 1,
      createdAt: Date.now()
    };
    jest.clearAllMocks();
  });

  afterEach(() => {
    animationManager.clear();
  });

  describe('动画添加和管理', () => {
    it('应该成功添加动画', () => {
      const animationConfig = {
        type: 'bounce' as const,
        duration: 1000,
        amplitude: 20
      };

      const animatedMessage = animationManager.addAnimation(mockMessage, animationConfig);

      expect(animatedMessage).toBeTruthy();
      expect(animatedMessage.animation).toEqual(animationConfig);
      expect(animatedMessage.originalY).toBe(mockMessage.y);
      expect(animatedMessage.originalFontSize).toBe(mockMessage.fontSize);
      expect(animatedMessage.originalColor).toBe(mockMessage.color);
    });

    it('应该能够获取动画消息', () => {
      const animationConfig = {
        type: 'wave' as const,
        duration: 2000
      };

      animationManager.addAnimation(mockMessage, animationConfig);
      const retrieved = animationManager.getAnimatedMessage(mockMessage.id);

      expect(retrieved).toBeTruthy();
      expect(retrieved!.id).toBe(mockMessage.id);
      expect(retrieved!.animation).toEqual(animationConfig);
    });

    it('应该能够移除动画', () => {
      const animationConfig = {
        type: 'fade' as const,
        duration: 1000
      };

      animationManager.addAnimation(mockMessage, animationConfig);
      expect(animationManager.getAnimatedMessage(mockMessage.id)).toBeTruthy();

      animationManager.removeAnimation(mockMessage.id);
      expect(animationManager.getAnimatedMessage(mockMessage.id)).toBeUndefined();
    });

    it('应该能够清除所有动画', () => {
      const animationConfig = {
        type: 'scale' as const,
        duration: 1000
      };

      animationManager.addAnimation(mockMessage, animationConfig);
      animationManager.addAnimation({...mockMessage, id: 'test-2'}, animationConfig);

      animationManager.clear();

      expect(animationManager.getAnimatedMessage(mockMessage.id)).toBeUndefined();
      expect(animationManager.getAnimatedMessage('test-2')).toBeUndefined();
    });
  });

  describe('动画更新', () => {
    it('应该更新弹跳动画', () => {
      const animationConfig = {
        type: 'bounce' as const,
        duration: 1000,
        amplitude: 20
      };

      const animatedMessage = animationManager.addAnimation(mockMessage, animationConfig);
      const originalY = animatedMessage.originalY!;

      // 模拟时间流逝
      animationManager.updateAnimations(500); // 50% 进度

      expect(animatedMessage.y).not.toBe(originalY);
    });

    it('应该更新波浪动画', () => {
      const animationConfig = {
        type: 'wave' as const,
        duration: 2000,
        amplitude: 15,
        frequency: 2
      };

      const animatedMessage = animationManager.addAnimation(mockMessage, animationConfig);
      const originalY = animatedMessage.originalY!;

      animationManager.updateAnimations(500);

      expect(animatedMessage.y).not.toBe(originalY);
    });

    it('应该更新淡入淡出动画', () => {
      const animationConfig = {
        type: 'fade' as const,
        duration: 1000
      };

      const animatedMessage = animationManager.addAnimation(mockMessage, animationConfig);

      // 测试淡入阶段
      animationManager.updateAnimations(250); // 25% 进度
      expect(animatedMessage.opacity).toBeLessThan(1);

      // 测试淡出阶段
      animationManager.updateAnimations(500); // 75% 总进度
      expect(animatedMessage.opacity).toBeLessThan(1);
    });

    it('应该更新缩放动画', () => {
      const animationConfig = {
        type: 'scale' as const,
        duration: 1000,
        amplitude: 1.5
      };

      const animatedMessage = animationManager.addAnimation(mockMessage, animationConfig);
      const originalFontSize = animatedMessage.originalFontSize!;

      animationManager.updateAnimations(500); // 50% 进度

      expect(animatedMessage.fontSize).not.toBe(originalFontSize);
    });

    it('应该更新彩虹动画', () => {
      const animationConfig = {
        type: 'rainbow' as const,
        duration: 3000
      };

      const animatedMessage = animationManager.addAnimation(mockMessage, animationConfig);
      const originalColor = animatedMessage.originalColor!;

      animationManager.updateAnimations(1000); // 33% 进度

      expect(animatedMessage.color).not.toBe(originalColor);
      expect(animatedMessage.color).toMatch(/^hsl\(\d+, 70%, 60%\)$/);
    });

    it('应该更新震动动画', () => {
      const animationConfig = {
        type: 'shake' as const,
        duration: 500,
        amplitude: 5,
        frequency: 20
      };

      const animatedMessage = animationManager.addAnimation(mockMessage, animationConfig);
      const originalX = animatedMessage.x;
      const originalY = animatedMessage.originalY!;

      animationManager.updateAnimations(100);

      // 震动会改变位置
      expect(animatedMessage.x !== originalX || animatedMessage.y !== originalY).toBe(true);
    });

    it('应该在动画完成后移除非循环动画', () => {
      const animationConfig = {
        type: 'bounce' as const,
        duration: 100
      };

      animationManager.addAnimation(mockMessage, animationConfig);
      
      // 超过动画持续时间
      animationManager.updateAnimations(150);

      expect(animationManager.getAnimatedMessage(mockMessage.id)).toBeUndefined();
    });

    it('应该保持循环动画（如彩虹和震动）', () => {
      const animationConfig = {
        type: 'rainbow' as const,
        duration: 100
      };

      animationManager.addAnimation(mockMessage, animationConfig);
      
      // 超过动画持续时间
      animationManager.updateAnimations(150);

      expect(animationManager.getAnimatedMessage(mockMessage.id)).toBeTruthy();
    });
  });
});

describe('DanmakuStyleRenderer', () => {
  let mockCtx: MockCanvasContext;
  let mockAnimatedMessage: any;

  beforeEach(() => {
    mockCtx = new MockCanvasContext();
    mockAnimatedMessage = {
      id: 'test-message',
      text: '样式测试',
      x: 100,
      y: 50,
      speed: 2,
      color: '#ff0000',
      fontSize: 16,
      opacity: 1,
      createdAt: Date.now(),
      style: {}
    };
    jest.clearAllMocks();
  });

  describe('样式渲染', () => {
    it('应该渲染基本样式', () => {
      mockAnimatedMessage.style = {
        fontFamily: 'Arial',
        fontWeight: 'bold'
      };

      DanmakuStyleRenderer.renderStyledDanmaku(mockCtx as any, mockAnimatedMessage);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalledWith('样式测试', 100, 50);
      expect(mockCtx.strokeText).toHaveBeenCalledWith('样式测试', 100, 50);
    });

    it('应该应用发光效果', () => {
      mockAnimatedMessage.style = {
        glow: {
          color: '#00ffff',
          blur: 10,
          intensity: 3
        }
      };

      DanmakuStyleRenderer.renderStyledDanmaku(mockCtx as any, mockAnimatedMessage);

      expect(mockCtx.shadowColor).toBe('#00ffff');
      expect(mockCtx.shadowBlur).toBe(10);
      expect(mockCtx.strokeText).toHaveBeenCalledTimes(3); // intensity = 3
    });

    it('应该应用渐变效果', () => {
      mockAnimatedMessage.style = {
        gradient: {
          colors: ['#ff0000', '#00ff00', '#0000ff'],
          direction: 'horizontal'
        }
      };

      DanmakuStyleRenderer.renderStyledDanmaku(mockCtx as any, mockAnimatedMessage);

      expect(mockCtx.createLinearGradient).toHaveBeenCalled();
    });

    it('应该应用径向渐变', () => {
      mockAnimatedMessage.style = {
        gradient: {
          colors: ['#ff0000', '#00ff00'],
          direction: 'radial'
        }
      };

      DanmakuStyleRenderer.renderStyledDanmaku(mockCtx as any, mockAnimatedMessage);

      expect(mockCtx.createRadialGradient).toHaveBeenCalled();
    });

    it('应该设置自定义描边', () => {
      mockAnimatedMessage.style = {
        strokeWidth: 3,
        strokeColor: '#000000'
      };

      DanmakuStyleRenderer.renderStyledDanmaku(mockCtx as any, mockAnimatedMessage);

      expect(mockCtx.strokeStyle).toBe('#000000');
      expect(mockCtx.lineWidth).toBe(3);
    });
  });

  describe('预设样式', () => {
    it('应该创建霓虹灯样式', () => {
      const style = DanmakuStyleRenderer.createPresetStyle('neon');

      expect(style.fontFamily).toContain('Arial Black');
      expect(style.glow).toBeTruthy();
      expect(style.glow!.color).toBe('#00ffff');
    });

    it('应该创建火焰样式', () => {
      const style = DanmakuStyleRenderer.createPresetStyle('fire');

      expect(style.fontFamily).toContain('Impact');
      expect(style.gradient).toBeTruthy();
      expect(style.gradient!.colors).toContain('#ff4500');
    });

    it('应该创建冰霜样式', () => {
      const style = DanmakuStyleRenderer.createPresetStyle('ice');

      expect(style.gradient).toBeTruthy();
      expect(style.gradient!.colors).toContain('#87ceeb');
      expect(style.strokeColor).toBe('#4682b4');
    });

    it('应该创建彩虹样式', () => {
      const style = DanmakuStyleRenderer.createPresetStyle('rainbow');

      expect(style.fontFamily).toContain('Comic Sans MS');
      expect(style.textShadow).toBeTruthy();
    });

    it('应该创建复古样式', () => {
      const style = DanmakuStyleRenderer.createPresetStyle('retro');

      expect(style.fontFamily).toContain('Courier New');
      expect(style.glow!.color).toBe('#00ff00');
    });

    it('应该返回默认样式当预设不存在时', () => {
      const style = DanmakuStyleRenderer.createPresetStyle('unknown');

      expect(style.fontFamily).toContain('Arial');
      expect(style.fontWeight).toBe('bold');
    });
  });
});

describe('DanmakuAnimationPresets', () => {
  it('应该获取弹跳预设', () => {
    const preset = DanmakuAnimationPresets.getPreset('bounce');

    expect(preset.type).toBe('bounce');
    expect(preset.duration).toBe(800);
    expect(preset.amplitude).toBe(20);
    expect(preset.easing).toBe('easeOut');
  });

  it('应该获取波浪预设', () => {
    const preset = DanmakuAnimationPresets.getPreset('wave');

    expect(preset.type).toBe('wave');
    expect(preset.duration).toBe(2000);
    expect(preset.amplitude).toBe(15);
    expect(preset.frequency).toBe(3);
  });

  it('应该获取脉冲预设', () => {
    const preset = DanmakuAnimationPresets.getPreset('pulse');

    expect(preset.type).toBe('scale');
    expect(preset.amplitude).toBe(1.3);
    expect(preset.easing).toBe('easeInOut');
  });

  it('应该获取彩虹预设', () => {
    const preset = DanmakuAnimationPresets.getPreset('rainbow');

    expect(preset.type).toBe('rainbow');
    expect(preset.duration).toBe(3000);
  });

  it('应该获取震动预设', () => {
    const preset = DanmakuAnimationPresets.getPreset('shake');

    expect(preset.type).toBe('shake');
    expect(preset.duration).toBe(500);
    expect(preset.amplitude).toBe(5);
    expect(preset.frequency).toBe(30);
  });

  it('应该获取淡入淡出预设', () => {
    const preset = DanmakuAnimationPresets.getPreset('fadeInOut');

    expect(preset.type).toBe('fade');
    expect(preset.duration).toBe(2000);
    expect(preset.easing).toBe('easeInOut');
  });

  it('应该返回默认预设当名称不存在时', () => {
    const preset = DanmakuAnimationPresets.getPreset('unknown');

    expect(preset.type).toBe('linear');
    expect(preset.duration).toBe(1000);
    expect(preset.easing).toBe('linear');
  });

  it('应该返回所有预设名称', () => {
    const presets = DanmakuAnimationPresets.getAllPresets();

    expect(presets).toContain('bounce');
    expect(presets).toContain('wave');
    expect(presets).toContain('pulse');
    expect(presets).toContain('rainbow');
    expect(presets).toContain('shake');
    expect(presets).toContain('fadeInOut');
  });
});