/**
 * PerformanceMonitor 单元测试
 */

import { PerformanceMonitor } from '../PerformanceMonitor';

// Mock performance API
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50MB
    jsHeapSizeLimit: 100 * 1024 * 1024 // 100MB
  }
};

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((callback) => {
  setTimeout(callback, 16);
  return 1;
});

global.cancelAnimationFrame = jest.fn();

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let mockTime = 0;

  beforeEach(() => {
    mockTime = 0;
    mockPerformance.now.mockImplementation(() => mockTime);
    
    monitor = new PerformanceMonitor({
      targetFPS: 60,
      maxSamples: 10,
      warningThreshold: 45,
      criticalThreshold: 30,
      enableMemoryMonitoring: true,
      enableDetailedProfiling: true
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    monitor.destroy();
  });

  describe('初始化', () => {
    it('应该成功创建性能监控器', () => {
      expect(monitor).toBeTruthy();
      
      const metrics = monitor.getMetrics();
      expect(metrics.fps).toBe(0);
      expect(metrics.averageFPS).toBe(0);
      expect(metrics.minFPS).toBe(Infinity);
      expect(metrics.maxFPS).toBe(0);
    });

    it('应该使用自定义配置', () => {
      const customMonitor = new PerformanceMonitor({
        targetFPS: 30,
        warningThreshold: 25
      });
      
      expect(customMonitor).toBeTruthy();
      customMonitor.destroy();
    });
  });

  describe('性能监控', () => {
    it('应该开始和停止监控', () => {
      expect(monitor['isRunning']).toBe(false);
      
      monitor.start();
      expect(monitor['isRunning']).toBe(true);
      
      monitor.stop();
      expect(monitor['isRunning']).toBe(false);
    });

    it('应该计算FPS', () => {
      monitor.start();
      
      // 模拟60FPS
      mockTime = 0;
      monitor['updateMetrics'](mockTime, 16.67);
      
      const metrics = monitor.getMetrics();
      expect(metrics.fps).toBeCloseTo(60, 0);
    });

    it('应该计算统计数据', () => {
      monitor.start();
      
      // 添加多个FPS样本
      const fpsSamples = [60, 58, 62, 55, 59];
      fpsSamples.forEach((fps, index) => {
        const frameTime = 1000 / fps;
        mockTime = index * frameTime;
        monitor['updateMetrics'](mockTime, frameTime);
      });
      
      const metrics = monitor.getMetrics();
      expect(metrics.averageFPS).toBeCloseTo(58.8, 1);
      expect(metrics.minFPS).toBe(55);
      expect(metrics.maxFPS).toBe(62);
    });

    it('应该检测丢帧', () => {
      monitor.start();
      
      // 模拟一些正常帧和丢帧
      const frameTimes = [16.67, 16.67, 33.33, 16.67, 50]; // 有两个丢帧
      frameTimes.forEach((frameTime, index) => {
        mockTime = index * frameTime;
        monitor['updateMetrics'](mockTime, frameTime);
      });
      
      const metrics = monitor.getMetrics();
      expect(metrics.droppedFrames).toBeGreaterThan(0);
    });
  });

  describe('内存监控', () => {
    it('应该监控内存使用', () => {
      monitor.start();
      
      mockTime = 16.67;
      monitor['updateMetrics'](mockTime, 16.67);
      
      const metrics = monitor.getMetrics();
      expect(metrics.memoryUsage).toBe(50 * 1024 * 1024);
    });

    it('应该在禁用内存监控时不监控内存', () => {
      const monitorWithoutMemory = new PerformanceMonitor({
        enableMemoryMonitoring: false
      });
      
      monitorWithoutMemory.start();
      
      mockTime = 16.67;
      monitorWithoutMemory['updateMetrics'](mockTime, 16.67);
      
      const metrics = monitorWithoutMemory.getMetrics();
      expect(metrics.memoryUsage).toBe(0);
      
      monitorWithoutMemory.destroy();
    });
  });

  describe('性能警告', () => {
    it('应该生成FPS警告', () => {
      monitor.start();
      
      // 模拟低FPS
      mockTime = 16.67;
      monitor['updateMetrics'](mockTime, 1000 / 40); // 40 FPS
      
      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('warning');
      expect(alerts[0].metric).toBe('fps');
    });

    it('应该生成严重FPS警告', () => {
      monitor.start();
      
      // 模拟非常低的FPS
      mockTime = 16.67;
      monitor['updateMetrics'](mockTime, 1000 / 25); // 25 FPS
      
      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toBe('critical');
      expect(alerts[0].metric).toBe('fps');
    });

    it('应该生成内存警告', () => {
      // 设置高内存使用
      mockPerformance.memory.usedJSHeapSize = 60 * 1024 * 1024; // 60MB
      
      monitor.start();
      mockTime = 16.67;
      monitor['updateMetrics'](mockTime, 16.67);
      
      const alerts = monitor.getAlerts();
      const memoryAlert = alerts.find(a => a.metric === 'memoryUsage');
      expect(memoryAlert).toBeTruthy();
      expect(memoryAlert!.type).toBe('warning');
    });

    it('应该避免重复警告', () => {
      monitor.start();
      
      // 连续生成相同的警告
      for (let i = 0; i < 5; i++) {
        mockTime = i * 16.67;
        monitor['updateMetrics'](mockTime, 1000 / 25); // 25 FPS
      }
      
      const alerts = monitor.getAlerts();
      const fpsAlerts = alerts.filter(a => a.metric === 'fps');
      expect(fpsAlerts.length).toBe(1); // 应该只有一个警告
    });

    it('应该清除警告', () => {
      monitor.start();
      
      mockTime = 16.67;
      monitor['updateMetrics'](mockTime, 1000 / 25); // 生成警告
      
      expect(monitor.getAlerts().length).toBeGreaterThan(0);
      
      monitor.clearAlerts();
      expect(monitor.getAlerts().length).toBe(0);
    });
  });

  describe('性能分析', () => {
    it('应该进行性能分析', () => {
      monitor.startProfile('test');
      
      mockTime = 100;
      const duration = monitor.endProfile('test');
      
      expect(duration).toBe(100);
      
      const profilerData = monitor.getProfilerData();
      expect(profilerData.has('test')).toBe(true);
      expect(profilerData.get('test')!.average).toBe(100);
    });

    it('应该处理多次分析', () => {
      // 第一次分析
      monitor.startProfile('test');
      mockTime = 50;
      monitor.endProfile('test');
      
      // 第二次分析
      monitor.startProfile('test');
      mockTime = 100;
      monitor.endProfile('test');
      
      const profilerData = monitor.getProfilerData();
      expect(profilerData.get('test')!.average).toBe(75); // (50 + 50) / 2
      expect(profilerData.get('test')!.count).toBe(2);
    });

    it('应该在禁用详细分析时不进行分析', () => {
      const monitorWithoutProfiling = new PerformanceMonitor({
        enableDetailedProfiling: false
      });
      
      monitorWithoutProfiling.startProfile('test');
      const duration = monitorWithoutProfiling.endProfile('test');
      
      expect(duration).toBe(0);
      
      const profilerData = monitorWithoutProfiling.getProfilerData();
      expect(profilerData.size).toBe(0);
      
      monitorWithoutProfiling.destroy();
    });

    it('应该重置分析器数据', () => {
      monitor.startProfile('test');
      mockTime = 100;
      monitor.endProfile('test');
      
      expect(monitor.getProfilerData().size).toBe(1);
      
      monitor.resetProfilers();
      expect(monitor.getProfilerData().size).toBe(0);
    });
  });

  describe('帧标记', () => {
    it('应该标记帧开始和结束', () => {
      monitor.markFrameStart();
      mockTime = 16.67;
      monitor.markFrameEnd();
      
      const profilerData = monitor.getProfilerData();
      expect(profilerData.has('frame')).toBe(true);
    });

    it('应该标记渲染开始和结束', () => {
      monitor.markRenderStart();
      mockTime = 8;
      monitor.markRenderEnd();
      
      const metrics = monitor.getMetrics();
      expect(metrics.renderTime).toBe(8);
    });

    it('应该标记更新开始和结束', () => {
      monitor.markUpdateStart();
      mockTime = 5;
      monitor.markUpdateEnd();
      
      const metrics = monitor.getMetrics();
      expect(metrics.updateTime).toBe(5);
    });
  });

  describe('性能报告', () => {
    it('应该生成性能报告', () => {
      monitor.start();
      
      // 添加一些数据
      mockTime = 16.67;
      monitor['updateMetrics'](mockTime, 16.67);
      
      monitor.startProfile('test');
      mockTime = 20;
      monitor.endProfile('test');
      
      const report = monitor.getPerformanceReport();
      
      expect(report.summary).toContain('性能状态');
      expect(report.metrics).toBeTruthy();
      expect(report.alerts).toBeTruthy();
      expect(report.profilers).toBeTruthy();
      expect(report.recommendations).toBeTruthy();
    });

    it('应该根据性能生成建议', () => {
      monitor.start();
      
      // 模拟低性能
      mockTime = 16.67;
      monitor['updateMetrics'](mockTime, 1000 / 40); // 40 FPS
      
      const report = monitor.getPerformanceReport();
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations[0]).toContain('降低游戏质量');
    });
  });

  describe('数据导出', () => {
    it('应该导出性能数据', () => {
      monitor.start();
      
      mockTime = 16.67;
      monitor['updateMetrics'](mockTime, 16.67);
      
      const exportedData = monitor.exportData();
      const data = JSON.parse(exportedData);
      
      expect(data.timestamp).toBeTruthy();
      expect(data.config).toBeTruthy();
      expect(data.metrics).toBeTruthy();
      expect(data.samples).toBeTruthy();
    });
  });

  describe('销毁功能', () => {
    it('应该正确销毁监控器', () => {
      monitor.start();
      
      monitor.destroy();
      
      expect(monitor['isRunning']).toBe(false);
      expect(monitor['samples']).toHaveLength(0);
      expect(monitor['alerts']).toHaveLength(0);
      expect(monitor['profilers'].size).toBe(0);
    });
  });

  describe('边界情况', () => {
    it('应该处理零除错误', () => {
      monitor.start();
      
      // 模拟零帧时间
      mockTime = 0;
      expect(() => {
        monitor['updateMetrics'](mockTime, 0);
      }).not.toThrow();
    });

    it('应该处理负帧时间', () => {
      monitor.start();
      
      mockTime = -10;
      expect(() => {
        monitor['updateMetrics'](mockTime, -10);
      }).not.toThrow();
    });

    it('应该处理非常高的FPS', () => {
      monitor.start();
      
      mockTime = 1;
      monitor['updateMetrics'](mockTime, 1); // 1000 FPS
      
      const metrics = monitor.getMetrics();
      expect(metrics.fps).toBe(1000);
    });
  });
});