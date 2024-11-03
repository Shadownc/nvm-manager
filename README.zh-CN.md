## 安装依赖碰到的问题
>  taobao 镜像迁移，证书过期引起的问题
1. `npm config list`查看配置 会有很多`npm.taobao.org`域名
2. 筛选`npm config ls -l | findstr "taobao"`
3. `Git Bash`执行`npm config ls -l | grep taobao | awk -F ' *= *' '{print $1}'`可以获取所有名称
4. 依次执行删除命令 如：`npm config delete electron-mirror`