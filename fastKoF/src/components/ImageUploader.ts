/**
 * 图片上传组件
 * 提供拖拽上传和点击上传功能
 */

import { ImageManager } from '@/core/ImageManager';
import { ErrorHandler } from '@/utils/ErrorHandler';

export interface ImageUploaderOptions {
  container: HTMLElement;
  onImageUploaded?: (image: HTMLImageElement) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
  maxFileSize?: number;
  supportedFormats?: string[];
  showPreview?: boolean;
}

export interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  uploadedImage: HTMLImageElement | null;
}

/**
 * 图片上传器组件
 */
export class ImageUploader {
  private container: HTMLElement;
  private imageManager: ImageManager;
  private errorHandler: ErrorHandler;
  private options: Required<ImageUploaderOptions>;
  private state: UploadState;
  
  // UI元素
  private uploadArea: HTMLElement | null = null;
  private fileInput: HTMLInputElement | null = null;
  private previewContainer: HTMLElement | null = null;
  private progressBar: HTMLElement | null = null;
  private errorMessage: HTMLElement | null = null;

  constructor(options: ImageUploaderOptions) {
    this.container = options.container;
    this.imageManager = new ImageManager(
      options.maxFileSize,
      options.supportedFormats
    );
    this.errorHandler = new ErrorHandler();
    
    // 设置默认选项
    this.options = {
      onImageUploaded: () => {},
      onError: () => {},
      onProgress: () => {},
      maxFileSize: 5 * 1024 * 1024,
      supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
      showPreview: true,
      ...options
    };

    // 初始化状态
    this.state = {
      isUploading: false,
      progress: 0,
      error: null,
      uploadedImage: null
    };

    this.init();
  }

  /**
   * 初始化组件
   */
  private init(): void {
    this.createUI();
    this.bindEvents();
  }

  /**
   * 创建UI结构
   */
  private createUI(): void {
    this.container.innerHTML = `
      <div class="image-uploader">
        <div class="upload-area" id="upload-area">
          <div class="upload-content">
            <div class="upload-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <div class="upload-text">
              <p class="upload-title">点击或拖拽上传照片</p>
              <p class="upload-subtitle">支持 JPG、PNG、WEBP 格式，最大 ${(this.options.maxFileSize / (1024 * 1024)).toFixed(1)}MB</p>
            </div>
          </div>
          <input type="file" id="file-input" accept="${this.options.supportedFormats.join(',')}" style="display: none;">
        </div>
        
        <div class="upload-progress" id="upload-progress" style="display: none;">
          <div class="progress-bar">
            <div class="progress-fill" id="progress-fill"></div>
          </div>
          <div class="progress-text" id="progress-text">上传中...</div>
        </div>
        
        <div class="upload-error" id="upload-error" style="display: none;">
          <div class="error-icon">⚠️</div>
          <div class="error-text" id="error-text"></div>
          <button class="retry-button" id="retry-button">重试</button>
        </div>
        
        ${this.options.showPreview ? `
        <div class="image-preview" id="image-preview" style="display: none;">
          <div class="preview-header">
            <span class="preview-title">已上传的照片</span>
            <button class="change-button" id="change-button">更换照片</button>
          </div>
          <div class="preview-image-container">
            <img class="preview-image" id="preview-image" alt="预览图片">
          </div>
        </div>
        ` : ''}
      </div>
    `;

    // 获取UI元素引用
    this.uploadArea = this.container.querySelector('#upload-area');
    this.fileInput = this.container.querySelector('#file-input');
    this.previewContainer = this.container.querySelector('#image-preview');
    this.progressBar = this.container.querySelector('#upload-progress');
    this.errorMessage = this.container.querySelector('#upload-error');
  }

