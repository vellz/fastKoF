// 游戏状态类型
export interface GameState {
  isPlaying: boolean
  clickCount: number
  currentPhase: 'initial' | 'phase1' | 'phase2' | 'completed'
  uploadedImage: HTMLImageElement | null
  transformedImages: HTMLImageElement[]
}

// 弹幕消息类型
export interface DanmakuMessage {
  id: string
  text: string
  x: number
  y: number
  speed: number
  color: string
  fontSize: number
  opacity: number
  createdAt: number
  animationType?: string
  scale?: number
  rotation?: number
  bounceOffset?: number
  shadowBlur?: number
}

// 特效类型
export interface Effect {
  id: string
  type: 'click' | 'shake' | 'particle'
  x: number
  y: number
  duration: number
  elapsed: number
  intensity?: number
  render(ctx: CanvasRenderingContext2D): void
}

// 点击效果类型
export interface ClickEffect extends Effect {
  type: 'click'
  scale: number
  rotation: number
}

// 震动效果类型
export interface ShakeEffect extends Effect {
  type: 'shake'
  offsetX: number
  offsetY: number
}

// API请求类型
export interface JimengImageTransformRequest {
  model: string
  prompt: string
  image: string // base64编码
  strength: number
  steps: number
  guidance_scale: number
  width?: number
  height?: number
  seed?: number
}

// API响应类型
export interface JimengImageTransformResponse {
  success: boolean
  message: string
  data?: {
    image: string // base64编码的结果图片
    seed: number
  }
  error?: string
}

// 错误类型
export enum ErrorType {
  UPLOAD_ERROR = 'UPLOAD_ERROR',
  API_ERROR = 'API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RENDER_ERROR = 'RENDER_ERROR',
  AUDIO_ERROR = 'AUDIO_ERROR',
  CANVAS_ERROR = 'CANVAS_ERROR',
  RESOURCE_ERROR = 'RESOURCE_ERROR',
  PERFORMANCE_ERROR = 'PERFORMANCE_ERROR',
  INTERACTION_ERROR = 'INTERACTION_ERROR'
}

export interface GameError {
  id: string
  type: ErrorType
  message: string
  details?: any
  timestamp: number
  stack?: string
  recoverable: boolean
  retryCount?: number
  context?: {
    gameState?: string
    userAction?: string
    component?: string
    url?: string
    userAgent?: string
  }
}

// 错误恢复策略
export interface ErrorRecoveryStrategy {
  type: ErrorType
  maxRetries: number
  retryDelay: number
  fallbackAction?: () => void
  shouldRetry?: (error: GameError) => boolean
}

// 事件类型
export interface GameEvent {
  type: 'click' | 'upload' | 'transform' | 'reset' | 'error'
  data?: any
  timestamp: number
}