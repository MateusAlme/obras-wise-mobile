# Guia de Testes - ObrasWise

## Teste 1: App Mobile (Expo)
1. cd mobile && npm install (se necessário).
2. 
pm run start e abra o QR code no Expo Go.
3. Faça login com usuário válido do Supabase.
4. Cadastre uma obra fictícia com fotos e marque modo offline.
5. Volte para o dashboard e verifique se:
   - A obra aparece na lista local.
   - A fila de fotos mostra status "Sincronizada" após voltar ao online.
6. Confirme no Supabase (select * from obras order by created_at desc limit 1) que o registro chegou.

Checklist:
- [ ] Login realizado.
- [ ] Cadastro offline funciona.
- [ ] Upload das fotos finaliza sem erros.

## Teste 2: Painel Web (Next.js)
1. cd web && npm install.
2. Configure .env.local com NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_KEY.
3. 
pm run dev e acesse http://localhost:3000.
4. Faça login com o mesmo usuário usado no mobile.
5. Valide:
   - [ ] Listagem de obras exibe os dados recém cadastrados.
   - [ ] Filtros por equipe/data funcionam.
   - [ ] Visualização de fotos mostra as imagens do bucket.
   - [ ] Exportação/relatórios (se habilitados) geram arquivo sem erro.

## Teste 3: Supabase
1. supabase status para garantir conexão.
2. Rode supabase db diff para confirmar que não existem migrações pendentes.
3. Execute scripts em supabase/migrations caso seja um ambiente novo.

## Teste 4: Scripts utilitários
- scripts\database\aplicar-migration-usuarios.bat ? aplica seed de equipes/usuários.
- scripts\utils\limpar-duplicados.bat ? limpa diretórios duplicados antes de builds.

## Aprovação final
- [ ] Mobile enviado (expo start) e testado no dispositivo.
- [ ] Painel web rodando e apontando para Supabase correto.
- [ ] Banco sincronizado e com dados de teste removidos após validação.
