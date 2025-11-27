/**
 * APIService 单元测试
 */

import { APIService } from '../APIService';
import type { APIConfig } from '@/config/api.config';

// Mock fetch
global.fetch = jest.fn();

// Mock AbortSignal.timeout
global.AbortSignal = {
  timeout: jest.fn((ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  })
} as any;

// Mock API配置
const mockAPIConfig: APIConfig = {
  jimengAI: {
    endpoint: 'https://api.jimengai.com/image2image',
    apiKey: 'test-api-key',
    defaultModel: 'test-model',
    transformPrompts: {
      light: 'slightly damaged',
      heavy: 'heavily damaged'
    },
    defaultParams: {
      strength: { light: 0.3, heavy: 0.7 },
      steps: 30,
      guidance_scale: 10,
      width: 512,
      height: 512
    },
    timeout: 30000,
    retryCount: 3
  }
};

describe('APIService', () => {
  let apiService: APIService;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    apiService = new APIService({
      apiConfig: mockAPIConfig,
      enableRetry: true,
      enableCache: true
    });
  });

  afterEach(() => {
    apiService.destroy();
  });

  describe('初始化', () => {
    it('应该成功初始化API服务', () => {
      expect(apiService).toBeTruthy();
      
      const config = apiService.getConfig();
      expect(config.jimengAI.apiKey).toBe('test-api-key');
      expect(config.jimengAI.endpoint).toBe('https://api.jimengai.com/image2image');
    });

    it('应该在没有API密钥时发出警告', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const configWithoutKey = {
        ...mockAPIConfig,
        jimengAI: { ...mockAPIConfig.jimengAI, apiKey: '' }
      };
      
      new APIService({ apiConfig: configWithoutKey }).destroy();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API key not configured')
      );
      
      consoleSpy.mockRestore();
    });

    it('应该在没有端点时抛出错误', () => {
      const configWithoutEndpoint = {
        ...mockAPIConfig,
        jimengAI: { ...mockAPIConfig.jimengAI, endpoint: '' }
      };
      
      expect(() => {
        new APIService({ apiConfig: configWithoutEndpoint });
      }).toThrow('JimengAI API endpoint not configured');
    });
  });

  describe('图片变形', () => {
    const testImageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/test';
    const mockResponse = {
      success: true,
      message: 'Success',
      data: {
        image: 'transformed-image-base64',
        seed: 12345
      }
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
        text: () => Promise.resolve(''),
        status: 200,
        statusText: 'OK'
      } as Response);
    });

    it('应该成功变形图片', async () => {
      const result = await apiService.transformImage(testImageBase64, 'light');
      
      expect(result).toBe('data:image/jpeg;base64,transformed-image-base64');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.jimengai.com/image2image',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          }),
          body: expect.stringContaining('slightly damaged')
        })
      );
    });

    it('应该使用正确的变形参数', async () => {
      await apiService.transformImage(testImageBase64, 'heavy', {
        strength: 0.8,
        steps: 40,
        customPrompt: 'custom prompt'
      });
      
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      
      expect(requestBody.prompt).toBe('custom prompt');
      expect(requestBody.strength).toBe(0.8);
      expect(requestBody.steps).toBe(40);
      expect(requestBody.image).toBe('/9j/4AAQSkZJRgABAQEAYABgAAD/test'); // 清理后的base64
    });

    it('应该处理API错误响应', async () => {
      const errorResponse = {
        success: false,
        message: 'Invalid request',
        error: 'Bad parameters'
      };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(errorResponse)
      } as Response);
      
      await expect(apiService.transformImage(testImageBase64, 'light'))
        .rejects.toThrow('Invalid request');
    });

    it('应该处理HTTP错误', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Unauthorized')
      } as Response);
      
      await expect(apiService.transformImage(testImageBase64, 'light'))
        .rejects.toMatchObject({
          type: 'AUTH_ERROR',
          message: 'HTTP 401: Unauthorized'
        });
    });

    it('应该处理网络错误', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
      
      await expect(apiService.transformImage(testImageBase64, 'light'))
        .rejects.toMatchObject({
          type: 'NETWORK_ERROR',
          message: 'Network connection failed'
        });
    });

    it('应该处理超时错误', async () => {
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 100);
        })
      );
      
      // Mock AbortError
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);
      
      await expect(apiService.transformImage(testImageBase64, 'light'))
        .rejects.toMatchObject({
          type: 'TIMEOUT_ERROR',
          message: 'Request timeout'
        });
    });

    it('应该在没有API密钥时抛出错误', async () => {
      const serviceWithoutKey = new APIService({
        apiConfig: {
          ...mockAPIConfig,
          jimengAI: { ...mockAPIConfig.jimengAI, apiKey: '' }
        }
      });
      
      await expect(serviceWithoutKey.transformImage(testImageBase64, 'light'))
        .rejects.toMatchObject({
          type: 'AUTH_ERROR',
          message: 'API key not configured'
        });
      
      serviceWithoutKey.destroy();
    });
  });

  describe('重试机制', () => {
    const testImageBase64 = 'data:image/jpeg;base64,test';

    it('应该在可重试错误时重试', async () => {
      // 前两次失败，第三次成功
      mockFetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { image: 'success-image', seed: 123 }
          })
        } as Response);
      
      const result = await apiService.transformImage(testImageBase64, 'light');
      
      expect(result).toBe('data:image/jpeg;base64,success-image');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('应该在不可重试错误时立即失败', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Unauthorized')
      } as Response);
      
      await expect(apiService.transformImage(testImageBase64, 'light'))
        .rejects.toMatchObject({
          type: 'AUTH_ERROR'
        });
      
      expect(mockFetch).toHaveBeenCalledTimes(1); // 不应该重试
    });

    it('应该在禁用重试时不重试', async () => {
      const serviceWithoutRetry = new APIService({
        apiConfig: mockAPIConfig,
        enableRetry: false
      });
      
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
      
      await expect(serviceWithoutRetry.transformImage(testImageBase64, 'light'))
        .rejects.toThrow();
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      serviceWithoutRetry.destroy();
    });
  });

  describe('缓存机制', () => {
    const testImageBase64 = 'data:image/jpeg;base64,test';
    const mockResponse = {
      success: true,
      data: { image: 'cached-image', seed: 123 }
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      } as Response);
    });

    it('应该缓存成功的结果', async () => {
      // 第一次调用
      const result1 = await apiService.transformImage(testImageBase64, 'light');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // 第二次调用应该使用缓存
      const result2 = await apiService.transformImage(testImageBase64, 'light');
      expect(mockFetch).toHaveBeenCalledTimes(1); // 没有新的请求
      expect(result1).toBe(result2);
    });

    it('应该为不同参数创建不同缓存', async () => {
      await apiService.transformImage(testImageBase64, 'light');
      await apiService.transformImage(testImageBase64, 'heavy');
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('应该在禁用缓存时不使用缓存', async () => {
      const serviceWithoutCache = new APIService({
        apiConfig: mockAPIConfig,
        enableCache: false
      });
      
      await serviceWithoutCache.transformImage(testImageBase64, 'light');
      await serviceWithoutCache.transformImage(testImageBase64, 'light');
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      serviceWithoutCache.destroy();
    });

    it('应该清除缓存', async () => {
      await apiService.transformImage(testImageBase64, 'light');
      
      apiService.clearCache();
      
      await apiService.transformImage(testImageBase64, 'light');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('应该提供缓存统计', async () => {
      await apiService.transformImage(testImageBase64, 'light');
      
      const stats = apiService.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.maxSize).toBeGreaterThan(0);
    });
  });

  describe('并发请求处理', () => {
    const testImageBase64 = 'data:image/jpeg;base64,test';

    it('应该合并相同的并发请求', async () => {
      let resolvePromise: (value: any) => void;
      const delayedPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockFetch.mockImplementation(() => delayedPromise);

      // 同时发起两个相同的请求
      const promise1 = apiService.transformImage(testImageBase64, 'light');
      const promise2 = apiService.transformImage(testImageBase64, 'light');

      // 解决请求
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { image: 'result', seed: 123 }
        })
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe(result2);
      expect(mockFetch).toHaveBeenCalledTimes(1); // 只发起一次请求
    });
  });

  describe('批量变形', () => {
    const testImages = [
      { data: 'data:image/jpeg;base64,test1', type: 'light' as const },
      { data: 'data:image/jpeg;base64,test2', type: 'heavy' as const }
    ];

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { image: 'batch-result', seed: 123 }
        })
      } as Response);
    });

    it('应该批量处理多张图片', async () => {
      const onProgress = jest.fn();
      
      const results = await apiService.batchTransformImages(testImages, onProgress);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toBe('data:image/jpeg;base64,batch-result');
      expect(results[1]).toBe('data:image/jpeg;base64,batch-result');
      expect(onProgress).toHaveBeenCalledWith(1, 2);
      expect(onProgress).toHaveBeenCalledWith(2, 2);
    });

    it('应该处理批量处理中的错误', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { image: 'success', seed: 123 }
          })
        } as Response)
        .mockRejectedValueOnce(new Error('Failed'));
      
      const results = await apiService.batchTransformImages(testImages);
      
      expect(results).toHaveLength(2);
      expect(results[0]).toBe('data:image/jpeg;base64,success');
      expect(results[1]).toBe(''); // 失败时返回空字符串
    });
  });

  describe('API状态检查', () => {
    it('应该检查API可用性', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      } as Response);
      
      const status = await apiService.getAPIStatus();
      
      expect(status.available).toBe(true);
      expect(status.latency).toBeGreaterThan(0);
      expect(status.error).toBeUndefined();
    });

    it('应该处理API不可用', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503
      } as Response);
      
      const status = await apiService.getAPIStatus();
      
      expect(status.available).toBe(false);
      expect(status.error).toBe('HTTP 503');
    });

    it('应该处理网络错误', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const status = await apiService.getAPIStatus();
      
      expect(status.available).toBe(false);
      expect(status.error).toBe('Network error');
    });
  });

  describe('配置管理', () => {
    it('应该更新配置', () => {
      const newConfig = {
        jimengAI: {
          ...mockAPIConfig.jimengAI,
          apiKey: 'new-api-key'
        }
      };
      
      apiService.updateConfig(newConfig);
      
      const config = apiService.getConfig();
      expect(config.jimengAI.apiKey).toBe('new-api-key');
    });

    it('应该返回配置副本', () => {
      const config1 = apiService.getConfig();
      const config2 = apiService.getConfig();
      
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  describe('请求管理', () => {
    it('应该取消所有进行中的请求', () => {
      apiService.cancelAllRequests();
      
      // 验证没有活跃请求
      expect(() => apiService.cancelAllRequests()).not.toThrow();
    });
  });

  describe('销毁功能', () => {
    it('应该正确销毁服务', () => {
      apiService.destroy();
      
      const stats = apiService.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('工具方法', () => {
    it('应该正确清理Base64字符串', () => {
      const service = apiService as any;
      
      const withPrefix = 'data:image/jpeg;base64,test123';
      const cleaned = service.cleanBase64(withPrefix);
      expect(cleaned).toBe('test123');
      
      const withoutPrefix = 'test123';
      const cleanedAgain = service.cleanBase64(withoutPrefix);
      expect(cleanedAgain).toBe('test123');
    });

    it('应该正确添加Base64前缀', () => {
      const service = apiService as any;
      
      const withoutPrefix = 'test123';
      const withPrefix = service.addBase64Prefix(withoutPrefix);
      expect(withPrefix).toBe('data:image/jpeg;base64,test123');
      
      const alreadyWithPrefix = 'data:image/png;base64,test123';
      const unchanged = service.addBase64Prefix(alreadyWithPrefix);
      expect(unchanged).toBe(alreadyWithPrefix);
    });

    it('应该生成一致的请求键', () => {
      const service = apiService as any;
      
      const key1 = service.generateRequestKey('image1', 'light', { strength: 0.5 });
      const key2 = service.generateRequestKey('image1', 'light', { strength: 0.5 });
      const key3 = service.generateRequestKey('image1', 'heavy', { strength: 0.5 });
      
      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });
});