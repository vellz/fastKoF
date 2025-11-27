/**
 * 错误处理工具类
 * 统一处理应用中的各种错误
 */

import { GameError, ErrorType, ErrorRecoveryStrategy } from '@/types';
import { logger, LogLevel } from './Logger';

export interface ErrorHandlerConfig {
  enableRetry: boolean;
  enableFallback: boolean;
  enableUserNotification: boolean;
  maxRetries: number;
  retryDelay: number;
  enableErrorReporting: boolean;
  reportingEndpoint?: string;
}

/**
 * 错误处理器类
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private errorLog: GameError[] = [];
  private recoveryStrategies: Map<ErrorType, ErrorRecoveryStrategy> = new Map();
  private retryTimers: Map<string, number> = new Map();
  private errorCallbacks: Map<ErrorType, ((error: GameError) => void)[]> = new Map();
  private maxLogSize = 100;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      enableRetry: true,
      enableFallback: true,
      enableUserNotification: true,
      maxRetries: 3,
      retryDelay: 1000,
      enableErrorReporting: false,
      ...config
    };

    this.setupDefaultStrategies();
    this.setupGlobalErrorHandlers();
  }

  /**
   * 设置默认恢复策略
   */
  private setupDefaultStrategies(): void {
    // 网络错误策略
    this.addRecoveryStrategy({
      type: ErrorType.NETWORK_ERROR,
      maxRetries: 3,
      retryDelay: 2000,
      shouldRetry: (error) => {
        // 对于5xx错误或网络超时，允许重试
        return error.details?.status >= 500 || error.details?.code === 'NETWORK_TIMEOUT';
      }
    });

    // API错误策略
    this.addRecoveryStrategy({
      type: ErrorType.API_ERROR,
      maxRetries: 2,
      retryDelay: 1500,
      shouldRetry: (error) => {
        // 对于服务器错误允许重试，客户端错误不重试
        return error.details?.status >= 500;
      }
    });

    // 资源加载错误策略
    this.addRecoveryStrategy({
      type: ErrorType.RESOURCE_ERROR,
      maxRetries: 2,
      retryDelay: 1000,
      fallbackAction: () => {
        logger.warn('Using fallback resources due to loading failure', 'error');
      }
    });

    // 渲染错误策略
    this.addRecoveryStrategy({
      type: ErrorType.RENDER_ERROR,
      maxRetries: 1,
      retryDelay: 500,
      fallbackAction: () => {
        logger.warn('Switching to safe rendering mode', 'error');
      }
    });

    // 音频错误策略
    this.addRecoveryStrategy({
      type: ErrorType.AUDIO_ERROR,
      maxRetries: 1,
      retryDelay: 1000,
      fallbackAction: () => {
        logger.info('Audio disabled due to playback errors', 'error');
      }
    });
  }

  /**
   * 设置全局错误处理器
   */
  private setupGlobalErrorHandlers(): void {
    // 处理未捕获的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      const error = this.createError(
        ErrorType.NETWORK_ERROR,
        'Unhandled Promise Rejection',
        {
          reason: event.reason,
          promise: event.promise
        },
        false
      );
      
      this.handleError(error);
      event.preventDefault(); // 防止默认的控制台错误输出
    });

    // 处理JavaScript运行时错误
    window.addEventListener('error', (event) => {
      const error = this.createError(
        ErrorType.RENDER_ERROR,
        event.message || 'JavaScript Runtime Error',
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error
        },
        false,
        event.error?.stack
      );
      
      this.handleError(error);
    });
  }

  /**
   * 创建错误对象
   */
  createError(
    type: ErrorType,
    message: string,
    details?: any,
    recoverable = true,
    stack?: string
  ): GameError {
    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      details,
      timestamp: Date.now(),
      stack,
      recoverable,
      retryCount: 0,
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        gameState: this.getCurrentGameState(),
        component: this.getCurrentComponent()
      }
    };
  }

  /**
   * 获取当前游戏状态（简化版）
   */
  private getCurrentGameState(): string {
    try {
      // 这里可以从全局状态管理器获取状态
      return 'unknown';
    } catch {
      return 'error_getting_state';
    }
  }

  /**
   * 获取当前组件信息
   */
  private getCurrentComponent(): string {
    try {
      // 通过调用栈分析当前组件
      const stack = new Error().stack;
      if (stack) {
        const lines = stack.split('\n');
        for (const line of lines) {
          if (line.includes('.ts:') || line.includes('.js:')) {
            const match = line.match(/([^/\\]+\.(ts|js)):/);
            if (match) {
              return match[1];
            }
          }
        }
      }
      return 'unknown';
    } catch {
      return 'error_getting_component';
    }
  }

  /**
   * 处理错误
   */
  async handleError(error: GameError): Promise<void> {
    // 记录错误到日志系统
    this.logError(error);

    // 检查是否需要重试
    if (this.shouldRetry(error)) {
      await this.retryOperation(error);
      return;
    }

    // 执行恢复策略
    await this.executeRecoveryStrategy(error);

    // 通知用户（如果启用）
    if (this.config.enableUserNotification) {
      this.notifyUser(error);
    }

    // 触发错误回调
    this.triggerErrorCallbacks(error);

    // 报告错误（如果启用）
    if (this.config.enableErrorReporting) {
      await this.reportError(error);
    }
  }

  /**
   * 记录错误到日志
   */
  private logError(error: GameError): void {
    // 添加到内存日志
    this.errorLog.push(error);
    
    // 限制日志大小
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    // 使用统一日志系统记录错误
    const logLevel = error.recoverable ? LogLevel.WARN : LogLevel.ERROR;
    
    logger.log(logLevel, error.message, 'error', {
      errorId: error.id,
      errorType: error.type,
      details: error.details,
      context: error.context,
      retryCount: error.retryCount
    }, error.stack);
  }

  /**
   * 检查是否应该重试
   */
  private shouldRetry(error: GameError): boolean {
    if (!this.config.enableRetry || !error.recoverable) {
      return false;
    }

    const strategy = this.recoveryStrategies.get(error.type);
    if (!strategy) {
      return false;
    }

    // 检查重试次数
    if ((error.retryCount || 0) >= strategy.maxRetries) {
      return false;
    }

    // 检查自定义重试条件
    if (strategy.shouldRetry && !strategy.shouldRetry(error)) {
      return false;
    }

    return true;
  }

  /**
   * 重试操作
   */
  private async retryOperation(error: GameError): Promise<void> {
    const strategy = this.recoveryStrategies.get(error.type);
    if (!strategy) {
      return;
    }

    error.retryCount = (error.retryCount || 0) + 1;

    logger.info(
      `Retrying operation for error ${error.id} (attempt ${error.retryCount}/${strategy.maxRetries})`,
      'error',
      { errorType: error.type, errorMessage: error.message }
    );

    // 延迟重试
    await new Promise(resolve => {
      const timerId = window.setTimeout(resolve, strategy.retryDelay);
      this.retryTimers.set(error.id, timerId);
    });

    this.retryTimers.delete(error.id);

    // 这里应该重新执行原始操作
    // 由于我们不知道原始操作是什么，所以只记录重试尝试
    logger.debug(`Retry attempt completed for error ${error.id}`, 'error');
  }

  /**
   * 执行恢复策略
   */
  private async executeRecoveryStrategy(error: GameError): Promise<void> {
    const strategy = this.recoveryStrategies.get(error.type);
    
    if (strategy?.fallbackAction && this.config.enableFallback) {
      try {
        logger.info(`Executing fallback action for error type: ${error.type}`, 'error');
        await strategy.fallbackAction();
      } catch (fallbackError) {
        logger.error(
          'Fallback action failed',
          'error',
          { originalError: error, fallbackError },
          fallbackError instanceof Error ? fallbackError : undefined
        );
      }
    }
  }

  /**
   * 通知用户
   */
  private notifyUser(error: GameError): void {
    const userMessage = this.getUserFriendlyMessage(error);
    
    // 这里可以集成到UI通知系统
    logger.info(`User notification: ${userMessage}`, 'ui');
    
    // 简单的控制台通知（开发时使用）
    if (process.env.NODE_ENV === 'development') {
      console.warn('User Notification:', userMessage);
    }
  }

  /**
   * 获取用户友好的错误消息
   */
  private getUserFriendlyMessage(error: GameError): string {
    const messages: Record<ErrorType, string> = {
      [ErrorType.UPLOAD_ERROR]: '图片上传失败，请检查文件格式和大小',
      [ErrorType.API_ERROR]: '服务暂时不可用，请稍后重试',
      [ErrorType.NETWORK_ERROR]: '网络连接异常，请检查网络设置',
      [ErrorType.VALIDATION_ERROR]: '输入数据有误，请检查后重试',
      [ErrorType.RENDER_ERROR]: '渲染出现问题，正在尝试恢复',
      [ErrorType.AUDIO_ERROR]: '音频播放失败，游戏将以静音模式继续',
      [ErrorType.CANVAS_ERROR]: '画布渲染异常，正在切换到安全模式',
      [ErrorType.RESOURCE_ERROR]: '资源加载失败，正在使用备用资源',
      [ErrorType.PERFORMANCE_ERROR]: '性能异常，正在优化游戏设置',
      [ErrorType.INTERACTION_ERROR]: '交互异常，请刷新页面重试'
    };

    return messages[error.type] || '发生了未知错误，请刷新页面重试';
  }

  /**
   * 触发错误回调
   */
  private triggerErrorCallbacks(error: GameError): void {
    const callbacks = this.errorCallbacks.get(error.type) || [];
    
    for (const callback of callbacks) {
      try {
        callback(error);
      } catch (callbackError) {
        logger.error(
          'Error callback failed',
          'error',
          { originalError: error, callbackError },
          callbackError instanceof Error ? callbackError : undefined
        );
      }
    }
  }

  /**
   * 报告错误到远程服务器
   */
  private async reportError(error: GameError): Promise<void> {
    if (!this.config.reportingEndpoint) {
      return;
    }

    try {
      const response = await fetch(this.config.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error,
          metadata: {
            timestamp: Date.now(),
            sessionId: logger.sessionId,
            userAgent: navigator.userAgent,
            url: window.location.href
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      logger.debug(`Error reported successfully: ${error.id}`, 'error');
    } catch (reportingError) {
      logger.warn(
        'Failed to report error to remote server',
        'error',
        { originalError: error, reportingError }
      );
    }
  }

  /**
   * 添加恢复策略
   */
  addRecoveryStrategy(strategy: ErrorRecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.type, strategy);
  }

  /**
   * 移除恢复策略
   */
  removeRecoveryStrategy(type: ErrorType): void {
    this.recoveryStrategies.delete(type);
  }

  /**
   * 添加错误回调
   */
  onError(type: ErrorType, callback: (error: GameError) => void): void {
    if (!this.errorCallbacks.has(type)) {
      this.errorCallbacks.set(type, []);
    }
    this.errorCallbacks.get(type)!.push(callback);
  }

  /**
   * 移除错误回调
   */
  offError(type: ErrorType, callback: (error: GameError) => void): void {
    const callbacks = this.errorCallbacks.get(type);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 获取错误日志
   */
  getErrorLog(filter?: {
    type?: ErrorType;
    since?: number;
    limit?: number;
  }): GameError[] {
    let filtered = [...this.errorLog];

    if (filter) {
      if (filter.type) {
        filtered = filtered.filter(error => error.type === filter.type);
      }
      
      if (filter.since) {
        filtered = filtered.filter(error => error.timestamp >= filter.since!);
      }
      
      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered;
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: number;
    recoverySuccessRate: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    const errorsByType: Record<string, number> = {};
    let recentErrors = 0;
    let recoverableErrors = 0;
    let recoveredErrors = 0;

    for (const error of this.errorLog) {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
      
      if (error.timestamp >= oneHourAgo) {
        recentErrors++;
      }
      
      if (error.recoverable) {
        recoverableErrors++;
        if ((error.retryCount || 0) > 0) {
          recoveredErrors++;
        }
      }
    }

    const recoverySuccessRate = recoverableErrors > 0 
      ? (recoveredErrors / recoverableErrors) * 100 
      : 0;

    return {
      totalErrors: this.errorLog.length,
      errorsByType,
      recentErrors,
      recoverySuccessRate
    };
  }

  /**
   * 清除错误日志
   */
  clearErrorLog(): void {
    this.errorLog = [];
    logger.info('Error log cleared', 'error');
  }

  /**
   * 导出错误报告
   */
  exportErrorReport(): string {
    const stats = this.getErrorStats();
    
    const report = {
      timestamp: new Date().toISOString(),
      stats,
      errors: this.errorLog,
      config: this.config,
      strategies: Array.from(this.recoveryStrategies.entries()).map(([type, strategy]) => ({
        type,
        maxRetries: strategy.maxRetries,
        retryDelay: strategy.retryDelay
      }))
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * 销毁错误处理器
   */
  destroy(): void {
    // 清除所有重试定时器
    for (const timerId of this.retryTimers.values()) {
      clearTimeout(timerId);
    }
    this.retryTimers.clear();

    // 清除回调
    this.errorCallbacks.clear();

    // 清除策略
    this.recoveryStrategies.clear();

    // 清除日志
    this.errorLog = [];

    logger.info('ErrorHandler destroyed', 'error');
  }
}

// 全局错误处理器实例
export const errorHandler = new ErrorHandler();