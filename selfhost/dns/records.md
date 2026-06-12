# DNS yozuvlari — adam.uz

> O'zgartir: `S1_IP`=server1, `S2_IP`=server2, `S3_IP`=server3 (mail).
> Mail yozuvlari (MX/SPF/DKIM/DMARC/PTR) **birinchi** qo'shilsin — tarqalishi vaqt oladi.

## A records
| Type | Host | Value | Izoh |
|------|------|-------|------|
| A | `plane` | `S1_IP` | Plane |
| A | `docs` | `S1_IP` | Docmost |
| A | `gitlab` | `S2_IP` | GitLab |
| A | `mail` | `S3_IP` | Mailcow host |

## Mail — MX
| Type | Host | Value | Priority |
|------|------|-------|----------|
| MX | `@` (adam.uz) | `mail.adam.uz.` | 10 |

## Mail — SPF (TXT)
| Type | Host | Value |
|------|------|-------|
| TXT | `@` | `v=spf1 mx a:mail.adam.uz -all` |

## Mail — DKIM (TXT)
Mailcow paneldan generatsiya qilingach (server3 DEPLOY 4-qadam) shu yerga ko'chiring:
| Type | Host | Value |
|------|------|-------|
| TXT | `dkim._domainkey` | `v=DKIM1;k=rsa;p=<MAILCOW_DAN_OLINGAN_PUBLIC_KEY>` |

> Selector odatda `dkim` — Mailcow ko'rsatadi. Host = `<selector>._domainkey`.

## Mail — DMARC (TXT)
| Type | Host | Value |
|------|------|-------|
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:postmaster@adam.uz; ruf=mailto:postmaster@adam.uz; fo=1` |

## Mail — PTR / rDNS (provayder panelida, DNS zonada EMAS)
| IP | PTR |
|----|-----|
| `S3_IP` | `mail.adam.uz` |

> PTR'ni VPS provayder reverse-DNS bo'limida o'rnatasiz. Mailsiz 10/10 bo'lmaydi.

## Ixtiyoriy — autoconfig (klient avtomatik sozlash)
| Type | Host | Value |
|------|------|-------|
| CNAME | `autodiscover` | `mail.adam.uz.` |
| CNAME | `autoconfig` | `mail.adam.uz.` |
| SRV | `_autodiscover._tcp` | `0 0 443 mail.adam.uz.` |

## Tekshirish tartibi
1. A yozuvlar tarqaldimi: `dig +short plane.adam.uz` ...
2. MX: `dig +short MX adam.uz` → `mail.adam.uz`
3. SPF/DKIM/DMARC: https://mxtoolbox.com/SuperTool.aspx
4. PTR: `dig +short -x S3_IP` → `mail.adam.uz`