  /**
   * 绑定事件
   */
  private bindEvents(): void {
    if (!this.uploadArea || !this.fileInput) return;

    // 点击上传区域
    this.uploadArea.addEventListener('click', () => {
      if (!this.state.isUploading) {
        this.fileInput?.click();
      }
    });

    // 文件选择
    this.fileInput.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      const files = target.files;
      if (files && files.length > 0) {
        this.handleFileUpload(files[0]);
      }
    });

    // 拖拽事件
    this.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
    this.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
    this.uploadArea.addEventListener('drop', this.handleDrop.bind(this));

    // 重试按钮
    const retryButton = this.container.querySelector('#retry-button');
    retryButton?.addEventListener('click', () => {
      this.resetUploader();
    });

    // 更换照片按钮
    const changeButton = this.container.querySelector('#change-button');
    changeButton?.addEventListener('click', () => {
      this.resetUploader();
    });

    // 阻止默认的拖拽行为
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      this.uploadArea?.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });
  }

  /**
   * 处理文件上传
   */
  private async handleFileUpload(file: File): Promise<void> {
    try {
      this.setState({
        isUploading: true,
        progress: 0,
        error: null
      });

      this.showProgress();

      // 模拟上传进度
      this.simulateProgress();

      // 上传图片
      const image = await this.imageManager.uploadImage(file);

      this.setState({
        isUploading: false,
        progress: 100,
        uploadedImage: image
      });

      this.showPreview(image);
      this.options.onImageUploaded(image);

    } catch (error) {
      this.setState({
        isUploading: false,
        error: error instanceof Error ? error.message : '上传失败'
      });

      this.showError(this.state.error!);
      this.options.onError(error instanceof Error ? error : new Error('上传失败'));
    }
  }

  /**
   * 处理拖拽悬停
   */
  private handleDragOver(event: DragEvent): void {
    event.preventDefault();
    this.uploadArea?.classList.add('drag-over');
  }

  /**
   * 处理拖拽离开
   */
  private handleDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.uploadArea?.classList.remove('drag-over');
  }

  /**
   * 处理文件拖拽放下
   */
  private handleDrop(event: DragEvent): void {
    event.preventDefault();
    this.uploadArea?.classList.remove('drag-over');

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFileUpload(files[0]);
    }
  }

  /**
   * 模拟上传进度
   */
  private simulateProgress(): void {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress >= 90) {
        progress = 90;
        clearInterval(interval);
      }
      
      this.setState({ progress });
      this.updateProgressBar(progress);
      this.options.onProgress(progress);
    }, 100);
  }

  /**
   * 显示进度条
   */
  private showProgress(): void {
    this.hideAllStates();
    if (this.progressBar) {
      this.progressBar.style.display = 'block';
    }
  }

  /**
   * 显示预览
   */
  private showPreview(image: HTMLImageElement): void {
    if (!this.options.showPreview || !this.previewContainer) return;

    this.hideAllStates();
    
    const previewImage = this.container.querySelector('#preview-image') as HTMLImageElement;
    if (previewImage) {
      previewImage.src = image.src;
    }

    this.previewContainer.style.display = 'block';
  }

  /**
   * 显示错误
   */
  private showError(message: string): void {
    this.hideAllStates();
    
    if (this.errorMessage) {
      const errorText = this.container.querySelector('#error-text');
      if (errorText) {
        errorText.textContent = message;
      }
      this.errorMessage.style.display = 'block';
    }
  }

  /**
   * 隐藏所有状态
   */
  private hideAllStates(): void {
    const elements = [
      this.uploadArea,
      this.progressBar,
      this.errorMessage,
      this.previewContainer
    ];

    elements.forEach(element => {
      if (element) {
        element.style.display = 'none';
      }
    });
  }

  /**
   * 更新进度条
   */
  private updateProgressBar(progress: number): void {
    const progressFill = this.container.querySelector('#progress-fill') as HTMLElement;
    const progressText = this.container.querySelector('#progress-text') as HTMLElement;
    
    if (progressFill) {
      progressFill.style.width = `${progress}%`;
    }
    
    if (progressText) {
      progressText.textContent = `上传中... ${Math.round(progress)}%`;
    }
  }

  /**
   * 重置上传器
   */
  private resetUploader(): void {
    this.setState({
      isUploading: false,
      progress: 0,
      error: null,
      uploadedImage: null
    });

    this.hideAllStates();
    if (this.uploadArea) {
      this.uploadArea.style.display = 'block';
    }

    // 清空文件输入
    if (this.fileInput) {
      this.fileInput.value = '';
    }
  }

  /**
   * 更新状态
   */
  private setState(newState: Partial<UploadState>): void {
    this.state = { ...this.state, ...newState };
  }

  /**
   * 获取当前状态
   */
  getState(): UploadState {
    return { ...this.state };
  }

  /**
   * 获取上传的图片
   */
  getUploadedImage(): HTMLImageElement | null {
    return this.state.uploadedImage;
  }

  /**
   * 销毁组件
   */
  destroy(): void {
    // 清理事件监听器
    this.container.innerHTML = '';
    
    // 清理图片管理器缓存
    this.imageManager.clearCache();
  }
}