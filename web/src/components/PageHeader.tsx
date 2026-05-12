interface PageHeaderProps {
  icon: React.ReactNode
  title: string
  subtitle?: string
  /** Área de ações (botões) alinhada à direita */
  actions?: React.ReactNode
}

export default function PageHeader({ icon, title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex items-center gap-4">
        {/* Ícone com fundo gradiente */}
        <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg shadow-primary/20 text-white">
          {icon}
        </div>

        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="shrink-0 flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  )
}
