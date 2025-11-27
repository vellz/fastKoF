import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CanvasRenderer } from '../CanvasRenderer'

// Mock Canvas和Context
const mockContext = {
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  beginPath: vi.fn(),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  setTransform: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  toDataURL: vi.fn(() => 'data:image/png;base64,mock'),
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'high',
  globalAlpha: 1,
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'left',
  textBaseline: 'top'
}

const mockCanvas = {
  getContext: vi.fn(() => mockContext),
  getBoundingClientRect: vi.fn(() => ({
    left: 0,
    top: 0,
    width: 800,
    height: 600
  })),
  toDataURL: vi.fn(() => 'data:image/png;base64,mock'),
  width: 800,
  height: 600,
  style: {
    width: '800px',
    height: '600px'
  }
} as any

// Mock window.devicePixelRatio
Object.defineProperty(window, 'devicePixelRatio', {
  writable: true,
  value: 2
})

describe('CanvasRenderer', () => {
  let renderer: CanvasRenderer

  beforeEach(() => {
    vi.clearAllMocks()
    renderer = new CanvasRenderer(mockCanvas)
  })

  describe('初始化', () => {
    it('应该正确初始化渲染器', () => {
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d')
      expect(mockContext.scale).toHaveBeenCalledWith(2, 2)
      expect(mockContext.imageSmoothingEnabled).toBe(true)
      expect(mockContext.imageSmoothingQuality).toBe('high')
    })

    it('应该在无法获取上下文时抛出错误', () => {
      const badCanvas = { getContext: vi.fn(() => null) } as any
      expect(() => new CanvasRenderer(badCanvas)).toThrow('无法获取Canvas 2D上下文')
    })
  })

  describe('尺寸调整', () => {
    it('应该正确调整Canvas尺寸', () => {
      renderer.resize(400, 300)
      
      expect(mockCanvas.style.width).toBe('400px')
      expect(mockCanvas.style.height).toBe('300px')
      expect(mockCanvas.width).toBe(800) // 400 * 2 (devicePixelRatio)
      expect(mockCanvas.height).toBe(600) // 300 * 2
      expect(mockContext.scale).toHaveBeenCalledWith(2, 2)
    })

    it('应该根据图片自动调整尺寸', () => {
      const mockImage = {
        width: 1000,
        height: 500
      } as HTMLImageElement

      renderer.resizeToFitImage(mockImage, 800, 600)
      
      // 图片宽高比 2:1，容器宽高比 4:3，应该以宽度为准
      expect(mockCanvas.style.width).toBe('800px')
      expect(mockCanvas.style.height).toBe('400px')
    })
  })

  describe('绘制功能', () => {
    it('应该能够清空Canvas', () => {
      renderer.clear()
      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
    })

    it('应该能够绘制图片', () => {
      const mockImage = new Image()
      
      renderer.drawImage(mockImage)
      
      expect(mockContext.clearRect).toHaveBeenCalled()
      expect(mockContext.drawImage).toHaveBeenCalledWith(mockImage, 0, 0, 400, 300)
    })

    it('应该能够绘制带震动效果的图片', () => {
      const mockImage = new Image()
      
      renderer.drawImage(mockImage, { applyShake: true, shakeIntensity: 10 })
      
      expect(mockContext.translate).toHaveBeenCalled()
      expect(mockContext.setTransform).toHaveBeenCalled()
    })

    it('应该能够绘制点击效果', () => {
      renderer.drawClickEffect(100, 200, 1.5, 0.8)
      
      expect(mockContext.save).toHaveBeenCalled()
      expect(mockContext.restore).toHaveBeenCalled()
      expect(mockContext.arc).toHaveBeenCalledWith(100, 200, 30, 0, Math.PI * 2)
      expect(mockContext.fillText).toHaveBeenCalledWith('👊', 100, 200)
    })

    it('应该能够绘制粒子效果', () => {
      const particles = [
        { x: 100, y: 100, size: 5, color: '#ff0000', opacity: 0.8 },
        { x: 200, y: 200, size: 3, color: '#00ff00', opacity: 0.6 }
      ]
      
      renderer.drawParticles(particles)
      
      expect(mockContext.save).toHaveBeenCalled()
      expect(mockContext.restore).toHaveBeenCalled()
      expect(mockContext.arc).toHaveBeenCalledTimes(2)
    })

    it('应该能够绘制进度条', () => {
      renderer.drawProgressBar(10, 20, 200, 10, 0.6, '#00ff00')
      
      expect(mockContext.fillRect).toHaveBeenCalledWith(10, 20, 200, 10) // 背景
      expect(mockContext.fillRect).toHaveBeenCalledWith(10, 20, 120, 10) // 进度 (200 * 0.6)
      expect(mockContext.strokeRect).toHaveBeenCalledWith(10, 20, 200, 10) // 边框
    })

    it('应该能够绘制文本', () => {
      renderer.drawText('Hello World', 100, 200, {
        font: '20px Arial',
        color: '#ff0000',
        align: 'center',
        stroke: true,
        strokeColor: '#ffffff'
      })
      
      expect(mockContext.font).toBe('20px Arial')
      expect(mockContext.fillStyle).toBe('#ff0000')
      expect(mockContext.textAlign).toBe('center')
      expect(mockContext.strokeText).toHaveBeenCalledWith('Hello World', 100, 200, undefined)
      expect(mockContext.fillText).toHaveBeenCalledWith('Hello World', 100, 200, undefined)
    })
  })

  describe('坐标转换', () => {
    it('应该正确转换屏幕坐标到Canvas坐标', () => {
      const result = renderer.screenToCanvas(400, 300)
      
      // 考虑devicePixelRatio = 2
      expect(result.x).toBe(200) // (400 - 0) * (800 / 800) / 2
      expect(result.y).toBe(150) // (300 - 0) * (600 / 600) / 2
    })

    it('应该正确检查点是否在Canvas内', () => {
      expect(renderer.isPointInCanvas(200, 150)).toBe(true)
      expect(renderer.isPointInCanvas(-10, 150)).toBe(false)
      expect(renderer.isPointInCanvas(200, -10)).toBe(false)
      expect(renderer.isPointInCanvas(500, 150)).toBe(false)
      expect(renderer.isPointInCanvas(200, 400)).toBe(false)
    })
  })

  describe('工具方法', () => {
    it('应该返回正确的Canvas尺寸', () => {
      const size = renderer.getSize()
      expect(size.width).toBe(400) // 800 / 2
      expect(size.height).toBe(300) // 600 / 2
    })

    it('应该返回Canvas元素', () => {
      expect(renderer.getCanvas()).toBe(mockCanvas)
    })

    it('应该返回渲染上下文', () => {
      expect(renderer.getContext()).toBe(mockContext)
    })

    it('应该能够生成截图', () => {
      const dataURL = renderer.toDataURL('image/jpeg', 0.8)
      expect(dataURL).toBe('data:image/png;base64,mock')
    })
  })

  describe('销毁', () => {
    it('应该正确销毁渲染器', () => {
      renderer.destroy()
      expect(mockContext.clearRect).toHaveBeenCalled()
    })
  })
})