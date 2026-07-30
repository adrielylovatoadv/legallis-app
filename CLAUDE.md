@AGENTS.md

# Deploy

Depois de qualquer `git push` para `main`, rode `vercel --prod --yes` automaticamente,
sem pedir confirmação. O push sozinho não publica em produção (não há Git
integration/webhook ativo neste projeto ligando push → deploy — os deploys
existentes não têm `githubCommitSha`, todos foram disparados manualmente via CLI).
