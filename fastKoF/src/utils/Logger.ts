/**
 * 日志系统
 * 提供结构化日志记录和错误跟踪功能
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  category: string;
  data?: any;
  stack?: string;
  userAgent?: string;
  url?: string;
  userId?: string;
  sessionId?: string;
}

export interface LoggerConfig {
  level: LogLevel;
  maxEntries: number;
  enableConsole: boolean;
  enableStorage: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  batchSize: number;
  flushInterval: number;
  categories: string[];
  sensitiveFields: string[];
}

/**
 * 日志记录器类
 */
export class Logger {
  private config: LoggerConfig;
  private entries: LogEntry[] = [];
  private batchQueue: LogEntry[] = [];
  private flushTimer: number | null = null;
  public sessionId: string;
  private userId?: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      maxEntries: 1000,
      enableConsole: true,
      enableStorage: true,
      enableRemote: false,
      batchSize: 10,
      flushInterval: 30000, // 30秒
      categories: ['game', 'api', 'ui', 'performance', 'error'],
      sensitiveFields: ['password', 'token', 'apiKey', 'email'],
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.init();
  }

  /**
   * 初始化日志系统
   */
  private init(): void {
    // 从本地存储恢复日志
    if (this.config.enableStorage) {
      this.loadFromStorage();
    }

    // 设置定时刷新
    if (this.config.enableRemote) {
      this.setupAutoFlush();
    }
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 设置用户ID
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * 记录调试信息
   */
  debug(message: string, category = 'debug', data?: any): void {
    this.log(LogLevel.DEBUG, message, category, data);
  }

  /**
   * 记录信息
   */
  info(message: string, category = 'info', data?: any): void {
    this.log(LogLevel.INFO, message, category, data);
  }

  /**
   * 记录警告
   */
  warn(message: string, category = 'warn', data?: any): void {
    this.log(LogLevel.WARN, message, category, data);
  }

  /**
   * 记录错误
   */
  error(message: string, category = 'error', data?: any, error?: Error): void {
    const logData = { ...data };
    if (error) {
      logData.stack = error.stack;
      logData.name = error.name;
    }
    this.log(LogLevel.ERROR, message, category, logData, error?.stack);
  }

  /**
   * 记录致命错误
   */
  fatal(message: string, category = 'fatal', data?: any, error?: Error): void {
    const logData = { ...data };
    if (error) {
      logData.stack = error.stack;
      logData.name = error.name;
    }
    this.log(LogLevel.FATAL, message, category, logData, error?.stack);
  }

  /**
   * 核心日志记录方法
   */
  log(
    level: LogLevel,
    message: string,
    category: string,
    data?: any,
    stack?: string
  ): void {
    // 检查日志级别
    if (level < this.config.level) {
      return;
    }

    // 创建日志条目
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      category,
      data: this.sanitizeData(data),
      stack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.userId,
      sessionId: this.sessionId
    };

    // 添加到日志列表
    this.entries.push(entry);

    // 限制日志数量
    if (this.entries.length > this.config.maxEntries) {
      this.entries.shift();
    }

    // 输出到控制台
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // 保存到本地存储
    if (this.config.enableStorage) {
      this.saveToStorage();
    }

    // 添加到远程批次队列
    if (this.config.enableRemote) {
      this.batchQueue.push(entry);
      
      // 如果是错误或致命错误，立即发送
      if (level >= LogLevel.ERROR) {
        this.flush();
      } else if (this.batchQueue.length >= this.config.batchSize) {
        this.flush();
      }
    }
  }

  /**
   * 清理敏感数据
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sanitized = { ...data };
    
    for (const field of this.config.sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * 输出到控制台
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toISOString();
    const levelName = LogLevel[entry.level];
    const prefix = `[${timestamp}] [${levelName}] [${entry.category}]`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(prefix, entry.message, entry.data);
        break;
      case LogLevel.INFO:
        console.info(prefix, entry.message, entry.data);
        break;
      case LogLevel.WARN:
        console.warn(prefix, entry.message, entry.data);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(prefix, entry.message, entry.data);
        if (entry.stack) {
          console.error(entry.stack);
        }
        break;
    }
  }

  /**
   * 保存到本地存储
   */
  private saveToStorage(): void {
    try {
      const recentEntries = this.entries.slice(-100); // 只保存最近100条
      localStorage.setItem('game_logs', JSON.stringify(recentEntries));
    } catch (error) {
      console.warn('Failed to save logs to storage:', error);
    }
  }

  /**
   * 从本地存储加载
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('game_logs');
      if (stored) {
        const entries = JSON.parse(stored);
        this.entries = entries.filter((entry: LogEntry) => 
          Date.now() - entry.timestamp < 24 * 60 * 60 * 1000 // 只保留24小时内的日志
        );
      }
    } catch (error) {
      console.warn('Failed to load logs from storage:', error);
    }
  }

  /**
   * 设置自动刷新
   */
  private setupAutoFlush(): void {
    this.flushTimer = window.setInterval(() => {
      if (this.batchQueue.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  /**
   * 刷新日志到远程服务器
   */
  private async flush(): Promise<void> {
    if (!this.config.enableRemote || !this.config.remoteEndpoint || this.batchQueue.length === 0) {
      return;
    }

    const batch = [...this.batchQueue];
    this.batchQueue = [];

    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          logs: batch,
          metadata: {
            sessionId: this.sessionId,
            userId: this.userId,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            url: window.location.href
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.debug(`Flushed ${batch.length} log entries to remote server`);
    } catch (error) {
      console.error('Failed to flush logs to remote server:', error);
      // 将失败的日志重新加入队列
      this.batchQueue.unshift(...batch);
    }
  }

  /**
   * 获取日志条目
   */
  getEntries(filter?: {
    level?: LogLevel;
    category?: string;
    since?: number;
    limit?: number;
  }): LogEntry[] {
    let filtered = [...this.entries];

    if (filter) {
      if (filter.level !== undefined) {
        filtered = filtered.filter(entry => entry.level >= filter.level!);
      }
      
      if (filter.category) {
        filtered = filtered.filter(entry => entry.category === filter.category);
      }
      
      if (filter.since) {
        filtered = filtered.filter(entry => entry.timestamp >= filter.since!);
      }
      
      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered;
  }

  /**
   * 获取日志统计
   */
  getStats(): {
    totalEntries: number;
    entriesByLevel: Record<string, number>;
    entriesByCategory: Record<string, number>;
    oldestEntry?: number;
    newestEntry?: number;
  } {
    const entriesByLevel: Record<string, number> = {};
    const entriesByCategory: Record<string, number> = {};

    for (const entry of this.entries) {
      const levelName = LogLevel[entry.level];
      entriesByLevel[levelName] = (entriesByLevel[levelName] || 0) + 1;
      entriesByCategory[entry.category] = (entriesByCategory[entry.category] || 0) + 1;
    }

    return {
      totalEntries: this.entries.length,
      entriesByLevel,
      entriesByCategory,
      oldestEntry: this.entries.length > 0 ? this.entries[0].timestamp : undefined,
      newestEntry: this.entries.length > 0 ? this.entries[this.entries.length - 1].timestamp : undefined
    };
  }

  /**
   * 清除日志
   */
  clear(): void {
    this.entries = [];
    this.batchQueue = [];
    
    if (this.config.enableStorage) {
      localStorage.removeItem('game_logs');
    }
  }

  /**
   * 导出日志
   */
  export(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      return this.exportAsCSV();
    } else {
      return this.exportAsJSON();
    }
  }

  /**
   * 导出为JSON格式
   */
  private exportAsJSON(): string {
    const exportData = {
      metadata: {
        exportTime: new Date().toISOString(),
        sessionId: this.sessionId,
        userId: this.userId,
        totalEntries: this.entries.length
      },
      logs: this.entries
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导出为CSV格式
   */
  private exportAsCSV(): string {
    const headers = ['timestamp', 'level', 'category', 'message', 'data', 'url'];
    const rows = [headers.join(',')];

    for (const entry of this.entries) {
      const row = [
        new Date(entry.timestamp).toISOString(),
        LogLevel[entry.level],
        entry.category,
        `"${entry.message.replace(/"/g, '""')}"`,
        entry.data ? `"${JSON.stringify(entry.data).replace(/"/g, '""')}"` : '',
        entry.url || ''
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * 启用/禁用控制台输出
   */
  setConsoleEnabled(enabled: boolean): void {
    this.config.enableConsole = enabled;
  }

  /**
   * 启用/禁用远程日志
   */
  setRemoteEnabled(enabled: boolean, endpoint?: string): void {
    this.config.enableRemote = enabled;
    if (endpoint) {
      this.config.remoteEndpoint = endpoint;
    }
    
    if (enabled && !this.flushTimer) {
      this.setupAutoFlush();
    } else if (!enabled && this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * 销毁日志记录器
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // 最后一次刷新
    this.flush();
    
    this.entries = [];
    this.batchQueue = [];
  }
}

// 全局日志实例
export const logger = new Logger();