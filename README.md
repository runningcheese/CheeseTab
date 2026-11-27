# CheeseTab

一个复刻 **Firefox 新标签页**体验的浏览器新标签页。



多行快捷方式、右侧滑出设置抽屉、风格壁纸分类，并叠加 RunningCheese 视觉细节。



![i36_CheeseTab](https://i0.wp.com/fc.sinaimg.cn/large/7a6a15d5gy1ijgiqlvazpj22hc1egkcs.jpg)



## 功能

### 快捷方式

- 内置 25 个默认站点，可添加、编辑、固定、取消固定、移除、拖拽排序

- 快捷方式行数 `0–5`、列数 `5–10` 可调；`0` 行会隐藏整块快捷方式

- 点击磁贴打开网址；`Cmd/Ctrl + 点击`在新标签页打开

- 右键磁贴直接编辑；磁贴右上角菜单提供固定、编辑、移除等操作

- 添加时如果名称为空，会自动取域名作为名称。

  

### 图标来源



快捷方式编辑弹窗提供三种图标来源：

```text
Favicon / Simple Icons / 自定义
```

- **Favicon**：默认模式。白色/透明背景的 favicon 会自动改用 Simple Icons；带完整彩色底板的图标继续使用 favicon

- **Simple Icons**：使用 [Simple Icons](https://simpleicons.org/) 品牌 SVG，下载后缓存为本地 data URL，后续打开不再重复请求。

- **自定义**：支持本地图片和在线图片链接

- 网站取不到 favicon、最终显示标题首字母头像时，保持 Favicon 模式；

- 快捷方式图标统一使用 Apple 风格连续圆角（squircle）；

  

### 壁纸

设置抽屉中的壁纸分类：

```text
自定义图像 / 纯色 / Firefox / 抽象 / 天体 / 摄影 / Bing / 随机
```

- **自定义图像**：可保存多张本地图片，像文件夹一样管理、切换和删除
- **纯色**：15 个 Firefox 纯色，按实际亮度自动选择黑字/白字
- **Firefox / 抽象 / 天体 / 摄影**：Firefox 壁纸分类
- **Bing**：每日 Bing 壁纸，支持 IndexedDB 离线缓存
- **随机**：从在线图片清单随机抽取，内置离线图片兜底
- 支持模糊、变暗；图片壁纸会采样亮度并自动调整文字对比度

### 设置与数据

- 中文 / 英文自动跟随浏览器语言
- 设置导入、导出
- “清除图标”：可一次清除全部快捷方式，或选择“删除固定图标以外图标”
- “恢复默认”：清空快捷方式、壁纸和自定义图片，恢复出厂设置
- 抽屉底部显示版本号与 GitHub 开源链接

### 隐私

- 无账号、无后端、无遥测
- 扩展数据保存在 `chrome.storage.local`；网页版使用 `localStorage` 与 IndexedDB
- 自定义壁纸、图标缓存等二进制数据保存在 IndexedDB
- 远程请求仅用于壁纸、favicon、Simple Icons、Bing 与随机图片清单

## 安装



Chrome：

[https://chromewebstore.google.com/detail/gemdefihekfijbamijdjnkpokapmgfme](https://chromewebstore.google.com/detail/gemdefihekfijbamijdjnkpokapmgfme)



镜像下载：

[https://www.crxsoso.com/webstore/detail/gemdefihekfijbamijdjnkpokapmgfme](https://www.crxsoso.com/webstore/detail/gemdefihekfijbamijdjnkpokapmgfme)



Firefox：

[https://addons.mozilla.org/zh-CN/firefox/addon/cheese-tab](https://addons.mozilla.org/zh-CN/firefox/addon/cheese-tab)





### 目录结构

```text
index.html              页面入口（扩展新标签页 / 网页版共用）
css/                    页面、主题、图标与壁纸样式
js/                     ES Module 源码
  app.js                入口装配
  shortcuts.js          快捷方式、图标来源、拖拽、菜单
  settings.js           设置抽屉、壁纸选择、数据操作
  favicon.js            favicon / Simple Icons 解析与缓存
  wallpapers.js         壁纸、分类、纯色、Bing、随机
  store.js              设置读写、IndexedDB 缓存
  i18n.js               中英文文案
icons/                  本地快捷方式图标与扩展图标
thumbs/                 壁纸分类缩略图
_locales/               扩展商店多语言描述
tools/build-web.mjs     静态网站构建脚本
site/                   静态网站构建产物
dist/                   Chrome / Firefox / Web 打包文件
```

### 图标来源说明



- 本地图标命中时优先使用 `icons/` 中的资源
- 其余 favicon 依次尝试国内可达的图标服务，并在扩展内使用浏览器 favicon 缓存兜底
- Simple Icons 请求 `https://cdn.simpleicons.org/{slug}`
- 自动判断只检查 favicon 四个角的外侧区域，避免把 logo 的彩色边缘误判为背景
- 自动判断结果缓存 7 天；Simple Icons 缓存 30 天
- 

### 浏览器支持

- 扩展：Chrome / Edge 111+；Firefox 121+
- 网页版：现代 Chrome / Edge / Firefox / Safari
- 使用 `light-dark()`、`color-mix()`、`mask-image` 等现代 CSS 能力



## 版本



- 当前版本：**1.5**
- 项目仓库：<https://github.com/runningcheese/CheeseTab>
- Simple Icons：<https://simpleicons.org/>
- Firefox 新标签页壁纸来源：Mozilla Remote Settings
