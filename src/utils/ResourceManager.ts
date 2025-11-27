/**
 * 资源管理器
 * 管理游戏资源的加载、缓存和释放
 */

export interface ResourceConfig {
  maxCacheSize: number; // 最大缓存大小（字节）
  maxCacheItems: number; // 最大缓存项目数
  enableLazyLoading: boolean; // 启用懒加载
  enablePreloading: boolean; // 启用预加载
  cacheExpiration: number; // 缓存过期时间（毫秒）
  compressionEnabled: boolean; // 启用压缩
}

export interface ResourceItem {
  id: string;
  type: 'image' | 'audio' | 'data' | 'font';
  url: string;
  data: any;
  size: number;
  lastAccessed: number;
  loadTime: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  persistent: boolean; // 是否持久化，不会被自动清理
}

export interface LoadingProgress {
  loaded: number;
  total: number;
  percentage: number;
  currentItem: string;
  errors: string[];
}

/**
 * 资源管理器类
 */
export class ResourceManager {
  private config: ResourceConfig;
  private cache = new Map<string, ResourceItem>();
  private loadingQueue = new Map<string, Promise<any>>();
  private preloadQueue: string[] = [];
  private totalCacheSize = 0;
  private loadingProgress: LoadingProgress = {
    loaded: 0,
    total: 0,
    percentage: 0,
    currentItem: '',
    errors: []
  };

  constructor(config: Partial<ResourceConfig> = {}) {
    this.config = {
      maxCacheSize: 100 * 1024 * 1024, // 100MB
      maxCacheItems: 500,
      enableLazyLoading: true,
      enablePreloading: true,
      cacheExpiration: 30 * 60 * 1000, // 30分钟
      compressionEnabled: true,
      ...config
    };

    this.init();
  }

  /**
   * 初始化资源管理器
   */
  private init(): void {
    // 定期清理过期缓存
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 5 * 60 * 1000); // 每5分钟清理一次

