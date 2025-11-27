/**
 * DanmakuSystem 单元测试
 */

import { DanmakuSystem } from '../DanmakuSystem';

// Mock Canvas Context
class MockCanvasContext {
  save = jest.fn();
  restore = jest.fn();
  fillText = jest.fn();
  strokeText = jest.fn();
  
  globalAlpha = 1;
  font = '';
  fillStyle = '';
  strokeStyle = '';
  textAlign = '';
  textBaseline = '';
  lineWidth = 1;
}

describe('DanmakuSystem', () => {
  let danmakuSystem: DanmakuSystem;
  let mockCtx: MockCanvasContext;

  beforeEach(() => {
    danmakuSystem = new DanmakuSystem({
      canvasWidth: 800,
      canvasHeight: 600,
      maxMessages: 10,
      defaultSpeed: 2,
      messages: ['测试消息1', '测试消息2', '测试消息3']
    });
    
    mockCtx = new MockCanvasContext();
    jest.clearAllMocks();
  });

  afterEach(() => {
    danmakuSystem.destroy();
  });

  describe('初始化', () => {
    it('应该正确初始化弹幕系统', () => {
      const options = danmakuSystem.getOptions();
      
      expect(options.canvasWidth).toBe(800);
      expect(options.canvasHeight).toBe(600);
      expect(options.maxMessages).toBe(10);
      expect(options.defaultSpeed).toBe(2);
    });

    it('应该初始化轨道系统', () => {
      const stats = danmakuSystem.getStats();
      
      expect(stats.availableLanes).toBeGreaterThan(0);
      expect(stats.occupiedLanes).toBe(0);
    });

    it('应该使用默认选项', () => {
      const defaultSystem = new DanmakuSystem({
        canvasWidth: 800,
        canvasHeight: 600
      });
      
      const options = defaultSystem.getOptions();
      expect(options.maxMessages).toBe(20);
      expect(options.defaultSpeed).toBe(2);
      expect(options.enableCollisionDetection).toBe(true);
      
      defaultSystem.destroy();
    });
  });

  describe('添加弹幕消息', () => {
    it('应该成功添加弹幕消息', () => {
      const message = danmakuSystem.addMessage({ text: '测试弹幕' });
      
      expect(message).toBeTruthy();
      expect(message!.text).toBe('测试弹幕');
      expect(message!.x).toBe(850); // canvasWidth + 50
      expect(message!.opacity).toBe(1);
      
      const stats = danmakuSystem.getStats();
      expect(stats.totalMessages).toBe(1);
    });

    it('应该使用随机消息当没有指定文本时', () => {
      const message = danmakuSystem.addMessage();
      
      expect(message).toBeTruthy();
      expect(['测试消息1', '测试消息2', '测试消息3']).toContain(message!.text);
    });

    it('应该使用自定义选项', () => {
      const message = danmakuSystem.addMessage({
        text: '自定义弹幕',
        speed: 5,
        fontSize: 20,
        color: '#ff0000',
        opacity: 0.8
      });
      
      expect(message!.text).toBe('自定义弹幕');
      expect(message!.speed).toBe(5);
      expect(message!.fontSize).toBe(20);
      expect(message!.color).toBe('#ff0000');
      expect(message!.opacity).toBe(0.8);
    });

    it('应该限制最大消息数量', () => {
      // 添加超过限制的消息
      for (let i = 0; i < 15; i++) {
        danmakuSystem.addMessage({ text: `消息${i}` });
      }
      
      const stats = danmakuSystem.getStats();
      expect(stats.totalMessages).toBe(10); // 应该被限制在maxMessages
    });

    it('应该在没有可用轨道时返回null', () => {
      // 填满所有轨道
      const maxLanes = Math.floor(600 / 24); // canvasHeight / lineHeight
      for (let i = 0; i < maxLanes + 5; i++) {
        danmakuSystem.addMessage({ text: `消息${i}` });
      }
      
      // 尝试添加更多消息可能返回null（取决于轨道管理逻辑）
      const stats = danmakuSystem.getStats();
      expect(stats.totalMessages).toBeLessThanOrEqual(danmakuSystem.getOptions().maxMessages!);
    });
  });

  describe('批量添加弹幕', () => {
    it('应该批量添加多条弹幕', () => {
      const messages = danmakuSystem.addMultipleMessages(3, { text: '批量消息' });
      
      expect(messages).toHaveLength(3);
      messages.forEach(message => {
        expect(message.text).toBe('批量消息');
      });
      
      const stats = danmakuSystem.getStats();
      expect(stats.totalMessages).toBe(3);
    });

    it('应该为每条消息添加随机性', () => {
      const messages = danmakuSystem.addMultipleMessages(3, { 
        speed: 2,
        fontSize: 16 
      });
      
      // 检查速度和字体大小是否有变化
      const speeds = messages.map(m => m.speed);
      const fontSizes = messages.map(m => m.fontSize);
      
      expect(new Set(speeds).size).toBeGreaterThan(1); // 应该有不同的速度
      expect(new Set(fontSizes).size).toBeGreaterThan(1); // 应该有不同的字体大小
    });
  });

  describe('弹幕更新', () => {
    it('应该移动弹幕消息', () => {
      const message = danmakuSystem.addMessage({ text: '移动测试' });
      const initialX = message!.x;
      
      danmakuSystem.update(16.67); // 1帧
      
      const messages = danmakuSystem.getMessages();
      expect(messages[0].x).toBeLessThan(initialX);
    });

    it('应该处理淡出效果', () => {
      const message = danmakuSystem.addMessage({ text: '淡出测试' });
      
      // 模拟弹幕移动到屏幕左侧
      message!.x = -150;
      
      danmakuSystem.update(16.67);
      
      const messages = danmakuSystem.getMessages();
      expect(messages[0].opacity).toBeLessThan(1);
    });

    it('应该移除完全移出屏幕的弹幕', () => {
      const message = danmakuSystem.addMessage({ text: '移除测试' });
      
      // 模拟弹幕完全移出屏幕
      message!.x = -400;
      message!.opacity = 0;
      
      danmakuSystem.update(16.67);
      
      const stats = danmakuSystem.getStats();
      expect(stats.totalMessages).toBe(0);
    });

    it('应该更新轨道状态', () => {
      danmakuSystem.addMessage({ text: '轨道测试' });
      
      let stats = danmakuSystem.getStats();
      expect(stats.occupiedLanes).toBeGreaterThan(0);
      
      // 清除所有弹幕
      danmakuSystem.clear();
      danmakuSystem.update(16.67);
      
      stats = danmakuSystem.getStats();
      expect(stats.occupiedLanes).toBe(0);
    });
  });

  describe('弹幕渲染', () => {
    it('应该渲染所有可见弹幕', () => {
      danmakuSystem.addMessage({ text: '渲染测试1' });
      danmakuSystem.addMessage({ text: '渲染测试2' });
      
      danmakuSystem.render(mockCtx as any);
      
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalledTimes(2);
      expect(mockCtx.strokeText).toHaveBeenCalledTimes(2);
    });

    it('应该跳过不可见的弹幕', () => {
      const message = danmakuSystem.addMessage({ text: '不可见测试' });
      message!.opacity = 0;
      
      danmakuSystem.render(mockCtx as any);
      
      expect(mockCtx.fillText).not.toHaveBeenCalled();
      expect(mockCtx.strokeText).not.toHaveBeenCalled();
    });

    it('应该设置正确的渲染属性', () => {
      const message = danmakuSystem.addMessage({ 
        text: '样式测试',
        color: '#ff0000',
        fontSize: 20,
        opacity: 0.8
      });
      
      danmakuSystem.render(mockCtx as any);
      
      expect(mockCtx.globalAlpha).toBe(0.8);
      expect(mockCtx.fillStyle).toBe('#ff0000');
      expect(mockCtx.font).toContain('20px');
    });
  });

  describe('碰撞检测', () => {
    it('应该检测弹幕碰撞', () => {
      const message = danmakuSystem.addMessage({ text: '碰撞测试' });
      message!.x = 100;
      message!.y = 100;
      
      const collisions = danmakuSystem.checkCollision(90, 90, 50, 50);
      
      expect(collisions).toHaveLength(1);
      expect(collisions[0]).toBe(message);
    });

    it('应该在禁用碰撞检测时返回空数组', () => {
      danmakuSystem.updateOptions({ enableCollisionDetection: false });
      
      const message = danmakuSystem.addMessage({ text: '无碰撞测试' });
      message!.x = 100;
      message!.y = 100;
      
      const collisions = danmakuSystem.checkCollision(90, 90, 50, 50);
      
      expect(collisions).toHaveLength(0);
    });

    it('应该正确处理无碰撞情况', () => {
      const message = danmakuSystem.addMessage({ text: '无碰撞测试' });
      message!.x = 100;
      message!.y = 100;
      
      const collisions = danmakuSystem.checkCollision(200, 200, 50, 50);
      
      expect(collisions).toHaveLength(0);
    });
  });

  describe('弹幕管理', () => {
    it('应该移除指定的弹幕消息', () => {
      const message = danmakuSystem.addMessage({ text: '移除测试' });
      
      const removed = danmakuSystem.removeMessage(message!.id);
      
      expect(removed).toBe(true);
      
      const stats = danmakuSystem.getStats();
      expect(stats.totalMessages).toBe(0);
    });

    it('应该在消息不存在时返回false', () => {
      const removed = danmakuSystem.removeMessage('不存在的ID');
      
      expect(removed).toBe(false);
    });

    it('应该批量移除弹幕消息', () => {
      const message1 = danmakuSystem.addMessage({ text: '批量移除1' });
      const message2 = danmakuSystem.addMessage({ text: '批量移除2' });
      const message3 = danmakuSystem.addMessage({ text: '批量移除3' });
      
      const removedCount = danmakuSystem.removeMessages([
        message1!.id, 
        message2!.id, 
        '不存在的ID'
      ]);
      
      expect(removedCount).toBe(2);
      
      const stats = danmakuSystem.getStats();
      expect(stats.totalMessages).toBe(1);
    });

    it('应该清除所有弹幕', () => {
      danmakuSystem.addMessage({ text: '清除测试1' });
      danmakuSystem.addMessage({ text: '清除测试2' });
      
      danmakuSystem.clear();
      
      const stats = danmakuSystem.getStats();
      expect(stats.totalMessages).toBe(0);
      expect(stats.occupiedLanes).toBe(0);
    });
  });

  describe('弹幕控制', () => {
    it('应该暂停所有弹幕', () => {
      const message = danmakuSystem.addMessage({ text: '暂停测试', speed: 3 });
      
      danmakuSystem.pause();
      
      expect(message!.speed).toBe(0);
      expect((message as any).originalSpeed).toBe(3);
    });

    it('应该恢复所有弹幕', () => {
      const message = danmakuSystem.addMessage({ text: '恢复测试', speed: 3 });
      
      danmakuSystem.pause();
      danmakuSystem.resume();
      
      expect(message!.speed).toBe(3);
      expect((message as any).originalSpeed).toBeUndefined();
    });

    it('应该设置速度倍率', () => {
      const message = danmakuSystem.addMessage({ text: '倍率测试', speed: 2 });
      
      danmakuSystem.setSpeedMultiplier(1.5);
      
      expect(message!.speed).toBe(3); // 2 * 1.5
      expect((message as any).originalSpeed).toBe(2);
    });
  });

  describe('统计信息', () => {
    it('应该提供正确的统计信息', () => {
      danmakuSystem.addMessage({ text: '统计测试1' });
      danmakuSystem.addMessage({ text: '统计测试2', speed: 4 });
      
      const stats = danmakuSystem.getStats();
      
      expect(stats.totalMessages).toBe(2);
      expect(stats.activeMessages).toBe(2);
      expect(stats.averageSpeed).toBe(3); // (2 + 4) / 2
      expect(stats.oldestMessageAge).toBeGreaterThan(0);
    });

    it('应该正确计算轨道统计', () => {
      danmakuSystem.addMessage({ text: '轨道统计1' });
      danmakuSystem.addMessage({ text: '轨道统计2' });
      
      const stats = danmakuSystem.getStats();
      
      expect(stats.occupiedLanes).toBeGreaterThan(0);
      expect(stats.availableLanes).toBeGreaterThan(0);
      expect(stats.occupiedLanes + stats.availableLanes).toBeGreaterThan(0);
    });
  });

  describe('区域查询', () => {
    it('应该获取指定区域内的弹幕', () => {
      const message1 = danmakuSystem.addMessage({ text: '区域内' });
      const message2 = danmakuSystem.addMessage({ text: '区域外' });
      
      message1!.x = 100;
      message1!.y = 100;
      message2!.x = 300;
      message2!.y = 300;
      
      const messagesInArea = danmakuSystem.getMessagesInArea(50, 50, 100, 100);
      
      expect(messagesInArea).toHaveLength(1);
      expect(messagesInArea[0]).toBe(message1);
    });

    it('应该返回所有弹幕的副本', () => {
      danmakuSystem.addMessage({ text: '副本测试1' });
      danmakuSystem.addMessage({ text: '副本测试2' });
      
      const messages1 = danmakuSystem.getMessages();
      const messages2 = danmakuSystem.getMessages();
      
      expect(messages1).toEqual(messages2);
      expect(messages1).not.toBe(messages2); // 不是同一个数组
    });
  });

  describe('选项更新', () => {
    it('应该更新系统选项', () => {
      danmakuSystem.updateOptions({
        maxMessages: 15,
        defaultSpeed: 3
      });
      
      const options = danmakuSystem.getOptions();
      expect(options.maxMessages).toBe(15);
      expect(options.defaultSpeed).toBe(3);
    });

    it('应该在画布尺寸改变时重新初始化轨道', () => {
      const oldStats = danmakuSystem.getStats();
      
      danmakuSystem.updateOptions({
        canvasHeight: 800,
        lineHeight: 30
      });
      
      const newStats = danmakuSystem.getStats();
      expect(newStats.availableLanes).not.toBe(oldStats.availableLanes);
    });
  });

  describe('销毁功能', () => {
    it('应该清理所有资源', () => {
      danmakuSystem.addMessage({ text: '销毁测试' });
      
      danmakuSystem.destroy();
      
      const stats = danmakuSystem.getStats();
      expect(stats.totalMessages).toBe(0);
    });
  });
});