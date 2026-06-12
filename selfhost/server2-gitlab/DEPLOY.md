# Server 2 — GitLab CE

Subdomen: `gitlab.adam.uz`. GitLab yakka → o'zi 80/443 + Let's Encrypt boshqaradi.

## 0. Talab
- 4 vCPU / **8 GB RAM** (kamida; 4GB swap qo'sh), 2+ vCPU
- DNS A: `gitlab.adam.uz` → shu server IP (Let's Encrypt'dan oldin tarqalsin)
- Port 80, 443 ochiq (LE uchun 80 majburiy), 2222 (git ssh)

## 1. Tizim ssh portini bo'shatish
GitLab konteyneri 2222→22 ishlatadi, lekin aniqlik uchun host sshd 22'da qolsin. Konflikt yo'q.

## 2. Ishga tushir
```bash
cd /Users/bro/hermes-adlc/selfhost/server2-gitlab
cp .env.example .env
nano .env                       # GITLAB_SMTP_PASSWORD (Mailcow'dagi gitlab@adam.uz paroli)
docker compose up -d
# Birinchi yuklash 3-5 daqiqa. Loglar:
docker compose logs -f gitlab   # "gitlab Reconfigured!" kutiladi
```

## 3. Root parol
```bash
docker exec -it gitlab grep 'Password:' /etc/gitlab/initial_root_password
# 24 soatdan keyin bu fayl o'chadi — darhol login qilib parolni o'zgartir.
```
`https://gitlab.adam.uz` → login `root` + yuqoridagi parol.

## 4. Firewall
```bash
sudo ufw allow 80,443/tcp
sudo ufw allow 2222/tcp        # git over ssh
sudo ufw allow OpenSSH
sudo ufw enable
```

## 5. git ssh klient sozlamasi
`~/.ssh/config` (developerlarda):
```
Host gitlab.adam.uz
  Port 2222
```
yoki clone: `git clone ssh://git@gitlab.adam.uz:2222/group/repo.git`

## 6. CI/CD runner (DevOps agent uchun)
```bash
# alohida runner host yoki shu serverda:
docker run -d --name gitlab-runner --restart always \
  -v /srv/gitlab-runner/config:/etc/gitlab-runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  gitlab/gitlab-runner:latest
# keyin: gitlab-runner register  (token = Admin > CI/CD > Runners)
```

## Update
```bash
cd /Users/bro/hermes-adlc/selfhost/server2-gitlab && docker compose pull && docker compose up -d
```
> Bir nechta major versiya sakrab o'tmang — GitLab upgrade path'ni hurmat qiling.
