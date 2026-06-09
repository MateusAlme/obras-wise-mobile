# Auditoria de Colunas da Tabela obras

Gerado em: 2026-02-21T00:38:47.616Z

## Resumo

- Colunas ativas na tabela obras (via migrations): **78**
- Colunas com uso no app (mobile/web/functions): **78**
- Colunas sem uso no app: **0**
- Colunas sem uso no app nem manutencao/scripts: **0**

## Colunas sem uso no app (candidatas a revisao)

| Coluna | Uso em manutencao/scripts | Adicionada em |
|---|---:|---|

## Todas as colunas ativas

| Coluna | App | Manutencao | Exemplo app |
|---|---:|---:|---|
| atipicidades | 4 | 0 | web/src/lib/pdf-generator.ts |
| checklist_aterramentos_cerca_data | 5 | 15 | mobile/app/nova-obra.tsx |
| checklist_hastes_termometros_data | 5 | 18 | mobile/app/nova-obra.tsx |
| checklist_postes_data | 6 | 15 | mobile/app/nova-obra.tsx |
| checklist_seccionamentos_data | 5 | 18 | mobile/app/nova-obra.tsx |
| created_at | 16 | 18 | mobile/app/cava-rocha.tsx |
| created_by | 3 | 0 | mobile/app/cava-rocha.tsx |
| created_by_admin | 3 | 0 | mobile/app/nova-obra.tsx |
| creator_role | 7 | 1 | mobile/app/cava-rocha.tsx |
| data | 37 | 34 | mobile/app/cava-rocha.tsx |
| data_abertura | 3 | 0 | mobile/app/nova-obra.tsx |
| data_fechamento | 4 | 1 | mobile/app/nova-obra.tsx |
| descricao_atipicidade | 3 | 0 | web/src/lib/supabase.ts |
| doc_apr | 10 | 0 | mobile/app/cava-rocha.tsx |
| doc_autorizacao_passagem | 6 | 1 | mobile/app/cava-rocha.tsx |
| doc_cadastro_medidor | 10 | 0 | mobile/app/cava-rocha.tsx |
| doc_fvbt | 10 | 0 | mobile/app/cava-rocha.tsx |
| doc_laudo_regulador | 10 | 0 | mobile/app/cava-rocha.tsx |
| doc_laudo_religador | 10 | 0 | mobile/app/cava-rocha.tsx |
| doc_laudo_transformador | 10 | 0 | mobile/app/cava-rocha.tsx |
| doc_materiais_previsto | 2 | 0 | mobile/app/nova-obra.tsx |
| doc_materiais_realizado | 2 | 0 | mobile/app/nova-obra.tsx |
| doc_termo_desistencia_lpt | 10 | 1 | mobile/app/cava-rocha.tsx |
| equipe | 31 | 10 | mobile/app/cava-rocha.tsx |
| finalizada_em | 4 | 3 | mobile/app/obra-detalhe.tsx |
| fotos_abertura | 12 | 3 | mobile/app/cava-rocha.tsx |
| fotos_altimetria_lado_carga | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_altimetria_lado_fonte | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_altimetria_medicao_carga | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_altimetria_medicao_fonte | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_antes | 13 | 5 | mobile/app/cava-rocha.tsx |
| fotos_aterramento_hastes | 12 | 2 | mobile/app/cava-rocha.tsx |
| fotos_aterramento_medicao | 12 | 2 | mobile/app/cava-rocha.tsx |
| fotos_aterramento_vala_aberta | 12 | 2 | mobile/app/cava-rocha.tsx |
| fotos_aterramento_vala_fechada | 12 | 2 | mobile/app/cava-rocha.tsx |
| fotos_checklist_abertura_fechamento_pulo | 7 | 0 | mobile/app/nova-obra.tsx |
| fotos_checklist_frying | 7 | 0 | mobile/app/nova-obra.tsx |
| fotos_checklist_hastes_aplicadas | 2 | 2 | web/src/lib/supabase.ts |
| fotos_checklist_medicao_termometro | 2 | 2 | web/src/lib/supabase.ts |
| fotos_depois | 13 | 5 | mobile/app/cava-rocha.tsx |
| fotos_ditais_abertura | 12 | 2 | mobile/app/cava-rocha.tsx |
| fotos_ditais_aterrar | 12 | 2 | mobile/app/cava-rocha.tsx |
| fotos_ditais_impedir | 12 | 2 | mobile/app/cava-rocha.tsx |
| fotos_ditais_sinalizar | 12 | 2 | mobile/app/cava-rocha.tsx |
| fotos_ditais_testar | 12 | 2 | mobile/app/cava-rocha.tsx |
| fotos_durante | 13 | 5 | mobile/app/cava-rocha.tsx |
| fotos_fechamento | 12 | 3 | mobile/app/cava-rocha.tsx |
| fotos_transformador_antes_retirar | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_transformador_componente_instalado | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_transformador_instalado | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_transformador_laudo | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_transformador_placa_instalado | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_transformador_placa_retirado | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_transformador_tape | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_transformador_tombamento_instalado | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_transformador_tombamento_retirado | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_vazamento_equipamentos_limpeza | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_vazamento_evidencia | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_vazamento_instalacao | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_vazamento_placa_instalado | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_vazamento_placa_retirado | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_vazamento_tombamento_instalado | 10 | 2 | mobile/app/cava-rocha.tsx |
| fotos_vazamento_tombamento_retirado | 10 | 2 | mobile/app/cava-rocha.tsx |
| id | 31 | 37 | mobile/app/cava-rocha.tsx |
| obra | 27 | 40 | mobile/app/cava-rocha.tsx |
| observacoes | 4 | 3 | mobile/lib/offline-sync.ts |
| postes_data | 4 | 0 | mobile/app/cava-rocha.tsx |
| responsavel | 12 | 6 | mobile/app/cava-rocha.tsx |
| status | 23 | 12 | mobile/app/cava-rocha.tsx |
| tem_atipicidade | 5 | 3 | web/src/lib/supabase.ts |
| tipo_servico | 14 | 9 | mobile/app/cava-rocha.tsx |
| transformador_conexoes_primarias_instalado | 4 | 1 | mobile/app/nova-obra.tsx |
| transformador_conexoes_primarias_retirado | 4 | 1 | mobile/app/nova-obra.tsx |
| transformador_conexoes_secundarias_instalado | 4 | 1 | mobile/app/nova-obra.tsx |
| transformador_conexoes_secundarias_retirado | 4 | 1 | mobile/app/nova-obra.tsx |
| transformador_status | 5 | 2 | mobile/app/nova-obra.tsx |
| updated_at | 8 | 5 | mobile/app/(tabs)/obras.tsx |
| user_id | 3 | 6 | mobile/app/nova-obra.tsx |

## Observacoes

- Este levantamento e estatico (busca textual por nome de coluna).
- Colunas com nomes muito genericos (ex.: status, data, id) podem aparecer por outros motivos no codigo.
- Antes de remover coluna, valide tambem com dados reais e queries no banco.