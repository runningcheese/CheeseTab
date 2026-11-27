// Firefox 新标签页壁纸数据（对齐 mozilla-central newtab-wallpapers-v2 Remote Settings 集合）
// 图片走在线链接；打开分组时写入 IndexedDB 缓存；名称取自 zh-CN/en-US Fluent 本地化，缺失项为等义中文翻译
// 位图（avif ×38）经 i0.wp.com（WordPress Photon）代理加载——大陆直连 mozilla CDN 过慢；
// Photon 会把 avif 重编码为 jpeg（显示无差别）。SVG ×15 不被 Photon 支持（400）：
// 扩展内直连 mozilla CDN 并用 DNR 改写 UA 绕过 406 反盗链；
// 网页版改用 wsrv.nl 在线代理（会把 SVG 转成 PNG），不再打包本地同源副本。

// thumb：本地缩略图（240×135 JPEG，6 张共约 37KB）。分类磁贴直接铺本地图，
// 打开设置即时可见，不再等待在线壁纸；custom 用虚线占位 / 已上传图片、
// firefox 缩略图取官网 firefox-orange.svg（「橙色背景上的狐狸」）光栅化：该 SVG 的狐狸
// 主体本就偏右、只露眼睛与吻部，按壁纸 position:center right 做右侧聚焦后才可辨识。

import { locale } from "./i18n.js";
import { IS_EXTENSION } from "./platform.js";

export const WALLPAPER_CATEGORIES = [
  { id: "custom", name: "自定义图像" },
  { id: "solid-colors", name: "纯色" },
  { id: "firefox", name: "Firefox", thumb: "thumbs/firefox.jpg" },
  { id: "abstracts", name: "抽象", thumb: "thumbs/abstracts.jpg" },
  { id: "celestial", name: "天体", thumb: "thumbs/celestial.jpg" },
  { id: "photographs", name: "摄影", thumb: "thumbs/photographs.jpg" },
  // 「Bing」与「随机」都不进二级列表：点击直接应用
  // Bing 跟随当日图自动更换；随机从随机图池抽取（random-1…5 作离线兜底）
  { id: "bing", name: "Bing", thumb: "thumbs/bing.jpg" },
  { id: "random", name: "随机", thumb: "thumbs/random.jpg" },
];

