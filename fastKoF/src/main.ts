import './styles/main.css'
import { defaultGameConfig } from './config/api.config'

// 应用初始化
console.log('发泄情绪小游戏启动中...')

// 基础DOM元素获取
const uploadArea = document.getElementById('uploadArea') as HTMLDivElement
const fileInput = document.getElementById('fileInput') as HTMLInputElement
const gameArea = document.getElementById('gameArea') as HTMLDivElement
const gameCanvas = document.getElementById('gameCanvas') as HTMLCanvasElement
const clickCountElement = document.getElementById('clickCount') as HTMLSpanElement
const statusText = document.getElementById('statusText') as HTMLSpanElement
const volumeBtn = document.getElementById('volumeBtn') as HTMLButtonElement
const settingsBtn = document.getElementById('settingsBtn') as HTMLButtonElement
const settingsModal = document.getElementById('settingsModal') as HTMLDivElement
const closeSettings = document.getElementById('closeSettings') as HTMLButtonElement
const volumeSlider = document.getElementById('volumeSlider') as HTMLInputElement
const volumeValue = document.getElementById('volumeValue') as HTMLSpanElement
const effectsToggle = document.getElementById('effectsToggle') as HTMLInputElement
const loadingOverlay = document.getElementById('loadingOverlay') as HTMLDivElement

// 新功能DOM元素
const gameActions = document.getElementById('gameActions') as HTMLDivElement
const shareBtn = document.getElementById('shareBtn') as HTMLButtonElement
const transformBtn = document.getElementById('transformBtn') as HTMLButtonElement
const resetGameBtn = document.getElementById('resetGameBtn') as HTMLButtonElement
const transformNotification = document.getElementById('transformNotification') as HTMLDivElement
const modifySection = document.getElementById('modifySection') as HTMLDivElement
const modifyBtn = document.getElementById('modifyBtn') as HTMLButtonElement
const nameInputSection = document.getElementById('nameInputSection') as HTMLDivElement
const nameInput = document.getElementById('nameInput') as HTMLInputElement
const floatingName = document.getElementById('floatingName') as HTMLDivElement

// 分享弹窗元素
const shareModal = document.getElementById('shareModal') as HTMLDivElement
const closeShareModal = document.getElementById('closeShareModal') as HTMLButtonElement
const shareClickCount = document.getElementById('shareClickCount') as HTMLSpanElement
const shareGameTime = document.getElementById('shareGameTime') as HTMLSpanElement
const shareTransformStatus = document.getElementById('shareTransformStatus') as HTMLSpanElement
const shareToWechat = document.getElementById('shareToWechat') as HTMLButtonElement
const shareToWeibo = document.getElementById('shareToWeibo') as HTMLButtonElement
const copyShareLink = document.getElementById('copyShareLink') as HTMLButtonElement

// 游戏状态
let clickCount = 0
let gameState = 'initial'
let gameStartTime = 0
let isTransformed = false
let currentImage: HTMLImageElement | null = null

// 初始化游戏核心组件
function initializeGameCore() {
  try {
    console.log('游戏核心组件初始化完成')
    console.log('配置:', defaultGameConfig)
  } catch (error) {
    console.error('游戏核心组件初始化失败:', error)
  }
}

// 设置Canvas点击事件
function setupCanvasClickEvents() {
  gameCanvas.addEventListener('click', handleCanvasClick)
  gameCanvas.addEventListener('touchstart', handleCanvasTouch, { passive: false })
}

// 处理Canvas点击
function handleCanvasClick(e: MouseEvent) {
  const rect = gameCanvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  // 增加点击计数
  clickCount++
  updateClickCount(clickCount)
  
  // 检查是否达到变身条件（10次点击）
  if (clickCount === 10 && !isTransformed) {
    triggerTransformation()
  }
  
  // 添加点击特效
  addClickEffect(x, y)
  
  console.log(`点击位置: (${x}, ${y}), 总点击数: ${clickCount}`)
}

