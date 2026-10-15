// feature-flags.ts · Criado por FlowCore Soluções LTDA · flowcoresolucoes.com.br/codigos · licença MIT
// Feature flags sem SaaS: liga recurso novo pra X% dos usuários (rollout
// gradual e determinístico: o mesmo usuário sempre cai no mesmo grupo),
// lista de permitidos (beta/clientes VIP) e bloqueados, filtro por ambiente
// (dev/homolog/produção) e kill switch por flag ou global pra desligar na hora.
// Roda em Node 18+, Cloudflare Workers, Deno, Bun e no navegador.
// Zero dependências.
//
// Referência: hash FNV-1a 32 bits (Fowler–Noll–Vo, IETF draft-eastlake-fnv)
// usado pra bucketing estável de 0 a 9999 (precisão de 0,01%).

export const CRIADO_POR = "Criado por FlowCore Soluções LTDA";

export type DefinicaoFlag = {
  /** Kill switch: false desliga a flag pra todo mundo, ignorando o resto. Padrão true. */
  ligada?: boolean;
  /** Percentual do rollout (0 a 100, aceita decimais como 2.5). Padrão 0. */
  porcentagem?: number;
  /** IDs que sempre recebem a flag (time interno, clientes beta). */
  permitidos?: string[];
  /** IDs que nunca recebem (vence os permitidos). */
  bloqueados?: string[];
  /** Ambientes onde a flag pode ligar. Vazio/ausente = todos. */
  ambientes?: string[];
  descricao?: string;
};

export type ContextoFlag = {
  /** ID estável do usuário, conta ou empresa (é o que define o grupo do rollout). */
  usuarioId?: string;
  /** Sobrescreve o ambiente padrão do cliente. */
  ambiente?: string;
};

export type MotivoFlag =
  | "FLAG_DESCONHECIDA"
  | "DESLIGADO_GLOBAL"
  | "KILL_SWITCH"
  | "AMBIENTE"
  | "BLOQUEADO"
  | "PERMITIDO"
  | "ROLLOUT_TOTAL"
  | "SEM_USUARIO"
  | "DENTRO_DO_ROLLOUT"
  | "FORA_DO_ROLLOUT";

export type AvaliacaoFlag = { ativo: boolean; motivo: MotivoFlag; bucket?: number };

const enc = new TextEncoder();

/** FNV-1a 32 bits sobre os bytes UTF-8. Retorna inteiro sem sinal. */
export function fnv1a32(texto: string): number {
  let h = 0x811c9dc5;
  const bytes = enc.encode(texto);
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Grupo estável de 0 a 9999 pra (flag, usuário). Mudar o nome da flag embaralha os grupos. */
export function calcularBucket(flag: string, usuarioId: string): number {
  return fnv1a32(`${flag}:${usuarioId}`) % 10_000;
}

export function criarFeatureFlags(
  flags: Record<string, DefinicaoFlag>,
  opcoes: { ambiente?: string; desligarTudo?: boolean } = {},
) {
  for (const [nome, f] of Object.entries(flags)) {
    const p = f.porcentagem ?? 0;
    if (!Number.isFinite(p) || p < 0 || p > 100) throw new Error(`Flag "${nome}": porcentagem precisa estar entre 0 e 100`);
  }
  let desligarTudo = opcoes.desligarTudo ?? false;

  function avaliar(nome: string, ctx: ContextoFlag = {}): AvaliacaoFlag {
    const f = Object.prototype.hasOwnProperty.call(flags, nome) ? flags[nome] : undefined;
    if (!f) return { ativo: false, motivo: "FLAG_DESCONHECIDA" };
    if (desligarTudo) return { ativo: false, motivo: "DESLIGADO_GLOBAL" };
    if (f.ligada === false) return { ativo: false, motivo: "KILL_SWITCH" };
    const ambiente = ctx.ambiente ?? opcoes.ambiente;
    if (f.ambientes?.length && (!ambiente || !f.ambientes.includes(ambiente))) return { ativo: false, motivo: "AMBIENTE" };
    const id = ctx.usuarioId;
    if (id && f.bloqueados?.includes(id)) return { ativo: false, motivo: "BLOQUEADO" };
    if (id && f.permitidos?.includes(id)) return { ativo: true, motivo: "PERMITIDO" };
    const pct = f.porcentagem ?? 0;
    if (pct >= 100) return { ativo: true, motivo: "ROLLOUT_TOTAL" };
    if (!id) return { ativo: false, motivo: "SEM_USUARIO" };
    const bucket = calcularBucket(nome, id);
    return bucket < Math.round(pct * 100)
      ? { ativo: true, motivo: "DENTRO_DO_ROLLOUT", bucket }
      : { ativo: false, motivo: "FORA_DO_ROLLOUT", bucket };
  }

  return {
    avaliar,
    estaAtivo: (nome: string, ctx: ContextoFlag = {}) => avaliar(nome, ctx).ativo,
    /** Todas as flags ativas pro contexto (útil pra mandar pro front numa só chamada). */
    ativasPara(ctx: ContextoFlag = {}): string[] {
      return Object.keys(flags).filter((n) => avaliar(n, ctx).ativo);
    },
    /** Kill switch global (incidente): desliga todas as flags até religar. */
    definirDesligarTudo(valor: boolean) {
      desligarTudo = valor;
    },
  };
}
