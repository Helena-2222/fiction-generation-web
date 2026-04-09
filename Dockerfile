# 使用官方 Python 3.9 镜像作为基础镜像
FROM python:3.9

# 设置工作目录为 /app
WORKDIR /app

# 将本地代码复制到 Docker 容器的 /app 目录
COPY . /app

# 安装项目依赖
RUN pip install -r requirements.txt

# 启动 FastAPI 应用
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]