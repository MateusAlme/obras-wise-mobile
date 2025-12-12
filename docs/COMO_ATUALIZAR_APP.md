# Como Atualizar o App Mobile

## Hot Reload (rápido)
- Se o Expo já estiver rodando, pressione  ou Shift + r no terminal.
- No celular, sacuda o aparelho (Android) ou use Cmd + D (iOS) e toque em Reload.

## Reiniciar o servidor Expo
Use quando alterar pp.json, instalar libs ou o app ficar estranho.
`powershell
cd mobile
npx expo start --clear
`

## Limpeza completa
`powershell
cd mobile
npx expo start --clear
rm -rf node_modules
npm install
npx expo start --clear --reset-cache
`

## Atualizações específicas
- UI/código: hot reload já resolve.
- pp.json: reinicie com --clear.
- Novas libs: reinstale dependências (
pm install) e reinicie.
- Fotos/qualidade: basta um reload.

## Aplicando as mudanças de hoje (exemplo)
Alterações:
- mobile/app/nova-obra.tsx (qualidade das fotos)
- Componentes de preview no painel web (Next.js)

### Mobile
`powershell
cd mobile
npx expo start --clear
`
Teste o fluxo de fotos.

### Painel Web
`powershell
cd web
npm install
npm run dev
`
Acesse http://localhost:3000 e valide o preview.

## Solução de problemas
- "Metro bundler error": 
px expo start --clear --reset-cache
- "Unable to resolve module": delete 
ode_modules, rode 
pm install e reinicie.
- QR Code não funciona: use 
px expo start --tunnel.

## Checklist
- [ ] Servidor Expo reiniciado (
px expo start --clear).
- [ ] QR Code testado no celular.
- [ ] Funcionalidade alterada validada.
- [ ] Painel web recarregado e sincronizado.

## Dicas
- Use rede Wi-Fi estável.
- Mantenha o terminal aberto para ver logs.
- Limpe cache sempre que fizer mudanças grandes.