    // 监听内存压力事件
    if ('memory' in performance) {
      this.setupMemoryPressureHandling();
    }
  }

  /**
   * 设置内存压力处理
   */
  private setupMemoryPressureHandling(): void {
    // 监听内存使用情况
    const checkMemoryPressure = () => {
      const memory = (performance as any).memory;
      if (memory && memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) {
        console.warn('Memory pressure detected, cleaning up cache');
        this.cleanupLowPriorityCache();
      }
    };

    setInterval(checkMemoryPressure, 10000); // 每10秒检查一次
  }

  /**
   * 加载资源
   */
  async loadResource(
    id: string,
    url: string,
    type: ResourceItem['type'],
    priority: ResourceItem['priority'] = 'normal',
    persistent = false
  ): Promise<any> {
    // 检查缓存
    const cached = this.cache.get(id);
    if (cached) {
      cached.lastAccessed = Date.now();
      return cached.data;
    }

    // 检查是否正在加载
    if (this.loadingQueue.has(id)) {
      return this.loadingQueue.get(id);
    }

    // 开始加载
    const loadPromise = this.performLoad(id, url, type, priority, persistent);
    this.loadingQueue.set(id, loadPromise);

    try {
      const data = await loadPromise;
      return data;
    } finally {
      this.loadingQueue.delete(id);
    }
  }

  /**
   * 执行资源加载
   */
  private async performLoad(
    id: string,
    url: string,
    type: ResourceItem['type'],
    priority: ResourceItem['priority'],
    persistent: boolean
  ): Promise<any> {
    const startTime = performance.now();
    this.loadingProgress.currentItem = id;

    try {
      let data: any;
      let size = 0;

      switch (type) {
        case 'image':
          data = await this.loadImage(url);
          size = this.estimateImageSize(data);
          break;
        case 'audio':
          data = await this.loadAudio(url);
          size = this.estimateAudioSize(data);
          break;
        case 'data':
          data = await this.loadData(url);
          size = this.estimateDataSize(data);
          break;
        case 'font':
          data = await this.loadFont(url);
          size = this.estimateFontSize(data);
          break;
        default:
          throw new Error(`Unsupported resource type: ${type}`);
      }

      const loadTime = performance.now() - startTime;

      // 创建资源项
      const item: ResourceItem = {
        id,
        type,
        url,
        data,
        size,
        lastAccessed: Date.now(),
        loadTime,
        priority,
        persistent
      };

      // 添加到缓存
      this.addToCache(item);

      console.log(`Resource loaded: ${id} (${type}) in ${loadTime.toFixed(2)}ms`);
      return data;

    } catch (error) {
      console.error(`Failed to load resource: ${id}`, error);
      this.loadingProgress.errors.push(`${id}: ${error}`);
      throw error;
    }
  }

  /**
   * 加载图片
   */
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      
      img.src = url;
    });
  }

  /**
   * 加载音频
   */
  private async loadAudio(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load audio: ${response.statusText}`);
    }
    return response.arrayBuffer();
  }

  /**
   * 加载数据
   */
  private async loadData(url: string): Promise<any> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load data: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    } else {
      return response.text();
    }
  }

  /**
   * 加载字体
   */
  private async loadFont(url: string): Promise<FontFace> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load font: ${response.statusText}`);
    }
    
    const fontData = await response.arrayBuffer();
    const fontFace = new FontFace('CustomFont', fontData);
    await fontFace.load();
    
    return fontFace;
  }

  /**
   * 估算图片大小
   */
  private estimateImageSize(img: HTMLImageElement): number {
    return img.width * img.height * 4; // RGBA
  }

  /**
   * 估算音频大小
   */
  private estimateAudioSize(buffer: ArrayBuffer): number {
    return buffer.byteLength;
  }

  /**
   * 估算数据大小
   */
  private estimateDataSize(data: any): number {
    return JSON.stringify(data).length * 2; // UTF-16
  }

  /**
   * 估算字体大小
   */
  private estimateFontSize(font: FontFace): number {
    return 50000; // 估算值
  }

  /**
   * 添加到缓存
   */
  private addToCache(item: ResourceItem): void {
    // 检查缓存限制
    this.ensureCacheSpace(item.size);

    this.cache.set(item.id, item);
    this.totalCacheSize += item.size;

    console.log(`Cache updated: ${this.cache.size} items, ${(this.totalCacheSize / 1024 / 1024).toFixed(2)}MB`);
  }

  /**
   * 确保缓存空间
   */
  private ensureCacheSpace(requiredSize: number): void {
    // 检查数量限制
    while (this.cache.size >= this.config.maxCacheItems) {
      this.evictLeastRecentlyUsed();
    }

    // 检查大小限制
    while (this.totalCacheSize + requiredSize > this.config.maxCacheSize) {
      this.evictLeastRecentlyUsed();
    }
  }

  /**
   * 驱逐最近最少使用的资源
   */
  private evictLeastRecentlyUsed(): void {
    let oldestItem: ResourceItem | null = null;
    let oldestId = '';

    for (const [id, item] of this.cache) {
      if (item.persistent) continue; // 跳过持久化资源
      
      if (!oldestItem || item.lastAccessed < oldestItem.lastAccessed) {
        oldestItem = item;
        oldestId = id;
      }
    }

    if (oldestItem) {
      this.removeFromCache(oldestId);
    }
  }

  /**
   * 从缓存中移除
   */
  private removeFromCache(id: string): void {
    const item = this.cache.get(id);
    if (item) {
      this.cache.delete(id);
      this.totalCacheSize -= item.size;
      console.log(`Resource evicted: ${id}`);
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, item] of this.cache) {
      if (item.persistent) continue;
      
      if (now - item.lastAccessed > this.config.cacheExpiration) {
        expiredIds.push(id);
      }
    }

    expiredIds.forEach(id => this.removeFromCache(id));

    if (expiredIds.length > 0) {
      console.log(`Cleaned up ${expiredIds.length} expired resources`);
    }
  }

  /**
   * 清理低优先级缓存
   */
  private cleanupLowPriorityCache(): void {
    const lowPriorityIds: string[] = [];

    for (const [id, item] of this.cache) {
      if (item.persistent) continue;
      
      if (item.priority === 'low') {
        lowPriorityIds.push(id);
      }
    }

    lowPriorityIds.forEach(id => this.removeFromCache(id));

    console.log(`Cleaned up ${lowPriorityIds.length} low priority resources`);
  }

  /**
   * 预加载资源
   */
  async preloadResources(resources: Array<{
    id: string;
    url: string;
    type: ResourceItem['type'];
    priority?: ResourceItem['priority'];
  }>): Promise<void> {
    if (!this.config.enablePreloading) return;

    this.loadingProgress.total = resources.length;
    this.loadingProgress.loaded = 0;
    this.loadingProgress.errors = [];

    const loadPromises = resources.map(async (resource, index) => {
      try {
        await this.loadResource(
          resource.id,
          resource.url,
          resource.type,
          resource.priority || 'normal'
        );
        this.loadingProgress.loaded++;
        this.loadingProgress.percentage = (this.loadingProgress.loaded / this.loadingProgress.total) * 100;
      } catch (error) {
        console.error(`Preload failed for ${resource.id}:`, error);
      }
    });

    await Promise.all(loadPromises);
    console.log(`Preloaded ${this.loadingProgress.loaded}/${this.loadingProgress.total} resources`);
  }

  /**
   * 获取资源
   */
  getResource(id: string): any | null {
    const item = this.cache.get(id);
    if (item) {
      item.lastAccessed = Date.now();
      return item.data;
    }
    return null;
  }

  /**
   * 检查资源是否存在
   */
  hasResource(id: string): boolean {
    return this.cache.has(id);
  }

  /**
   * 移除资源
   */
  removeResource(id: string): boolean {
    if (this.cache.has(id)) {
      this.removeFromCache(id);
      return true;
    }
    return false;
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.totalCacheSize = 0;
    console.log('Cache cleared');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    itemCount: number;
    totalSize: number;
    maxSize: number;
    utilizationPercentage: number;
    itemsByType: Record<string, number>;
    itemsByPriority: Record<string, number>;
  } {
    const itemsByType: Record<string, number> = {};
    const itemsByPriority: Record<string, number> = {};

    for (const item of this.cache.values()) {
      itemsByType[item.type] = (itemsByType[item.type] || 0) + 1;
      itemsByPriority[item.priority] = (itemsByPriority[item.priority] || 0) + 1;
    }

    return {
      itemCount: this.cache.size,
      totalSize: this.totalCacheSize,
      maxSize: this.config.maxCacheSize,
      utilizationPercentage: (this.totalCacheSize / this.config.maxCacheSize) * 100,
      itemsByType,
      itemsByPriority
    };
  }

  /**
   * 获取加载进度
   */
  getLoadingProgress(): LoadingProgress {
    return { ...this.loadingProgress };
  }

  /**
   * 获取资源列表
   */
  getResourceList(): Array<{
    id: string;
    type: string;
    size: number;
    lastAccessed: number;
    loadTime: number;
    priority: string;
    persistent: boolean;
  }> {
    return Array.from(this.cache.values()).map(item => ({
      id: item.id,
      type: item.type,
      size: item.size,
      lastAccessed: item.lastAccessed,
      loadTime: item.loadTime,
      priority: item.priority,
      persistent: item.persistent
    }));
  }

  /**
   * 优化缓存
   */
  optimizeCache(): void {
    console.log('Optimizing cache...');
    
    // 清理过期资源
    this.cleanupExpiredCache();
    
    // 如果仍然超出限制，清理低优先级资源
    if (this.totalCacheSize > this.config.maxCacheSize * 0.8) {
      this.cleanupLowPriorityCache();
    }
    
    console.log('Cache optimization complete');
  }

  /**
   * 导出缓存信息
   */
  exportCacheInfo(): string {
    const info = {
      timestamp: new Date().toISOString(),
      config: this.config,
      stats: this.getCacheStats(),
      resources: this.getResourceList()
    };
    
    return JSON.stringify(info, null, 2);
  }

  /**
   * 销毁资源管理器
   */
  destroy(): void {
    this.clearCache();
    this.loadingQueue.clear();
    this.preloadQueue = [];
  }
}