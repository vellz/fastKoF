/**
 * 图片变形管理器
 * 集成APIService，提供游戏中的图片变形功能
 */

import { APIService } from '@/services/APIService';
import { ImageManager } from './ImageManager';
import type { GameState, GamePhase } from '@/types/game.types';
import type { GameError } from '@/types/error.types';

export interface TransformManagerOptions {
  apiService?: APIService;
  imageManager?: ImageManager;
  phase1Threshold?: number;
  phase2Threshold?: number;
  enableProgressiveTransform?: boolean;
  maxTransformAttempts?: number;
}

export interface TransformProgress {
  phase: 'preparing' | 'uploading' | 'processing' | 'downloading' | 'completed' | 'error';
  progress: number; // 0-100
  message: string;
  estimatedTimeRemaining?: number;
}

export interface TransformResult {
  success: boolean;
  transformedImage?: HTMLImageElement;
  originalImage?: HTMLImageElement;
  transformType: 'light' | 'heavy';
  processingTime: number;
  error?: GameError;
}

export interface TransformState {
  isTransforming: boolean;
  currentPhase: TransformProgress['phase'];
  progress: number;
  lastTransformTime: number;
  transformHistory: TransformResult[];
  failedAttempts: number;
}

/**
 * 图片变形管理器类
 */
export class ImageTransformManager {
  private apiService: APIService;
  private imageManager: ImageManager;
  private options: Required<TransformManagerOptions>;
  private state: TransformState;
  private progressCallbacks = new Set<(progress: TransformProgress) => void>();
  private abortController: AbortController | null = null;

  constructor(options: TransformManagerOptions = {}) {
    this.apiService = options.apiService || new APIService();
    this.imageManager = options.imageManager || new ImageManager();
    
    this.options = {
      apiService: this.apiService,
      imageManager: this.imageManager,
      phase1Threshold: 50,
      phase2Threshold: 100,
      enableProgressiveTransform: true,
      maxTransformAttempts: 3,
      ...options
    };

    this.state = {
      isTransforming: false,
      currentPhase: 'completed',
      progress: 0,
      lastTransformTime: 0,
      transformHistory: [],
      failedAttempts: 0
    };
  }

  /**
   * 检查是否需要变形
   */
  shouldTransform(clickCount: number, gameState: GameState): { shouldTransform: boolean; transformType?: 'light' | 'heavy' } {
    if (!gameState.uploadedImage || this.state.isTransforming) {
      return { shouldTransform: false };
    }

    // 检查是否达到变形阈值
    if (clickCount >= this.options.phase2Threshold) {
      // 检查是否已经进行过重度变形
      const hasHeavyTransform = this.state.transformHistory.some(
        result => result.success && result.transformType === 'heavy'
      );
      
      if (!hasHeavyTransform) {
        return { shouldTransform: true, transformType: 'heavy' };
      }
    } else if (clickCount >= this.options.phase1Threshold) {
      // 检查是否已经进行过轻度变形
      const hasLightTransform = this.state.transformHistory.some(
        result => result.success && result.transformType === 'light'
      );
      
      if (!hasLightTransform) {
        return { shouldTransform: true, transformType: 'light' };
      }
    }

    return { shouldTransform: false };
  }

