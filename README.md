# 通信协议课堂 · Protocol Academy

嵌入式四大串行通信协议（UART / I2C / SPI / CAN）的交互式教学网站合集。
纯静态 HTML，零依赖，可直接部署到 **GitHub Pages** 或任意静态服务器。

## 📚 站点地图

| 站点 | 说明 | 目录 |
|---|---|---|
| 🏠 **通信协议课堂（主站）** | 四大协议总览 + 交互式动画 + 26 道自测题 | `comm-protocol-academy/` |
| 🔬 **ProtocolLab 交互实验台** | 可配置波形生成器 + CAN 位时序计算器 + 故障诊断模拟器 | `protocol-lab/` |
| 📇 **面试速查手册** | 协议对比卡 + 必背数字 + 30 道高频面试题 + 选型决策树 | `interview-cheatsheet/` |
| 🔵 **UART Academy** | UART 深度专题（融合 20 篇论文） | `uart-academy/` |
| 🟢 **I2C Academy**（重点） | I2C 深度专题（融合 19 篇论文） | `i2c-academy/` |
| 🟠 **SPI Academy** | SPI 深度专题（融合 21 篇论文） | `spi-academy/` |
| 🔴 **CAN Academy**（重点） | CAN 深度专题（融合 20 篇论文） | `can-academy/` |

> 专题学院合计融合 **80+ 篇论文/规范**的研究成果（含真实数据与公式），文末均附可点击的参考文献清单。

## 🚀 本地预览

无需安装任何依赖，直接打开各站点的 `index.html` 即可；或任选一种方式启动本地服务器：

```powershell
# 方式一：Python
python -m http.server 8321

# 方式二：Node
npx serve -l 8321
```

然后访问 `http://localhost:8321/comm-protocol-academy/`（站点间使用相对路径互相链接，任意部署方式均可正常跳转）。

## 📦 部署到 GitHub Pages

1. 在 GitHub 新建仓库（Public），如 `protocol-academy`
2. 本地执行：
   ```bash
   git init -b main
   git add .
   git commit -m "init: 通信协议教学网站合集"
   git remote add origin https://github.com/<你的用户名>/protocol-academy.git
   git push -u origin main
   ```
3. 仓库 **Settings → Pages** → Source 选 `Deploy from a branch` → 分支 `main` + 目录 `/ (root)` → Save
4. 访问：`https://<你的用户名>.github.io/protocol-academy/comm-protocol-academy/`

## ✨ 特性

- 四大协议全谱系教学：物理层 → 时序 → 帧结构 → 工程实践 → 前沿论文
- 交互式动画：I2C 读写时序播放、CAN 逐位仲裁动画、SPI 模式切换
- 自测系统：主站 26 题 + 四个专题站各 10 题，带解析
- 移动端适配 + 可打印样式

© 2026 · 仅用于教学与学习参考
