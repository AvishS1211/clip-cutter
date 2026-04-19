FROM node:18-slim

RUN apt-get update && apt-get install -y \
  ffmpeg \
  python3 \
  python3-pip \
  curl \
  aria2 \
  && pip3 install -U yt-dlp --break-system-packages \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

RUN mkdir -p /tmp/clip-cutter-videos/exports

EXPOSE 3000

CMD ["npm", "start"]
