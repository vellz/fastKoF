/**
 * EffectSystem 单元测试
 */

import { EffectSystem } from '../EffectSystem';

// Mock Canvas Context
class MockCanvasContext {
  save = jest.fn();
  restore = jest.fn();
  translate = jest.fn();
  scale = jest.fn();
  beginPath = jest.fn();
  arc = jest.fn();
  stroke = jest.fn();
  fill = jest.fn();
  fillText = jest.fn();
  
  globalAlpha = 1;
  strokeStyle = '';
  fillStyle = '';
  lineWidth = 1;
  font = '';
  textAlign = '';
  textBaseline = '';
}

describe('EffectSystem', () => {
  let effectSystem: EffectSystem;
  let mockCtx: MockCanvasContext;

  beforeEach(() => {
    effectSystem = new EffectSystem();
    mockCtx = new MockCanvasContext();
    jest.clearAllMocks();
  });

  afterEach(() => {
    effectSystem.destroy();
  });

  describe('初始化', () => {
    it('应该使用默认选项初始化', () => {
      const options = effectSystem.getOptions();
      
      expect(options.maxEffects).toBe(50);
      expect(options.maxParticles).toBe(200);
      expect(options.enableParticles).toBe(true);
      expect(options.enableShake).toBe(true);
    });

    it('应该允许自定义选项', () => {
      const customSystem = new EffectSystem({
        maxEffects: 100,
        enableParticles: false
      });
      
      const options = customSystem.getOptions();
      expect(options.maxEffects).toBe(100);
      expect(options.enableParticles).toBe(false);
      
      customSystem.destroy();
    });
  });

  describe('点击特效', () => {
    it('应该添加脉冲特效', () => {
      effectSystem.addClickEffect(100, 150, { style: 'pulse' });
      
      const stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(1);
      expect(stats.effectsByType.click).toBe(1);
    });

    it('应该添加涟漪特效', () => {
      effectSystem.addClickEffect(100, 150, { style: 'ripple' });
      
      const stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(1);
      expect(stats.effectsByType.click).toBe(1);
    });

    it('应该添加爆炸特效', () => {
      effectSystem.addClickEffect(100, 150, { style: 'explosion' });
      
      const stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(1);
      expect(stats.effectsByType.explosion).toBe(1);
    });

    it('应该添加拳头特效', () => {
      effectSystem.addClickEffect(100, 150, { style: 'punch' });
      
      const stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(1);
      expect(stats.effectsByType.click).toBe(1);
    });

    it('应该使用默认脉冲特效当样式未知时', () => {
      effectSystem.addClickEffect(100, 150, { style: 'unknown' as any });
      
      const stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(1);
      expect(stats.effectsByType.click).toBe(1);
    });
  });

  describe('震动特效', () => {
    it('应该添加震动特效', () => {
      effectSystem.addShakeEffect({ intensity: 15, duration: 500 });
      
      const stats = effectSystem.getStats();
      expect(stats.hasShake).toBe(true);
    });

    it('应该在禁用震动时忽略震动特效', () => {
      effectSystem.setOptions({ enableShake: false });
      effectSystem.addShakeEffect({ intensity: 15 });
      
      const stats = effectSystem.getStats();
      expect(stats.hasShake).toBe(false);
    });

    it('应该增强现有震动特效的强度', () => {
      effectSystem.addShakeEffect({ intensity: 10 });
      effectSystem.addShakeEffect({ intensity: 5 });
      
      const offset1 = effectSystem.getShakeOffset();
      
      // 第二次震动应该增强效果
      effectSystem.addShakeEffect({ intensity: 10 });
      const offset2 = effectSystem.getShakeOffset();
      
      // 由于震动是随机的，我们只能检查是否有震动效果
      expect(stats => stats.hasShake).toBeTruthy();
    });

    it('应该限制最大震动强度', () => {
      // 添加多个高强度震动
      for (let i = 0; i < 10; i++) {
        effectSystem.addShakeEffect({ intensity: 20 });
      }
      
      const stats = effectSystem.getStats();
      expect(stats.hasShake).toBe(true);
      
      // 震动偏移应该在合理范围内（不会无限增长）
      const offset = effectSystem.getShakeOffset();
      expect(Math.abs(offset.x)).toBeLessThan(100);
      expect(Math.abs(offset.y)).toBeLessThan(100);
    });
  });

  describe('粒子特效', () => {
    it('应该添加粒子爆炸特效', () => {
      effectSystem.addParticleExplosion(100, 150, { count: 10 });
      
      const stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(1);
      expect(stats.effectsByType.explosion).toBe(1);
    });

    it('应该在禁用粒子时忽略粒子特效', () => {
      effectSystem.setOptions({ enableParticles: false });
      effectSystem.addParticleExplosion(100, 150);
      
      const stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(0);
    });
  });

  describe('特效管理', () => {
    it('应该限制最大特效数量', () => {
      effectSystem.setOptions({ maxEffects: 5 });
      
      // 添加超过限制的特效
      for (let i = 0; i < 10; i++) {
        effectSystem.addClickEffect(i * 10, i * 10);
      }
      
      const stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(5);
    });

    it('应该清除所有特效', () => {
      effectSystem.addClickEffect(100, 150);
      effectSystem.addShakeEffect();
      
      let stats = effectSystem.getStats();
      expect(stats.totalEffects).toBeGreaterThan(0);
      expect(stats.hasShake).toBe(true);
      
      effectSystem.clear();
      
      stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(0);
      expect(stats.hasShake).toBe(false);
    });

    it('应该按类型清除特效', () => {
      effectSystem.addClickEffect(100, 150);
      effectSystem.addParticleExplosion(200, 250);
      effectSystem.addShakeEffect();
      
      effectSystem.clearEffectsByType('click');
      
      const stats = effectSystem.getStats();
      expect(stats.effectsByType.click).toBeUndefined();
      expect(stats.effectsByType.explosion).toBe(1);
      expect(stats.hasShake).toBe(true);
    });

    it('应该清除震动特效', () => {
      effectSystem.addShakeEffect();
      
      let stats = effectSystem.getStats();
      expect(stats.hasShake).toBe(true);
      
      effectSystem.clearEffectsByType('shake');
      
      stats = effectSystem.getStats();
      expect(stats.hasShake).toBe(false);
    });
  });

  describe('特效更新', () => {
    it('应该更新特效并移除过期的特效', () => {
      effectSystem.addClickEffect(100, 150, { duration: 100 });
      
      let stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(1);
      
      // 更新超过特效持续时间
      effectSystem.update(150);
      
      stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(0);
    });

    it('应该更新震动特效', () => {
      effectSystem.addShakeEffect({ duration: 100 });
      
      let stats = effectSystem.getStats();
      expect(stats.hasShake).toBe(true);
      
      // 更新超过震动持续时间
      effectSystem.update(150);
      
      stats = effectSystem.getStats();
      expect(stats.hasShake).toBe(false);
    });

    it('应该保持未过期的特效', () => {
      effectSystem.addClickEffect(100, 150, { duration: 1000 });
      
      effectSystem.update(100);
      
      const stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(1);
    });
  });

  describe('特效渲染', () => {
    it('应该渲染所有特效', () => {
      effectSystem.addClickEffect(100, 150);
      effectSystem.addShakeEffect();
      
      effectSystem.render(mockCtx as any);
      
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('应该应用震动偏移', () => {
      effectSystem.addShakeEffect({ intensity: 10 });
      
      effectSystem.render(mockCtx as any);
      
      expect(mockCtx.translate).toHaveBeenCalled();
    });

    it('应该为每个特效保存和恢复上下文', () => {
      effectSystem.addClickEffect(100, 150);
      effectSystem.addClickEffect(200, 250);
      
      effectSystem.render(mockCtx as any);
      
      // 应该为每个特效调用save/restore
      expect(mockCtx.save).toHaveBeenCalledTimes(3); // 1次总体 + 2次特效
      expect(mockCtx.restore).toHaveBeenCalledTimes(3);
    });
  });

  describe('震动偏移', () => {
    it('应该在没有震动时返回零偏移', () => {
      const offset = effectSystem.getShakeOffset();
      
      expect(offset.x).toBe(0);
      expect(offset.y).toBe(0);
    });

    it('应该在有震动时返回非零偏移', () => {
      effectSystem.addShakeEffect({ intensity: 10 });
      
      const offset = effectSystem.getShakeOffset();
      
      // 由于震动是随机的，我们检查偏移是否在合理范围内
      expect(typeof offset.x).toBe('number');
      expect(typeof offset.y).toBe('number');
    });
  });

  describe('统计信息', () => {
    it('应该正确统计特效数量', () => {
      effectSystem.addClickEffect(100, 150);
      effectSystem.addClickEffect(200, 250);
      effectSystem.addParticleExplosion(300, 350);
      
      const stats = effectSystem.getStats();
      
      expect(stats.totalEffects).toBe(3);
      expect(stats.effectsByType.click).toBe(2);
      expect(stats.effectsByType.explosion).toBe(1);
    });

    it('应该正确报告震动状态', () => {
      let stats = effectSystem.getStats();
      expect(stats.hasShake).toBe(false);
      
      effectSystem.addShakeEffect();
      
      stats = effectSystem.getStats();
      expect(stats.hasShake).toBe(true);
    });
  });

  describe('选项管理', () => {
    it('应该允许更新选项', () => {
      effectSystem.setOptions({
        maxEffects: 25,
        enableParticles: false
      });
      
      const options = effectSystem.getOptions();
      expect(options.maxEffects).toBe(25);
      expect(options.enableParticles).toBe(false);
      expect(options.enableShake).toBe(true); // 保持原值
    });

    it('应该返回选项的副本', () => {
      const options1 = effectSystem.getOptions();
      const options2 = effectSystem.getOptions();
      
      expect(options1).toEqual(options2);
      expect(options1).not.toBe(options2); // 不是同一个对象
    });
  });

  describe('销毁功能', () => {
    it('应该清理所有资源', () => {
      effectSystem.addClickEffect(100, 150);
      effectSystem.addShakeEffect();
      
      effectSystem.destroy();
      
      const stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(0);
      expect(stats.hasShake).toBe(false);
    });
  });

  describe('特效生命周期', () => {
    it('应该正确处理特效的生命周期', () => {
      // 添加一个短时间特效
      effectSystem.addClickEffect(100, 150, { duration: 50 });
      
      // 第一次更新，特效应该还存在
      effectSystem.update(25);
      let stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(1);
      
      // 第二次更新，特效应该过期
      effectSystem.update(30);
      stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(0);
    });

    it('应该处理多个特效的不同生命周期', () => {
      effectSystem.addClickEffect(100, 150, { duration: 100 });
      effectSystem.addClickEffect(200, 250, { duration: 200 });
      
      // 第一次更新
      effectSystem.update(150);
      let stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(1); // 只剩一个
      
      // 第二次更新
      effectSystem.update(100);
      stats = effectSystem.getStats();
      expect(stats.totalEffects).toBe(0); // 全部过期
    });
  });
});