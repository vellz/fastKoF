import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GameEngine } from '../GameEngine'
import { GameConfig } from '@/config/api.config'

// Mock配置
const mockConfig: GameConfig = {
  phase1Threshold: 10,
  phase2Threshold: 20,
  danmakuMessages: ['test message'],
  danmakuSpeed: 2,
  danmakuFrequency: 0.3,
  soundVolume: 0.5,
  soundFiles: [],
  clickEffectDuration: 800,
  shakeIntensity: 10,
  maxImageSize: 5 * 1024 * 1024,
  supportedFormats: ['image/jpeg'],
  canvasSize: { width: 800, height: 600 }
}

describe('GameEngine', () => {
  let gameEngine: GameEngine

  beforeEach(() => {
    gameEngine = new GameEngine(mockConfig)
  })

  describe('初始化', () => {
    it('应该正确初始化游戏状态', () => {
      const state = gameEngine.getState()
      
      expect(state.isPlaying).toBe(false)
      expect(state.clickCount).toBe(0)
      expect(state.currentPhase).toBe('initial')
      expect(state.uploadedImage).toBeNull()
      expect(state.transformedImages).toEqual([])
    })

    it('应该正确设置配置', () => {
      const config = gameEngine.getConfig()
      expect(config).toEqual(mockConfig)
    })
  })

  describe('游戏生命周期', () => {
    it('应该能够初始化游戏', () => {
      const mockCallback = vi.fn()
      gameEngine.on('init', mockCallback)
      
      gameEngine.init()
      
      expect(mockCallback).toHaveBeenCalledWith({ state: gameEngine.getState() })
    })

    it('应该能够开始游戏', () => {
      const mockCallback = vi.fn()
      gameEngine.on('start', mockCallback)
      
      gameEngine.start()
      
      expect(gameEngine.getState().isPlaying).toBe(true)
      expect(mockCallback).toHaveBeenCalled()
    })

    it('应该能够暂停游戏', () => {
      gameEngine.start()
      const mockCallback = vi.fn()
      gameEngine.on('pause', mockCallback)
      
      gameEngine.pause()
      
      expect(gameEngine.getState().isPlaying).toBe(false)
      expect(mockCallback).toHaveBeenCalled()
    })

    it('应该能够重置游戏', () => {
      // 先设置一些状态
      gameEngine.start()
      gameEngine.handleClick(100, 100)
      
      const mockCallback = vi.fn()
      gameEngine.on('reset', mockCallback)
      
      gameEngine.reset()
      
      const state = gameEngine.getState()
      expect(state.isPlaying).toBe(false)
      expect(state.clickCount).toBe(0)
      expect(state.currentPhase).toBe('initial')
      expect(mockCallback).toHaveBeenCalled()
    })
  })

  describe('点击处理', () => {
    beforeEach(() => {
      // 创建模拟图片
      const mockImage = new Image()
      gameEngine.setUploadedImage(mockImage)
    })

    it('应该正确处理点击事件', () => {
      const mockCallback = vi.fn()
      gameEngine.on('click', mockCallback)
      
      gameEngine.handleClick(100, 200)
      
      expect(gameEngine.getState().clickCount).toBe(1)
      expect(mockCallback).toHaveBeenCalledWith({
        x: 100,
        y: 200,
        clickCount: 1,
        phase: 'initial'
      })
    })

    it('应该在没有图片时忽略点击', () => {
      const newEngine = new GameEngine(mockConfig)
      newEngine.start()
      
      const mockCallback = vi.fn()
      newEngine.on('click', mockCallback)
      
      newEngine.handleClick(100, 200)
      
      expect(newEngine.getState().clickCount).toBe(0)
      expect(mockCallback).not.toHaveBeenCalled()
    })

    it('应该在游戏未开始时忽略点击', () => {
      gameEngine.pause()
      
      const mockCallback = vi.fn()
      gameEngine.on('click', mockCallback)
      
      gameEngine.handleClick(100, 200)
      
      expect(gameEngine.getState().clickCount).toBe(0)
      expect(mockCallback).not.toHaveBeenCalled()
    })
  })

  describe('阶段转换', () => {
    beforeEach(() => {
      const mockImage = new Image()
      gameEngine.setUploadedImage(mockImage)
    })

    it('应该在达到阈值时转换到phase1', () => {
      const mockCallback = vi.fn()
      gameEngine.on('phaseChange', mockCallback)
      
      // 点击到阈值
      for (let i = 0; i < mockConfig.phase1Threshold; i++) {
        gameEngine.handleClick(100, 100)
      }
      
      expect(gameEngine.getState().currentPhase).toBe('phase1')
      expect(mockCallback).toHaveBeenCalledWith({
        oldPhase: 'initial',
        newPhase: 'phase1',
        clickCount: mockConfig.phase1Threshold
      })
    })

    it('应该在达到阈值时转换到phase2', () => {
      const mockCallback = vi.fn()
      gameEngine.on('phaseChange', mockCallback)
      
      // 点击到phase2阈值
      for (let i = 0; i < mockConfig.phase2Threshold; i++) {
        gameEngine.handleClick(100, 100)
      }
      
      expect(gameEngine.getState().currentPhase).toBe('phase2')
      expect(mockCallback).toHaveBeenCalledTimes(2) // phase1 和 phase2 各一次
    })
  })

  describe('图片管理', () => {
    it('应该能够设置上传的图片', () => {
      const mockImage = new Image()
      const mockCallback = vi.fn()
      gameEngine.on('imageUploaded', mockCallback)
      
      gameEngine.setUploadedImage(mockImage)
      
      expect(gameEngine.getState().uploadedImage).toBe(mockImage)
      expect(gameEngine.getState().isPlaying).toBe(true)
      expect(mockCallback).toHaveBeenCalledWith({
        image: mockImage,
        state: gameEngine.getState()
      })
    })

    it('应该能够添加变形后的图片', () => {
      const mockImage = new Image()
      const transformedImage = new Image()
      
      gameEngine.setUploadedImage(mockImage)
      
      const mockCallback = vi.fn()
      gameEngine.on('imageTransformed', mockCallback)
      
      gameEngine.addTransformedImage(transformedImage)
      
      expect(gameEngine.getState().transformedImages).toContain(transformedImage)
      expect(mockCallback).toHaveBeenCalledWith({
        image: transformedImage,
        transformCount: 1,
        state: gameEngine.getState()
      })
    })

    it('应该返回正确的当前图片', () => {
      const originalImage = new Image()
      const transformedImage1 = new Image()
      const transformedImage2 = new Image()
      
      gameEngine.setUploadedImage(originalImage)
      expect(gameEngine.getCurrentImage()).toBe(originalImage)
      
      gameEngine.addTransformedImage(transformedImage1)
      expect(gameEngine.getCurrentImage()).toBe(transformedImage1)
      
      gameEngine.addTransformedImage(transformedImage2)
      expect(gameEngine.getCurrentImage()).toBe(transformedImage2)
    })
  })

  describe('事件系统', () => {
    it('应该能够注册和触发事件监听器', () => {
      const mockCallback = vi.fn()
      
      gameEngine.on('test', mockCallback)
      gameEngine['emit']('test', { data: 'test' })
      
      expect(mockCallback).toHaveBeenCalledWith({ data: 'test' })
    })

    it('应该能够移除事件监听器', () => {
      const mockCallback = vi.fn()
      
      gameEngine.on('test', mockCallback)
      gameEngine.off('test', mockCallback)
      gameEngine['emit']('test', { data: 'test' })
      
      expect(mockCallback).not.toHaveBeenCalled()
    })
  })

  describe('统计信息', () => {
    it('应该返回正确的游戏统计信息', () => {
      const mockImage = new Image()
      gameEngine.setUploadedImage(mockImage)
      
      // 点击几次
      for (let i = 0; i < 5; i++) {
        gameEngine.handleClick(100, 100)
      }
      
      const stats = gameEngine.getStats()
      
      expect(stats.clickCount).toBe(5)
      expect(stats.currentPhase).toBe('initial')
      expect(stats.isPlaying).toBe(true)
      expect(stats.hasImage).toBe(true)
      expect(stats.transformedCount).toBe(0)
      expect(stats.phase1Progress).toBe(0.5) // 5/10
      expect(stats.phase2Progress).toBe(0.25) // 5/20
    })
  })

  describe('销毁', () => {
    it('应该能够正确销毁游戏引擎', () => {
      gameEngine.start()
      gameEngine.handleClick(100, 100)
      
      gameEngine.destroy()
      
      const state = gameEngine.getState()
      expect(state.isPlaying).toBe(false)
      expect(state.clickCount).toBe(0)
    })
  })
})