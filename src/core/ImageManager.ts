/**
 * 图片管理器
 * 负责图片上传、验证、处理和缓存
 */

import type { GameError } from '@/types/error.types';
import { DeviceDetector } from '@/utils/DeviceDetector';

export interface ImageValidationResult {
  isValid: boolean;
  error?: string;
  details?: any;
}

export interface ImageProcessOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

/**
 * 图片管理器类
 */
export class ImageManager {
  private maxFileSize: number;
  private supportedFormats: string[];
  private imageCache: Map<string, HTMLImageElement> = new Map();
  private processingQueue: Map<string, Promise<HTMLImageElement>> = new Map();

  constructor(
    maxFileSize: number = 5 * 1024 * 1024, // 5MB
    supportedFormats: string[] = ['image/jpeg', 'image/png', 'image/webp']
  ) {
    this.maxFileSize = maxFileSize;
    this.supportedFormats = supportedFormats;
  }

  /**
   * 上传并处理图片
   */
  async uploadImage(file: File): Promise<HTMLImageElement> {
    // 验证文件
    const validation = this.validateImage(file);
    if (!validation.isValid) {
      throw this.createError('UPLOAD_ERROR', validation.error || '图片验证失败', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        reason: 'validation'
      });
    }

    // 检查是否已在处理队列中
    const fileKey = this.getFileKey(file);
    if (this.processingQueue.has(fileKey)) {
      return this.processingQueue.get(fileKey)!;
    }

    // 创建处理Promise
    const processingPromise = this.processImageFile(file);
    this.processingQueue.set(fileKey, processingPromise);

