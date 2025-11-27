/**
 * ImageManager 单元测试
 */

import { ImageManager } from '../ImageManager';

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

// Mock FileReader
class MockFileReader {
  onload: ((event: any) => void) | null = null;
  onerror: (() => void) | null = null;
  result: string | null = null;

  readAsDataURL(file: any) {
    setTimeout(() => {
      if (file.name === 'error.jpg') {
        this.onerror?.();
      } else {
        this.result = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A';
        this.onload?.({ target: { result: this.result } });
      }
    }, 10);
  }
}

// Mock Image
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 100;
  height = 100;
  src = '';

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

// Mock Canvas
class MockCanvas {
  width = 0;
  height = 0;
  
  getContext() {
    return {
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
      drawImage: jest.fn()
    };
  }

  toDataURL(type?: string, quality?: number) {
    return 'data:image/jpeg;base64,mock-data';
  }
}

// Setup mocks
global.FileReader = MockFileReader as any;
global.Image = MockImage as any;
global.File = MockFile as any;

// Mock document.createElement
const originalCreateElement = document.createElement;
document.createElement = jest.fn((tagName: string) => {
  if (tagName === 'canvas') {
    return new MockCanvas() as any;
  }
  return originalCreateElement.call(document, tagName);
});

describe('ImageManager', () => {
  let imageManager: ImageManager;

  beforeEach(() => {
    imageManager = new ImageManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    imageManager.clearCache();
  });

  describe('validateImage', () => {
    it('should validate supported image formats', () => {
      const validFile = new MockFile('test.jpg', 1024 * 1024, 'image/jpeg') as any;
      const result = imageManager.validateImage(validFile);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject unsupported formats', () => {
      const invalidFile = new MockFile('test.gif', 1024 * 1024, 'image/gif') as any;
      const result = imageManager.validateImage(invalidFile);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('不支持的文件格式');
    });

    it('should reject files that are too large', () => {
      const largeFile = new MockFile('large.jpg', 10 * 1024 * 1024, 'image/jpeg') as any;
      const result = imageManager.validateImage(largeFile);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('文件过大');
    });

    it('should reject files with empty names', () => {
      const noNameFile = new MockFile('', 1024 * 1024, 'image/jpeg') as any;
      const result = imageManager.validateImage(noNameFile);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('无效的文件名');
    });
  });

  describe('uploadImage', () => {
    it('should successfully upload a valid image', async () => {
      const validFile = new MockFile('test.jpg', 1024 * 1024, 'image/jpeg') as any;
      
      const image = await imageManager.uploadImage(validFile);
      
      expect(image).toBeInstanceOf(MockImage);
      expect(image.width).toBe(100);
      expect(image.height).toBe(100);
    });

    it('should throw error for invalid files', async () => {
      const invalidFile = new MockFile('test.gif', 1024 * 1024, 'image/gif') as any;
      
      await expect(imageManager.uploadImage(invalidFile)).rejects.toThrow();
    });

    it('should cache uploaded images', async () => {
      const validFile = new MockFile('test.jpg', 1024 * 1024, 'image/jpeg') as any;
      
      await imageManager.uploadImage(validFile);
      
      const stats = imageManager.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.keys.length).toBe(1);
    });

    it('should handle file reading errors', async () => {
      const errorFile = new MockFile('error.jpg', 1024 * 1024, 'image/jpeg') as any;
      
      await expect(imageManager.uploadImage(errorFile)).rejects.toThrow();
    });
  });

  describe('resizeImage', () => {
    it('should resize image to fit within max dimensions', () => {
      const mockImage = new MockImage() as any;
      mockImage.width = 200;
      mockImage.height = 200;
      
      const canvas = imageManager.resizeImage(mockImage, 100, 100);
      
      expect(canvas.width).toBe(100);
      expect(canvas.height).toBe(100);
    });

    it('should maintain aspect ratio when resizing', () => {
      const mockImage = new MockImage() as any;
      mockImage.width = 200;
      mockImage.height = 100;
      
      const canvas = imageManager.resizeImage(mockImage, 100, 100);
      
      expect(canvas.width).toBe(100);
      expect(canvas.height).toBe(50);
    });

    it('should not upscale images', () => {
      const mockImage = new MockImage() as any;
      mockImage.width = 50;
      mockImage.height = 50;
      
      const canvas = imageManager.resizeImage(mockImage, 100, 100);
      
      expect(canvas.width).toBe(50);
      expect(canvas.height).toBe(50);
    });
  });

  describe('imageToBase64', () => {
    it('should convert image to base64', () => {
      const mockImage = new MockImage() as any;
      
      const base64 = imageManager.imageToBase64(mockImage);
      
      expect(base64).toContain('data:image/jpeg;base64,');
    });

    it('should use specified format and quality', () => {
      const mockImage = new MockImage() as any;
      
      const base64 = imageManager.imageToBase64(mockImage, {
        format: 'png',
        quality: 0.9
      });
      
      expect(base64).toContain('data:image/png;base64,');
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      const validFile = new MockFile('test.jpg', 1024 * 1024, 'image/jpeg') as any;
      
      await imageManager.uploadImage(validFile);
      expect(imageManager.getCacheStats().size).toBe(1);
      
      imageManager.clearCache();
      expect(imageManager.getCacheStats().size).toBe(0);
    });

    it('should retrieve cached images', async () => {
      const validFile = new MockFile('test.jpg', 1024 * 1024, 'image/jpeg') as any;
      
      const image = await imageManager.uploadImage(validFile);
      const fileKey = `${validFile.name}_${validFile.size}_${validFile.lastModified}`;
      const cachedImage = imageManager.getCachedImage(fileKey);
      
      expect(cachedImage).toBe(image);
    });
  });

  describe('error handling', () => {
    it('should handle canvas context creation failure', () => {
      // Mock canvas.getContext to return null
      const mockCanvas = {
        getContext: () => null
      };
      
      document.createElement = jest.fn(() => mockCanvas as any);
      
      const mockImage = new MockImage() as any;
      
      expect(() => {
        imageManager.resizeImage(mockImage, 100, 100);
      }).toThrow('Canvas上下文创建失败');
    });
  });
});