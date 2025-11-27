/**
 * 性能监控器
 * 监控游戏性能指标并提供优化建议
 */

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  renderTime: number;
  updateTime: number;
  totalTime: number;
  droppedFrames: number;
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
}

export interface PerformanceConfig {
  targetFPS: number;
  maxSamples: number;
  warningThreshold: number;
  criticalThreshold: number;
  enableMemoryMonitoring: boolean;
  enableDetailedProfiling: boolean;
}

export interface PerformanceAlert {
  type: 'warning' | 'critical';
  message: string;
  metric: keyof PerformanceMetrics;
  value: number;
  threshold: number;
  timestamp: number;
  suggestions: string[];
}

/**
 * 性能监控器类
 */
export class PerformanceMonitor {
  private config: PerformanceConfig;
  private metrics: PerformanceMetrics;
  private samples: number[] = [];
  private frameTimes: number[] = [];
  private lastFrameTime = 0;
  private frameCount = 0;
  private startTime = 0;
  private alerts: PerformanceAlert[] = [];
  private isRunning = false;
  private rafId: number | null = null;
  
  // 性能分析器
  private profilers = new Map<string, { start: number; total: number; count: number }>();
  
  // 内存监控
  private memoryBaseline = 0;
  private memoryPeak = 0;
  private memoryWarningThreshold = 50 * 1024 * 1024; // 50MB

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      targetFPS: 60,
      maxSamples: 120, // 2秒的样本
      warningThreshold: 45, // FPS低于45时警告
      criticalThreshold: 30, // FPS低于30时严重警告
      enableMemoryMonitoring: true,
      enableDetailedProfiling: false,
      ...config
    };

    this.metrics = {
      fps: 0,
      frameTime: 0,
      memoryUsage: 0,
      renderTime: 0,
      updateTime: 0,
      totalTime: 0,
      droppedFrames: 0,
      averageFPS: 0,
      minFPS: Infinity,
      maxFPS: 0
    };

    this.init();
  }

  /**
   * 初始化性能监控器
   */
  private init(): void {
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    
    if (this.config.enableMemoryMonitoring) {
      this.initMemoryMonitoring();
    }
  }

  /**
   * 初始化内存监控
   */
  private initMemoryMonitoring(): void {
    if ('memory' in performance) {
      this.memoryBaseline = (performance as any).memory.usedJSHeapSize;
    }
  }

  /**
   * 开始监控
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    this.frameCount = 0;
    
    this.tick();
  }

  /**
   * 停止监控
   */
  stop(): void {
    this.isRunning = false;
    
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * 监控循环
   */
  private tick(): void {
    if (!this.isRunning) return;

    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    
    this.updateMetrics(now, frameTime);
    this.checkPerformanceAlerts();
    
    this.lastFrameTime = now;
    this.frameCount++;
    
    this.rafId = requestAnimationFrame(() => this.tick());
  }

  /**
   * 更新性能指标
   */
  private updateMetrics(now: number, frameTime: number): void {
    // 计算FPS
    const fps = 1000 / frameTime;
    this.metrics.fps = fps;
    this.metrics.frameTime = frameTime;
    
    // 更新样本
    this.samples.push(fps);
    this.frameTimes.push(frameTime);
    
    if (this.samples.length > this.config.maxSamples) {
      this.samples.shift();
      this.frameTimes.shift();
    }
    
    // 计算统计数据
    this.calculateStatistics();
    
    // 更新内存使用情况
    if (this.config.enableMemoryMonitoring) {
      this.updateMemoryMetrics();
    }
    
    // 更新总时间
    this.metrics.totalTime = now - this.startTime;
  }

  /**
   * 计算统计数据
   */
  private calculateStatistics(): void {
    if (this.samples.length === 0) return;
    
    // 平均FPS
    this.metrics.averageFPS = this.samples.reduce((sum, fps) => sum + fps, 0) / this.samples.length;
    
    // 最小和最大FPS
    this.metrics.minFPS = Math.min(...this.samples);
    this.metrics.maxFPS = Math.max(...this.samples);
    
    // 丢帧计算
    const targetFrameTime = 1000 / this.config.targetFPS;
    this.metrics.droppedFrames = this.frameTimes.filter(time => time > targetFrameTime * 1.5).length;
  }

  /**
   * 更新内存指标
   */
  private updateMemoryMetrics(): void {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = memory.usedJSHeapSize;
      
      if (this.metrics.memoryUsage > this.memoryPeak) {
        this.memoryPeak = this.metrics.memoryUsage;
      }
    }
  }

  /**
   * 检查性能警告
   */
  private checkPerformanceAlerts(): void {
    const now = Date.now();
    
    // FPS警告
    if (this.metrics.fps < this.config.criticalThreshold) {
      this.addAlert({
        type: 'critical',
        message: `FPS严重偏低: ${this.metrics.fps.toFixed(1)}`,
        metric: 'fps',
        value: this.metrics.fps,
        threshold: this.config.criticalThreshold,
        timestamp: now,
        suggestions: [
          '降低特效质量',
          '减少同时显示的弹幕数量',
          '优化图片尺寸',
          '关闭不必要的动画效果'
        ]
      });
    } else if (this.metrics.fps < this.config.warningThreshold) {
      this.addAlert({
        type: 'warning',
        message: `FPS偏低: ${this.metrics.fps.toFixed(1)}`,
        metric: 'fps',
        value: this.metrics.fps,
        threshold: this.config.warningThreshold,
        timestamp: now,
        suggestions: [
          '考虑降低特效强度',
          '减少粒子效果数量'
        ]
      });
    }
    
    // 内存警告
    if (this.config.enableMemoryMonitoring && this.metrics.memoryUsage > this.memoryWarningThreshold) {
      this.addAlert({
        type: 'warning',
        message: `内存使用过高: ${(this.metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB`,
        metric: 'memoryUsage',
        value: this.metrics.memoryUsage,
        threshold: this.memoryWarningThreshold,
        timestamp: now,
        suggestions: [
          '清理不使用的图片资源',
          '减少缓存的弹幕消息',
          '优化音频资源管理'
        ]
      });
    }
  }

  /**
   * 添加性能警告
   */
  private addAlert(alert: PerformanceAlert): void {
    // 避免重复警告（5秒内相同类型的警告只显示一次）
    const recentAlert = this.alerts.find(a => 
      a.metric === alert.metric && 
      a.type === alert.type && 
      (alert.timestamp - a.timestamp) < 5000
    );
    
    if (!recentAlert) {
      this.alerts.push(alert);
      
      // 限制警告数量
      if (this.alerts.length > 50) {
        this.alerts.shift();
      }
    }
  }

  /**
   * 开始性能分析
   */
  startProfile(name: string): void {
    if (!this.config.enableDetailedProfiling) return;
    
    const profiler = this.profilers.get(name) || { start: 0, total: 0, count: 0 };
    profiler.start = performance.now();
    this.profilers.set(name, profiler);
  }

  /**
   * 结束性能分析
   */
  endProfile(name: string): number {
    if (!this.config.enableDetailedProfiling) return 0;
    
    const profiler = this.profilers.get(name);
    if (!profiler || profiler.start === 0) return 0;
    
    const duration = performance.now() - profiler.start;
    profiler.total += duration;
    profiler.count++;
    profiler.start = 0;
    
    return duration;
  }

  /**
   * 标记帧开始
   */
  markFrameStart(): void {
    this.startProfile('frame');
  }

  /**
   * 标记帧结束
   */
  markFrameEnd(): void {
    this.endProfile('frame');
  }

  /**
   * 标记渲染开始
   */
  markRenderStart(): void {
    this.startProfile('render');
  }

  /**
   * 标记渲染结束
   */
  markRenderEnd(): void {
    const renderTime = this.endProfile('render');
    this.metrics.renderTime = renderTime;
  }

  /**
   * 标记更新开始
   */
  markUpdateStart(): void {
    this.startProfile('update');
  }

  /**
   * 标记更新结束
   */
  markUpdateEnd(): void {
    const updateTime = this.endProfile('update');
    this.metrics.updateTime = updateTime;
  }

  /**
   * 获取当前性能指标
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 获取性能警告
   */
  getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  /**
   * 清除警告
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * 获取分析器数据
   */
  getProfilerData(): Map<string, { average: number; total: number; count: number }> {
    const result = new Map();
    
    this.profilers.forEach((profiler, name) => {
      if (profiler.count > 0) {
        result.set(name, {
          average: profiler.total / profiler.count,
          total: profiler.total,
          count: profiler.count
        });
      }
    });
    
    return result;
  }

  /**
   * 重置分析器数据
   */
  resetProfilers(): void {
    this.profilers.clear();
  }

  /**
   * 获取性能报告
   */
  getPerformanceReport(): {
    summary: string;
    metrics: PerformanceMetrics;
    alerts: PerformanceAlert[];
    profilers: any;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    
    // 基于当前性能生成建议
    if (this.metrics.averageFPS < this.config.warningThreshold) {
      recommendations.push('考虑降低游戏质量设置以提高帧率');
    }
    
    if (this.metrics.droppedFrames > this.samples.length * 0.1) {
      recommendations.push('检测到较多丢帧，建议优化渲染性能');
    }
    
    if (this.metrics.memoryUsage > this.memoryBaseline * 2) {
      recommendations.push('内存使用量较高，建议清理不必要的资源');
    }
    
    if (this.metrics.renderTime > 10) {
      recommendations.push('渲染时间较长，考虑优化绘制逻辑');
    }
    
    const summary = this.generatePerformanceSummary();
    
    return {
      summary,
      metrics: this.getMetrics(),
      alerts: this.getAlerts(),
      profilers: Object.fromEntries(this.getProfilerData()),
      recommendations
    };
  }

  /**
   * 生成性能摘要
   */
  private generatePerformanceSummary(): string {
    const avgFPS = this.metrics.averageFPS.toFixed(1);
    const memoryMB = (this.metrics.memoryUsage / 1024 / 1024).toFixed(1);
    const uptime = (this.metrics.totalTime / 1000).toFixed(1);
    
    let status = '良好';
    if (this.metrics.averageFPS < this.config.criticalThreshold) {
      status = '严重';
    } else if (this.metrics.averageFPS < this.config.warningThreshold) {
      status = '警告';
    }
    
    return `性能状态: ${status} | 平均FPS: ${avgFPS} | 内存: ${memoryMB}MB | 运行时间: ${uptime}s`;
  }

  /**
   * 导出性能数据
   */
  exportData(): string {
    const data = {
      timestamp: new Date().toISOString(),
      config: this.config,
      metrics: this.metrics,
      samples: this.samples,
      frameTimes: this.frameTimes,
      alerts: this.alerts,
      profilers: Object.fromEntries(this.getProfilerData())
    };
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * 销毁性能监控器
   */
  destroy(): void {
    this.stop();
    this.samples = [];
    this.frameTimes = [];
    this.alerts = [];
    this.profilers.clear();
  }
}