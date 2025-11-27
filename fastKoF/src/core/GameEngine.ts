import { GameState, GameEvent, GameError, ErrorType } from '@/types'
import { defaultGameConfig, GameConfig } from '@/config/api.config'

export class GameEngine {
  private state: GameState
  private config: GameConfig
  private eventListeners: Map<string, Function[]>
  private animationId: number | null = null
  private lastUpdateTime: number = 0

  constructor(config: GameConfig = defaultGameConfig) {
    this.config = config
    this.eventListeners = new Map()
    this.state = this.createInitialState()
    
    console.log('GameEngine initialized')
  }

  // 创建初始状态
  private createInitialState(): GameState {
    return {
      isPlaying: false,
      clickCount: 0,
      currentPhase: 'initial',
      uploadedImage: null,
      transformedImages: []
    }
  }

  // 获取当前状态
  public getState(): GameState {
    return { ...this.state }
  }

  // 获取配置
  public getConfig(): GameConfig {
    return this.config
  }

  // 初始化游戏引擎
  public init(): void {
    try {
      console.log('Initializing game engine...')
      this.state = this.createInitialState()
      this.emit('init', { state: this.state })
      console.log('Game engine initialized successfully')
    } catch (error) {
      this.handleError(ErrorType.RENDER_ERROR, 'Failed to initialize game engine', error)
    }
  }

  // 开始游戏
  public start(): void {
    if (this.state.isPlaying) {
      console.warn('Game is already running')
      return
    }

    try {
      this.state.isPlaying = true
      this.lastUpdateTime = performance.now()
      this.startGameLoop()
      this.emit('start', { state: this.state })
      console.log('Game started')
    } catch (error) {
      this.handleError(ErrorType.RENDER_ERROR, 'Failed to start game', error)
    }
  }

  // 暂停游戏
  public pause(): void {
    if (!this.state.isPlaying) {
      console.warn('Game is not running')
      return
    }

    try {
      this.state.isPlaying = false
      this.stopGameLoop()
      this.emit('pause', { state: this.state })
      console.log('Game paused')
    } catch (error) {
      this.handleError(ErrorType.RENDER_ERROR, 'Failed to pause game', error)
    }
  }

  // 重置游戏
  public reset(): void {
    try {
      this.stopGameLoop()
      this.state = this.createInitialState()
      this.emit('reset', { state: this.state })
      console.log('Game reset')
    } catch (error) {
      this.handleError(ErrorType.RENDER_ERROR, 'Failed to reset game', error)
    }
  }

  // 处理点击事件
  public handleClick(x: number, y: number): void {
    if (!this.state.isPlaying || !this.state.uploadedImage) {
      return
    }

    try {
      // 增加点击计数
      this.state.clickCount++
      
      // 检查阶段转换
      this.checkPhaseTransition()
      
      // 发射点击事件
      this.emit('click', { 
        x, 
        y, 
        clickCount: this.state.clickCount,
        phase: this.state.currentPhase
      })

      console.log(`Click at (${x}, ${y}), count: ${this.state.clickCount}, phase: ${this.state.currentPhase}`)
    } catch (error) {
      this.handleError(ErrorType.RENDER_ERROR, 'Failed to handle click', error)
    }
  }

  // 检查阶段转换
  private checkPhaseTransition(): void {
    const { clickCount } = this.state
    const { phase1Threshold, phase2Threshold } = this.config

    let newPhase = this.state.currentPhase

    if (clickCount >= phase2Threshold && this.state.currentPhase !== 'phase2') {
      newPhase = 'phase2'
    } else if (clickCount >= phase1Threshold && this.state.currentPhase === 'initial') {
      newPhase = 'phase1'
    }

    if (newPhase !== this.state.currentPhase) {
      const oldPhase = this.state.currentPhase
      this.state.currentPhase = newPhase
      this.emit('phaseChange', { 
        oldPhase, 
        newPhase, 
        clickCount 
      })
      console.log(`Phase changed from ${oldPhase} to ${newPhase}`)
    }
  }

  // 设置上传的图片
  public setUploadedImage(image: HTMLImageElement): void {
    try {
      this.state.uploadedImage = image
      this.state.isPlaying = true
      this.start()
      this.emit('imageUploaded', { image, state: this.state })
      console.log('Image uploaded and set')
    } catch (error) {
      this.handleError(ErrorType.UPLOAD_ERROR, 'Failed to set uploaded image', error)
    }
  }

  // 添加变形后的图片
  public addTransformedImage(image: HTMLImageElement): void {
    try {
      this.state.transformedImages.push(image)
      this.emit('imageTransformed', { 
        image, 
        transformCount: this.state.transformedImages.length,
        state: this.state 
      })
      console.log(`Transformed image added, total: ${this.state.transformedImages.length}`)
    } catch (error) {
      this.handleError(ErrorType.API_ERROR, 'Failed to add transformed image', error)
    }
  }

  // 获取当前显示的图片
  public getCurrentImage(): HTMLImageElement | null {
    const { transformedImages, uploadedImage } = this.state
    
    // 返回最新的变形图片，如果没有则返回原图
    if (transformedImages.length > 0) {
      return transformedImages[transformedImages.length - 1]
    }
    
    return uploadedImage
  }

  // 游戏循环
  private startGameLoop(): void {
    if (this.animationId !== null) {
      return
    }

    const gameLoop = (currentTime: number) => {
      if (!this.state.isPlaying) {
        return
      }

      const deltaTime = currentTime - this.lastUpdateTime
      this.lastUpdateTime = currentTime

      this.update(deltaTime)
      this.animationId = requestAnimationFrame(gameLoop)
    }

    this.animationId = requestAnimationFrame(gameLoop)
  }

  private stopGameLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  // 更新游戏状态
  public update(deltaTime: number): void {
    // 发射更新事件，让其他系统处理具体的更新逻辑
    this.emit('update', { deltaTime, state: this.state })
  }

  // 事件系统
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(callback)
  }

  public off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error)
        }
      })
    }
  }

  // 错误处理
  private handleError(type: ErrorType, message: string, details?: any): void {
    const error: GameError = {
      type,
      message,
      details,
      timestamp: Date.now()
    }

    console.error('GameEngine Error:', error)
    this.emit('error', error)
  }

  // 销毁游戏引擎
  public destroy(): void {
    try {
      this.stopGameLoop()
      this.eventListeners.clear()
      this.state = this.createInitialState()
      console.log('Game engine destroyed')
    } catch (error) {
      console.error('Error destroying game engine:', error)
    }
  }

  // 获取游戏统计信息
  public getStats() {
    return {
      clickCount: this.state.clickCount,
      currentPhase: this.state.currentPhase,
      isPlaying: this.state.isPlaying,
      hasImage: !!this.state.uploadedImage,
      transformedCount: this.state.transformedImages.length,
      phase1Progress: Math.min(this.state.clickCount / this.config.phase1Threshold, 1),
      phase2Progress: Math.min(this.state.clickCount / this.config.phase2Threshold, 1)
    }
  }
}