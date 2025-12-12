# Organização do Repositório

`
obras-wise-mobile/
+-- mobile/              # App React Native
¦   +-- app/             # Telas e rotas (Expo Router)
¦   +-- lib/             # Supabase client, offline-sync, filas
¦   +-- assets/          # Ícones, fontes
+-- web/                 # Painel Next.js 16
¦   +-- src/app/         # App Router e páginas
¦   +-- src/components/  # UI compartilhada
¦   +-- src/lib/         # Supabase client (browser/server)
+-- supabase/            # Configurações do projeto Supabase
¦   +-- migrations/      # Scripts SQL versionados
+-- docs/                # Arquivos de documentação
+-- scripts/             # Scripts utilitários (SQL, limpeza, etc.)
+-- .expo/, .vscode/     # Configurações locais
+-- README.md            # Visão geral
`

O diretório ackend/ foi removido porque toda a lógica administrativa agora vive no painel Next.js e no Supabase.
