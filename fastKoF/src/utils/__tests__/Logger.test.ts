/**
 * Logger 单元测试
 */

import { Logger, LogLevel, ChildLogger } from '../Logger';

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn();

describe('Logger', () => {
  let logger: Logger;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    logger = new Logger({
      level: LogLevel.DEBUG,
      maxEntries: 10,
      enableConsole: true,
      enableStorage: true,
      enableRemote: false,
      batchSize: 5,
      flushInterval: 1000
    });

    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    // Mock console methods
    jest.spyOn(console, 'debug').mockImplementation();
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    logger.destroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('初始化', () => {
    it('应该成功创建日志记录器', () => {
      expect(logger).toBeTruthy();
      expect(logger['sessionId']).toBeTruthy();
    });

    it('应该使用默认配置', () => {
      const defaultLogger = new Logger();
      expect(defaultLogger).toBeTruthy();
      defaultLogger.destroy();
    });

    it('应该从本地存储加载日志', () => {
      const storedLogs = JSON.stringify([
        {
          timestamp: Date.now(),
          level: LogLevel.INFO,
          message: 'Test log',
          category: 'test'
        }
      ]);
      
      mockLocalStorage.getItem.mockReturnValue(storedLogs);
      
      const loggerWithStorage = new Logger({ enableStorage: true });
      
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('game_logs');
      
      loggerWithStorage.destroy();
    });
  });

  describe('日志记录', () => {
    it('应该记录不同级别的日志', () => {
      logger.debug('Debug message', 'test');
      logger.info('Info message', 'test');
      logger.warn('Warning message', 'test');
      logger.error('Error message', 'test');
      logger.fatal('Fatal message', 'test');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(5);
      
      expect(entries[0].level).toBe(LogLevel.DEBUG);
      expect(entries[1].level).toBe(LogLevel.INFO);
      expect(entries[2].level).toBe(LogLevel.WARN);
      expect(entries[3].level).toBe(LogLevel.ERROR);
      expect(entries[4].level).toBe(LogLevel.FATAL);
    });

    it('应该过滤低于设定级别的日志', () => {
      logger.setLevel(LogLevel.WARN);
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(2);
      expect(entries[0].level).toBe(LogLevel.WARN);
      expect(entries[1].level).toBe(LogLevel.ERROR);
    });

    it('应该包含完整的日志信息', () => {
      const testData = { key: 'value' };
      logger.info('Test message', 'test', testData);

      const entries = logger.getEntries();
      const entry = entries[0];

      expect(entry.message).toBe('Test message');
      expect(entry.category).toBe('test');
      expect(entry.data).toEqual(testData);
      expect(entry.timestamp).toBeTruthy();
      expect(entry.sessionId).toBeTruthy();
      expect(entry.userAgent).toBeTruthy();
      expect(entry.url).toBeTruthy();
    });

    it('应该处理错误对象', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', 'test', { context: 'testing' }, error);

      const entries = logger.getEntries();
      const entry = entries[0];

      expect(entry.stack).toBe(error.stack);
      expect(entry.data.name).toBe('Error');
      expect(entry.data.context).toBe('testing');
    });
  });

  describe('数据清理', () => {
    it('应该清理敏感数据', () => {
      const sensitiveData = {
        username: 'testuser',
        password: 'secret123',
        token: 'abc123',
        normalField: 'normal'
      };

      logger.info('Login attempt', 'auth', sensitiveData);

      const entries = logger.getEntries();
      const entry = entries[0];

      expect(entry.data.username).toBe('testuser');
      expect(entry.data.password).toBe('[REDACTED]');
      expect(entry.data.token).toBe('[REDACTED]');
      expect(entry.data.normalField).toBe('normal');
    });
  });

  describe('控制台输出', () => {
    it('应该输出到控制台', () => {
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(console.debug).toHaveBeenCalled();
      expect(console.info).toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
    });

    it('应该能够禁用控制台输出', () => {
      logger.setConsoleEnabled(false);
      logger.info('Test message');

      expect(console.info).not.toHaveBeenCalled();
    });
  });

  describe('本地存储', () => {
    it('应该保存到本地存储', () => {
      logger.info('Test message');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'game_logs',
        expect.any(String)
      );
    });

    it('应该处理存储错误', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });

      expect(() => logger.info('Test message')).not.toThrow();
    });
  });

  describe('远程日志', () => {
    beforeEach(() => {
      logger = new Logger({
        enableRemote: true,
        remoteEndpoint: 'https://api.example.com/logs',
        batchSize: 2
      });
    });

    it('应该批量发送日志', async () => {
      mockFetch.mockResolvedValue({
        ok: true
      } as Response);

      logger.info('Message 1');
      logger.info('Message 2');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/logs',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String)
        })
      );
    });

    it('应该立即发送错误日志', async () => {
      mockFetch.mockResolvedValue({
        ok: true
      } as Response);

      logger.error('Critical error');

      expect(mockFetch).toHaveBeenCalled();
    });

    it('应该处理发送失败', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      logger.error('Test error');

      // 应该不抛出异常
      expect(() => jest.runAllTimers()).not.toThrow();
    });

    it('应该定时刷新日志', () => {
      mockFetch.mockResolvedValue({
        ok: true
      } as Response);

      logger.info('Test message');

      jest.advanceTimersByTime(1000);

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('日志查询', () => {
    beforeEach(() => {
      logger.debug('Debug message', 'debug');
      logger.info('Info message', 'info');
      logger.warn('Warning message', 'warn');
      logger.error('Error message', 'error');
    });

    it('应该按级别过滤', () => {
      const entries = logger.getEntries({ level: LogLevel.WARN });
      expect(entries).toHaveLength(2);
      expect(entries.every(entry => entry.level >= LogLevel.WARN)).toBe(true);
    });

    it('应该按类别过滤', () => {
      const entries = logger.getEntries({ category: 'error' });
      expect(entries).toHaveLength(1);
      expect(entries[0].category).toBe('error');
    });

    it('应该按时间过滤', () => {
      const since = Date.now() - 1000;
      const entries = logger.getEntries({ since });
      expect(entries.length).toBeGreaterThan(0);
    });

    it('应该限制返回数量', () => {
      const entries = logger.getEntries({ limit: 2 });
      expect(entries).toHaveLength(2);
    });
  });

  describe('统计信息', () => {
    beforeEach(() => {
      logger.debug('Debug message', 'debug');
      logger.info('Info message', 'info');
      logger.warn('Warning message', 'warn');
      logger.error('Error message', 'error');
    });

    it('应该提供正确的统计信息', () => {
      const stats = logger.getStats();

      expect(stats.totalEntries).toBe(4);
      expect(stats.entriesByLevel.DEBUG).toBe(1);
      expect(stats.entriesByLevel.INFO).toBe(1);
      expect(stats.entriesByLevel.WARN).toBe(1);
      expect(stats.entriesByLevel.ERROR).toBe(1);
      expect(stats.entriesByCategory.debug).toBe(1);
      expect(stats.entriesByCategory.info).toBe(1);
      expect(stats.entriesByCategory.warn).toBe(1);
      expect(stats.entriesByCategory.error).toBe(1);
    });
  });

  describe('数据导出', () => {
    beforeEach(() => {
      logger.info('Test message 1');
      logger.warn('Test message 2');
    });

    it('应该导出JSON格式', () => {
      const exported = logger.export('json');
      const data = JSON.parse(exported);

      expect(data.metadata).toBeTruthy();
      expect(data.logs).toBeInstanceOf(Array);
      expect(data.logs).toHaveLength(2);
    });

    it('应该导出CSV格式', () => {
      const exported = logger.export('csv');
      const lines = exported.split('\\n');

      expect(lines[0]).toContain('timestamp,level,category,message');
      expect(lines).toHaveLength(3); // header + 2 data rows
    });
  });

  describe('子日志记录器', () => {
    it('应该创建子日志记录器', () => {
      const childLogger = logger.createChild('test-component');
      expect(childLogger).toBeInstanceOf(ChildLogger);
    });

    it('子日志记录器应该使用指定类别', () => {
      const childLogger = logger.createChild('test-component');
      childLogger.info('Test message');

      const entries = logger.getEntries();
      expect(entries[0].category).toBe('test-component');
    });
  });

  describe('用户管理', () => {
    it('应该设置用户ID', () => {
      logger.setUserId('user123');
      logger.info('Test message');

      const entries = logger.getEntries();
      expect(entries[0].userId).toBe('user123');
    });
  });

  describe('日志限制', () => {
    it('应该限制日志数量', () => {
      // 超过最大条目数
      for (let i = 0; i < 15; i++) {
        logger.info(`Message ${i}`);
      }

      const entries = logger.getEntries();
      expect(entries.length).toBeLessThanOrEqual(10);
    });
  });

  describe('清理功能', () => {
    it('应该清除所有日志', () => {
      logger.info('Test message');
      expect(logger.getEntries()).toHaveLength(1);

      logger.clear();
      expect(logger.getEntries()).toHaveLength(0);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('game_logs');
    });
  });

  describe('销毁功能', () => {
    it('应该正确销毁日志记录器', () => {
      logger.info('Test message');
      logger.destroy();

      expect(logger.getEntries()).toHaveLength(0);
    });
  });

  describe('全局错误处理', () => {
    it('应该捕获未处理的错误', () => {
      const errorEvent = new ErrorEvent('error', {
        message: 'Test error',
        filename: 'test.js',
        lineno: 10,
        colno: 5
      });

      window.dispatchEvent(errorEvent);

      const entries = logger.getEntries({ category: 'error' });
      expect(entries.length).toBeGreaterThan(0);
    });

    it('应该捕获未处理的Promise拒绝', () => {
      const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject('Test rejection'),
        reason: 'Test rejection'
      });

      window.dispatchEvent(rejectionEvent);

      const entries = logger.getEntries({ category: 'error' });
      expect(entries.length).toBeGreaterThan(0);
    });
  });
});