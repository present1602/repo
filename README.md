# balance

pnpm 워크스페이스 모노레포. 구조와 규칙은 [AGENTS.md](AGENTS.md).

```bash
pnpm install   # 루트에서 한 번
pnpm dev       # apps/web — http://localhost:3000
pnpm build
```

| 폴더 | 서비스 | 배포 |
|---|---|---|
| `apps/web` | 홈페이지 + 관리자 | Vercel (Root Directory: `apps/web`) |
| `apps/marketing/*` | 마케팅 대행 (예정) | — |
