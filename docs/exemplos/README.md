# Exemplos de Arquivos

Pasta destinada a **arquivos de referência** que mostram como devem ser entregas/exports do sistema. Útil pra:

- Validar visualmente se o output gerado pelo código bate com o esperado.
- Servir de base para novos devs/equipe entenderem o formato.
- Comparar antes/depois quando alguém alterar o gerador.

## O que colocar aqui

| Tipo | Exemplos |
|---|---|
| Excel/XLSX | `book_linha_viva_REFERENCIA.xlsx`, `relatorio_checklist_REFERENCIA.xlsx` |
| PDF | `pdf_obra_REFERENCIA.pdf` |
| JSON | `obra_payload_REFERENCIA.json` (caso queira modelo de payload do banco) |
| CSV | exports de tabelas |

## Convenções

- **Nome do arquivo**: prefixo do tipo + `_REFERENCIA` + extensão. Ajuda a achar rápido.
- **Sem dados sensíveis**: se o exemplo vem de obra real, anonimizar (trocar nome do responsável, número da obra, etc.).
- **Comitar pequeno**: arquivos > 5MB evita — o git vai ficar inflado. Pra arquivos grandes, usa Git LFS ou só descreve o conteúdo num `.md`.
- **Acompanhar com `.md` de contexto**: pra cada exemplo, idealmente um `NOME.md` explicando o que ele representa e quando deve ser regenerado.

## Como usar

1. Salva o `.xlsx` de referência aqui (ex.: `book_linha_viva_REFERENCIA.xlsx`).
2. Quando alguém gerar um export novo do código, compara com este arquivo.
3. Se o formato mudou intencionalmente, atualiza o arquivo de referência.
4. Se mudou sem intenção, é um regression bug — investiga o código.