// 处理Canvas触摸
function handleCanvasTouch(e: TouchEvent) {
  e.preventDefault()
  const rect = gameCanvas.getBoundingClientRect()
  const touch = e.touches[0]
  const x = touch.clientX - rect.left
  const y = touch.clientY - rect.top
  
  // 增加点击计数
  clickCount++
  updateClickCount(clickCount)
  
  // 检查是否达到变身条件（10次点击）
  if (clickCount === 10 && !isTransformed) {
    triggerTransformation()
  }
  
  // 添加点击特效
  addClickEffect(x, y)
  
  console.log(`触摸位置: (${x}, ${y}), 总点击数: ${clickCount}`)
}

// 基础事件监听器设置
function initializeEventListeners() {
  // 文件上传相关事件
  uploadArea.addEventListener('click', () => fileInput.click())
  uploadArea.addEventListener('dragover', handleDragOver)
  uploadArea.addEventListener('dragleave', handleDragLeave)
  uploadArea.addEventListener('drop', handleDrop)
  fileInput.addEventListener('change', handleFileSelect)
  
  // 新功能按钮事件
  shareBtn.addEventListener('click', () => {
    console.log('点击分享战绩按钮')
    showShareModal()
  })
  transformBtn.addEventListener('click', () => {
    console.log('点击变身宠物按钮')
    manualTransform()
  })
  resetGameBtn.addEventListener('click', () => {
    console.log('点击重置游戏按钮')
    resetGame()
  })
  modifyBtn.addEventListener('click', () => {
    console.log('点击修改按钮')
    fileInput.click()
  })
  
  // 名字输入框事件
  nameInput.addEventListener('input', handleNameInput)
  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      nameInput.blur()
    }
  })
  
  // 分享弹窗事件
  closeShareModal.addEventListener('click', hideShareModal)
  shareToWechat.addEventListener('click', shareToWechatHandler)
  shareToWeibo.addEventListener('click', shareToWeiboHandler)
  copyShareLink.addEventListener('click', copyShareLinkHandler)
  
  // 设置相关事件
  settingsBtn.addEventListener('click', () => settingsModal.style.display = 'flex')
  closeSettings.addEventListener('click', () => settingsModal.style.display = 'none')
  volumeBtn.addEventListener('click', toggleMute)
  volumeSlider.addEventListener('input', updateVolume)
  
  // 模态框外部点击关闭
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.style.display = 'none'
    }
  })
  
  shareModal.addEventListener('click', (e) => {
    if (e.target === shareModal) {
      hideShareModal()
    }
  })
  
  // 窗口大小变化事件
  window.addEventListener('resize', handleWindowResize)
}

// 处理窗口大小变化
function handleWindowResize() {
  console.log('窗口大小变化')
}

// 拖拽事件处理
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  uploadArea.classList.add('dragover')
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault()
  uploadArea.classList.remove('dragover')
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  uploadArea.classList.remove('dragover')
  
  const files = e.dataTransfer?.files
  if (files && files.length > 0) {
    handleFile(files[0])
  }
}

// 文件选择处理
function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    handleFile(files[0])
  }
}

// 文件处理 - 简化版本
async function handleFile(file: File) {
  try {
    console.log('处理文件:', file.name)
    
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      showUploadError('请选择图片文件')
      return
    }
    
    // 检查文件大小
    if (file.size > defaultGameConfig.maxImageSize) {
      showUploadError('文件太大，请选择小于5MB的图片')
      return
    }
    
    showUploadProgress()
    
    // 创建图片对象
    const img = new Image()
    img.onload = () => {
      hideUploadProgress()
      
      // 保存当前图片引用
      currentImage = img
      
      // 隐藏上传区域，显示游戏区域
      uploadArea.style.display = 'none'
      gameArea.style.display = 'flex'
      
      // 设置游戏开始时间
      gameStartTime = Date.now()
      
      // 更新状态文本
      statusText.textContent = '开始点击图片发泄情绪吧！'
      
      // 设置Canvas尺寸（圆形区域）
      const size = Math.min(gameArea.clientWidth, gameArea.clientHeight)
      gameCanvas.width = size
      gameCanvas.height = size
      
      // 绘制图片到Canvas（圆形裁剪）
      const ctx = gameCanvas.getContext('2d')!
      ctx.save()
      
      // 创建圆形裁剪路径
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
      ctx.clip()
      
      // 计算图片缩放和位置
      const scale = Math.max(size / img.width, size / img.height)
      const scaledWidth = img.width * scale
      const scaledHeight = img.height * scale
      const x = (size - scaledWidth) / 2
      const y = (size - scaledHeight) / 2
      
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight)
      ctx.restore()
      
      // 设置Canvas点击事件
      setupCanvasClickEvents()
      
      // 显示名字输入框和操作按钮
      nameInputSection.style.display = 'block'
      gameActions.style.display = 'block'
      modifySection.style.display = 'block'
      
      console.log('图片加载完成')
    }
    
    img.onerror = () => {
      hideUploadProgress()
      showUploadError('图片加载失败')
    }
    
    img.src = URL.createObjectURL(file)
    
  } catch (error) {
    console.error('文件处理失败:', error)
    hideUploadProgress()
    showUploadError('文件处理失败')
  }
}

