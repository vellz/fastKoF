/**
 * API和游戏配置
 */

export interface GameConfig {
  // 点击阈值配置
  phase1Threshold: number;
  phase2Threshold: number;
  
  // API配置
  apiEndpoint: string;
  apiTimeout: number;
  maxRetries: number;
  
  // 图片配置
  maxImageSize: number;
  supportedFormats: string[];
  
  // 音频配置
  enableAudio: boolean;
  defaultVolume: number;
  
  // 性能配置
  targetFPS: number;
  maxParticles: number;
  
  // 弹幕配置
  maxDanmaku: number;
  danmakuSpeed: number;
}

export const defaultGameConfig: GameConfig = {
  // 点击阈值
  phase1Threshold: 50,
  phase2Threshold: 100,
  
  // API配置
  apiEndpoint: 'https://api.example.com/transform',
  apiTimeout: 30000,
  maxRetries: 3,
  
  // 图片配置
  maxImageSize: 5 * 1024 * 1024, // 5MB
  supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
  
  // 音频配置
  enableAudio: true,
  defaultVolume: 0.5,
  
  // 性能配置
  targetFPS: 60,
  maxParticles: 100,
  
  // 弹幕配置
  maxDanmaku: 20,
  danmakuSpeed: 2
};