  /**
   * 执行图片变形
   */
  async transformImage(
    sourceImage: HTMLImageElement,
    transformType: 'light' | 'heavy',
    onProgress?: (progress: TransformProgress) => void
  ): Promise<TransformResult> {
    if (this.state.isTransforming) {
      throw this.createError('VALIDATION_ERROR', 'Transform already in progress');
    }

    const startTime = Date.now();
    this.abortController = new AbortController();
    
    try {
      this.setState({
        isTransforming: true,
        currentPhase: 'preparing',
        progress: 0,
        failedAttempts: 0
      });

      if (onProgress) {
        this.progressCallbacks.add(onProgress);
      }

      // 阶段1: 准备图片
      this.updateProgress('preparing', 10, '准备图片数据...');
      const imageBase64 = await this.prepareImageForTransform(sourceImage);
      
      this.checkAborted();

      // 阶段2: 上传和处理
      this.updateProgress('uploading', 20, '上传图片到AI服务...');
      
      // 模拟上传进度
      await this.simulateUploadProgress();
      
      this.checkAborted();

      // 阶段3: AI处理
      this.updateProgress('processing', 50, 'AI正在处理图片...');
      
      const transformedBase64 = await this.performTransform(imageBase64, transformType);
      
      this.checkAborted();

      // 阶段4: 下载结果
      this.updateProgress('downloading', 80, '下载处理结果...');
      
      const transformedImage = await this.createImageFromBase64(transformedBase64);
      
      this.checkAborted();

      // 阶段5: 完成
      this.updateProgress('completed', 100, '变形完成！');

      const result: TransformResult = {
        success: true,
        transformedImage,
        originalImage: sourceImage,
        transformType,
        processingTime: Date.now() - startTime
      };

      this.state.transformHistory.push(result);
      this.state.lastTransformTime = Date.now();

      return result;

    } catch (error) {
      const transformError = error instanceof Error && (error as any).type
        ? error as GameError
        : this.createError('API_ERROR', 'Transform failed', error);

      this.updateProgress('error', this.state.progress, `变形失败: ${transformError.message}`);

      const result: TransformResult = {
        success: false,
        originalImage: sourceImage,
        transformType,
        processingTime: Date.now() - startTime,
        error: transformError
      };

      this.state.transformHistory.push(result);
      this.state.failedAttempts++;

      throw transformError;

    } finally {
      this.setState({
        isTransforming: false,
        currentPhase: 'completed'
      });

      if (onProgress) {
        this.progressCallbacks.delete(onProgress);
      }

      this.abortController = null;
    }
  }

  /**
   * 准备图片用于变形
   */
  private async prepareImageForTransform(image: HTMLImageElement): Promise<string> {
    // 调整图片尺寸以优化API调用
    const maxSize = 1024; // API推荐的最大尺寸
    const canvas = this.imageManager.resizeImage(image, maxSize, maxSize);
    
    // 转换为Base64，使用适当的质量设置
    return this.imageManager.imageToBase64(canvas, {
      format: 'jpeg',
      quality: 0.8
    });
  }