// { id, category, name, theme: "light"|"dark", file?（图片壁纸）, solid?（纯色值）, position }
export const WALLPAPERS = [
  // -------------------- 天体分组 --------------------
  { id: "celestial-river", category: "celestial", name: "河流卫星图", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/671df231-8415-4066-8144-0ddb31394a19.avif", position: "center" },
  { id: "celestial-earth-night", category: "celestial", name: "近地轨道地球夜景", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/fa93a1e0-fec5-4351-adc2-5692e5b2bf32.avif", position: "center" },
  { id: "celestial-lunar-eclipse", category: "celestial", name: "月食", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/7fd1f326-58cf-4b5c-9737-e68a8c44dc51.avif", position: "center" },
  { id: "celestial-starry-sky", category: "celestial", name: "星空", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/43793431-0f4a-473b-b346-7c30df84af10.avif", position: "center" },
  { id: "celestial-eclipse-time-lapse", category: "celestial", name: "月食延时", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/55b678ff-15c3-49d5-bdbc-40f8413cfb8a.avif", position: "center" },
  { id: "celestial-black-hole", category: "celestial", name: "黑洞星系插画", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/9fa5c4e0-5f22-419e-b2eb-a3494520f5f2.avif", position: "center" },
  { id: "dark-fox-anniversary", category: "photographs", name: "森林旁人行道上的狐狸", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/d8b71c77-9985-41d2-b98e-51bebc60e595.avif", position: "top left" },
  { id: "light-fox-anniversary", category: "photographs", name: "草原雾山间的狐狸", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/a5a041de-9275-4eb5-8f21-a0171c82d388.avif", position: "center left" },
  { id: "dark-aurora", category: "photographs", name: "极光", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/10e23599-85bc-4660-ae06-7a67befbbcf9.avif", position: "center right" },
  { id: "dark-panda", category: "photographs", name: "躲在森林里的小熊猫", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/6b8eb3cf-f232-4c7b-a179-afd174555134.avif", position: "center left" },
  { id: "light-red-panda", category: "photographs", name: "小熊猫", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/dfd3762e-f77d-4b6e-ac75-32eb2549ef40.avif", position: "center left" },
  { id: "hot-air-balloons", category: "photographs", name: "白天的彩色热气球", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/ade94d3a-9a02-4b30-848f-638725a05180.avif", position: "bottom center" },
  { id: "abstract-blue-purple-dark", category: "abstracts", name: "蓝紫渐变", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/036ac885-33cb-41db-bcbb-52dd49254a12.avif", position: "center" },
  { id: "blue-flowers", category: "photographs", name: "蓝色花朵特写", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/f5c362af-16df-488d-a8b2-bf8cf29d1c63.avif", position: "center" },
  { id: "palm-trees", category: "photographs", name: "金色时刻的椰树剪影", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/32c50b87-9f4b-46cf-a467-f4aa768a1687.avif", position: "center" },
  { id: "sand-dunes", category: "photographs", name: "白色沙丘", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/7dcbd2c8-8982-4108-b044-fae72b46e97f.avif", position: "center" },
  { id: "starry-canyon", category: "photographs", name: "蓝色星夜", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/7d98c7ab-274a-411d-95e4-84afd4e6203c.avif", position: "center" },
  { id: "suspension-bridge", category: "photographs", name: "灰色悬索桥", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/c1130d05-bb6b-448d-bc66-96df1eb088bb.avif", position: "center" },
  { id: "abstract-black-waves", category: "abstracts", name: "黑色波浪形状", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/18c7861f-0c9d-48d4-a98c-fb8999e331bd.avif", position: "center" },
  { id: "abstract-white-curves", category: "abstracts", name: "白色阴影曲线", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/ea29bb39-223f-4c49-9362-b7caf75313af.avif", position: "center" },
  { id: "abstract-purple-green", category: "abstracts", name: "紫绿光渐变", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/31dd47f1-a979-42a0-8351-33c2bb0b35cf.avif", position: "center" },
  { id: "light-color", category: "abstracts", name: "蓝色、粉色和黄色的形状", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/a205885e-194a-41f9-ae47-e7da66a74041.avif", position: "center" },
  { id: "dark-color", category: "abstracts", name: "红色和蓝色的形状", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/d357925c-b9cd-417e-8731-14272f28f556.avif", position: "center" },
  { id: "light-sky", category: "photographs", name: "漂浮着粉紫色云的天空", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/45ecab20-ffb9-47b4-94ff-07a5f8b9f53f.avif", position: "center" },
  { id: "abstract-green", category: "abstracts", name: "绿色形状", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/13495d0e-f975-4218-b5f0-c841c69ce2e5.avif", position: "center" },
  { id: "gradient-orange", category: "abstracts", name: "橙粉渐变", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/bd424c86-6366-4f2b-b8dc-74d21439c1fb.avif", position: "center" },
  { id: "abstract-purple", category: "abstracts", name: "紫色形状", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/6bf5c4ac-f55b-4de3-bbf5-1b0f2f56d488.avif", position: "center" },
  { id: "abstract-orange", category: "abstracts", name: "橙色形状", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/32531fc6-1ea3-46de-a93c-f8a0c2f01916.avif", position: "center" },
  { id: "abstract-blue-purple-light", category: "abstracts", name: "蓝紫渐变", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/becfadf4-4c2d-4fad-bbbc-b060d12277e5.avif", position: "center" },
  { id: "abstract-blue", category: "abstracts", name: "蓝色形状", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/e1108381-5c19-4cb4-a630-69f9e45503fb.avif", position: "center" },
  { id: "dark-city", category: "photographs", name: "紫色城市景观", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/966b18ad-3733-41c4-92f6-c89cdf1381d0.avif", position: "center" },
  { id: "dark-mountain", category: "photographs", name: "山地景观", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/af6073d2-cbb2-4e28-b642-3327d14808b2.avif", position: "center" },
  { id: "dark-sky", category: "photographs", name: "夜空下的城市景观", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/e94b1e49-c518-40d6-98e3-dffab6cc370d.avif", position: "center" },
  { id: "light-beach", category: "photographs", name: "生长着棕榈树的海滩", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/56a7f3ae-70cc-45f2-82ec-1d39acdd3b8d.avif", position: "center" },
  { id: "light-landscape", category: "photographs", name: "淡蓝薄雾笼罩下的山地景观", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/d9289c5b-8c78-4b27-b5d8-afe7285ce7d1.avif", position: "center" },
  { id: "light-mountain", category: "photographs", name: "白山山脉", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/5344443f-f427-4029-bc6b-68bc22f83355.avif", position: "center" },
  { id: "firefox-orange", category: "firefox", name: "橙色背景上的狐狸", theme: "light", url: "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/20260819200624--c01058f4-5b6c-4ac4-9708-54d5bee8f450--91a8634f-15b5-4b17-836b-de3225cb3b17.svg", position: "center right" },
  { id: "firefox-colorful-sky", category: "firefox", name: "紫夜空中的橙色云浪", theme: "light", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/0fdf6f5d-8b70-473e-a0cd-50b4dbf87a4b.avif", position: "center right" },
  { id: "firefox-desert-dark", category: "firefox", name: "深紫沙漠中的狐狸", theme: "dark", url: "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/20260819185205--36d49fb5-9fd4-4fa9-9504-2dd0b137d285--a6db06ef-39b8-4133-a41a-e198fbd6ae97.svg", position: "center left" },
  { id: "firefox-desert-light", category: "firefox", name: "浅色沙漠中奔跑的狐狸", theme: "light", url: "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/20260819185224--dd9512ea-ea90-4d7b-9571-ab8fa3d52d51--c4c169fa-8c84-4cf3-87b5-46dad7dd43b7.svg", position: "center left" },
  { id: "firefox-hills-dark", category: "firefox", name: "深色山丘上的狐狸", theme: "dark", url: "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/e08c3e8c-4bda-48e4-8f36-a1d203f46536.svg", position: "top right" },
  { id: "firefox-hills-light", category: "firefox", name: "浅色山丘上的狐狸", theme: "light", url: "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/ddf2cbca-daef-4702-808b-131891b326dd.svg", position: "top right" },
  { id: "firefox-tail-dark", category: "firefox", name: "深色背景上的狐狸尾巴", theme: "dark", url: "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/6f7e2155-df50-4917-81fd-9c6f16e14965.svg", position: "center right" },
  { id: "firefox-tail-light", category: "firefox", name: "浅色背景上的狐狸尾巴", theme: "light", url: "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/b283ca51-354c-476f-9ee8-82f5a9ced0e2.svg", position: "center right" },
  { id: "firefox-side-kit-dark", category: "firefox", name: "深色背景左侧的狐狸", theme: "dark", url: "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/20260819201311--8611e834-7285-4b7b-8d56-06eab6a0a227--28518a88-2c98-44b7-ad17-00c6cb774914.svg", position: "top left" },
  { id: "firefox-side-kit-light", category: "firefox", name: "浅色背景左侧的狐狸", theme: "light", url: "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/20260819200245--429c288c-8d92-4baa-aefb-a04719882454--cd2122fe-b227-4003-8e18-3cd2cc1c6204.svg", position: "top left" },
  { id: "firefox-sitting-hill-dark", category: "firefox", name: "深紫山丘上端坐的狐狸", theme: "dark", url: "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/20260819204733--1a0b388c-db2c-4f86-b953-0e5302573258--ce4d91e8-abc7-4f63-963f-83385d6cd86a.svg", position: "top right" },
  { id: "firefox-sitting-hill-light", category: "firefox", name: "浅色山丘上端坐的狐狸", theme: "light", url: "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/20260819201015--62aa72d9-b9f3-4f29-88f5-5120ee004e7c--4d48db83-de9c-44dd-bf12-20aa9152f6a5.svg", position: "top right" },
  { id: "firefox-peak-dark", category: "firefox", name: "深色背景边缘的狐狸面孔", theme: "dark", url: "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/20260819185340--94e8a3ce-1faf-4aa1-a52e-7e15c07ff627--d00502f9-f163-432d-bdb6-d54e7c36da10.svg", position: "top left" },
  { id: "firefox-peak-light", category: "firefox", name: "浅色背景边缘的狐狸面孔", theme: "light", url: "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/20260819185317--2b1b54e2-19e7-4846-9d5b-ebbede82747b--aa4df1eb-b009-467f-b17b-0b73194286c7.svg", position: "top left" },
  { id: "firefox-sky-dark", category: "firefox", name: "夜空下的深紫山丘", theme: "dark", url: "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/0b039df1-971b-445a-84f6-6a15da08940e.svg", position: "bottom center" },
  { id: "firefox-sky-light", category: "firefox", name: "柔和天空下的浅色山丘", theme: "light", url: "https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/9b9d40c7-a3bf-4058-836a-2ce378e8daf5.svg", position: "bottom center" },
  { id: "firefox-wrexham", category: "firefox", name: "雷克斯汉姆队徽", theme: "dark", url: "https://i0.wp.com/firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/20260904203317--75b87498-000e-45fa-973b-299d19212ef9--15c05c49-ba17-47ba-a7ac-ca430d967d71.avif", position: "top right" },

  // -------------------- 纯色分组（Firefox Remote Settings newtab-wallpapers-v2） --------------------
  { id: "blue", category: "solid-colors", name: "蓝色", theme: "light", solid: "#76C1FF", position: "center" },
  { id: "light-blue", category: "solid-colors", name: "浅蓝色", theme: "light", solid: "#D4E7F6", position: "center" },
  { id: "light-purple", category: "solid-colors", name: "浅紫色", theme: "light", solid: "#D3A3F3", position: "center" },
  { id: "light-green", category: "solid-colors", name: "浅绿色", theme: "light", solid: "#DAE8E0", position: "center" },
  { id: "green", category: "solid-colors", name: "绿色", theme: "light", solid: "#A8DF8E", position: "center" },
  { id: "beige", category: "solid-colors", name: "米色", theme: "light", solid: "#EDD5B8", position: "center" },
  { id: "yellow", category: "solid-colors", name: "黄色", theme: "light", solid: "#FFF7B2", position: "center" },
  { id: "orange", category: "solid-colors", name: "橙色", theme: "light", solid: "#FEBE5E", position: "center" },
  { id: "pink", category: "solid-colors", name: "粉色", theme: "light", solid: "#FA87CC", position: "center" },
  { id: "light-pink", category: "solid-colors", name: "浅粉色", theme: "light", solid: "#F4DBE9", position: "center" },
  { id: "red", category: "solid-colors", name: "红色", theme: "light", solid: "#9D242D", position: "center" },
  { id: "dark-blue", category: "solid-colors", name: "深蓝色", theme: "dark", solid: "#031A3E", position: "center" },
  { id: "dark-purple", category: "solid-colors", name: "深紫色", theme: "dark", solid: "#450A54", position: "center" },
  { id: "dark-green", category: "solid-colors", name: "深绿色", theme: "dark", solid: "#19310D", position: "center" },
  { id: "brown", category: "solid-colors", name: "棕色", theme: "light", solid: "#401F00", position: "center" },

  // -------------------- 「随机」分组：内置兜底池（离线 / 首次 / 审核环境） --------------------
  // 5 张新浪图床 JPEG，统一经 i0.wp.com（Photon）代理以便大陆访问；响应带 CORS *，
  // 因此 cacheWallpaper() 的 fetch 可直接写 IndexedDB，无需新增 host_permission。
  // 平时由下方远程清单注册 runtime 条目参与抽取；这 5 条常驻，保证包内功能完整可辨识。
  { id: "random-1", category: "random", name: "随机壁纸 1", theme: "dark", url: "https://i0.wp.com/fc.sinaimg.cn/large/7a6a15d5gy1iiyitzhyu7j21hc0u0wlt.jpg", position: "center" },
  { id: "random-2", category: "random", name: "随机壁纸 2", theme: "dark", url: "https://i0.wp.com/fc.sinaimg.cn/large/7a6a15d5gy1iiyiu6rc7xj21hc0u0tii.jpg", position: "center" },
  { id: "random-3", category: "random", name: "随机壁纸 3", theme: "dark", url: "https://i0.wp.com/fc.sinaimg.cn/large/7a6a15d5gy1iiyiu74txgj22yo1o013m.jpg", position: "center" },
  { id: "random-4", category: "random", name: "随机壁纸 4", theme: "light", url: "https://i0.wp.com/fc.sinaimg.cn/large/7a6a15d5gy1iiyiu7gbiaj22801e0h0m.jpg", position: "center" },
  { id: "random-5", category: "random", name: "随机壁纸 5", theme: "light", url: "https://i0.wp.com/fc.sinaimg.cn/large/7a6a15d5gy1iiyiu89bswj20yb0lg75y.jpg", position: "center" },
];

// ------------------------- 线上部署：SVG 壁纸改用在线代理 -------------------------
// mozilla CDN 会按 User-Agent 反盗链：Chrome UA 直接请求 SVG 返回 406。
// 扩展内靠 rules.json 的 declarativeNetRequest 把 UA 改写成 Firefox 才可加载；
// 普通网页无法修改请求头，因此线上版本改用 wsrv.nl 在线代理（SVG 会转为 PNG）。
// 这样网页版不需要在站点里额外上传 wallpapers/ 目录。
const SVG_PROXY = (url) => `https://wsrv.nl/?url=${encodeURIComponent(url)}`;

if (!IS_EXTENSION) {
  for (const w of WALLPAPERS) {
    if (typeof w.url === "string" && /\.svg(?:\?|$)/i.test(w.url)) {
      w.url = SVG_PROXY(w.url);
    }
  }
}

/** 壁纸实际加载地址：网页版 SVG 已替换为在线代理，扩展内保持原 CDN 地址 */
export function wallpaperSrc(w) {
  return w?.url || "";
}

// ------------------------------- 英文名称（en locale） -------------------------------
// key 与上方 id 一一对应；缺失项回落中文名。分类名同理（对齐 Firefox WallpaperCategories 英文）。

const WALLPAPER_NAMES_EN = {
  // 纯色
  blue: "Blue",
  "light-blue": "Light blue",
  "light-purple": "Light purple",
  "light-green": "Light green",
  green: "Green",
  beige: "Beige",
  yellow: "Yellow",
  orange: "Orange",
  pink: "Pink",
  "light-pink": "Light pink",
  red: "Red",
  "dark-blue": "Dark blue",
  "dark-purple": "Dark purple",
  "dark-green": "Dark green",
  brown: "Brown",
  // 天体
  "celestial-earth-night": "Night photo from low Earth orbit",
  "celestial-lunar-eclipse": "Lunar eclipse",
  "celestial-starry-sky": "Starry sky",
  "celestial-eclipse-time-lapse": "Lunar eclipse time lapse",
  "celestial-black-hole": "Black hole galaxy illustration",
  "celestial-river": "Satellite image of river",
  // 摄影
  "dark-fox-anniversary": "A fox beside a forest path",
  "light-fox-anniversary": "A fox in misty grassland",
  "dark-aurora": "Aurora",
  "dark-panda": "A red panda hiding in the forest",
  "light-red-panda": "Red panda",
  "hot-air-balloons": "Colorful hot-air balloons by day",
  "blue-flowers": "Close-up of blue flowers",
  "palm-trees": "Palm trees at golden hour",
  "sand-dunes": "White sand dunes",
  "starry-canyon": "Blue starry night",
  "suspension-bridge": "Gray suspension bridge",
  // 天体
  // 抽象
  "abstract-blue-purple-dark": "Blue-purple gradient",
  "abstract-black-waves": "Black wave shapes",
  "abstract-white-curves": "White curved shadows",
  "abstract-purple-green": "Purple-green gradient",
  "light-color": "Blue, pink and yellow shapes",
  "dark-color": "Red and blue shapes",
  "light-sky": "Sky with pink and purple clouds",
  "abstract-green": "Green shapes",
  "gradient-orange": "Orange-pink gradient",
  "abstract-purple": "Purple shapes",
  "abstract-orange": "Orange shapes",
  "abstract-blue-purple-light": "Light blue-purple gradient",
  "abstract-blue": "Blue shapes",
  "dark-city": "Purple cityscape",
  "dark-mountain": "Mountain landscape",
  "dark-sky": "City skyline under a night sky",
  "light-beach": "A beach with palm trees",
  "light-landscape": "Mountains in pale blue mist",
  "light-mountain": "Snowy mountain range",
  // 纯色
  // Firefox
  "firefox-orange": "A fox on an orange background",
  "firefox-colorful-sky": "Orange cloud waves in a purple night sky",
  "firefox-desert-dark": "A fox in a dark purple desert",
  "firefox-desert-light": "A running fox in a light desert",
  "firefox-hills-dark": "A fox on dark hills",
  "firefox-hills-light": "A fox on light hills",
  "firefox-tail-dark": "A fox tail on a dark background",
  "firefox-tail-light": "A fox tail on a light background",
  "firefox-side-kit-dark": "A fox on the left of a dark background",
  "firefox-side-kit-light": "A fox on the left of a light background",
  "firefox-sitting-hill-dark": "A fox sitting on a dark purple hill",
  "firefox-sitting-hill-light": "A fox sitting on a light hill",
  "firefox-peak-dark": "A fox face on the edge of a dark background",
  "firefox-peak-light": "A fox face on the edge of a light background",
  "firefox-sky-dark": "Dark purple hills under a night sky",
  "firefox-sky-light": "Light hills under a soft sky",
  "firefox-wrexham": "Wrexham crest",
  // 「随机」分组
  "random-1": "Random wallpaper 1",
  "random-2": "Random wallpaper 2",
  "random-3": "Random wallpaper 3",
  "random-4": "Random wallpaper 4",
  "random-5": "Random wallpaper 5",
};

const CATEGORY_NAMES_EN = {
  custom: "Custom Images",
  firefox: "Firefox",
  abstracts: "Abstract",
  celestial: "Celestial",
  photographs: "Photographs",
  "solid-colors": "Solid Colors",
  bing: "Bing",
  random: "Random",
};

/** 分类显示名（按当前语言） */
export function categoryName(cat) {
  if (!cat) return "";
  return locale === "en" ? (CATEGORY_NAMES_EN[cat.id] ?? cat.name) : cat.name;
}

/** 壁纸显示名（按当前语言） */
export function wallpaperName(w) {
  if (!w) return "";
  return locale === "en" ? (WALLPAPER_NAMES_EN[w.id] ?? w.name) : w.name;
}

/* --------------------- 「随机」分组：远程可维护的图片清单 ---------------------
   Chrome Web Store MV3 允许扩展在运行时加载远程「数据」（配置文件 / 图片清单 / 图片），
   前提是远程内容不含任何逻辑、且不被 eval、不注入 <script>、不拼进 HTML。
   官方政策 developer.chrome.com/docs/webstore/program-policies/mv3-requirements：
   "Fetching remote resources that are not used to evaluate logic, such as images"。
   下面每行只当作 URL 字符串，经协议 + 字符白名单校验后，仅交给 <img> / CSS
   background 作为图片资源；全部控制逻辑都在本扩展包内。
   CDN 返回 access-control-allow-origin: *，因此无需新增 host_permissions。       */
// 多个镜像依次尝试：不同网络环境下 gcore / fastly / cdn / raw 的可用性不同
const RANDOM_LIST_URLS = [
  "https://gcore.jsdelivr.net/gh/runningcheese/Awesome-Bookmarklets/libs/wallpapers.txt",
  "https://fastly.jsdelivr.net/gh/runningcheese/Awesome-Bookmarklets/libs/wallpapers.txt",
  "https://cdn.jsdelivr.net/gh/runningcheese/Awesome-Bookmarklets/libs/wallpapers.txt",
  "https://raw.githubusercontent.com/runningcheese/Awesome-Bookmarklets/master/libs/wallpapers.txt",
];

const RANDOM_LS_KEY = "foxfox.random.list.v1";
const FETCH_TIMEOUT_MS = 4000;
const MAX_ENTRIES = 200;
const MAX_LINE = 2048;

/** 只接受 https 绝对 URL；注释、空行、危险协议、超长行一律丢弃。
 *  远程文本永远只被当作数据，绝不作为代码或 HTML 使用。 */
function parseRandomList(text) {
  const urls = [];
  const seen = new Set();
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.length > MAX_LINE) continue;
    // 引号 / 反斜杠 / 括号会破坏 CSS url("...") 拼接，直接拒绝
    if (/["'\\()]/.test(line)) continue;
    let u;
    try {
      u = new URL(line);
    } catch {
      continue;
    }
    if (u.protocol !== "https:" || !u.hostname) continue;
    if (seen.has(u.href)) continue;
    seen.add(u.href);
    urls.push(u.href);
    if (urls.length >= MAX_ENTRIES) break;
  }
  return urls;
}

/** 同一 URL 恒定得到同一 id，刷新后 store.js 的 wallpaperById() 仍能命中 */
function urlWallpaperId(url) {
  let hash = 2166136261; // FNV-1a
  for (let i = 0; i < url.length; i++) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return "rnd-" + (hash >>> 0).toString(36);
}

/** 注册进 WALLPAPERS：store.js 直接使用这个数组，wallpaperById 零改动 */
function registerRandomList(urls) {
  for (let i = WALLPAPERS.length - 1; i >= 0; i--) {
    if (WALLPAPERS[i].runtime) WALLPAPERS.splice(i, 1);
  }
  urls.forEach((url, i) => {
    WALLPAPERS.push({
      id: urlWallpaperId(url),
      category: "random",
      name: locale === "en" ? `Random wallpaper ${i + 1}` : `随机壁纸 ${i + 1}`,
      theme: "dark",
      url,
      position: "center",
      runtime: true, // 可被下一次远程清单替换；内置 random-1…5 常驻兜底
    });
  });
}

function readCachedList() {
  // 构建脚本 / 非浏览器环境没有 window，直接跳过（同时避免触碰 Node 的实验性 localStorage）
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(localStorage.getItem(RANDOM_LS_KEY) || "null");
    return Array.isArray(saved?.urls) ? parseRandomList(saved.urls.join("\n")) : [];
  } catch {
    return [];
  }
}

// 模块加载时同步恢复上次清单：保证刷新后 wallpaperById(rnd-*) 在 applyAppearance 之前就能命中
const bootList = readCachedList();
if (bootList.length) registerRandomList(bootList);

let listInflight = null;

/** 拉取最新清单；依次尝试多个镜像，全部失败时抛错交给调用方静默回退 */
function downloadRandomList() {
  if (listInflight) return listInflight;
  listInflight = (async () => {
    const bust = new Date().toISOString().slice(0, 13).replace(/[-T]/g, "");
    let lastError = null;

    for (const url of RANDOM_LIST_URLS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`${url}?v=${bust}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const urls = parseRandomList(await res.text());
        if (!urls.length) throw new Error("empty wallpaper list");
        try {
          localStorage.setItem(RANDOM_LS_KEY, JSON.stringify({ ts: Date.now(), urls }));
        } catch {
          /* 存储不可用仅影响下次启动 */
        }
        return urls;
      } catch (err) {
        lastError = err;
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError || new Error("wallpaper list unavailable");
  })().finally(() => {
    listInflight = null;
  });
  return listInflight;
}

/** 点击「随机」时调用：立即用现有清单抽一张，远程清单在后台静默刷新。
 *  这样点击不等待网络，也不会因为超时/中断在控制台输出错误。 */
export async function pickRandomWallpaper(excludeId) {
  const pick = randomWallpaper(excludeId);

  downloadRandomList()
    .then(registerRandomList)
    .catch(() => {
      /* 远程清单不可用：继续使用缓存清单或内置 random-1…5，不打扰用户 */
    });

  return pick;
}

/** 首次没有缓存时在后台预取一次，让第一次点击也能用上远程图池 */
export function prefetchRandomList() {
  if (typeof window === "undefined" || bootList.length) return;
  if (!navigator.onLine) return;
  downloadRandomList()
    .then(registerRandomList)
    .catch(() => {});
}

/** 图池抽一张；excludeId 传当前壁纸 id，避免连续两次点击抽中同一张。
 *  有运行时清单时只用它，否则回落到内置的 random-1…5（离线 / 首次 / 审核环境） */
function randomWallpaper(excludeId) {
  const all = WALLPAPERS.filter((w) => w.category === "random" && w.url);
  const pool = all.some((w) => w.runtime) ? all.filter((w) => w.runtime) : all;
  const candidates = pool.length > 1 ? pool.filter((w) => w.id !== excludeId) : pool;
  return candidates[Math.floor(Math.random() * candidates.length)] || null;
}
