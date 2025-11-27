/**
 * API服务类
 * 处理火山引擎即梦API的调用和图片变形功能
 */

import type { 
  JimengImageTransformRequest, 
  JimengImageTransformResponse,
  APIError,
  APIErrorType,
  APIRequestStatus,
  APIRequestResult
} from '@/types/api.types';
import { getAPIConfig, type APIConfig } from '@/config/api.config';

export interface APIServiceOptions {
  apiConfig?: APIConfig;
  enableRetry?: boolean;
  enableCache?: boolean;
  maxCacheSize?: number;
}

export interface TransformOptions {
  strength?: number;
  steps?: number;
  guidance_scale?: number;
  width?: number;
  height?: number;
  seed?: number;
  customPrompt?: string;
}

export interface CacheEntry {
  key: string;
  result: string;
  timestamp: number;
  expiresAt: number;
}

/**
 * API服务类
 */
export class APIService {
  private config: APIConfig;
  private options: Required<APIServiceOptions>;
  private requestCache = new Map<string, CacheEntry>();
  private activeRequests = new Map<string, Promise<string>>();
  private requestIdCounter = 0;

  constructor(options: APIServiceOptions = {}) {
    this.config = options.apiConfig || getAPIConfig();
    this.options = {
      apiConfig: this.config,
      enableRetry: true,
      enableCache: true,
      maxCacheSize: 50,
      ...options
    };

    this.validateConfig();
  }

  /**
   * 验证API配置
   */
  private validateConfig(): void {
    if (!this.config.jimengAI.apiKey) {
      console.warn('JimengAI API key not configured. Image transformation will not work.');
    }

    if (!this.config.jimengAI.endpoint) {
      throw new Error('JimengAI API endpoint not configured');
    }
  }

  /**
   * 变形图片
   */
  async transformImage(
    imageBase64: string, 
    transformType: 'light' | 'heavy',
    options: TransformOptions = {}
  ): Promise<string> {
    if (!this.config.jimengAI.apiKey) {
      throw this.createAPIError(
        'AUTH_ERROR',
        'API key not configured',
        { transformType }
      );
    }

    // 生成请求ID
    const requestId = `transform_${++this.requestIdCounter}`;
    
    try {
      // 检查缓存
      if (this.options.enableCache) {
        const cachedResult = this.getCachedResult(imageBase64, transformType, options);
        if (cachedResult) {
          console.log('Using cached transformation result');
          return cachedResult;
        }
      }

      // 检查是否有相同的请求正在进行
      const requestKey = this.generateRequestKey(imageBase64, transformType, options);
      if (this.activeRequests.has(requestKey)) {
        console.log('Waiting for existing request to complete');
        return await this.activeRequests.get(requestKey)!;
      }

      // 创建新请求
      const requestPromise = this.performTransformation(imageBase64, transformType, options, requestId);
      this.activeRequests.set(requestKey, requestPromise);

      try {
        const result = await requestPromise;
        
        // 缓存结果
        if (this.options.enableCache) {
          this.cacheResult(requestKey, result);
        }

        return result;
      } finally {
        this.activeRequests.delete(requestKey);
      }

    } catch (error) {
      console.error('Image transformation failed:', error);
      throw error instanceof Error && (error as any).type 
        ? error 
        : this.createAPIError('UNKNOWN_ERROR', 'Image transformation failed', { error, requestId });
    }
  }

  /**
   * 执行图片变形
   */
  private async performTransformation(
    imageBase64: string,
    transformType: 'light' | 'heavy',
    options: TransformOptions,
    requestId: string
  ): Promise<string> {
    const jimengConfig = this.config.jimengAI;
    
    // 构建请求参数
    const request: JimengImageTransformRequest = {
      model: jimengConfig.defaultModel,
      prompt: options.customPrompt || jimengConfig.transformPrompts[transformType],
      image: this.cleanBase64(imageBase64),
      strength: options.strength || jimengConfig.defaultParams.strength[transformType],
      steps: options.steps || jimengConfig.defaultParams.steps,
      guidance_scale: options.guidance_scale || jimengConfig.defaultParams.guidance_scale,
      width: options.width || jimengConfig.defaultParams.width,
      height: options.height || jimengConfig.defaultParams.height,
      seed: options.seed
    };

    console.log(`Starting image transformation (${transformType}) - Request ID: ${requestId}`);

    let lastError: Error | null = null;
    const maxRetries = this.options.enableRetry ? jimengConfig.retryCount : 1;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Transformation attempt ${attempt}/${maxRetries}`);
        
        const response = await this.makeAPIRequest(request, requestId);
        
        if (response.success && response.data?.image) {
          console.log(`Transformation successful on attempt ${attempt}`);
          return this.addBase64Prefix(response.data.image);
        } else {
          throw this.createAPIError(
            'SERVER_ERROR',
            response.message || response.error || 'Transformation failed',
            { response, attempt, requestId }
          );
        }

      } catch (error) {
        lastError = error as Error;
        console.warn(`Transformation attempt ${attempt} failed:`, error);

        // 如果是最后一次尝试，或者是不可重试的错误，直接抛出
        if (attempt === maxRetries || !this.isRetryableError(error as Error)) {
          break;
        }

        // 等待后重试
        const delay = this.calculateRetryDelay(attempt);
        console.log(`Retrying in ${delay}ms...`);
        await this.sleep(delay);
      }
    }

    throw lastError || this.createAPIError('UNKNOWN_ERROR', 'All retry attempts failed', { requestId });
  }

  /**
   * 发起API请求
   */
  private async makeAPIRequest(
    request: JimengImageTransformRequest,
    requestId: string
  ): Promise<JimengImageTransformResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, this.config.jimengAI.timeout);

    try {
      const response = await fetch(this.config.jimengAI.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.jimengAI.apiKey}`,
          'X-Request-ID': requestId
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw this.createAPIError(
          this.getErrorTypeFromStatus(response.status),
          `HTTP ${response.status}: ${response.statusText}`,
          { status: response.status, errorText, requestId }
        );
      }

