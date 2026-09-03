# DNS yozuvlari — adam.uz

> `S1_IP`, `S2_IP`, `S3_IP` placeholderlarini real IP bilan almashtiring. Mail cutoverdan kamida bir eski-TTL davri oldin tegishli TTL'larni 300 soniyaga tushiring. Stalwart yaratgan DNS zone qiymatlari mail security yozuvlari uchun yakuniy manba.

## A records

| Type | Host | Value | Izoh |
|------|------|-------|------|
| A | `plane` | `S1_IP` | Plane |
| A | `docs` | `S1_IP` | Docmost |
| A | `gitlab` | `S2_IP` | GitLab |
| A | `mail` | `S3_IP` | Stalwart JMAP/admin + mail hostname |
| A | `webmail` | `S3_IP` | Bulwark web client |

Pilot paytida `mail`/MX'ni eski serverda qoldirib, yangi Stalwart uchun vaqtinchalik hostname/IP ishlating. Quyidagi production yozuvlarini faqat tasdiqlangan cutoverda almashtiring.

## Mail — MX

| Type | Host | Value | Priority |
|------|------|-------|----------|
| MX | `@` (`adam.uz`) | `mail.adam.uz.` | 10 |

## Mail — SPF (TXT)

| Type | Host | Value |
|------|------|-------|
| TXT | `@` | `v=spf1 mx a:mail.adam.uz -all` |

## Mail — DKIM (TXT)

Stalwart admin WebUI'da `Management → Domains → adam.uz → View DNS Zone file` ni oching. Generatsiya qilingan selector, host va public key'ni **aynan** DNS'ga ko'chiring:

| Type | Host | Value |
|------|------|-------|
| TXT | `<STALWART_SELECTOR>._domainkey` | `v=DKIM1;...p=<STALWART_PUBLIC_KEY>` |

Eski Mailcow DKIM yozuvini Stalwart shu selector bilan muvaffaqiyatli imzolayotgani tashqaridan tekshirilmaguncha o'chirmang. Selectorlar turlicha bo'lsa, rollback oynasida ikkala DKIM yozuvi birga turishi mumkin.

## Mail — DMARC (TXT)

| Type | Host | Value |
|------|------|-------|
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:postmaster@adam.uz; ruf=mailto:postmaster@adam.uz; fo=1` |

Cutoverdan oldin mavjud DMARC policy va reportlarni saqlang. Yangi server alignment'i tasdiqlanmaguncha policy'ni keskinlashtirmang.

## Mail — PTR / rDNS (provayder panelida, DNS zonada emas)

| IP | PTR |
|----|-----|
| `S3_IP` | `mail.adam.uz` |

Forward-confirmed reverse DNS shart: `mail.adam.uz → S3_IP` va `S3_IP → mail.adam.uz`.

## Client discovery

| Type | Host | Value |
|------|------|-------|
| CNAME | `autodiscover` | `mail.adam.uz.` |
| CNAME | `autoconfig` | `mail.adam.uz.` |
| SRV | `_autodiscover._tcp` | `0 0 443 mail.adam.uz.` |

Stalwart zone fayli qo'shimcha MTA-STS, TLS-RPT yoki boshqa yozuvlar chiqarsa, ularni ham providerga kiriting.

## Tekshirish

```bash
dig +short mail.adam.uz
dig +short webmail.adam.uz
dig +short MX adam.uz
dig +short TXT adam.uz
dig +short TXT _dmarc.adam.uz
dig +short TXT <STALWART_SELECTOR>._domainkey.adam.uz
dig +short -x S3_IP
```

So'ng tashqi SMTP delivery, DKIM signature, SPF/DMARC alignment va TLS'ni mail-tester hamda MXToolbox bilan tekshiring.
