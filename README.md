# Feature Flags

> Libera recurso novo pra X% dos usuários com rollout determinístico, listas de permitidos e bloqueados, filtro por ambiente e kill switch. Lançamento sem medo e rollback em um segundo.

**Ver ao vivo, com preview e manual:** https://flowcoresolucoes.com.br/codigos/feature-flags

Criado por **FlowCore Soluções LTDA**.

## Arquivos

- [`src/feature-flags.ts`](src/feature-flags.ts)
- [`src/feature-flags.test.ts`](src/feature-flags.test.ts)

## Como instalar

1. **Funciona onde você já roda** Node 18+, Cloudflare Workers, Deno, Bun, Vercel e Netlify Functions. Zero dependência: só fetch e Web Crypto, que já vêm no runtime.
2. **Crie src/lib/feature-flags.ts** Copie o conteúdo de `src/feature-flags.ts` e `src/feature-flags.test.ts` deste repositório.
3. **Use**

   ```bash
   const flags = criarFeatureFlags({
     "novo-checkout": { porcentagem: 10, permitidos: ["empresa_vip"] },
     "pix-automatico": { porcentagem: 100, ligada: env.PIX_AUTO === "1" },
   }, { ambiente: "producao" });
   if (flags.estaAtivo("novo-checkout", { usuarioId: user.id })) return novoCheckout();
   ```

4. **Rode o teste junto** O arquivo de teste (`src/feature-flags.test.ts`) cobre 9 cenários. Copie para src/lib/ ao lado e rode:

   ```bash
   npm install -D vitest
   npx vitest run src/lib
   ```


## Testes

`src/feature-flags.test.ts` cobre 9 cenários.

```bash
npm install
npm test
```

## Licença

MIT. Pode usar em projeto pessoal ou comercial, de graça. A única condição é manter a linha **“Criado por FlowCore Soluções LTDA”** (ou o crédito de adaptação) onde ela está.

---

Precisa disso integrado no seu sistema? A [FlowCore](https://flowcoresolucoes.com.br) desenvolve sob medida.