      const result: JimengImageTransformResponse = await response.json();
      return result;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createAPIError(
          'TIMEOUT_ERROR',
          'Request timeout',
          { timeout: this.config.jimengAI.timeout, requestId }
        );
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw this.createAPIError(
          'NETWORK_ERROR',
          'Network connection failed',
          { originalError: error, requestId }
        );
      }

      throw error;
    }
  }

  /**
   * 根据HTTP状态码获取错误类型
   */
  private getErrorTypeFromStatus(status: number): APIErrorType {
    if (status === 401 || status === 403) {
      return 'AUTH_ERROR';
    } else if (status === 429) {
      return 'RATE_LIMIT_ERROR';
    } else if (status >= 400 && status < 500) {
      return 'INVALID_REQUEST';
    } else if (status >= 500) {
      return 'SERVER_ERROR';
    } else {
      return 'UNKNOWN_ERROR';
    }
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: Error): boolean {
    const apiError = error as APIError;
    
    // 网络错误、超时错误、服务器错误可以重试
    const retryableTypes: APIErrorType[] = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'SERVER_ERROR'
    ];

    return retryableTypes.includes(apiError.type);
  }

  /**
   * 计算重试延迟
   */
  private calculateRetryDelay(attempt: number): number {
    // 指数退避策略：1s, 2s, 4s
    return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
  }

  /**
   * 生成请求键
   */
  private generateRequestKey(
    imageBase64: string,
    transformType: string,
    options: TransformOptions
  ): string {
    // 使用图片的哈希和参数生成唯一键
    const imageHash = this.simpleHash(imageBase64);
    const optionsStr = JSON.stringify({
      transformType,
      ...options
    });
    return `${imageHash}_${this.simpleHash(optionsStr)}`;
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 获取缓存结果
   */
  private getCachedResult(
    imageBase64: string,
    transformType: string,
    options: TransformOptions
  ): string | null {
    const key = this.generateRequestKey(imageBase64, transformType, options);
    const entry = this.requestCache.get(key);
    
    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.requestCache.delete(key);
      return null;
    }

    return entry.result;
  }

  /**
   * 缓存结果
   */
  private cacheResult(key: string, result: string): void {
    // 检查缓存大小限制
    if (this.requestCache.size >= this.options.maxCacheSize) {
      // 删除最老的条目
      const oldestKey = this.requestCache.keys().next().value;
      if (oldestKey) {
        this.requestCache.delete(oldestKey);
      }
    }

    const entry: CacheEntry = {
      key,
      result,
      timestamp: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24小时过期
    };

    this.requestCache.set(key, entry);
  }

  /**
   * 清理Base64字符串
   */
  private cleanBase64(base64: string): string {
    // 移除data:image前缀
    return base64.replace(/^data:image\/[a-z]+;base64,/, '');
  }

  /**
   * 添加Base64前缀
   */
  private addBase64Prefix(base64: string): string {
    if (base64.startsWith('data:')) {
      return base64;
    }
    return `data:image/jpeg;base64,${base64}`;
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 创建API错误
   */
  private createAPIError(
    type: APIErrorType,
    message: string,
    details?: any
  ): APIError {
    return {
      type,
      message,
      details,
      timestamp: Date.now()
    };
  }

  /**
   * 批量变形图片
   */
  async batchTransformImages(
    images: Array<{ data: string; type: 'light' | 'heavy'; options?: TransformOptions }>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<string[]> {
    const results: string[] = [];
    
    for (let i = 0; i < images.length; i++) {
      const { data, type, options } = images[i];
      
      try {
        const result = await this.transformImage(data, type, options);
        results.push(result);
      } catch (error) {
        console.error(`Batch transformation failed for image ${i}:`, error);
        results.push(''); // 失败时推入空字符串
      }
      
      onProgress?.(i + 1, images.length);
    }
    
    return results;
  }

  /**
   * 获取API状态
   */
  async getAPIStatus(): Promise<{ available: boolean; latency?: number; error?: string }> {
    if (!this.config.jimengAI.apiKey) {
      return { available: false, error: 'API key not configured' };
    }

    const startTime = Date.now();
    
    try {
      // 发送一个简单的测试请求
      const response = await fetch(this.config.jimengAI.endpoint, {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${this.config.jimengAI.apiKey}`
        },
        signal: AbortSignal.timeout(5000)
      });

      const latency = Date.now() - startTime;
      
      return {
        available: response.ok,
        latency,
        error: response.ok ? undefined : `HTTP ${response.status}`
      };

    } catch (error) {
      return {
        available: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.requestCache.clear();
    console.log('API cache cleared');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntry?: number;
  } {
    const entries = Array.from(this.requestCache.values());
    const oldestEntry = entries.length > 0 
      ? Math.min(...entries.map(e => e.timestamp))
      : undefined;

    return {
      size: this.requestCache.size,
      maxSize: this.options.maxCacheSize,
      hitRate: 0, // 需要额外跟踪命中率
      oldestEntry
    };
  }

  /**
   * 更新API配置
   */
  updateConfig(newConfig: Partial<APIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.validateConfig();
  }

  /**
   * 获取当前配置
   */
  getConfig(): APIConfig {
    return { ...this.config };
  }

  /**
   * 取消所有进行中的请求
   */
  cancelAllRequests(): void {
    this.activeRequests.clear();
    console.log('All active requests cancelled');
  }

  /**
   * 销毁API服务
   */
  destroy(): void {
    this.cancelAllRequests();
    this.clearCache();
  }
}