// 触发图片变形
function triggerImageTransform(phase: 'phase1' | 'phase2') {
  showLoading()
  
  // 这里将在后续任务中实现API调用
  console.log(`触发${phase}阶段图片变形`)
  
  // 临时模拟变形完成
  setTimeout(() => {
    hideLoading()
    console.log(`${phase}阶段变形完成`)
  }, 2000)
}

// 重置游戏
function resetGame() {
  console.log('重置游戏')
  
  // 重置游戏状态
  clickCount = 0
  gameState = 'initial'
  gameStartTime = 0
  isTransformed = false
  currentImage = null
  
  // 重置UI状态
  gameArea.style.display = 'none'
  uploadArea.style.display = 'flex'
  resetUploadArea()
  
  // 隐藏操作按钮和修改按钮
  gameActions.style.display = 'none'
  modifySection.style.display = 'none'
  
  // 隐藏名字输入框和漂浮名字
  nameInputSection.style.display = 'none'
  floatingName.style.display = 'none'
  
  // 隐藏变身通知
  transformNotification.style.display = 'none'
  
  // 重置状态文本
  statusText.textContent = '等待上传照片'
  
  // 重置计数器显示
  updateClickCount(0)
  
  // 清空文件输入和名字输入
  fileInput.value = ''
  nameInput.value = ''
  
  // 清空Canvas
  const ctx = gameCanvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height)
  }
  
  console.log('游戏重置完成')
}

// 更新点击计数
function updateClickCount(count: number) {
  clickCountElement.textContent = count.toString()
  
  // 更新状态文本
  if (count === 0) {
    statusText.textContent = '开始点击图片发泄情绪吧！'
  } else if (count < 10) {
    statusText.textContent = `再点击 ${10 - count} 次可以变身！`
  } else if (count === 10 && !isTransformed) {
    statusText.textContent = '可以变身了！点击变身按钮！'
  } else if (isTransformed) {
    statusText.textContent = '已变身为可爱宠物！继续点击吧！'
  } else {
    statusText.textContent = `已点击 ${count} 次！`
  }
}

// 音量控制
let isMuted = false

function toggleMute() {
  isMuted = !isMuted
  volumeBtn.textContent = isMuted ? '🔇' : '🔊'
  console.log('音量状态:', isMuted ? '静音' : '开启')
}

function updateVolume() {
  const volume = parseInt(volumeSlider.value)
  volumeValue.textContent = volume.toString()
  console.log('音量设置为:', volume)
}

// 显示加载状态
function showLoading() {
  loadingOverlay.style.display = 'flex'
}

function hideLoading() {
  loadingOverlay.style.display = 'none'
}

// 显示上传进度
function showUploadProgress() {
  // 在上传区域显示进度指示
  const uploadContent = uploadArea.querySelector('.upload-content')
  if (uploadContent) {
    uploadContent.innerHTML = `
      <div class="upload-icon">📤</div>
      <p>正在处理图片...</p>
      <div class="upload-progress">
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
      </div>
    `
  }
  
  // 添加加载动画样式
  uploadArea.classList.add('uploading')
}

