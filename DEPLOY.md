# 部署指南 · 霓虹疾跑 / Neon Dash

本项目是**纯静态网页**（HTML + CSS + 原生 ES Modules，零构建、无后端），所有路径均为相对路径，可直接部署到任意静态托管。存档用 localStorage，按域名独立保存。

---

## 方式一：GitHub Pages（推荐，白嫖 + 展示代码）

> 前提：本机已安装 git，并有 GitHub 账号。建议把 `neon-runner` 作为**独立仓库**发布，链接最干净。

### 步骤

1. 在 GitHub 新建一个空仓库，例如 `neon-dash`（Public）。

2. 在 `neon-runner` 目录下执行（把 URL 换成你自己的仓库地址）：
   ```bash
   cd neon-runner
   git init
   git add .
   git commit -m "feat: 霓虹疾跑双轨跑酷 首个可玩版本"
   git branch -M main
   git remote add origin https://github.com/你的用户名/neon-dash.git
   git push -u origin main
   ```

3. 打开仓库 → **Settings → Pages**：
   - **Source** 选 `Deploy from a branch`
   - **Branch** 选 `main`、目录选 `/ (root)`，保存

4. 等 1–2 分钟，访问：
   ```
   https://你的用户名.github.io/neon-dash/
   ```
   手机浏览器打开同一网址即可游玩（建议横屏）。

> 说明：仓库根目录已放 `.nojekyll`，避免 GitHub Pages 用 Jekyll 处理资源。

---

## 方式二：itch.io（推荐，做作品集 / 给别人玩）

### 步骤

1. 使用已生成的压缩包：`neon-runner-itch.zip`
   （里面 `index.html` 位于压缩包根目录，符合 itch 要求）

2. 登录 itch.io → **Dashboard → Create new project**。

3. 关键设置：
   - **Kind of project**：选 `HTML`
   - **Upload** 上传 `neon-runner-itch.zip`，勾选 **This file will be played in the browser**
   - **Embed options**：
     - Viewport 建议 `960 × 540`（16:9，等比放大自适应）
     - 勾选 `Mobile friendly` 与 `Fullscreen button`
   - Visibility 设为 Public（或 Draft 先自测）

4. 保存并 `View page`，得到可分享网址，手机/电脑打开即玩。

---

## 部署后自检清单

- [ ] 首页出现「霓虹疾跑」主菜单
- [ ] 电脑：↑↓ 切轨、Enter 确认；手机：点上/下半屏切轨、点按钮
- [ ] 商城可购买/装备，金币与皮肤刷新后仍在（localStorage 生效）
- [ ] 横屏显示占满、无溢出

## 更新已上线版本

- GitHub Pages：改完代码后 `git add . && git commit -m "..." && git push`，Pages 自动更新。
- itch.io：重新执行打包命令生成新 zip，在项目页 **Edit → 重新上传** 覆盖。

### 重新生成 itch 压缩包（PowerShell）

```powershell
Compress-Archive -Path "neon-runner\*" -DestinationPath "neon-runner-itch.zip" -Force
```
