/**
 * InteractionManager 单元测试
 */

import { InteractionManager } from '../InteractionManager';

// Mock DeviceDetector
jest.mock('@/utils/DeviceDetector', () => ({
  DeviceDetector: {
    getDeviceInfo: jest.fn(() => ({
      isMobile: false,
      isTablet: false,
      supportsTouch: true,
      supportsVibration: true,
      pixelRatio: 1,
      screenWidth: 1920,
      screenHeight: 1080
    })),
    vibrate: jest.fn()
  }
}));

// Mock Canvas
class MockCanvas {
  width = 800;
  height = 600;
  style: any = {};
  
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  getBoundingClientRect = jest.fn(() => ({
    left: 0,
    top: 0,
    width: 800,
    height: 600,
    right: 800,
    bottom: 600
  }));
}

// Mock window methods
Object.defineProperty(window, 'setTimeout', {
  value: jest.fn((callback, delay) => {
    const id = Math.random();
    setTimeout(() => callback(), delay);
    return id;
  })
});

Object.defineProperty(window, 'clearTimeout', {
  value: jest.fn()
});

describe('InteractionManager', () => {
  let canvas: MockCanvas;
  let interactionManager: InteractionManager;
  let mockOnClickEvent: jest.Mock;
  let mockOnComboChange: jest.Mock;

  beforeEach(() => {
    canvas = new MockCanvas();
    mockOnClickEvent = jest.fn();
    mockOnComboChange = jest.fn();
    
    interactionManager = new InteractionManager({
      canvas: canvas as any,
      onClickEvent: mockOnClickEvent,
      onComboChange: mockOnComboChange,
      enableVibration: true,
      clickCooldown: 50
    });
    
    jest.clearAllMocks();
  });

  afterEach(() => {
    interactionManager.destroy();
  });

  describe('初始化', () => {
    it('应该正确绑定事件监听器', () => {
      expect(canvas.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(canvas.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(canvas.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(canvas.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: false });
      expect(canvas.addEventListener).toHaveBeenCalledWith('touchend', expect.any(Function), { passive: false });
      expect(canvas.addEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: false });
      expect(canvas.addEventListener).toHaveBeenCalledWith('contextmenu', expect.any(Function));
    });

    it('应该设置Canvas样式属性', () => {
      expect(canvas.style.touchAction).toBe('none');
      expect(canvas.style.userSelect).toBe('none');
      expect(canvas.style.webkitUserSelect).toBe('none');
      expect(canvas.style.cursor).toBe('crosshair');
    });
  });

  describe('鼠标事件处理', () => {
    it('应该处理鼠标点击事件', () => {
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 150
      });
      
      // 模拟事件处理
      const handler = canvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1];
      
      handler(mouseEvent);
      
      expect(mockOnClickEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 100,
          y: 150,
          timestamp: expect.any(Number),
          force: 1
        })
      );
    });

    it('应该阻止默认的鼠标事件行为', () => {
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 150
      });
      mouseEvent.preventDefault = jest.fn();
      
      const handler = canvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1];
      
      handler(mouseEvent);
      
      expect(mouseEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('触摸事件处理', () => {
    it('应该处理触摸开始事件', () => {
      const touchEvent = {
        preventDefault: jest.fn(),
        changedTouches: [{
          identifier: 1,
          clientX: 200,
          clientY: 250,
          force: 0.8
        }]
      };
      
      const handler = canvas.addEventListener.mock.calls.find(
        call => call[0] === 'touchstart'
      )[1];
      
      handler(touchEvent);
      
      expect(touchEvent.preventDefault).toHaveBeenCalled();
      expect(mockOnClickEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 200,
          y: 250,
          timestamp: expect.any(Number),
          force: 0.8
        })
      );
    });

    it('应该跟踪活跃的触摸点', () => {
      const touchEvent = {
        preventDefault: jest.fn(),
        changedTouches: [{
          identifier: 1,
          clientX: 200,
          clientY: 250
        }]
      };
      
      const startHandler = canvas.addEventListener.mock.calls.find(
        call => call[0] === 'touchstart'
      )[1];
      
      startHandler(touchEvent);
      
      const activeTouches = interactionManager.getActiveTouches();
      expect(activeTouches).toHaveLength(1);
      expect(activeTouches[0]).toMatchObject({
        id: 1,
        x: 200,
        y: 250
      });
    });

    it('应该在触摸结束时清理触摸点', () => {
      // 先添加触摸点
      const startEvent = {
        preventDefault: jest.fn(),
        changedTouches: [{
          identifier: 1,
          clientX: 200,
          clientY: 250
        }]
      };
      
      const startHandler = canvas.addEventListener.mock.calls.find(
        call => call[0] === 'touchstart'
      )[1];
      
      startHandler(startEvent);
      
      // 然后结束触摸
      const endEvent = {
        preventDefault: jest.fn(),
        changedTouches: [{
          identifier: 1
        }]
      };
      
      const endHandler = canvas.addEventListener.mock.calls.find(
        call => call[0] === 'touchend'
      )[1];
      
      endHandler(endEvent);
      
      const activeTouches = interactionManager.getActiveTouches();
      expect(activeTouches).toHaveLength(0);
    });
  });

  describe('连击系统', () => {
    it('应该正确计算连击数', () => {
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 150
      });
      
      const handler = canvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1];
      
      // 快速连续点击
      handler(mouseEvent);
      handler(mouseEvent);
      handler(mouseEvent);
      
      expect(mockOnComboChange).toHaveBeenLastCalledWith(3);
    });

    it('应该在连击窗口结束后重置连击数', (done) => {
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 150
      });
      
      const handler = canvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1];
      
      handler(mouseEvent);
      
      // 等待连击窗口结束
      setTimeout(() => {
        expect(mockOnComboChange).toHaveBeenCalledWith(0);
        done();
      }, 1100);
    });
  });

  describe('点击冷却系统', () => {
    it('应该在冷却期间忽略点击', () => {
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 150
      });
      
      const handler = canvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1];
      
      // 第一次点击
      handler(mouseEvent);
      expect(mockOnClickEvent).toHaveBeenCalledTimes(1);
      
      // 立即再次点击（应该被忽略）
      handler(mouseEvent);
      expect(mockOnClickEvent).toHaveBeenCalledTimes(1);
    });

    it('应该允许设置冷却时间', () => {
      interactionManager.setClickCooldown(100);
      
      // 测试新的冷却时间是否生效
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 150
      });
      
      const handler = canvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1];
      
      handler(mouseEvent);
      handler(mouseEvent); // 应该被冷却阻止
      
      expect(mockOnClickEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('区域检测', () => {
    it('应该正确检测矩形区域内的点击', () => {
      const clickEvent = {
        x: 150,
        y: 200,
        timestamp: Date.now(),
        force: 1
      };
      
      const area = { x: 100, y: 150, width: 100, height: 100 };
      
      const isInArea = interactionManager.isClickInArea(clickEvent, area);
      expect(isInArea).toBe(true);
    });

    it('应该正确检测矩形区域外的点击', () => {
      const clickEvent = {
        x: 50,
        y: 100,
        timestamp: Date.now(),
        force: 1
      };
      
      const area = { x: 100, y: 150, width: 100, height: 100 };
      
      const isInArea = interactionManager.isClickInArea(clickEvent, area);
      expect(isInArea).toBe(false);
    });

    it('应该正确检测圆形区域内的点击', () => {
      const clickEvent = {
        x: 110,
        y: 110,
        timestamp: Date.now(),
        force: 1
      };
      
      const center = { x: 100, y: 100 };
      const radius = 20;
      
      const isInCircle = interactionManager.isClickInCircle(clickEvent, center, radius);
      expect(isInCircle).toBe(true);
    });

    it('应该正确检测圆形区域外的点击', () => {
      const clickEvent = {
        x: 150,
        y: 150,
        timestamp: Date.now(),
        force: 1
      };
      
      const center = { x: 100, y: 100 };
      const radius = 20;
      
      const isInCircle = interactionManager.isClickInCircle(clickEvent, center, radius);
      expect(isInCircle).toBe(false);
    });
  });

  describe('统计信息', () => {
    it('应该正确跟踪点击统计', () => {
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 150
      });
      
      const handler = canvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1];
      
      handler(mouseEvent);
      handler(mouseEvent);
      handler(mouseEvent);
      
      const stats = interactionManager.getClickStats();
      expect(stats.totalClicks).toBe(3);
      expect(stats.currentCombo).toBe(3);
      expect(stats.lastClickTime).toBeGreaterThan(0);
    });

    it('应该能够重置统计信息', () => {
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 150
      });
      
      const handler = canvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1];
      
      handler(mouseEvent);
      
      interactionManager.resetStats();
      
      const stats = interactionManager.getClickStats();
      expect(stats.totalClicks).toBe(0);
      expect(stats.currentCombo).toBe(0);
      expect(stats.lastClickTime).toBe(0);
    });
  });

  describe('配置选项', () => {
    it('应该允许启用/禁用振动', () => {
      interactionManager.setVibrationEnabled(false);
      
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 150
      });
      
      const handler = canvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1];
      
      handler(mouseEvent);
      
      // 验证振动没有被调用
      const { DeviceDetector } = require('@/utils/DeviceDetector');
      expect(DeviceDetector.vibrate).not.toHaveBeenCalled();
    });

    it('应该允许启用/禁用多点触控', () => {
      interactionManager.setMultiTouchEnabled(true);
      
      // 测试多点触控功能
      const touchEvent = {
        preventDefault: jest.fn(),
        changedTouches: [
          { identifier: 1, clientX: 100, clientY: 150 },
          { identifier: 2, clientX: 200, clientY: 250 }
        ]
      };
      
      const handler = canvas.addEventListener.mock.calls.find(
        call => call[0] === 'touchstart'
      )[1];
      
      handler(touchEvent);
      
      const activeTouches = interactionManager.getActiveTouches();
      expect(activeTouches).toHaveLength(2);
    });
  });

  describe('销毁功能', () => {
    it('应该正确移除事件监听器', () => {
      interactionManager.destroy();
      
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(canvas.removeEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(canvas.removeEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(canvas.removeEventListener).toHaveBeenCalledWith('touchend', expect.any(Function));
      expect(canvas.removeEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function));
      expect(canvas.removeEventListener).toHaveBeenCalledWith('contextmenu', expect.any(Function));
    });

    it('应该清理所有计时器和状态', () => {
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 100,
        clientY: 150
      });
      
      const handler = canvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1];
      
      handler(mouseEvent);
      
      interactionManager.destroy();
      
      const activeTouches = interactionManager.getActiveTouches();
      expect(activeTouches).toHaveLength(0);
    });
  });

  describe('坐标转换', () => {
    it('应该正确转换Canvas坐标', () => {
      // 设置Canvas缩放
      canvas.getBoundingClientRect = jest.fn(() => ({
        left: 10,
        top: 20,
        width: 400, // 缩放到一半
        height: 300,
        right: 410,
        bottom: 320
      }));
      
      // 重新创建InteractionManager以应用新的getBoundingClientRect
      interactionManager.destroy();
      interactionManager = new InteractionManager({
        canvas: canvas as any,
        onClickEvent: mockOnClickEvent
      });
      
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: 210, // 相对于页面的坐标
        clientY: 170
      });
      
      const handler = canvas.addEventListener.mock.calls.find(
        call => call[0] === 'mousedown'
      )[1];
      
      handler(mouseEvent);
      
      // 期望的Canvas坐标应该考虑偏移和缩放
      // clientX: 210, Canvas left: 10, Canvas相对坐标: 200
      // Canvas width: 400, 实际Canvas width: 800, 缩放比例: 2
      // 最终坐标: 200 * 2 = 400
      expect(mockOnClickEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 400, // (210 - 10) * (800 / 400)
          y: 300  // (170 - 20) * (600 / 300)
        })
      );
    });
  });
});