// 隐藏上传进度
function hideUploadProgress() {
  uploadArea.classList.remove('uploading')
}

// 显示上传错误
function showUploadError(message: string) {
  const uploadContent = uploadArea.querySelector('.upload-content')
  if (uploadContent) {
    uploadContent.innerHTML = `
      <div class="upload-icon error">❌</div>
      <p class="error-message">${message}</p>
      <p class="upload-hint">请重新选择图片</p>
    `
  }
  
  // 添加错误样式
  uploadArea.classList.add('error')
  
  // 3秒后恢复原始状态
  setTimeout(() => {
    resetUploadArea()
  }, 3000)
}

// 重置上传区域
function resetUploadArea() {
  uploadArea.classList.remove('uploading', 'error')
  
  const uploadContent = uploadArea.querySelector('.upload-content')
  if (uploadContent) {
    uploadContent.innerHTML = `
      <div class="upload-icon">📷</div>
      <p>点击或拖拽上传照片</p>
      <p class="upload-hint">支持 JPG、PNG、WEBP 格式，最大 5MB</p>
    `
  }
}

// 触发变身效果
function triggerTransformation() {
  isTransformed = true
  
  // 显示变身通知
  transformNotification.style.display = 'block'
  
  // 更新状态文本
  statusText.textContent = '已变身为可爱宠物！'
  
  // 显示操作按钮
  gameActions.style.display = 'block'
  modifySection.style.display = 'block'
  
  // 3秒后隐藏通知
  setTimeout(() => {
    transformNotification.style.display = 'none'
  }, 3000)
  
  console.log('角色变身成功！')
}

// 手动变身（通过按钮触发）
function manualTransform() {
  if (!isTransformed && clickCount >= 10) {
    triggerTransformation()
  } else if (!isTransformed) {
    const remaining = 10 - clickCount
    alert(`还需要点击 ${remaining} 次才能变身！\n当前点击数: ${clickCount}/10`)
  } else {
    alert('已经变身为可爱宠物了！')
  }
  
  console.log('手动变身尝试 - 点击数:', clickCount, '变身状态:', isTransformed)
}

// 添加点击特效
function addClickEffect(x: number, y: number) {
  const ctx = gameCanvas.getContext('2d')
  if (!ctx) return
  
  // 创建简单的点击特效
  const effect = document.createElement('div')
  effect.style.position = 'absolute'
  effect.style.left = `${x}px`
  effect.style.top = `${y}px`
  effect.style.width = '20px'
  effect.style.height = '20px'
  effect.style.background = 'rgba(102, 126, 234, 0.8)'
  effect.style.borderRadius = '50%'
  effect.style.pointerEvents = 'none'
  effect.style.animation = 'clickEffect 0.5s ease-out forwards'
  effect.style.zIndex = '10'
  
  gameArea.appendChild(effect)
  
  // 0.5秒后移除特效
  setTimeout(() => {
    if (effect.parentNode) {
      effect.parentNode.removeChild(effect)
    }
  }, 500)
}

// 显示分享弹窗
function showShareModal() {
  // 计算游戏时长
  const gameTime = gameStartTime > 0 ? Date.now() - gameStartTime : 0
  const minutes = Math.floor(gameTime / 60000)
  const seconds = Math.floor((gameTime % 60000) / 1000)
  
  // 获取输入的名字
  const playerName = nameInput.value.trim() || '匿名玩家'
  
  // 更新分享数据
  shareClickCount.textContent = clickCount.toString()
  shareGameTime.textContent = `${minutes}分${seconds}秒`
  shareTransformStatus.textContent = isTransformed ? '已变身为可爱宠物' : '未变身'
  
  // 显示弹窗
  shareModal.style.display = 'flex'
  
  console.log('显示分享弹窗 - 玩家:', playerName, '点击数:', clickCount, '变身状态:', isTransformed)
}

// 隐藏分享弹窗
function hideShareModal() {
  shareModal.style.display = 'none'
}

