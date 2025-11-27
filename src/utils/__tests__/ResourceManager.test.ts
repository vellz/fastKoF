/**
 * ResourceManager 单元测试
 */

import { ResourceManager } from '../ResourceManager';

// Mock fetch
global.fetch = jest.fn();

// Mock Image
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
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

// Mock FontFace
class MockFontFace {
  family = '';
  source = '';
  
  constructor(family: string, source: any) {
    this.family = family;
    this.source = source;
  }
  
  load = jest.fn(() => Promise.resolve(this));
}

global.FontFace = MockFontFace as any;

describe('ResourceManager', () => {
  let resourceManager: ResourceManager;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    resourceManager = new ResourceManager({
      maxCacheSize: 10 * 1024 * 1024, // 10MB
      maxCacheItems: 10,
      enableLazyLoading: true,
      enablePreloading: true
    });

    jest.clearAllMocks();
  });

  afterEach(() => {
    resourceManager.destroy();
  });

  describe('初始化', () => {
    it('应该成功创建资源管理器', () => {
      expect(resourceManager).toBeTruthy();
      
      const stats = resourceManager.getCacheStats();
      expect(stats.itemCount).toBe(0);
      expect(stats.totalSize).toBe(0);
    });

    it('应该使用自定义配置', () => {
      const customManager = new ResourceManager({
        maxCacheSize: 5 * 1024 * 1024,
        enablePreloading: false
      });
      
      expect(customManager).toBeTruthy();
      customManager.destroy();
    });
  });

  describe('图片加载', () => {
    it('应该成功加载图片', async () => {
      const image = await resourceManager.loadResource(
        'test-image',
        '/test.jpg',
        'image',
        'normal'
      );
      
      expect(image).toBeInstanceOf(MockImage);
      expect(resourceManager.hasResource('test-image')).toBe(true);
    });

    it('应该处理图片加载错误', async () => {
      await expect(
        resourceManager.loadResource('error-image', '/error.jpg', 'image')
      ).rejects.toThrow('Failed to load image');
    });

    it('应该缓存加载的图片', async () => {
      await resourceManager.loadResource('cached-image', '/cached.jpg', 'image');
      
      const stats = resourceManager.getCacheStats();
      expect(stats.itemCount).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('应该从缓存返回图片', async () => {
      // 第一次加载
      const image1 = await resourceManager.loadResource('same-image', '/same.jpg', 'image');
      
      // 第二次应该从缓存返回
      const image2 = await resourceManager.loadResource('same-image', '/same.jpg', 'image');
      
      expect(image1).toBe(image2);
    });
  });

  describe('音频加载', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
      } as Response);
    });

    it('应该成功加载音频', async () => {
      const audio = await resourceManager.loadResource(
        'test-audio',
        '/test.mp3',
        'audio'
      );
      
      expect(audio).toBeInstanceOf(ArrayBuffer);
      expect(audio.byteLength).toBe(1024);
    });

    it('应该处理音频加载错误', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found'
      } as Response);
      
      await expect(
        resourceManager.loadResource('error-audio', '/error.mp3', 'audio')
      ).rejects.toThrow('Failed to load audio');
    });
  });

  describe('数据加载', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: (name: string) => name === 'content-type' ? 'application/json' : null
        },
        json: () => Promise.resolve({ test: 'data' }),
        text: () => Promise.resolve('test text')
      } as Response);
    });

    it('应该加载JSON数据', async () => {
      const data = await resourceManager.loadResource(
        'test-json',
        '/test.json',
        'data'
      );
      
      expect(data).toEqual({ test: 'data' });
    });

    it('应该加载文本数据', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'text/plain'
        },
        text: () => Promise.resolve('test text')
      } as Response);
      
      const data = await resourceManager.loadResource(
        'test-text',
        '/test.txt',
        'data'
      );
      
      expect(data).toBe('test text');
    });
  });

  describe('字体加载', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(50000))
      } as Response);
    });

    it('应该成功加载字体', async () => {
      const font = await resourceManager.loadResource(
        'test-font',
        '/test.woff2',
        'font'
      );
      
      expect(font).toBeInstanceOf(MockFontFace);
      expect(font.family).toBe('CustomFont');
    });
  });

  describe('缓存管理', () => {
    it('应该限制缓存项目数量', async () => {
      // 加载超过限制的资源
      for (let i = 0; i < 15; i++) {
        await resourceManager.loadResource(`image-${i}`, `/image-${i}.jpg`, 'image');
      }
      
      const stats = resourceManager.getCacheStats();
      expect(stats.itemCount).toBeLessThanOrEqual(10);
    });

    it('应该驱逐最近最少使用的资源', async () => {
      // 加载多个资源
      await resourceManager.loadResource('old-image', '/old.jpg', 'image');
      await resourceManager.loadResource('new-image', '/new.jpg', 'image');
      
      // 访问新资源
      resourceManager.getResource('new-image');
      
      // 加载更多资源触发驱逐
      for (let i = 0; i < 10; i++) {
        await resourceManager.loadResource(`filler-${i}`, `/filler-${i}.jpg`, 'image');
      }
      
      // 旧资源应该被驱逐，新资源应该保留
      expect(resourceManager.hasResource('old-image')).toBe(false);
      expect(resourceManager.hasResource('new-image')).toBe(true);
    });

    it('应该保护持久化资源', async () => {
      await resourceManager.loadResource(
        'persistent-image',
        '/persistent.jpg',
        'image',
        'normal',
        true // persistent
      );
      
      // 加载大量资源触发驱逐
      for (let i = 0; i < 15; i++) {
        await resourceManager.loadResource(`temp-${i}`, `/temp-${i}.jpg`, 'image');
      }
      
      // 持久化资源应该保留
      expect(resourceManager.hasResource('persistent-image')).toBe(true);
    });

    it('应该清空缓存', async () => {
      await resourceManager.loadResource('test-image', '/test.jpg', 'image');
      
      expect(resourceManager.getCacheStats().itemCount).toBe(1);
      
      resourceManager.clearCache();
      
      expect(resourceManager.getCacheStats().itemCount).toBe(0);
    });

    it('应该移除指定资源', async () => {
      await resourceManager.loadResource('removable-image', '/removable.jpg', 'image');
      
      expect(resourceManager.hasResource('removable-image')).toBe(true);
      
      const removed = resourceManager.removeResource('removable-image');
      
      expect(removed).toBe(true);
      expect(resourceManager.hasResource('removable-image')).toBe(false);
    });
  });

  describe('预加载功能', () => {
    it('应该预加载资源列表', async () => {
      const resources = [
        { id: 'preload-1', url: '/preload-1.jpg', type: 'image' as const },
        { id: 'preload-2', url: '/preload-2.jpg', type: 'image' as const }
      ];
      
      await resourceManager.preloadResources(resources);
      
      expect(resourceManager.hasResource('preload-1')).toBe(true);
      expect(resourceManager.hasResource('preload-2')).toBe(true);
      
      const progress = resourceManager.getLoadingProgress();
      expect(progress.loaded).toBe(2);
      expect(progress.total).toBe(2);
      expect(progress.percentage).toBe(100);
    });

    it('应该处理预加载错误', async () => {
      const resources = [
        { id: 'good-image', url: '/good.jpg', type: 'image' as const },
        { id: 'bad-image', url: '/error.jpg', type: 'image' as const }
      ];
      
      await resourceManager.preloadResources(resources);
      
      const progress = resourceManager.getLoadingProgress();
      expect(progress.errors.length).toBeGreaterThan(0);
      expect(progress.errors[0]).toContain('bad-image');
    });

    it('应该在禁用预加载时跳过', async () => {
      const managerWithoutPreload = new ResourceManager({
        enablePreloading: false
      });
      
      const resources = [
        { id: 'skip-image', url: '/skip.jpg', type: 'image' as const }
      ];
      
      await managerWithoutPreload.preloadResources(resources);
      
      expect(managerWithoutPreload.hasResource('skip-image')).toBe(false);
      
      managerWithoutPreload.destroy();
    });
  });

  describe('缓存统计', () => {
    it('应该提供详细的缓存统计', async () => {
      await resourceManager.loadResource('image-1', '/image-1.jpg', 'image', 'high');
      await resourceManager.loadResource('audio-1', '/audio-1.mp3', 'audio', 'low');
      
      const stats = resourceManager.getCacheStats();
      
      expect(stats.itemCount).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.itemsByType.image).toBe(1);
      expect(stats.itemsByType.audio).toBe(1);
      expect(stats.itemsByPriority.high).toBe(1);
      expect(stats.itemsByPriority.low).toBe(1);
      expect(stats.utilizationPercentage).toBeGreaterThan(0);
    });

    it('应该返回资源列表', async () => {
      await resourceManager.loadResource('list-image', '/list.jpg', 'image', 'normal');
      
      const resourceList = resourceManager.getResourceList();
      
      expect(resourceList).toHaveLength(1);
      expect(resourceList[0].id).toBe('list-image');
      expect(resourceList[0].type).toBe('image');
      expect(resourceList[0].priority).toBe('normal');
    });
  });

  describe('缓存优化', () => {
    it('应该优化缓存', async () => {
      // 加载一些资源
      await resourceManager.loadResource('opt-1', '/opt-1.jpg', 'image');
      await resourceManager.loadResource('opt-2', '/opt-2.jpg', 'image');
      
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      resourceManager.optimizeCache();
      
      expect(consoleSpy).toHaveBeenCalledWith('Optimizing cache...');
      expect(consoleSpy).toHaveBeenCalledWith('Cache optimization complete');
      
      consoleSpy.mockRestore();
    });
  });

  describe('数据导出', () => {
    it('应该导出缓存信息', async () => {
      await resourceManager.loadResource('export-image', '/export.jpg', 'image');
      
      const exportedInfo = resourceManager.exportCacheInfo();
      const info = JSON.parse(exportedInfo);
      
      expect(info.timestamp).toBeTruthy();
      expect(info.config).toBeTruthy();
      expect(info.stats).toBeTruthy();
      expect(info.resources).toBeTruthy();
      expect(info.resources).toHaveLength(1);
    });
  });

  describe('并发加载', () => {
    it('应该处理并发加载相同资源', async () => {
      const promise1 = resourceManager.loadResource('concurrent', '/concurrent.jpg', 'image');
      const promise2 = resourceManager.loadResource('concurrent', '/concurrent.jpg', 'image');
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1).toBe(result2);
      expect(resourceManager.getCacheStats().itemCount).toBe(1);
    });
  });

  describe('错误处理', () => {
    it('应该处理不支持的资源类型', async () => {
      await expect(
        resourceManager.loadResource('unsupported', '/test.xyz', 'unknown' as any)
      ).rejects.toThrow('Unsupported resource type');
    });

    it('应该处理网络错误', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      await expect(
        resourceManager.loadResource('network-error', '/error.mp3', 'audio')
      ).rejects.toThrow('Network error');
    });
  });

  describe('销毁功能', () => {
    it('应该正确销毁资源管理器', async () => {
      await resourceManager.loadResource('destroy-test', '/destroy.jpg', 'image');
      
      resourceManager.destroy();
      
      const stats = resourceManager.getCacheStats();
      expect(stats.itemCount).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });
});