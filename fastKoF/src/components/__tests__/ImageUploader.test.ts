/**
 * ImageUploader 组件单元测试
 */

import { ImageUploader } from '../ImageUploader';

// Mock ImageManager
jest.mock('@/core/ImageManager', () => ({
  ImageManager: jest.fn().mockImplementation(() => ({
    uploadImage: jest.fn(),
    validateImage: jest.fn(),
    clearCache: jest.fn()
  }))
}));

// Mock ErrorHandler
jest.mock('@/utils/ErrorHandler', () => ({
  ErrorHandler: jest.fn().mockImplementation(() => ({
    handleError: jest.fn(),
    showUserError: jest.fn()
  }))
}));

// Mock File API
class MockFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;

  constructor(name: string, size: number, type: string) {
    this.name = name;
    this.size = size;
    this.type = type;
    this.lastModified = Date.now();
  }
}

// Mock Image
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 100;
  height = 100;
  src = '';
}

global.File = MockFile as any;
global.Image = MockImage as any;

describe('ImageUploader', () => {
  let container: HTMLElement;
  let uploader: ImageUploader;
  let mockOnImageUploaded: jest.Mock;
  let mockOnError: jest.Mock;
  let mockOnProgress: jest.Mock;

  beforeEach(() => {
    // 创建测试容器
    container = document.createElement('div');
    document.body.appendChild(container);

    // 创建mock回调函数
    mockOnImageUploaded = jest.fn();
    mockOnError = jest.fn();
    mockOnProgress = jest.fn();

    // 创建上传器实例
    uploader = new ImageUploader({
      container,
      onImageUploaded: mockOnImageUploaded,
      onError: mockOnError,
      onProgress: mockOnProgress,
      showPreview: true
    });
  });

  afterEach(() => {
    uploader.destroy();
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  describe('初始化', () => {
    it('应该创建正确的UI结构', () => {
      expect(container.querySelector('.image-uploader')).toBeTruthy();
      expect(container.querySelector('.upload-area')).toBeTruthy();
      expect(container.querySelector('#file-input')).toBeTruthy();
      expect(container.querySelector('#upload-progress')).toBeTruthy();
      expect(container.querySelector('#upload-error')).toBeTruthy();
      expect(container.querySelector('#image-preview')).toBeTruthy();
    });

    it('应该设置正确的文件输入属性', () => {
      const fileInput = container.querySelector('#file-input') as HTMLInputElement;
      expect(fileInput.type).toBe('file');
      expect(fileInput.accept).toContain('image/jpeg');
      expect(fileInput.accept).toContain('image/png');
      expect(fileInput.accept).toContain('image/webp');
    });

    it('应该隐藏进度条和错误信息', () => {
      const progress = container.querySelector('#upload-progress') as HTMLElement;
      const error = container.querySelector('#upload-error') as HTMLElement;
      const preview = container.querySelector('#image-preview') as HTMLElement;

      expect(progress.style.display).toBe('none');
      expect(error.style.display).toBe('none');
      expect(preview.style.display).toBe('none');
    });
  });

  describe('点击上传', () => {
    it('应该在点击上传区域时触发文件选择', () => {
      const uploadArea = container.querySelector('.upload-area') as HTMLElement;
      const fileInput = container.querySelector('#file-input') as HTMLInputElement;
      
      // Mock click方法
      fileInput.click = jest.fn();
      
      uploadArea.click();
      
      expect(fileInput.click).toHaveBeenCalled();
    });

    it('应该在上传中时禁用点击', () => {
      const uploadArea = container.querySelector('.upload-area') as HTMLElement;
      const fileInput = container.querySelector('#file-input') as HTMLInputElement;
      
      fileInput.click = jest.fn();
      
      // 设置上传状态
      (uploader as any).state.isUploading = true;
      
      uploadArea.click();
      
      expect(fileInput.click).not.toHaveBeenCalled();
    });
  });

  describe('文件选择处理', () => {
    it('应该处理有效的文件选择', async () => {
      const fileInput = container.querySelector('#file-input') as HTMLInputElement;
      const mockFile = new MockFile('test.jpg', 1024 * 1024, 'image/jpeg') as any;
      
      // Mock ImageManager.uploadImage
      const mockImage = new MockImage();
      (uploader as any).imageManager.uploadImage.mockResolvedValue(mockImage);
      
      // 模拟文件选择
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false
      });
      
      // 触发change事件
      const changeEvent = new Event('change');
      fileInput.dispatchEvent(changeEvent);
      
      // 等待异步处理
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect((uploader as any).imageManager.uploadImage).toHaveBeenCalledWith(mockFile);
    });

    it('应该忽略空文件选择', () => {
      const fileInput = container.querySelector('#file-input') as HTMLInputElement;
      
      // Mock空文件列表
      Object.defineProperty(fileInput, 'files', {
        value: [],
        writable: false
      });
      
      const changeEvent = new Event('change');
      fileInput.dispatchEvent(changeEvent);
      
      expect((uploader as any).imageManager.uploadImage).not.toHaveBeenCalled();
    });
  });

  describe('拖拽功能', () => {
    let uploadArea: HTMLElement;

    beforeEach(() => {
      uploadArea = container.querySelector('.upload-area') as HTMLElement;
    });

    it('应该在拖拽悬停时添加样式类', () => {
      const dragEvent = new DragEvent('dragover');
      Object.defineProperty(dragEvent, 'dataTransfer', {
        value: { files: [] }
      });
      
      uploadArea.dispatchEvent(dragEvent);
      
      expect(uploadArea.classList.contains('drag-over')).toBe(true);
    });

    it('应该在拖拽离开时移除样式类', () => {
      uploadArea.classList.add('drag-over');
      
      const dragEvent = new DragEvent('dragleave');
      uploadArea.dispatchEvent(dragEvent);
      
      expect(uploadArea.classList.contains('drag-over')).toBe(false);
    });

    it('应该处理文件拖拽放下', async () => {
      const mockFile = new MockFile('test.jpg', 1024 * 1024, 'image/jpeg') as any;
      const mockImage = new MockImage();
      
      (uploader as any).imageManager.uploadImage.mockResolvedValue(mockImage);
      
      const dropEvent = new DragEvent('drop');
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: { files: [mockFile] }
      });
      
      uploadArea.dispatchEvent(dropEvent);
      
      // 等待异步处理
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(uploadArea.classList.contains('drag-over')).toBe(false);
      expect((uploader as any).imageManager.uploadImage).toHaveBeenCalledWith(mockFile);
    });
  });

  describe('状态管理', () => {
    it('应该正确更新上传状态', () => {
      const initialState = uploader.getState();
      expect(initialState.isUploading).toBe(false);
      expect(initialState.progress).toBe(0);
      expect(initialState.error).toBe(null);
      expect(initialState.uploadedImage).toBe(null);
    });

    it('应该在上传成功后更新状态', async () => {
      const mockFile = new MockFile('test.jpg', 1024 * 1024, 'image/jpeg') as any;
      const mockImage = new MockImage();
      
      (uploader as any).imageManager.uploadImage.mockResolvedValue(mockImage);
      
      await (uploader as any).handleFileUpload(mockFile);
      
      const state = uploader.getState();
      expect(state.isUploading).toBe(false);
      expect(state.progress).toBe(100);
      expect(state.error).toBe(null);
      expect(state.uploadedImage).toBe(mockImage);
    });

    it('应该在上传失败后更新状态', async () => {
      const mockFile = new MockFile('test.jpg', 1024 * 1024, 'image/jpeg') as any;
      const error = new Error('上传失败');
      
      (uploader as any).imageManager.uploadImage.mockRejectedValue(error);
      
      await (uploader as any).handleFileUpload(mockFile);
      
      const state = uploader.getState();
      expect(state.isUploading).toBe(false);
      expect(state.error).toBe('上传失败');
      expect(state.uploadedImage).toBe(null);
    });
  });

  describe('UI状态切换', () => {
    it('应该显示进度条', () => {
      (uploader as any).showProgress();
      
      const progress = container.querySelector('#upload-progress') as HTMLElement;
      const uploadArea = container.querySelector('.upload-area') as HTMLElement;
      
      expect(progress.style.display).toBe('block');
      expect(uploadArea.style.display).toBe('none');
    });

    it('应该显示错误信息', () => {
      const errorMessage = '测试错误信息';
      (uploader as any).showError(errorMessage);
      
      const error = container.querySelector('#upload-error') as HTMLElement;
      const errorText = container.querySelector('#error-text') as HTMLElement;
      
      expect(error.style.display).toBe('block');
      expect(errorText.textContent).toBe(errorMessage);
    });

    it('应该显示预览图片', () => {
      const mockImage = new MockImage();
      mockImage.src = 'data:image/jpeg;base64,test';
      
      (uploader as any).showPreview(mockImage);
      
      const preview = container.querySelector('#image-preview') as HTMLElement;
      const previewImage = container.querySelector('#preview-image') as HTMLImageElement;
      
      expect(preview.style.display).toBe('block');
      expect(previewImage.src).toBe(mockImage.src);
    });
  });

  describe('重置功能', () => {
    it('应该重置上传器状态', () => {
      // 设置一些状态
      (uploader as any).setState({
        isUploading: true,
        progress: 50,
        error: '测试错误',
        uploadedImage: new MockImage()
      });
      
      const retryButton = container.querySelector('#retry-button') as HTMLButtonElement;
      retryButton.click();
      
      const state = uploader.getState();
      expect(state.isUploading).toBe(false);
      expect(state.progress).toBe(0);
      expect(state.error).toBe(null);
      expect(state.uploadedImage).toBe(null);
    });

    it('应该清空文件输入', () => {
      const fileInput = container.querySelector('#file-input') as HTMLInputElement;
      fileInput.value = 'test.jpg';
      
      const changeButton = container.querySelector('#change-button') as HTMLButtonElement;
      changeButton.click();
      
      expect(fileInput.value).toBe('');
    });
  });

  describe('回调函数', () => {
    it('应该在上传成功时调用onImageUploaded', async () => {
      const mockFile = new MockFile('test.jpg', 1024 * 1024, 'image/jpeg') as any;
      const mockImage = new MockImage();
      
      (uploader as any).imageManager.uploadImage.mockResolvedValue(mockImage);
      
      await (uploader as any).handleFileUpload(mockFile);
      
      expect(mockOnImageUploaded).toHaveBeenCalledWith(mockImage);
    });

    it('应该在上传失败时调用onError', async () => {
      const mockFile = new MockFile('test.jpg', 1024 * 1024, 'image/jpeg') as any;
      const error = new Error('上传失败');
      
      (uploader as any).imageManager.uploadImage.mockRejectedValue(error);
      
      await (uploader as any).handleFileUpload(mockFile);
      
      expect(mockOnError).toHaveBeenCalledWith(error);
    });

    it('应该在进度更新时调用onProgress', async () => {
      const mockFile = new MockFile('test.jpg', 1024 * 1024, 'image/jpeg') as any;
      const mockImage = new MockImage();
      
      (uploader as any).imageManager.uploadImage.mockResolvedValue(mockImage);
      
      await (uploader as any).handleFileUpload(mockFile);
      
      // 等待进度模拟完成
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(mockOnProgress).toHaveBeenCalled();
    });
  });

  describe('销毁功能', () => {
    it('应该清理DOM和缓存', () => {
      uploader.destroy();
      
      expect(container.innerHTML).toBe('');
      expect((uploader as any).imageManager.clearCache).toHaveBeenCalled();
    });
  });

  describe('配置选项', () => {
    it('应该支持禁用预览功能', () => {
      const noPreviewUploader = new ImageUploader({
        container: document.createElement('div'),
        showPreview: false
      });
      
      const preview = noPreviewUploader['container'].querySelector('#image-preview');
      expect(preview).toBe(null);
      
      noPreviewUploader.destroy();
    });

    it('应该支持自定义文件大小限制', () => {
      const customUploader = new ImageUploader({
        container: document.createElement('div'),
        maxFileSize: 2 * 1024 * 1024 // 2MB
      });
      
      const subtitle = customUploader['container'].querySelector('.upload-subtitle');
      expect(subtitle?.textContent).toContain('2.0MB');
      
      customUploader.destroy();
    });
  });
});