// 微信分享处理
function shareToWechatHandler() {
  const playerName = nameInput.value.trim() || '匿名玩家'
  const gameTime = gameStartTime > 0 ? Date.now() - gameStartTime : 0
  const minutes = Math.floor(gameTime / 60000)
  const seconds = Math.floor((gameTime % 60000) / 1000)
  
  const shareText = `${playerName}在情绪发泄小游戏中的战绩：\n` +
    `🎯 点击次数: ${clickCount}次\n` +
    `⏱️ 游戏时长: ${minutes}分${seconds}秒\n` +
    `🐾 变身状态: ${isTransformed ? '已变身为可爱宠物' : '未变身'}\n` +
    `快来挑战我的记录吧！`
  
  // 检查是否在微信环境
  if (navigator.userAgent.toLowerCase().includes('micromessenger')) {
    // 在微信中，可以调用微信分享API
    alert('请点击右上角分享按钮分享到朋友圈或好友')
  } else {
    // 复制分享文本到剪贴板
    copyToClipboard(shareText)
    alert('分享文本已复制到剪贴板！')
  }
  
  console.log('微信分享:', shareText)
}

// 微博分享处理
function shareToWeiboHandler() {
  const playerName = nameInput.value.trim() || '匿名玩家'
  const gameTime = gameStartTime > 0 ? Date.now() - gameStartTime : 0
  const minutes = Math.floor(gameTime / 60000)
  const seconds = Math.floor((gameTime % 60000) / 1000)
  
  const shareText = `${playerName}在#情绪发泄小游戏#中的战绩：点击${clickCount}次，游戏${minutes}分${seconds}秒，${isTransformed ? '成功变身为可爱宠物' : '未变身'}！快来挑战我的记录吧！`
  const shareUrl = window.location.href
  const weiboUrl = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`
  
  window.open(weiboUrl, '_blank')
  
  console.log('微博分享:', shareText)
}

// 复制分享链接
function copyShareLinkHandler() {
  const playerName = nameInput.value.trim() || '匿名玩家'
  const gameTime = gameStartTime > 0 ? Date.now() - gameStartTime : 0
  const minutes = Math.floor(gameTime / 60000)
  const seconds = Math.floor((gameTime % 60000) / 1000)
  
  const shareText = `${playerName}在情绪发泄小游戏中的战绩：\n` +
    `🎯 点击次数: ${clickCount}次\n` +
    `⏱️ 游戏时长: ${minutes}分${seconds}秒\n` +
    `🐾 变身状态: ${isTransformed ? '已变身为可爱宠物' : '未变身'}\n` +
    `快来挑战我的记录吧！\n` +
    `游戏链接: ${window.location.href}`
  
  copyToClipboard(shareText)
  alert('分享内容已复制到剪贴板！')
  
  console.log('复制分享链接:', shareText)
}

// 复制到剪贴板工具函数
function copyToClipboard(text: string) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(err => {
      console.error('复制失败:', err)
      fallbackCopyTextToClipboard(text)
    })
  } else {
    fallbackCopyTextToClipboard(text)
  }
}

// 备用复制方法
function fallbackCopyTextToClipboard(text: string) {
  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.left = '-999999px'
  textArea.style.top = '-999999px'
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  
  try {
    document.execCommand('copy')
  } catch (err) {
    console.error('备用复制方法失败:', err)
  }
  
  document.body.removeChild(textArea)
}

// 处理名字输入
function handleNameInput() {
  const name = nameInput.value.trim()
  
  if (name) {
    // 显示漂浮名字
    floatingName.textContent = name
    floatingName.style.display = 'block'
    console.log('显示名字:', name)
  } else {
    // 隐藏漂浮名字
    floatingName.style.display = 'none'
    console.log('隐藏名字')
  }
}

// 应用初始化
function initializeApp() {
  console.log('初始化应用...')
  
  // 初始化游戏核心组件
  initializeGameCore()
  
  // 初始化事件监听器
  initializeEventListeners()
  
  // 设置初始状态
  updateClickCount(0)
  hideLoading()
  
  console.log('应用初始化完成!')
}

// 启动应用
document.addEventListener('DOMContentLoaded', initializeApp)