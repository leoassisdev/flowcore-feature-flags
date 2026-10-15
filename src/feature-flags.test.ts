// feature-flags.test.ts · Criado por FlowCore Soluções LTDA · flowcoresolucoes.com.br/codigos · licença MIT
import { describe, expect, it } from "vitest";
import { calcularBucket, criarFeatureFlags, fnv1a32 } from "./feature-flags";

const ids = Array.from({ length: 10_000 }, (_, i) => `usuario_${i}`);

describe("feature-flags", () => {
  it("FNV-1a 32 bits bate com os vetores oficiais", () => {
    expect(fnv1a32("")).toBe(0x811c9dc5);
    expect(fnv1a32("a")).toBe(0xe40c292c);
    expect(fnv1a32("foobar")).toBe(0xbf9cf968);
  });

  it("bucket é determinístico e fica entre 0 e 9999", () => {
    for (const id of ids.slice(0, 200)) {
      const b = calcularBucket("novo-checkout", id);
      expect(b).toBe(calcularBucket("novo-checkout", id));
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(10_000);
    }
  });

  it("distribui o rollout dentro da tolerância em 10 mil usuários", () => {
    const ff = criarFeatureFlags({ dez: { porcentagem: 10 }, metade: { porcentagem: 50 }, fino: { porcentagem: 2.5 } });
    const contar = (flag: string) => ids.filter((id) => ff.estaAtivo(flag, { usuarioId: id })).length;
    expect(Math.abs(contar("dez") - 1000)).toBeLessThan(150);
    expect(Math.abs(contar("metade") - 5000)).toBeLessThan(250);
    expect(Math.abs(contar("fino") - 250)).toBeLessThan(80);
  });

  it("aumentar o percentual só adiciona usuários (ninguém perde a flag)", () => {
    const de10 = criarFeatureFlags({ f: { porcentagem: 10 } });
    const de30 = criarFeatureFlags({ f: { porcentagem: 30 } });
    const grupo10 = ids.filter((id) => de10.estaAtivo("f", { usuarioId: id }));
    expect(grupo10.every((id) => de30.estaAtivo("f", { usuarioId: id }))).toBe(true);
  });

  it("flags diferentes sorteiam grupos independentes", () => {
    const ff = criarFeatureFlags({ a: { porcentagem: 50 }, b: { porcentagem: 50 } });
    const ambas = ids.filter((id) => ff.estaAtivo("a", { usuarioId: id }) && ff.estaAtivo("b", { usuarioId: id })).length;
    expect(Math.abs(ambas - 2500)).toBeLessThan(250);
  });

  it("permitidos e bloqueados vencem o percentual (bloqueio vence permissão)", () => {
    const ff = criarFeatureFlags({ beta: { porcentagem: 0, permitidos: ["vip", "ambos"], bloqueados: ["ruim", "ambos"] } });
    expect(ff.avaliar("beta", { usuarioId: "vip" })).toEqual({ ativo: true, motivo: "PERMITIDO" });
    expect(ff.avaliar("beta", { usuarioId: "ambos" })).toEqual({ ativo: false, motivo: "BLOQUEADO" });
    expect(ff.avaliar("beta", { usuarioId: "outro" })).toMatchObject({ ativo: false, motivo: "FORA_DO_ROLLOUT" });
    const total = criarFeatureFlags({ x: { porcentagem: 100, bloqueados: ["ruim"] } });
    expect(total.avaliar("x", { usuarioId: "ruim" }).ativo).toBe(false);
    expect(total.avaliar("x")).toEqual({ ativo: true, motivo: "ROLLOUT_TOTAL" });
  });

  it("filtra por ambiente", () => {
    const ff = criarFeatureFlags({ debug: { porcentagem: 100, ambientes: ["dev", "homolog"] } }, { ambiente: "producao" });
    expect(ff.avaliar("debug")).toEqual({ ativo: false, motivo: "AMBIENTE" });
    expect(ff.estaAtivo("debug", { ambiente: "homolog" })).toBe(true);
  });

  it("kill switch por flag e global", () => {
    const ff = criarFeatureFlags({ pix: { porcentagem: 100 }, boleto: { porcentagem: 100, ligada: false, permitidos: ["vip"] } });
    expect(ff.avaliar("boleto", { usuarioId: "vip" })).toEqual({ ativo: false, motivo: "KILL_SWITCH" });
    expect(ff.ativasPara({ usuarioId: "u" })).toEqual(["pix"]);
    ff.definirDesligarTudo(true);
    expect(ff.avaliar("pix")).toEqual({ ativo: false, motivo: "DESLIGADO_GLOBAL" });
    ff.definirDesligarTudo(false);
    expect(ff.estaAtivo("pix")).toBe(true);
  });

  it("flag desconhecida, sem usuário e configuração inválida", () => {
    const ff = criarFeatureFlags({ parcial: { porcentagem: 50 } });
    expect(ff.avaliar("nao-existe")).toEqual({ ativo: false, motivo: "FLAG_DESCONHECIDA" });
    expect(ff.avaliar("toString")).toEqual({ ativo: false, motivo: "FLAG_DESCONHECIDA" });
    expect(ff.avaliar("parcial")).toEqual({ ativo: false, motivo: "SEM_USUARIO" });
    expect(() => criarFeatureFlags({ x: { porcentagem: 120 } })).toThrow("entre 0 e 100");
  });
});
