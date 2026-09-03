# 📋 TODO


- [ ] 🟠 🔨 GitLab update'dan keyin AIBUS MR/CI full flowni ulash <!-- asana:1217763709533012 plane:8530fa41-294e-4846-9dde-61cf44445cce -->
- [ ] 🟠 🔨 Faza 0: fake/local adapterlarni REAL MCP ga almashtirish (`HERMES_MODE=real`) — prod creds kelganda:
    - Plane (Issue), GitLab (remote MR push), Docmost (release notes), Stalwart SMTP (notify), Pencil (design jonli)
- [ ] 🟠 🔨 hermesd dev stage REAL: `adapters/repo-git` → GitLab remote push + `glab` MR + CI; ladder merge gate real MR bilan (hozir MR-plan reasoning)
- [ ] 🟡 🔨 hermesd: Docmost release-notes REAL adapter (prod gate'da page yaratish) + Stalwart IMAP/JMAP email ingest (ikkilamchi signal)
- [ ] 🟢 🔨 Orchestrator hardening: hermes-run jonli gate'lar bilan to'liq e2e (PM→design→dev→QA→merge→staging→marketing)
