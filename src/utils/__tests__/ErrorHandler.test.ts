/**
 * ErrorHandler 单元测试
 */

import { ErrorHandler } from '../ErrorHandler';
import { ErrorType } from '@/types';
import { logger } from '../Logger';

// Mock logger
jest.mock('../Logger', () => ({
  logger: {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    sessionId: 'test-session-123'
  }
}));

// Mock fetch
global.fetch = jest.fn();

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    errorHandler = new ErrorHandler({
      enableRetry: true,
      enableFallback: true,
      enableUserNotification: true,
      maxRetries: 3,
      retryDelay: 100, // 缩短测试时间
      enableErrorReporting: false
    });

    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    // Mock console methods
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    errorHandler.destroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('初始化', () => {
    it('应该成功创建错误处理器', () => {
      expect(errorHandler).toBeTruthy();
    });

    it('应该使用默认配置', () => {
      const defaultHandler = new ErrorHandler();
      expect(defaultHandler).toBeTruthy();
      defaultHandler.destroy();
    });
  });

  describe('错误创建', () => {
    it('应该创建完整的错误对象', () => {
      const error = errorHandler.createError(
        ErrorType.API_ERROR,
        'Test API error',
        { status: 500 },
        true
      );

      expect(error.id).toBeTruthy();
      expect(error.type).toBe(ErrorType.API_ERROR);
      expect(error.message).toBe('Test API error');
      expect(error.details).toEqual({ status: 500 });
      expect(error.recoverable).toBe(true);
      expect(error.timestamp).toBeTruthy();
      expect(error.retryCount).toBe(0);
      expect(error.context).toBeTruthy();
    });
  });

  describe('错误处理', () => {
    it('应该处理可恢复的错误', async () => {
      const error = errorHandler.createError(
        ErrorType.NETWORK_ERROR,
        'Network timeout',
        { status: 500 },
        true
      );

      await errorHandler.handleError(error);

      expect(logger.log).toHaveBeenCalled();
    });

    it('应该记录错误到日志', async () => {
      const error = errorHandler.createError(
        ErrorType.RENDER_ERROR,
        'Render failed'
      );

      await errorHandler.handleError(error);

      const errorLog = errorHandler.getErrorLog();
      expect(errorLog).toHaveLength(1);
      expect(errorLog[0]).toEqual(error);
    });
  });

  describe('错误统计', () => {
    it('应该提供正确的统计信息', async () => {
      const errors = [
        errorHandler.createError(ErrorType.UPLOAD_ERROR, 'Upload error', {}, true),
        errorHandler.createError(ErrorType.API_ERROR, 'API error', {}, true),
        errorHandler.createError(ErrorType.VALIDATION_ERROR, 'Validation error', {}, false)
      ];

      for (const error of errors) {
        await errorHandler.handleError(error);
      }

      const stats = errorHandler.getErrorStats();

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByType[ErrorType.UPLOAD_ERROR]).toBe(1);
      expect(stats.errorsByType[ErrorType.API_ERROR]).toBe(1);
      expect(stats.errorsByType[ErrorType.VALIDATION_ERROR]).toBe(1);
    });
  });

  describe('清理功能', () => {
    it('应该清除错误日志', async () => {
      const error = errorHandler.createError(
        ErrorType.UPLOAD_ERROR,
        'Upload failed'
      );
      await errorHandler.handleError(error);

      expect(errorHandler.getErrorLog()).toHaveLength(1);

      errorHandler.clearErrorLog();
      expect(errorHandler.getErrorLog()).toHaveLength(0);
    });
  });

  describe('销毁功能', () => {
    it('应该正确销毁错误处理器', () => {
      errorHandler.destroy();

      expect(errorHandler.getErrorLog()).toHaveLength(0);
      expect(logger.info).toHaveBeenCalledWith('ErrorHandler destroyed', 'error');
    });
  });
});