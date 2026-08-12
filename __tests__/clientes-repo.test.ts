/**
 * Regressão: editar um cliente (mesmo sem tocar em senha/dados bancários) não pode
 * apagar senha_gov, senha_serasa, conta ou chave_pix já cadastrados. A listagem de
 * clientes omite esses campos por segurança, então o formulário de edição os manda
 * de volta como "" — o repo precisa tratar isso como "não alterado", não "apagar".
 */
import * as clientesRepo from "@/lib/repo/clientes";
import type { Cliente } from "@/lib/controle-data";

const TENANT = `test-tenant-senha-fix-${Date.now()}`;

async function criarCliente(overrides: Partial<Omit<Cliente, "id" | "criado_em">> = {}) {
  return clientesRepo.create(TENANT, {
    nome: "Cliente Teste", telefone: "", cpf: "", email: "", endereco: "",
    tipo_aposentadoria: "", informacoes: "",
    senha_gov: "segredoGov123", senha_serasa: "segredoSerasa456",
    conta: "12345-6", chave_pix: "pix@teste.com",
    ...overrides,
  });
}

afterEach(async () => {
  const restantes = await clientesRepo.list(TENANT);
  for (const c of restantes) await clientesRepo.remove(TENANT, c.id);
});

test("editar outro campo não apaga senha_gov/senha_serasa já cadastradas", async () => {
  const cliente = await criarCliente();

  // Simula o que o formulário de edição envia hoje: todos os campos, com os sensíveis
  // em branco porque a listagem nunca os retornou.
  await clientesRepo.update(TENANT, cliente.id, {
    nome: "Cliente Teste Editado",
    senha_gov: "",
    senha_serasa: "",
  });

  const atualizado = await clientesRepo.get(TENANT, cliente.id);
  expect(atualizado?.nome).toBe("Cliente Teste Editado");
  expect(atualizado?.senha_gov).toBe("segredoGov123");
  expect(atualizado?.senha_serasa).toBe("segredoSerasa456");
});

test("editar outro campo não apaga conta/chave_pix já cadastradas", async () => {
  const cliente = await criarCliente();

  await clientesRepo.update(TENANT, cliente.id, {
    nome: "Outro Nome",
    conta: "",
    chave_pix: "",
  });

  const atualizado = await clientesRepo.get(TENANT, cliente.id);
  expect(atualizado?.conta).toBe("12345-6");
  expect(atualizado?.chave_pix).toBe("pix@teste.com");
});

test("enviar uma nova senha de fato ainda substitui a antiga", async () => {
  const cliente = await criarCliente();

  await clientesRepo.update(TENANT, cliente.id, { senha_gov: "novaSenhaGov789" });

  const atualizado = await clientesRepo.get(TENANT, cliente.id);
  expect(atualizado?.senha_gov).toBe("novaSenhaGov789");
});

test("cliente sem senha cadastrada continua sem senha após edição em branco", async () => {
  const cliente = await criarCliente({ senha_gov: "", senha_serasa: "" });

  await clientesRepo.update(TENANT, cliente.id, { nome: "Sem Senha Editado", senha_gov: "" });

  const atualizado = await clientesRepo.get(TENANT, cliente.id);
  expect(atualizado?.senha_gov).toBe("");
});