  /**
   * 执行变形处理
   */
  private async performTransform(imageBase64: string, transformType: 'light' | 'heavy'): Promise<string> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.options.maxTransformAttempts; attempt++) {
      try {
        this.updateProgress('processing', 50 + (attempt - 1) * 10, 
          `AI处理中... (尝试 ${attempt}/${this.options.maxTransformAttempts})`);

        const result = await this.apiService.transformImage(imageBase64, transformType, {
          // 根据变形类型调整参数
          strength: transformType === 'heavy' ? 0.8 : 0.4,
          steps: transformType === 'heavy' ? 40 : 30
        });

        return result;

      } catch (error) {
        lastError = error as Error;
        console.warn(`Transform attempt ${attempt} failed:`, error);

        if (attempt < this.options.maxTransformAttempts) {
          // 等待后重试
          const delay = Math.min(1000 * attempt, 5000);
          this.updateProgress('processing', 50 + attempt * 10, 
            `处理失败，${delay/1000}秒后重试...`);
          
          await this.sleep(delay);
          this.checkAborted();
        }
      }
    }

    throw lastError || this.createError('API_ERROR', 'All transform attempts failed');
  }

  /**
   * 从Base64创建图片
   */
  private async createImageFromBase64(base64: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      
      image.onload = () => {
        resolve(image);
      };
      
      image.onerror = () => {
        reject(this.createError('RENDER_ERROR', 'Failed to load transformed image'));
      };
      
      image.src = base64;
    });
  }

  /**
   * 模拟上传进度
   */
  private async simulateUploadProgress(): Promise<void> {
    const steps = 5;
    const stepDelay = 200;
    
    for (let i = 1; i <= steps; i++) {
      this.checkAborted();
      
      const progress = 20 + (i / steps) * 20; // 20% 到 40%
      this.updateProgress('uploading', progress, `上传进度 ${Math.round(progress)}%`);
      
      await this.sleep(stepDelay);
    }
  }

  /**
   * 更新进度
   */
  private updateProgress(phase: TransformProgress['phase'], progress: number, message: string): void {
    this.setState({
      currentPhase: phase,
      progress: Math.min(100, Math.max(0, progress))
    });

    const progressData: TransformProgress = {
      phase,
      progress: this.state.progress,
      message,
      estimatedTimeRemaining: this.calculateEstimatedTime(progress)
    };

    this.progressCallbacks.forEach(callback => {
      try {
        callback(progressData);
      } catch (error) {
        console.error('Progress callback error:', error);
      }
    });
  }

  /**
   * 计算预估剩余时间
   */
  private calculateEstimatedTime(currentProgress: number): number | undefined {
    if (currentProgress <= 0 || !this.state.isTransforming) {
      return undefined;
    }

    const elapsed = Date.now() - (this.state.lastTransformTime || Date.now());
    const progressRate = currentProgress / elapsed;
    const remainingProgress = 100 - currentProgress;
    
    return remainingProgress / progressRate;
  }

  /**
   * 检查是否被中止
   */
  private checkAborted(): void {
    if (this.abortController?.signal.aborted) {
      throw this.createError('VALIDATION_ERROR', 'Transform was cancelled');
    }
  }

  /**
   * 取消当前变形
   */
  cancelTransform(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    
    this.setState({
      isTransforming: false,
      currentPhase: 'completed',
      progress: 0
    });

    this.updateProgress('error', 0, '变形已取消');
  }

  /**
   * 重试上次失败的变形
   */
  async retryLastTransform(): Promise<TransformResult | null> {
    const lastResult = this.getLastTransformResult();
    
    if (!lastResult || lastResult.success || !lastResult.originalImage) {
      return null;
    }

    return this.transformImage(lastResult.originalImage, lastResult.transformType);
  }

  /**
   * 获取渐进式变形建议
   */
  getProgressiveTransformSuggestion(clickCount: number): {
    suggested: boolean;
    transformType?: 'light' | 'heavy';
    reason: string;
  } {
    if (!this.options.enableProgressiveTransform) {
      return { suggested: false, reason: 'Progressive transform disabled' };
    }

    const { shouldTransform, transformType } = this.shouldTransform(clickCount, {
      uploadedImage: new Image(),
      isPlaying: true
    } as GameState);

    if (shouldTransform && transformType) {
      const reason = transformType === 'light' 
        ? `达到 ${this.options.phase1Threshold} 次点击，建议进行轻度变形`
        : `达到 ${this.options.phase2Threshold} 次点击，建议进行重度变形`;
      
      return { suggested: true, transformType, reason };
    }

    return { suggested: false, reason: 'No transform needed at current click count' };
  }

  /**
   * 获取变形历史
   */
  getTransformHistory(): TransformResult[] {
    return [...this.state.transformHistory];
  }

  /**
   * 获取最后一次变形结果
   */
  getLastTransformResult(): TransformResult | null {
    return this.state.transformHistory.length > 0 
      ? this.state.transformHistory[this.state.transformHistory.length - 1]
      : null;
  }

  /**
   * 获取变形统计
   */
  getTransformStats(): {
    totalTransforms: number;
    successfulTransforms: number;
    failedTransforms: number;
    averageProcessingTime: number;
    lastTransformTime: number;
    isTransforming: boolean;
    currentProgress: number;
  } {
    const successful = this.state.transformHistory.filter(r => r.success);
    const failed = this.state.transformHistory.filter(r => !r.success);
    
    const averageProcessingTime = successful.length > 0
      ? successful.reduce((sum, r) => sum + r.processingTime, 0) / successful.length
      : 0;

    return {
      totalTransforms: this.state.transformHistory.length,
      successfulTransforms: successful.length,
      failedTransforms: failed.length,
      averageProcessingTime,
      lastTransformTime: this.state.lastTransformTime,
      isTransforming: this.state.isTransforming,
      currentProgress: this.state.progress
    };
  }

  /**
   * 清除变形历史
   */
  clearHistory(): void {
    this.state.transformHistory = [];
    this.state.failedAttempts = 0;
  }

  /**
   * 更新状态
   */
  private setState(newState: Partial<TransformState>): void {
    Object.assign(this.state, newState);
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 创建错误对象
   */
  private createError(type: string, message: string, details?: any): GameError {
    return {
      type: type as any,
      message,
      details,
      timestamp: Date.now(),
      recoverable: true
    };
  }

  /**
   * 获取当前状态
   */
  getState(): TransformState {
    return { ...this.state };
  }

  /**
   * 销毁变形管理器
   */
  destroy(): void {
    this.cancelTransform();
    this.clearHistory();
    this.progressCallbacks.clear();
    this.apiService.destroy();
  }
}