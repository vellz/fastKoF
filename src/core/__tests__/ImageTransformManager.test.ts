/**
 * ImageTransformManager 单元测试
 */

import { ImageTransformManager } from '../ImageTransformManager';
import { APIService } from '@/services/APIService';
import { ImageManager } from '../ImageManager';
import type { GameState } from '@/types/game.types';

// Mock APIService
jest.mock('@/services/APIService');
jest.mock('../ImageManager');

// Mock Image
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  width = 100;
  height = 100;

  set src(value: string) {
    setTimeout(() => {
      if (value.includes('error')) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    }, 10);
  }
}

global.Image = MockImage as any;

describe('ImageTransformManager', () => {
  let transformManager: ImageTransformManager;
  let mockAPIService: jest.Mocked<APIService>;
  let mockImageManager: jest.Mocked<ImageManager>;
  let mockImage: HTMLImageElement;

  beforeEach(() => {
    // 创建mock实例
    mockAPIService = {
      transformImage: jest.fn().mockResolvedValue('data:image/jpeg;base64,transformed'),
      destroy: jest.fn()
    } as any;

    mockImageManager = {
      resizeImage: jest.fn().mockReturnValue(document.createElement('canvas')),
      imageToBase64: jest.fn().mockReturnValue('data:image/jpeg;base64,original'),
      destroy: jest.fn()
    } as any;

    mockImage = new MockImage() as any;

    transformManager = new ImageTransformManager({
      apiService: mockAPIService,
      imageManager: mockImageManager,
      phase1Threshold: 50,
      phase2Threshold: 100
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    transformManager.destroy();
  });

  describe('初始化', () => {
    it('应该成功初始化变形管理器', () => {
      expect(transformManager).toBeTruthy();
      
      const state = transformManager.getState();
      expect(state.isTransforming).toBe(false);
      expect(state.transformHistory).toHaveLength(0);
    });

    it('应该使用自定义选项', () => {
      const customManager = new ImageTransformManager({
        phase1Threshold: 30,
        phase2Threshold: 80,
        maxTransformAttempts: 5
      });
      
      expect(customManager).toBeTruthy();
      customManager.destroy();
    });
  });

  describe('变形条件检查', () => {
    const mockGameState: GameState = {
      uploadedImage: mockImage,
      isPlaying: true,
      clickCount: 0,
      currentPhase: 'initial' as any,
      transformedImages: [],
      isTransforming: false,
      lastClickTime: 0,
      isPaused: false
    };

    it('应该在达到轻度变形阈值时建议变形', () => {
      const result = transformManager.shouldTransform(50, mockGameState);
      
      expect(result.shouldTransform).toBe(true);
      expect(result.transformType).toBe('light');
    });

    it('应该在达到重度变形阈值时建议变形', () => {
      const result = transformManager.shouldTransform(100, mockGameState);
      
      expect(result.shouldTransform).toBe(true);
      expect(result.transformType).toBe('heavy');
    });

    it('应该在未达到阈值时不建议变形', () => {
      const result = transformManager.shouldTransform(30, mockGameState);
      
      expect(result.shouldTransform).toBe(false);
    });

    it('应该在没有上传图片时不建议变形', () => {
      const stateWithoutImage = { ...mockGameState, uploadedImage: null };
      const result = transformManager.shouldTransform(100, stateWithoutImage);
      
      expect(result.shouldTransform).toBe(false);
    });

    it('应该在正在变形时不建议变形', () => {
      // 先设置为正在变形状态
      transformManager['setState']({ isTransforming: true });
      
      const result = transformManager.shouldTransform(100, mockGameState);
      
      expect(result.shouldTransform).toBe(false);
    });
  });

  describe('图片变形', () => {
    it('应该成功执行图片变形', async () => {
      const onProgress = jest.fn();
      
      const result = await transformManager.transformImage(mockImage, 'light', onProgress);
      
      expect(result.success).toBe(true);
      expect(result.transformType).toBe('light');
      expect(result.transformedImage).toBeTruthy();
      expect(result.processingTime).toBeGreaterThan(0);
      
      // 验证进度回调被调用
      expect(onProgress).toHaveBeenCalled();
      
      // 验证API调用
      expect(mockAPIService.transformImage).toHaveBeenCalledWith(
        'data:image/jpeg;base64,original',
        'light',
        expect.objectContaining({
          strength: 0.4,
          steps: 30
        })
      );
    });

    it('应该处理重度变形', async () => {
      const result = await transformManager.transformImage(mockImage, 'heavy');
      
      expect(result.success).toBe(true);
      expect(result.transformType).toBe('heavy');
      
      expect(mockAPIService.transformImage).toHaveBeenCalledWith(
        'data:image/jpeg;base64,original',
        'heavy',
        expect.objectContaining({
          strength: 0.8,
          steps: 40
        })
      );
    });

    it('应该在变形进行中时抛出错误', async () => {
      // 设置为正在变形状态
      transformManager['setState']({ isTransforming: true });
      
      await expect(transformManager.transformImage(mockImage, 'light'))
        .rejects.toMatchObject({
          type: 'VALIDATION_ERROR',
          message: 'Transform already in progress'
        });
    });

    it('应该处理API错误', async () => {
      mockAPIService.transformImage.mockRejectedValue(new Error('API Error'));
      
      await expect(transformManager.transformImage(mockImage, 'light'))
        .rejects.toThrow();
      
      const history = transformManager.getTransformHistory();
      expect(history).toHaveLength(1);
      expect(history[0].success).toBe(false);
    });

    it('应该重试失败的变形', async () => {
      // 前两次失败，第三次成功
      mockAPIService.transformImage
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce('data:image/jpeg;base64,success');
      
      const result = await transformManager.transformImage(mockImage, 'light');
      
      expect(result.success).toBe(true);
      expect(mockAPIService.transformImage).toHaveBeenCalledTimes(3);
    });

    it('应该在所有重试失败后抛出错误', async () => {
      mockAPIService.transformImage.mockRejectedValue(new Error('Persistent error'));
      
      await expect(transformManager.transformImage(mockImage, 'light'))
        .rejects.toThrow();
      
      expect(mockAPIService.transformImage).toHaveBeenCalledTimes(3); // 默认最大重试次数
    });
  });

  describe('进度跟踪', () => {
    it('应该报告变形进度', async () => {
      const progressUpdates: any[] = [];
      const onProgress = (progress: any) => progressUpdates.push(progress);
      
      await transformManager.transformImage(mockImage, 'light', onProgress);
      
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // 验证进度阶段
      const phases = progressUpdates.map(p => p.phase);
      expect(phases).toContain('preparing');
      expect(phases).toContain('uploading');
      expect(phases).toContain('processing');
      expect(phases).toContain('downloading');
      expect(phases).toContain('completed');
      
      // 验证进度递增
      const progressValues = progressUpdates.map(p => p.progress);
      expect(progressValues[progressValues.length - 1]).toBe(100);
    });

    it('应该计算预估剩余时间', async () => {
      const progressUpdates: any[] = [];
      const onProgress = (progress: any) => progressUpdates.push(progress);
      
      await transformManager.transformImage(mockImage, 'light', onProgress);
      
      // 检查是否有预估时间
      const withEstimatedTime = progressUpdates.filter(p => p.estimatedTimeRemaining !== undefined);
      expect(withEstimatedTime.length).toBeGreaterThan(0);
    });
  });

  describe('变形取消', () => {
    it('应该能够取消正在进行的变形', async () => {
      // 模拟长时间运行的API调用
      mockAPIService.transformImage.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 5000))
      );
      
      const transformPromise = transformManager.transformImage(mockImage, 'light');
      
      // 立即取消
      transformManager.cancelTransform();
      
      await expect(transformPromise).rejects.toMatchObject({
        message: 'Transform was cancelled'
      });
      
      const state = transformManager.getState();
      expect(state.isTransforming).toBe(false);
    });
  });

  describe('变形历史', () => {
    it('应该记录变形历史', async () => {
      await transformManager.transformImage(mockImage, 'light');
      await transformManager.transformImage(mockImage, 'heavy');
      
      const history = transformManager.getTransformHistory();
      expect(history).toHaveLength(2);
      expect(history[0].transformType).toBe('light');
      expect(history[1].transformType).toBe('heavy');
    });

    it('应该获取最后一次变形结果', async () => {
      await transformManager.transformImage(mockImage, 'light');
      
      const lastResult = transformManager.getLastTransformResult();
      expect(lastResult).toBeTruthy();
      expect(lastResult!.transformType).toBe('light');
    });

    it('应该清除变形历史', async () => {
      await transformManager.transformImage(mockImage, 'light');
      
      transformManager.clearHistory();
      
      const history = transformManager.getTransformHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('重试功能', () => {
    it('应该重试上次失败的变形', async () => {
      // 第一次失败
      mockAPIService.transformImage.mockRejectedValueOnce(new Error('First failure'));
      
      try {
        await transformManager.transformImage(mockImage, 'light');
      } catch (error) {
        // 预期的失败
      }
      
      // 重试时成功
      mockAPIService.transformImage.mockResolvedValueOnce('data:image/jpeg;base64,retry-success');
      
      const retryResult = await transformManager.retryLastTransform();
      
      expect(retryResult).toBeTruthy();
      expect(retryResult!.success).toBe(true);
    });

    it('应该在没有失败变形时返回null', async () => {
      await transformManager.transformImage(mockImage, 'light'); // 成功的变形
      
      const retryResult = await transformManager.retryLastTransform();
      
      expect(retryResult).toBeNull();
    });
  });

  describe('渐进式变形建议', () => {
    it('应该提供渐进式变形建议', () => {
      const suggestion1 = transformManager.getProgressiveTransformSuggestion(50);
      expect(suggestion1.suggested).toBe(true);
      expect(suggestion1.transformType).toBe('light');
      
      const suggestion2 = transformManager.getProgressiveTransformSuggestion(100);
      expect(suggestion2.suggested).toBe(true);
      expect(suggestion2.transformType).toBe('heavy');
      
      const suggestion3 = transformManager.getProgressiveTransformSuggestion(30);
      expect(suggestion3.suggested).toBe(false);
    });

    it('应该在禁用渐进式变形时不提供建议', () => {
      const managerWithoutProgressive = new ImageTransformManager({
        enableProgressiveTransform: false
      });
      
      const suggestion = managerWithoutProgressive.getProgressiveTransformSuggestion(100);
      expect(suggestion.suggested).toBe(false);
      expect(suggestion.reason).toContain('disabled');
      
      managerWithoutProgressive.destroy();
    });
  });

  describe('统计信息', () => {
    it('应该提供变形统计信息', async () => {
      await transformManager.transformImage(mockImage, 'light');
      
      // 模拟一次失败
      mockAPIService.transformImage.mockRejectedValueOnce(new Error('Test error'));
      try {
        await transformManager.transformImage(mockImage, 'heavy');
      } catch (error) {
        // 预期的失败
      }
      
      const stats = transformManager.getTransformStats();
      
      expect(stats.totalTransforms).toBe(2);
      expect(stats.successfulTransforms).toBe(1);
      expect(stats.failedTransforms).toBe(1);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
      expect(stats.isTransforming).toBe(false);
    });
  });

  describe('错误处理', () => {
    it('应该处理图片加载错误', async () => {
      mockAPIService.transformImage.mockResolvedValue('data:image/jpeg;base64,error');
      
      await expect(transformManager.transformImage(mockImage, 'light'))
        .rejects.toMatchObject({
          type: 'RENDER_ERROR',
          message: 'Failed to load transformed image'
        });
    });

    it('应该处理图片准备错误', async () => {
      mockImageManager.imageToBase64.mockImplementation(() => {
        throw new Error('Canvas error');
      });
      
      await expect(transformManager.transformImage(mockImage, 'light'))
        .rejects.toThrow();
    });
  });

  describe('状态管理', () => {
    it('应该正确更新状态', async () => {
      const transformPromise = transformManager.transformImage(mockImage, 'light');
      
      // 检查变形中状态
      let state = transformManager.getState();
      expect(state.isTransforming).toBe(true);
      
      await transformPromise;
      
      // 检查完成状态
      state = transformManager.getState();
      expect(state.isTransforming).toBe(false);
      expect(state.transformHistory).toHaveLength(1);
    });
  });

  describe('销毁功能', () => {
    it('应该正确销毁管理器', () => {
      transformManager.destroy();
      
      expect(mockAPIService.destroy).toHaveBeenCalled();
      
      const state = transformManager.getState();
      expect(state.transformHistory).toHaveLength(0);
    });
  });

  describe('并发控制', () => {
    it('应该防止并发变形', async () => {
      const promise1 = transformManager.transformImage(mockImage, 'light');
      
      await expect(transformManager.transformImage(mockImage, 'heavy'))
        .rejects.toMatchObject({
          message: 'Transform already in progress'
        });
      
      await promise1; // 等待第一个完成
    });
  });
});