    try {
      const image = await processingPromise;
      
      // 缓存处理后的图片
      this.imageCache.set(fileKey, image);
      
      return image;
    } catch (error) {
      throw this.createError('UPLOAD_ERROR', '图片处理失败', {
        fileName: file.name,
        originalError: error
      });
    } finally {
      // 清理处理队列
      this.processingQueue.delete(fileKey);
    }
  }

  /**
   * 验证图片文件
   */
  validateImage(file: File): ImageValidationResult {
    // 检查文件类型
    if (!this.supportedFormats.includes(file.type)) {
      return {
        isValid: false,
        error: `不支持的文件格式。支持的格式: ${this.supportedFormats.join(', ')}`,
        details: { fileType: file.type, supportedFormats: this.supportedFormats }
      };
    }

    // 检查文件大小
    if (file.size > this.maxFileSize) {
      const maxSizeMB = (this.maxFileSize / (1024 * 1024)).toFixed(1);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return {
        isValid: false,
        error: `文件过大。最大允许 ${maxSizeMB}MB，当前文件 ${fileSizeMB}MB`,
        details: { fileSize: file.size, maxFileSize: this.maxFileSize }
      };
    }

    // 检查文件名
    if (!file.name || file.name.length === 0) {
      return {
        isValid: false,
        error: '无效的文件名',
        details: { fileName: file.name }
      };
    }

    return { isValid: true };
  }

  /**
   * 调整图片尺寸
   */
  resizeImage(
    image: HTMLImageElement, 
    maxWidth: number, 
    maxHeight: number,
    options: ImageProcessOptions = {}
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw this.createError('RENDER_ERROR', 'Canvas上下文创建失败');
    }

    // 计算新尺寸
    const { width: newWidth, height: newHeight } = this.calculateNewSize(
      image.width,
      image.height,
      maxWidth,
      maxHeight
    );

    // 设置Canvas尺寸
    canvas.width = newWidth;
    canvas.height = newHeight;

    // 启用图像平滑
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 绘制调整后的图片
    ctx.drawImage(image, 0, 0, newWidth, newHeight);

    return canvas;
  }

  /**
   * 将图片转换为Base64
   */
  imageToBase64(
    image: HTMLImageElement | HTMLCanvasElement,
    options: ImageProcessOptions = {}
  ): string {
    const canvas = image instanceof HTMLCanvasElement ? 
      image : this.imageToCanvas(image);
    
    const format = options.format || 'jpeg';
    const quality = options.quality || 0.8;
    
    const mimeType = `image/${format}`;
    return canvas.toDataURL(mimeType, quality);
  }

  /**
   * 将图片转换为Canvas
   */
  imageToCanvas(image: HTMLImageElement): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw this.createError('RENDER_ERROR', 'Canvas上下文创建失败');
    }

    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    
    return canvas;
  }

  /**
   * 压缩图片
   */
  async compressImage(
    image: HTMLImageElement,
    targetSize: number = 1024 * 1024, // 1MB
    options: ImageProcessOptions = {}
  ): Promise<HTMLCanvasElement> {
    let quality = options.quality || 0.8;
    let canvas = this.imageToCanvas(image);
    
    // 如果图片已经足够小，直接返回
    const initialSize = this.getCanvasSize(canvas);
    if (initialSize <= targetSize) {
      return canvas;
    }

    // 首先尝试调整尺寸
    const deviceInfo = DeviceDetector.getDeviceInfo();
    const maxDimension = deviceInfo.isMobile ? 800 : 1200;
    
    if (image.width > maxDimension || image.height > maxDimension) {
      canvas = this.resizeImage(image, maxDimension, maxDimension, options);
    }

    // 然后调整质量
    let attempts = 0;
    const maxAttempts = 10;
    
    while (this.getCanvasSize(canvas) > targetSize && attempts < maxAttempts) {
      quality *= 0.8;
      if (quality < 0.1) break;
      
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      canvas = await this.dataUrlToCanvas(dataUrl);
      attempts++;
    }

    return canvas;
  }

  /**
   * 获取图片缓存
   */
  getCachedImage(fileKey: string): HTMLImageElement | null {
    return this.imageCache.get(fileKey) || null;
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.imageCache.clear();
    this.processingQueue.clear();
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.imageCache.size,
      keys: Array.from(this.imageCache.keys())
    };
  }

  /**
   * 处理图片文件
   */
  private async processImageFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (!dataUrl) {
          reject(new Error('文件读取失败'));
          return;
        }

        const image = new Image();
        
        image.onload = () => {
          // 检查图片尺寸
          if (image.width === 0 || image.height === 0) {
            reject(new Error('无效的图片尺寸'));
            return;
          }

          resolve(image);
        };

        image.onerror = () => {
          reject(new Error('图片加载失败'));
        };

        image.src = dataUrl;
      };

      reader.onerror = () => {
        reject(new Error('文件读取失败'));
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * 计算新的图片尺寸
   */
  private calculateNewSize(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    let { width, height } = { width: originalWidth, height: originalHeight };

    // 计算缩放比例
    const widthRatio = maxWidth / width;
    const heightRatio = maxHeight / height;
    const ratio = Math.min(widthRatio, heightRatio, 1); // 不放大

    width = Math.floor(width * ratio);
    height = Math.floor(height * ratio);

    return { width, height };
  }

  /**
   * 获取文件唯一标识
   */
  private getFileKey(file: File): string {
    return `${file.name}_${file.size}_${file.lastModified}`;
  }

  /**
   * 获取Canvas数据大小（估算）
   */
  private getCanvasSize(canvas: HTMLCanvasElement): number {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    // Base64编码大约增加33%的大小
    return Math.floor(dataUrl.length * 0.75);
  }

  /**
   * 将DataURL转换为Canvas
   */
  private async dataUrlToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      
      image.onload = () => {
        const canvas = this.imageToCanvas(image);
        resolve(canvas);
      };

      image.onerror = () => {
        reject(new Error('DataURL转换失败'));
      };

      image.src = dataUrl;
    });
  }

  /**
   * 创建错误对象
   */
  private createError(
    type: string,
    message: string,
    details?: any
  ): GameError {
    return {
      type: type as any,
      message,
      details,
      timestamp: Date.now(),
      recoverable: true
    };
  }
}