FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8080 ENVIRONMENT=production
WORKDIR /workspace
COPY requirements.txt /workspace/requirements.txt
RUN pip install --no-cache-dir -r /workspace/requirements.txt && useradd --system --uid 10001 --home /workspace workforce
COPY app/ /workspace/app/
COPY public/ /workspace/public/
RUN chown -R 10001:10001 /workspace
USER 10001
EXPOSE 8080
CMD ["sh","-c","exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1 --proxy-headers"]
