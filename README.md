# Lumus — Branddi Monitor

Suite interna com duas ferramentas:

1. **Relatório Brand Bidding** — wizard de 3 passos com IA analisando os gráficos automaticamente
2. **Resumo de Tratativa** — gera resumo de cards do Pipefy via IA

## Como rodar

```bash
npm install
# crie .env.local com GEMINI_API_KEY=AIza...
npm run dev
```

## Deploy na Vercel

Importe o repo e adicione `GEMINI_API_KEY` em Environment Variables.
A chave é gratuita: https://aistudio.google.com/apikey
